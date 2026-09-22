const request = require("supertest");
const crypto = require("crypto");

// Set env vars before requiring modules
process.env.SHOPIFY_API_SECRET = "test_shopify_secret";
process.env.SHOPIFY_ACCESS_TOKEN = "test_shopify_access_token";
process.env.SHOPIFY_API_KEY = "test_shopify_key";
process.env.SHOPIFY_WEBHOOK_SECRET = "test_webhook_secret_123";
process.env.RESEND_API_KEY = "re_test_fake_key";

// Mock node-fetch
jest.mock("node-fetch", () => {
  const mockFetch = jest.fn();
  mockFetch.__esModule = true;
  return mockFetch;
});

const fetch = require("node-fetch");
const { createApp } = require("../src/app");
const { setResendClient } = require("../src/email");

// Mock Resend
const mockSend = jest.fn().mockResolvedValue({ data: { id: "email_test" } });
setResendClient({ emails: { send: mockSend } });

const app = createApp();

// ─── Helpers ───

function signPayload(body) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(body), "utf8")
    .digest("base64");
  return hmac;
}

function mockGraphQLResponses(responses) {
  let callIndex = 0;
  fetch.mockImplementation((url) => {
    if (url.includes("graphql.json")) {
      const response = responses[callIndex] || responses[responses.length - 1];
      callIndex++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(response),
      });
    }
    return Promise.resolve({ ok: true, text: () => Promise.resolve("OK") });
  });
}

beforeEach(() => {
  fetch.mockReset();
});

// ─── Unit tests for ordersWebhook internals ───

const { _internal } = require("../src/ordersWebhook");

