const request = require("supertest");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

// Set env vars BEFORE requiring modules
const TEST_DATA_DIR = path.join(__dirname, "..", "data-test");
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.SHOPIFY_WEBHOOK_SECRET = "test_webhook_secret_123";
process.env.RESEND_API_KEY = "re_test_fake_key";
process.env.REVIEW_DELAY_MS = "200";
process.env.CART_ABANDON_DELAY_MS = "200";
process.env.VENDOR_EMAIL2_DELAY_MS = "200";
process.env.VENDOR_EMAIL3_DELAY_MS = "400";

const { createApp } = require("../src/app");
const { setResendClient } = require("../src/email");
const { clearAll, setUnref } = require("../src/scheduler");

const WEBHOOK_SECRET = "test_webhook_secret_123";

setUnref(false);

const mockSend = jest.fn().mockResolvedValue({ data: { id: "email_test" } });
setResendClient({ emails: { send: mockSend } });

const app = createApp();

function signPayload(body) {
  const raw = JSON.stringify(body);
  const hmac = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(raw, "utf8")
    .digest("base64");
  return { raw, hmac };
}

function waitFor(ms) {
  return new Promise((resolve) => {
    const start = Date.now();
    function check() {
      if (Date.now() - start >= ms) {
        Promise.resolve().then(() => Promise.resolve()).then(resolve);
      } else {
        setTimeout(check, 10);
      }
    }
    check();
  });
}

beforeEach(() => {
  mockSend.mockClear();
  clearAll();
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
});

afterAll(() => {
  clearAll();
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true });
  }
});

// ───────────────────────────
// 1. Fulfillment / Shipping
// ───────────────────────────
describe("POST /webhooks/orders/fulfilled", () => {
  it("sends fulfillment email with tracking info", async () => {
    const order = {
      order_number: 2001,
      email: "buyer@example.com",
      fulfillments: [
        {
          tracking_number: "BRT123456",
          tracking_url: "https://brt.it/track/BRT123456",
          tracking_company: "BRT",
          estimated_delivery_at: "2026-09-25",
        },
      ],
      customer: { first_name: "Marco" },
      order_status_url: "https://tmaxmarket.it/orders/2001",
    };
    const { raw, hmac } = signPayload(order);

    const res = await request(app)
      .post("/webhooks/orders/fulfilled")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(raw);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reviewScheduled).toBe(true);

    // At least the fulfillment email was sent
    expect(mockSend).toHaveBeenCalled();
    const sentArgs = mockSend.mock.calls[0][0];
    expect(sentArgs.subject).toBe(
      "Il tuo ordine è in arrivo! 🚚 - TmaxMarket.it"
    );
    expect(sentArgs.html).toContain("BRT123456");
    expect(sentArgs.html).toContain("BRT");
    expect(sentArgs.html).toContain("#2001");
    expect(sentArgs.html).toContain("Traccia il tuo pacco");
  });

  it("sends fulfillment email without tracking", async () => {
    const order = {
      order_number: 2002,
      email: "buyer2@example.com",
    };
    const { raw, hmac } = signPayload(order);

    const res = await request(app)
      .post("/webhooks/orders/fulfilled")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(raw);

    expect(res.status).toBe(200);
    const sentArgs = mockSend.mock.calls[0][0];
    expect(sentArgs.html).toContain("Il tracking sarà disponibile a breve");
  });

  it("returns 400 if email is missing", async () => {
    const order = { order_number: 2003 };
    const { raw, hmac } = signPayload(order);

    const res = await request(app)
      .post("/webhooks/orders/fulfilled")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(raw);

    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("schedules review email after delay", async () => {
    const order = {
      order_number: 2004,
      email: "reviewer@example.com",
      customer: { first_name: "Anna" },
    };
    const { raw, hmac } = signPayload(order);

    await request(app)
      .post("/webhooks/orders/fulfilled")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(raw);

    // Right after request, only 1 email (fulfillment)
    const initialCount = mockSend.mock.calls.length;
    expect(initialCount).toBe(1);

    // Wait for review delay (200ms) + buffer
    await waitFor(400);

    expect(mockSend.mock.calls.length).toBe(2);
    const reviewArgs = mockSend.mock.calls[1][0];
    expect(reviewArgs.subject).toBe(
      "Come è andata? Lascia una recensione 🌟 - TmaxMarket.it"
    );
    expect(reviewArgs.html).toContain("Anna");
    expect(reviewArgs.html).toContain("#2004");
  });
});

// ───────────────────────────
// 2. Abandoned Cart
// ───────────────────────────
describe("POST /webhooks/checkouts/create", () => {
  it("tracks checkout and schedules abandoned cart email", async () => {
    const checkout = {
      token: "chk_abc123",
      email: "shopper@example.com",
      customer: { first_name: "Luca" },
      abandoned_checkout_url: "https://tmaxmarket.it/checkouts/chk_abc123",
      line_items: [
        { title: "Specchio Tmax 560", quantity: 1, price: "45.00" },
      ],
      total_price: "45.00",
    };
    const { raw, hmac } = signPayload(checkout);

    const res = await request(app)
      .post("/webhooks/checkouts/create")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(raw);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSend).not.toHaveBeenCalled();

    await waitFor(400);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const sentArgs = mockSend.mock.calls[0][0];
    expect(sentArgs.subject).toBe(
      "Hai dimenticato qualcosa? 🛒 - TmaxMarket.it"
    );
    expect(sentArgs.html).toContain("Luca");
    expect(sentArgs.html).toContain("Specchio Tmax 560");
  });

  it("does NOT send email if order was completed", async () => {
    const checkout = {
      token: "chk_completed",
      email: "buyer@example.com",
      line_items: [{ title: "Freni", quantity: 1, price: "30.00" }],
    };
    const { raw: chkRaw, hmac: chkHmac } = signPayload(checkout);

    await request(app)
      .post("/webhooks/checkouts/create")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", chkHmac)
      .send(chkRaw);

    const order = {
      order_number: 3001,
      email: "buyer@example.com",
      checkout_token: "chk_completed",
      total_price: "30.00",
      line_items: [{ title: "Freni", quantity: 1, price: "30.00" }],
    };
    const { raw: ordRaw, hmac: ordHmac } = signPayload(order);

    await request(app)
      .post("/webhooks/orders/create")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", ordHmac)
      .send(ordRaw);

    mockSend.mockClear();

    await waitFor(400);

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns 400 if email or token is missing", async () => {
    const checkout = { line_items: [] };
    const { raw, hmac } = signPayload(checkout);

    const res = await request(app)
      .post("/webhooks/checkouts/create")
      .set("Content-Type", "application/json")
      .set("X-Shopify-Hmac-Sha256", hmac)
      .send(raw);

    expect(res.status).toBe(400);
  });
});

