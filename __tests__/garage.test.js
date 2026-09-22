const request = require("supertest");
const path = require("path");

// Set env vars before requiring modules
process.env.SHOPIFY_API_SECRET = "test_shopify_secret";
process.env.SHOPIFY_ACCESS_TOKEN = "test_shopify_secret";
process.env.SHOPIFY_API_KEY = "test_shopify_key";
process.env.SHOPIFY_WEBHOOK_SECRET = "test_webhook_secret_123";
process.env.RESEND_API_KEY = "re_test_fake_key";

// Mock node-fetch before requiring garage
jest.mock("node-fetch", () => {
  const mockFetch = jest.fn();
  mockFetch.__esModule = true;
  return mockFetch;
});

const fetch = require("node-fetch");
const { createApp } = require("../src/app");
const { setResendClient } = require("../src/email");

// Mock Resend so app.js doesn't fail
const mockSend = jest.fn().mockResolvedValue({ data: { id: "email_test" } });
setResendClient({ emails: { send: mockSend } });

const app = createApp();

// ─── Helpers ───

function mockGraphQLResponses(responses) {
  let callIndex = 0;
  fetch.mockImplementation((url, opts) => {
    // GraphQL call
    if (url.includes("graphql.json")) {
      const response = responses[callIndex] || responses[responses.length - 1];
      callIndex++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(response),
      });
    }
    // Staged upload target (file upload to external URL)
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve("OK"),
    });
  });
}

beforeEach(() => {
  fetch.mockReset();
});

// ─── POST /garage/save ───

describe("POST /garage/save", () => {
  it("returns 400 if customer_id is missing", async () => {
    const res = await request(app)
      .post("/garage/save")
      .field("anno", "2020");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("customer_id is required");
  });

  it("saves garage data without photo", async () => {
    mockGraphQLResponses([
      // metaobjectUpsert response
      {
        data: {
          metaobjectUpsert: {
            metaobject: {
              id: "gid://shopify/Metaobject/12345",
              handle: "garage-67890",
            },
            userErrors: [],
          },
        },
      },
    ]);

    const res = await request(app)
      .post("/garage/save")
      .field("customer_id", "67890")
      .field("anno", "2022")
      .field("cilindrata", "530")
      .field("modello", "T-Max 530")
      .field("modifiche", "Marmitta Akrapovic");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.metaobject_id).toBe("gid://shopify/Metaobject/12345");

    // Only 1 GraphQL call (metaobject upsert, no file upload)
    const graphqlCalls = fetch.mock.calls.filter((c) =>
      c[0].includes("graphql.json")
    );
    expect(graphqlCalls.length).toBe(1);

    // Check the mutation was called with correct variables
    const body = JSON.parse(graphqlCalls[0][1].body);
    expect(body.variables.handle.handle).toBe("garage-67890");
    expect(body.variables.handle.type).toBe("veicolo_garage");
    expect(body.variables.metaobject.fields).toEqual(
      expect.arrayContaining([
        { key: "cliente", value: "gid://shopify/Customer/67890" },
        { key: "anno", value: "2022" },
        { key: "cilindrata", value: "530" },
        { key: "modello", value: "T-Max 530" },
        { key: "modifiche", value: "Marmitta Akrapovic" },
      ])
    );
  });

  it("saves garage data with photo upload", async () => {
    mockGraphQLResponses([
      // stagedUploadsCreate response
      {
        data: {
          stagedUploadsCreate: {
            stagedTargets: [
              {
                url: "https://shopify-staged.s3.amazonaws.com/upload",
                resourceUrl: "https://shopify-staged.s3.amazonaws.com/tmp/file.jpg",
                parameters: [
                  { name: "key", value: "tmp/file.jpg" },
                  { name: "Content-Type", value: "image/jpeg" },
                ],
              },
            ],
            userErrors: [],
          },
        },
      },
      // fileCreate response
      {
        data: {
          fileCreate: {
            files: [
              {
                id: "gid://shopify/MediaImage/99999",
                alt: "Garage photo",
              },
            ],
            userErrors: [],
          },
        },
      },
      // metaobjectUpsert response
      {
        data: {
          metaobjectUpsert: {
            metaobject: {
              id: "gid://shopify/Metaobject/12345",
              handle: "garage-67890",
            },
            userErrors: [],
          },
        },
      },
    ]);

    // Create a small fake image buffer
    const fakeImage = Buffer.from("fake-image-data");

    const res = await request(app)
      .post("/garage/save")
      .field("customer_id", "67890")
      .field("anno", "2023")
      .field("cilindrata", "560")
      .field("modello", "T-Max 560")
      .field("modifiche", "Variatore Malossi")
      .attach("foto", fakeImage, "my-tmax.jpg");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.metaobject_id).toBe("gid://shopify/Metaobject/12345");

    // Should have called: stagedUploadsCreate, file upload, fileCreate, metaobjectUpsert
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("handles Shopify GraphQL errors", async () => {
    fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            errors: [{ message: "Access denied" }],
          }),
      })
    );

    const res = await request(app)
      .post("/garage/save")
      .field("customer_id", "99999")
      .field("anno", "2020");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to save garage data");
    expect(res.body.details).toContain("Access denied");
  });

  it("handles metaobject userErrors", async () => {
    mockGraphQLResponses([
      {
        data: {
          metaobjectUpsert: {
            metaobject: null,
            userErrors: [
              { field: "type", message: "Metaobject type not found" },
            ],
          },
        },
      },
    ]);

    const res = await request(app)
      .post("/garage/save")
      .field("customer_id", "11111")
      .field("anno", "2019");

    expect(res.status).toBe(500);
    expect(res.body.details).toContain("Metaobject type not found");
  });

  it("defaults empty fields to empty strings", async () => {
    mockGraphQLResponses([
      {
        data: {
          metaobjectUpsert: {
            metaobject: {
              id: "gid://shopify/Metaobject/55555",
              handle: "garage-333",
            },
            userErrors: [],
          },
        },
      },
    ]);

    const res = await request(app)
      .post("/garage/save")
      .field("customer_id", "333");

    expect(res.status).toBe(200);

    const graphqlCalls = fetch.mock.calls.filter((c) =>
      c[0].includes("graphql.json")
    );
    const body = JSON.parse(graphqlCalls[0][1].body);
    const fields = body.variables.metaobject.fields;
    expect(fields).toEqual(
      expect.arrayContaining([
        { key: "anno", value: "" },
        { key: "cilindrata", value: "" },
        { key: "modello", value: "" },
        { key: "modifiche", value: "" },
      ])
    );
  });
});