describe("ordersWebhook internals", () => {
  describe("extractCustomerId", () => {
    it("extracts numeric customer id", () => {
      expect(_internal.extractCustomerId({ customer: { id: 12345 } })).toBe("12345");
    });

    it("extracts GID format customer id", () => {
      expect(
        _internal.extractCustomerId({ customer: { id: "gid://shopify/Customer/67890" } })
      ).toBe("67890");
    });

    it("returns null when no customer", () => {
      expect(_internal.extractCustomerId({})).toBeNull();
    });

    it("returns null when customer has no id", () => {
      expect(_internal.extractCustomerId({ customer: {} })).toBeNull();
    });
  });

  describe("buildPurchaseItems", () => {
    it("builds items from order line items", () => {
      const order = {
        id: 1001,
        created_at: "2026-09-22T10:30:00+02:00",
        line_items: [
          { title: "Marmitta Akrapovic", price: "299.00" },
          { title: "Variatore Malossi", price: "189.50" },
        ],
      };
      const items = _internal.buildPurchaseItems(order);
      expect(items).toEqual([
        { product: "Marmitta Akrapovic", date: "2026-09-22", order_id: "1001", price: "299.00" },
        { product: "Variatore Malossi", date: "2026-09-22", order_id: "1001", price: "189.50" },
      ]);
    });

    it("handles empty line_items", () => {
      expect(_internal.buildPurchaseItems({ id: 999, line_items: [] })).toEqual([]);
    });

    it("handles missing line_items", () => {
      expect(_internal.buildPurchaseItems({ id: 999 })).toEqual([]);
    });

    it("falls back to today's date if created_at is missing", () => {
      const items = _internal.buildPurchaseItems({
        id: 999,
        line_items: [{ title: "Test", price: "10.00" }],
      });
      expect(items[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("uses order_number as fallback for order_id", () => {
      const items = _internal.buildPurchaseItems({
        order_number: 5555,
        line_items: [{ title: "Test", price: "10.00" }],
      });
      expect(items[0].order_id).toBe("5555");
    });
  });

  describe("parseAcquisti", () => {
    it("parses valid JSON array", () => {
      const result = _internal.parseAcquisti('[{"product":"Test","price":"10.00"}]');
      expect(result).toEqual([{ product: "Test", price: "10.00" }]);
    });

    it("returns empty array for null", () => {
      expect(_internal.parseAcquisti(null)).toEqual([]);
    });

    it("returns empty array for empty string", () => {
      expect(_internal.parseAcquisti("")).toEqual([]);
    });

    it("returns empty array for invalid JSON", () => {
      expect(_internal.parseAcquisti("not json")).toEqual([]);
    });

    it("returns empty array for JSON that is not an array", () => {
      expect(_internal.parseAcquisti('{"key": "value"}')).toEqual([]);
    });
  });
});

// ─── Integration tests: POST /webhooks/orders/paid ───

describe("POST /webhooks/orders/paid", () => {
  const baseOrder = {
    id: 1001,
    order_number: 1001,
    created_at: "2026-09-22T10:30:00+02:00",
    customer: { id: 67890 },
    email: "mario@example.com",
    line_items: [
      { title: "Marmitta Akrapovic", price: "299.00" },
      { title: "Cinghia di trasmissione", price: "45.00" },
    ],
    total_price: "344.00",
  };

  it("skips when no customer ID", async () => {
    const order = { ...baseOrder, customer: {} };
    const hmac = signPayload(order);

    const res = await request(app)
      .post("/webhooks/orders/paid")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(order);

    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(true);
    expect(res.body.reason).toContain("No customer ID");
  });

  it("skips when no line items", async () => {
    const order = { ...baseOrder, line_items: [] };
    const hmac = signPayload(order);

    const res = await request(app)
      .post("/webhooks/orders/paid")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(order);

    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(true);
    expect(res.body.reason).toContain("No line items");
  });

  it("updates existing garage with acquisti", async () => {
    const existingAcquisti = [
      { product: "Filtro aria", date: "2026-09-01", order_id: "900", price: "35.00" },
    ];

    mockGraphQLResponses([
      // getGarageByHandle — found existing
      {
        data: {
          metaobjectByHandle: {
            id: "gid://shopify/Metaobject/12345",
            handle: "garage-67890",
            fields: [
              { key: "cliente", value: "67890" },
              { key: "acquisti", value: JSON.stringify(existingAcquisti) },
            ],
          },
        },
      },
      // metaobjectUpdate — success
      {
        data: {
          metaobjectUpdate: {
            metaobject: { id: "gid://shopify/Metaobject/12345", handle: "garage-67890" },
            userErrors: [],
          },
        },
      },
    ]);

    const hmac = signPayload(baseOrder);
    const res = await request(app)
      .post("/webhooks/orders/paid")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(baseOrder);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.action).toBe("updated");
    expect(res.body.items_added).toBe(2);
    expect(res.body.total_items).toBe(3); // 1 existing + 2 new

    // Verify the update call sent correct acquisti
    const graphqlCalls = fetch.mock.calls.filter((c) => c[0].includes("graphql.json"));
    expect(graphqlCalls.length).toBe(2);
    const updateBody = JSON.parse(graphqlCalls[1][1].body);
    const acquistiFld = updateBody.variables.metaobject.fields.find((f) => f.key === "acquisti");
    const parsedAcquisti = JSON.parse(acquistiFld.value);
    expect(parsedAcquisti).toHaveLength(3);
    expect(parsedAcquisti[0].product).toBe("Filtro aria");
    expect(parsedAcquisti[1].product).toBe("Marmitta Akrapovic");
    expect(parsedAcquisti[2].product).toBe("Cinghia di trasmissione");
  });

  it("creates new garage when none exists", async () => {
    mockGraphQLResponses([
      // getGarageByHandle — not found
      { data: { metaobjectByHandle: null } },
      // metaobjectUpsert — created
      {
        data: {
          metaobjectUpsert: {
            metaobject: { id: "gid://shopify/Metaobject/99999", handle: "garage-67890" },
            userErrors: [],
          },
        },
      },
    ]);

    const hmac = signPayload(baseOrder);
    const res = await request(app)
      .post("/webhooks/orders/paid")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(baseOrder);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.action).toBe("created");
    expect(res.body.items_added).toBe(2);
    expect(res.body.total_items).toBe(2);

    // Verify the upsert call
    const graphqlCalls = fetch.mock.calls.filter((c) => c[0].includes("graphql.json"));
    expect(graphqlCalls.length).toBe(2);
    const upsertBody = JSON.parse(graphqlCalls[1][1].body);
    expect(upsertBody.variables.handle.handle).toBe("garage-67890");
    const clienteField = upsertBody.variables.metaobject.fields.find((f) => f.key === "cliente");
    expect(clienteField.value).toBe("gid://shopify/Customer/67890");
  });

  it("handles existing garage with no acquisti field", async () => {
    mockGraphQLResponses([
      // getGarageByHandle — found but no acquisti field
      {
        data: {
          metaobjectByHandle: {
            id: "gid://shopify/Metaobject/12345",
            handle: "garage-67890",
            fields: [
              { key: "cliente", value: "67890" },
              { key: "anno", value: "2022" },
            ],
          },
        },
      },
      // metaobjectUpdate
      {
        data: {
          metaobjectUpdate: {
            metaobject: { id: "gid://shopify/Metaobject/12345", handle: "garage-67890" },
            userErrors: [],
          },
        },
      },
    ]);

    const hmac = signPayload(baseOrder);
    const res = await request(app)
      .post("/webhooks/orders/paid")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(baseOrder);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.action).toBe("updated");
    expect(res.body.items_added).toBe(2);
    expect(res.body.total_items).toBe(2); // 0 existing + 2 new
  });

  it("handles GID format customer id", async () => {
    const order = {
      ...baseOrder,
      customer: { id: "gid://shopify/Customer/11111" },
    };

    mockGraphQLResponses([
      { data: { metaobjectByHandle: null } },
      {
        data: {
          metaobjectUpsert: {
            metaobject: { id: "gid://shopify/Metaobject/55555", handle: "garage-11111" },
            userErrors: [],
          },
        },
      },
    ]);

    const hmac = signPayload(order);
    const res = await request(app)
      .post("/webhooks/orders/paid")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(order);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const graphqlCalls = fetch.mock.calls.filter((c) => c[0].includes("graphql.json"));
    const firstBody = JSON.parse(graphqlCalls[0][1].body);
    expect(firstBody.variables.handle.handle).toBe("garage-11111");
  });

  it("rejects requests without HMAC", async () => {
    const res = await request(app)
      .post("/webhooks/orders/paid")
      .send(baseOrder);

    expect(res.status).toBe(401);
  });

  it("rejects requests with invalid HMAC", async () => {
    const res = await request(app)
      .post("/webhooks/orders/paid")
      .set("X-Shopify-Hmac-Sha256", "invalidhmacvalue==")
      .send(baseOrder);

    expect(res.status).toBe(401);
  });

  it("returns 500 on Shopify API error", async () => {
    fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            errors: [{ message: "Access denied" }],
          }),
      })
    );

    const hmac = signPayload(baseOrder);
    const res = await request(app)
      .post("/webhooks/orders/paid")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(baseOrder);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to process order paid webhook");
  });
});

