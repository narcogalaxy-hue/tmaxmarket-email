const request = require("supertest");
const crypto = require("crypto");
const { createApp } = require("../src/app");
const { setResendClient } = require("../src/email");

const WEBHOOK_SECRET = "test_webhook_secret_123";

// Mock Resend client
const mockSend = jest.fn().mockResolvedValue({ data: { id: "email_abc123" } });
setResendClient({ emails: { send: mockSend } });

// Set env vars
process.env.SHOPIFY_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.RESEND_API_KEY = "re_test_fake_key";

const app = createApp();

function signPayload(body) {
  const raw = JSON.stringify(body);
  const hmac = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(raw, "utf8")
    .digest("base64");
  return { raw, hmac };
}

describe("GET /health", () => {
  it("returns 200 OK", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("POST /webhooks/customers/create", () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  it("sends welcome email for valid customer", async () => {
    const customer = {
      id: 1,
      email: "mario@example.com",
      first_name: "Mario",
      last_name: "Rossi",
    };
    const { raw, hmac } = signPayload(customer);

    const res = await request(app)
      .post("/webhooks/customers/create")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(raw);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);

    const sentArgs = mockSend.mock.calls[0][0];
    expect(sentArgs.to).toEqual(["mario@example.com"]);
    expect(sentArgs.subject).toBe("Benvenuto su TmaxMarket.it! 🛵");
    expect(sentArgs.html).toContain("Ciao Mario, benvenuto!");
    expect(sentArgs.html).toContain("TmaxMarket.it");
    expect(sentArgs.from).toContain("noreply@tmaxmarket.it");
  });

  it("uses 'Cliente' when first_name is missing", async () => {
    const customer = { id: 2, email: "test@example.com" };
    const { raw, hmac } = signPayload(customer);

    const res = await request(app)
      .post("/webhooks/customers/create")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(raw);

    expect(res.status).toBe(200);
    const sentArgs = mockSend.mock.calls[0][0];
    expect(sentArgs.html).toContain("Ciao Cliente, benvenuto!");
  });

  it("rejects missing HMAC header", async () => {
    const res = await request(app)
      .post("/webhooks/customers/create")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ email: "a@b.com" }));

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Missing HMAC header");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects invalid HMAC", async () => {
    const res = await request(app)
      .post("/webhooks/customers/create")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", "aW52YWxpZA==")
      .send(JSON.stringify({ email: "a@b.com" }));

    expect(res.status).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns 400 when email is missing", async () => {
    const customer = { id: 3, first_name: "NoEmail" };
    const { raw, hmac } = signPayload(customer);

    const res = await request(app)
      .post("/webhooks/customers/create")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(raw);

    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("POST /webhooks/orders/create", () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  it("sends order confirmation email", async () => {
    const order = {
      order_number: 1042,
      name: "#1042",
      email: "luigi@example.com",
      total_price: "149.99",
      order_status_url: "https://tmaxmarket.it/orders/1042",
      line_items: [
        {
          title: "Cinghia trasmissione Tmax 530",
          variant_title: null,
          quantity: 1,
          price: "89.99",
        },
        {
          title: "Pastiglie freno anteriori",
          variant_title: "Set completo",
          quantity: 2,
          price: "30.00",
        },
      ],
    };
    const { raw, hmac } = signPayload(order);

    const res = await request(app)
      .post("/webhooks/orders/create")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(raw);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);

    const sentArgs = mockSend.mock.calls[0][0];
    expect(sentArgs.to).toEqual(["luigi@example.com"]);
    expect(sentArgs.subject).toBe(
      "Ordine confermato #1042 - TmaxMarket.it"
    );
    expect(sentArgs.html).toContain("#1042");
    expect(sentArgs.html).toContain("Cinghia trasmissione Tmax 530");
    expect(sentArgs.html).toContain("Set completo");
    expect(sentArgs.html).toContain("Consegna stimata");
  });

  it("falls back to contact_email", async () => {
    const order = {
      order_number: 1043,
      contact_email: "fallback@example.com",
      total_price: "50.00",
      line_items: [{ title: "Olio motore", quantity: 1, price: "50.00" }],
    };
    const { raw, hmac } = signPayload(order);

    const res = await request(app)
      .post("/webhooks/orders/create")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(raw);

    expect(res.status).toBe(200);
    const sentArgs = mockSend.mock.calls[0][0];
    expect(sentArgs.to).toEqual(["fallback@example.com"]);
  });

  it("returns 400 when no email on order", async () => {
    const order = { order_number: 1044, total_price: "10.00", line_items: [] };
    const { raw, hmac } = signPayload(order);

    const res = await request(app)
      .post("/webhooks/orders/create")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(raw);

    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("HMAC verification edge cases", () => {
  it("rejects when HMAC lengths differ", async () => {
    const res = await request(app)
      .post("/webhooks/customers/create")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", "short")
      .send(JSON.stringify({ email: "a@b.com" }));

    expect(res.status).toBe(401);
  });
});

describe("Email templates", () => {
  const { welcomeEmail } = require("../src/templates/welcome");
  const {
    orderConfirmationEmail,
    formatCurrency,
  } = require("../src/templates/orderConfirmation");

  it("welcome email contains key Italian copy", () => {
    const html = welcomeEmail({ firstName: "Luca" });
    expect(html).toContain("Ciao Luca, benvenuto!");
    expect(html).toContain("Yamaha Tmax");
    expect(html).toContain("Visita il marketplace");
    expect(html).toContain("tmaxmarket.it");
    expect(html).toContain("#FF6B00");
  });

  it("order confirmation contains items and total", () => {
    const html = orderConfirmationEmail({
      orderNumber: "9999",
      lineItems: [{ name: "Filtro aria", quantity: 1, price: "25.50" }],
      totalPrice: "25.50",
    });
    expect(html).toContain("#9999");
    expect(html).toContain("Filtro aria");
    expect(html).toContain("Ordine Confermato");
    expect(html).toContain("Consegna stimata");
    expect(html).toContain("Vedi il tuo ordine");
  });

  it("formatCurrency formats euros correctly", () => {
    const formatted = formatCurrency(25.5);
    expect(formatted).toContain("25,50");
    expect(formatted).toContain("€");
  });
});