// ─── GET /garage/:customer_id ───

describe("GET /garage/:customer_id", () => {
  it("returns garage data for existing customer", async () => {
    mockGraphQLResponses([
      {
        data: {
          metaobjectByHandle: {
            id: "gid://shopify/Metaobject/12345",
            handle: "garage-67890",
            fields: [
              { key: "cliente", value: "67890", reference: null },
              { key: "anno", value: "2022", reference: null },
              { key: "cilindrata", value: "530", reference: null },
              { key: "modello", value: "T-Max 530", reference: null },
              { key: "modifiche", value: "Marmitta Akrapovic", reference: null },
              {
                key: "foto",
                value: "gid://shopify/MediaImage/99999",
                reference: {
                  image: {
                    url: "https://cdn.shopify.com/s/files/1/tmax-photo.jpg",
                  },
                },
              },
            ],
          },
        },
      },
    ]);

    const res = await request(app).get("/garage/67890");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.garage.id).toBe("gid://shopify/Metaobject/12345");
    expect(res.body.garage.anno).toBe("2022");
    expect(res.body.garage.cilindrata).toBe("530");
    expect(res.body.garage.modello).toBe("T-Max 530");
    expect(res.body.garage.modifiche).toBe("Marmitta Akrapovic");
    expect(res.body.garage.foto_url).toBe(
      "https://cdn.shopify.com/s/files/1/tmax-photo.jpg"
    );
  });

  it("returns 404 when customer has no garage", async () => {
    mockGraphQLResponses([
      {
        data: {
          metaobjectByHandle: null,
        },
      },
    ]);

    const res = await request(app).get("/garage/99999");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Garage not found for this customer");
  });

  it("handles Shopify API errors gracefully", async () => {
    fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            errors: [{ message: "Internal error" }],
          }),
      })
    );

    const res = await request(app).get("/garage/12345");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to fetch garage data");
  });

  it("queries with correct handle format", async () => {
    mockGraphQLResponses([
      { data: { metaobjectByHandle: null } },
    ]);

    await request(app).get("/garage/ABC123");

    const graphqlCalls = fetch.mock.calls.filter((c) =>
      c[0].includes("graphql.json")
    );
    const body = JSON.parse(graphqlCalls[0][1].body);
    expect(body.variables.handle).toEqual({
      type: "veicolo_garage",
      handle: "garage-ABC123",
    });
  });
});

// ─── Auth header ───

describe("Shopify API authentication", () => {
  it("sends X-Shopify-Access-Token header", async () => {
    mockGraphQLResponses([
      { data: { metaobjectByHandle: null } },
    ]);

    await request(app).get("/garage/test123");

    const graphqlCalls = fetch.mock.calls.filter((c) =>
      c[0].includes("graphql.json")
    );
    expect(graphqlCalls.length).toBe(1);
    const headers = graphqlCalls[0][1].headers;
    expect(headers["X-Shopify-Access-Token"]).toBe("test_shopify_secret");
    expect(headers["Content-Type"]).toBe("application/json");
  });
});

// ─── CORS / existing routes still work ───

describe("Existing routes unaffected", () => {
  it("health check still works", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