// ───────────────────────────
// 3. Vendor Onboarding
// ───────────────────────────
describe("POST /webhooks/vendors/create", () => {
  it("sends immediate welcome and schedules 2 follow-ups", async () => {
    const vendor = {
      email: "vendor@example.com",
      name: "MotoShop Roma",
    };

    const res = await request(app)
      .post("/webhooks/vendors/create")
      .set("Content-Type", "application/json")
      .send(vendor);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sequenceScheduled).toBe(true);

    // Immediate: welcome email only
    expect(mockSend).toHaveBeenCalledTimes(1);
    const welcomeArgs = mockSend.mock.calls[0][0];
    expect(welcomeArgs.subject).toContain("Benvenuto tra i venditori");
    expect(welcomeArgs.html).toContain("MotoShop Roma");
    expect(welcomeArgs.html).toContain("Carica il primo annuncio");

    // Wait for email 2 (200ms delay) + buffer
    await waitFor(350);
    expect(mockSend).toHaveBeenCalledTimes(2);
    const tipsArgs = mockSend.mock.calls[1][0];
    expect(tipsArgs.subject).toContain("Consigli per annunci");
    expect(tipsArgs.html).toContain("Foto di alta qualità");

    // Wait for email 3 (400ms delay) + buffer
    await waitFor(200);
    expect(mockSend).toHaveBeenCalledTimes(3);
    const payoutArgs = mockSend.mock.calls[2][0];
    expect(payoutArgs.subject).toContain("ordini e pagamenti");
    expect(payoutArgs.html).toContain("Gestione Ordini");
  });

  it("returns 400 when email is missing", async () => {
    const res = await request(app)
      .post("/webhooks/vendors/create")
      .set("Content-Type", "application/json")
      .send({ name: "NoEmail" });

    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does not require HMAC (custom endpoint)", async () => {
    const vendor = { email: "v2@example.com", name: "Test" };

    const res = await request(app)
      .post("/webhooks/vendors/create")
      .set("Content-Type", "application/json")
      .send(vendor);

    expect(res.status).toBe(200);
  });
});