// ─── GET /garage/:customer_id — acquisti in response ───

describe("GET /garage/:customer_id with acquisti", () => {
  it("returns parsed acquisti array", async () => {
    const acquisti = [
      { product: "Marmitta Akrapovic", date: "2026-09-22", order_id: "1001", price: "299.00" },
    ];

    mockGraphQLResponses([
      {
        data: {
          metaobjectByHandle: {
            id: "gid://shopify/Metaobject/12345",
            handle: "garage-67890",
            fields: [
              { key: "cliente", value: "67890", reference: null },
              { key: "anno", value: "2022", reference: null },
              { key: "acquisti", value: JSON.stringify(acquisti), reference: null },
            ],
          },
        },
      },
    ]);

    const res = await request(app).get("/garage/67890");

    expect(res.status).toBe(200);
    expect(res.body.garage.acquisti).toEqual(acquisti);
    expect(Array.isArray(res.body.garage.acquisti)).toBe(true);
  });

  it("returns empty array when acquisti field is missing", async () => {
    mockGraphQLResponses([
      {
        data: {
          metaobjectByHandle: {
            id: "gid://shopify/Metaobject/12345",
            handle: "garage-67890",
            fields: [
              { key: "cliente", value: "67890", reference: null },
              { key: "anno", value: "2022", reference: null },
            ],
          },
        },
      },
    ]);

    const res = await request(app).get("/garage/67890");

    expect(res.status).toBe(200);
    expect(res.body.garage.acquisti).toEqual([]);
  });

  it("returns empty array when acquisti field has invalid JSON", async () => {
    mockGraphQLResponses([
      {
        data: {
          metaobjectByHandle: {
            id: "gid://shopify/Metaobject/12345",
            handle: "garage-67890",
            fields: [
              { key: "cliente", value: "67890", reference: null },
              { key: "acquisti", value: "not valid json", reference: null },
            ],
          },
        },
      },
    ]);

    const res = await request(app).get("/garage/67890");

    expect(res.status).toBe(200);
    expect(res.body.garage.acquisti).toEqual([]);
  });

  it("returns empty array when acquisti field is null", async () => {
    mockGraphQLResponses([
      {
        data: {
          metaobjectByHandle: {
            id: "gid://shopify/Metaobject/12345",
            handle: "garage-67890",
            fields: [
              { key: "cliente", value: "67890", reference: null },
              { key: "acquisti", value: null, reference: null },
            ],
          },
        },
      },
    ]);

    const res = await request(app).get("/garage/67890");

    expect(res.status).toBe(200);
    expect(res.body.garage.acquisti).toEqual([]);
  });
});