// ───────────────────────────
// 4. Zone Alerts
// ───────────────────────────
describe("Zone Alerts", () => {
  describe("POST /alerts/subscribe", () => {
    it("subscribes a user to zone alerts", async () => {
      const res = await request(app)
        .post("/alerts/subscribe")
        .send({ email: "mario@example.com", zone: "Roma", tmax_model: "530", max_price: 500 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("returns 400 if email or zone is missing", async () => {
      const res = await request(app)
        .post("/alerts/subscribe")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /alerts/notify", () => {
    it("notifies matching subscribers", async () => {
      await request(app)
        .post("/alerts/subscribe")
        .send({ email: "sub1@example.com", zone: "Milano" });
      await request(app)
        .post("/alerts/subscribe")
        .send({ email: "sub2@example.com", zone: "Roma" });
      await request(app)
        .post("/alerts/subscribe")
        .send({ email: "sub3@example.com", zone: "Milano", max_price: 100 });

      mockSend.mockClear();

      const res = await request(app)
        .post("/alerts/notify")
        .send({
          listing: {
            title: "Cinghia Tmax 530",
            price: 50,
            zone: "Milano",
            model: "530",
            url: "https://tmaxmarket.it/listings/123",
            image_url: "https://tmaxmarket.it/img/cinghia.jpg",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.notified).toBe(2);
      expect(mockSend).toHaveBeenCalledTimes(2);

      const emails = mockSend.mock.calls.map((c) => c[0].to[0]).sort();
      expect(emails).toEqual(["sub1@example.com", "sub3@example.com"]);

      const sentHtml = mockSend.mock.calls[0][0].html;
      expect(sentHtml).toContain("Cinghia Tmax 530");
      expect(sentHtml).toContain("Milano");
    });

    it("filters by max_price", async () => {
      await request(app)
        .post("/alerts/subscribe")
        .send({ email: "cheap@example.com", zone: "Napoli", max_price: 50 });

      mockSend.mockClear();

      const res = await request(app)
        .post("/alerts/notify")
        .send({
          listing: { title: "Expensive part", price: 200, zone: "Napoli" },
        });

      expect(res.body.notified).toBe(0);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("returns 400 if listing or zone is missing", async () => {
      const res = await request(app)
        .post("/alerts/notify")
        .send({ listing: { title: "No zone" } });

      expect(res.status).toBe(400);
    });
  });
});

// ───────────────────────────
// 5. Weekly Report
// ───────────────────────────
describe("POST /reports/trigger-weekly", () => {
  it("sends weekly report to a single vendor", async () => {
    const res = await request(app)
      .post("/reports/trigger-weekly")
      .send({
        email: "vendor@example.com",
        vendorName: "MotoShop",
        totalOrders: 12,
        totalRevenue: 1450.5,
        topProducts: [
          { name: "Cinghia Tmax 530", quantity: 5, revenue: 449.95 },
          { name: "Pastiglie freno", quantity: 7, revenue: 280.0 },
        ],
        periodStart: "14 Set 2026",
        periodEnd: "20 Set 2026",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sent).toBe(1);
    expect(mockSend).toHaveBeenCalledTimes(1);

    const sentArgs = mockSend.mock.calls[0][0];
    expect(sentArgs.subject).toContain("riepilogo della tua settimana");
    expect(sentArgs.html).toContain("MotoShop");
    expect(sentArgs.html).toContain("12");
    expect(sentArgs.html).toContain("Cinghia Tmax 530");
  });

  it("sends reports to multiple vendors", async () => {
    const res = await request(app)
      .post("/reports/trigger-weekly")
      .send({
        vendors: [
          { email: "v1@example.com", vendorName: "Shop A", totalOrders: 5, totalRevenue: 300 },
          { email: "v2@example.com", vendorName: "Shop B", totalOrders: 8, totalRevenue: 600 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(2);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("returns 400 when no vendor email", async () => {
    const res = await request(app)
      .post("/reports/trigger-weekly")
      .send({ vendorName: "NoEmail" });

    expect(res.status).toBe(400);
  });
});

// ───────────────────────────
// 6. Template Tests
// ───────────────────────────
describe("New email templates", () => {
  const { fulfillmentEmail } = require("../src/templates/fulfillment");
  const { reviewRequestEmail } = require("../src/templates/reviewRequest");
  const { abandonedCartEmail } = require("../src/templates/abandonedCart");
  const {
    vendorWelcomeEmail,
    vendorListingTipsEmail,
    vendorOrdersPayoutEmail,
  } = require("../src/templates/vendorOnboarding");
  const { zoneAlertEmail } = require("../src/templates/zoneAlert");
  const { weeklyReportEmail } = require("../src/templates/weeklyReport");

  it("fulfillment template contains branding and tracking", () => {
    const html = fulfillmentEmail({
      orderNumber: "5001",
      trackingNumber: "GLS789",
      carrier: "GLS",
      trackingUrl: "https://gls.it/track/789",
      estimatedDelivery: "25 Settembre 2026",
    });
    expect(html).toContain("#FF6B00");
    expect(html).toContain("TmaxMarket.it");
    expect(html).toContain("GLS789");
    expect(html).toContain("GLS");
    expect(html).toContain("#5001");
    expect(html).toContain("25 Settembre 2026");
  });

  it("review request template contains Italian copy", () => {
    const html = reviewRequestEmail({
      orderNumber: "5002",
      customerName: "Paolo",
    });
    expect(html).toContain("Paolo");
    expect(html).toContain("#5002");
    expect(html).toContain("Lascia una recensione");
    expect(html).toContain("La tua opinione");
  });

  it("abandoned cart template shows items", () => {
    const html = abandonedCartEmail({
      customerName: "Giulia",
      lineItems: [{ title: "Manopole Tmax", quantity: 2, price: "25.00" }],
      totalPrice: "50.00",
      checkoutUrl: "https://tmaxmarket.it/checkout/abc",
    });
    expect(html).toContain("Giulia");
    expect(html).toContain("Manopole Tmax");
    expect(html).toContain("Completa l'acquisto");
    expect(html).toContain("carrello");
  });

  it("vendor welcome template has onboarding steps", () => {
    const html = vendorWelcomeEmail({ vendorName: "AutoRicambi" });
    expect(html).toContain("AutoRicambi");
    expect(html).toContain("Carica il tuo primo annuncio");
    expect(html).toContain("Benvenuto");
  });

  it("vendor listing tips template has advice", () => {
    const html = vendorListingTipsEmail({ vendorName: "Test" });
    expect(html).toContain("Foto di alta qualità");
    expect(html).toContain("Descrizioni dettagliate");
    expect(html).toContain("Prezzi competitivi");
  });

  it("vendor orders payout template has payment info", () => {
    const html = vendorOrdersPayoutEmail({ vendorName: "Test" });
    expect(html).toContain("Gestione Ordini");
    expect(html).toContain("Pagamenti");
    expect(html).toContain("IBAN");
    expect(html).toContain("5%");
  });

  it("zone alert template shows listing details", () => {
    const html = zoneAlertEmail({
      listing: {
        title: "Marmitta Tmax 560",
        price: 350,
        zone: "Torino",
        model: "560",
        url: "https://tmaxmarket.it/listings/456",
        image_url: "https://tmaxmarket.it/img/marmitta.jpg",
      },
      subscriberZone: "Torino",
    });
    expect(html).toContain("Marmitta Tmax 560");
    expect(html).toContain("Torino");
    expect(html).toContain("560");
    expect(html).toContain("Vedi l'annuncio");
  });

  it("weekly report template shows stats", () => {
    const html = weeklyReportEmail({
      vendorName: "MotoShop",
      totalOrders: 15,
      totalRevenue: 2000,
      topProducts: [{ name: "Filtro", quantity: 10, revenue: 500 }],
      periodStart: "1 Set",
      periodEnd: "7 Set",
    });
    expect(html).toContain("MotoShop");
    expect(html).toContain("15");
    expect(html).toContain("Filtro");
    expect(html).toContain("1 Set");
    expect(html).toContain("Riepilogo settimanale");
  });
});
