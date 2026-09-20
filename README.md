# TmaxMarket.it — Email Automation System

Sistema di automazione email per [TmaxMarket.it](https://tmaxmarket.it), il marketplace italiano per ricambi e accessori Yamaha Tmax.

## 🚀 Features

### Webhook Endpoints (Shopify)
| Endpoint | Trigger | Email |
|---|---|---|
| `POST /webhooks/customers/create` | Nuovo cliente | Email di benvenuto |
| `POST /webhooks/orders/create` | Nuovo ordine | Conferma ordine |
| `POST /webhooks/orders/fulfilled` | Ordine spedito | Notifica spedizione + tracking |
| `POST /webhooks/checkouts/create` | Checkout iniziato | Carrello abbandonato (1h dopo) |

### Custom Endpoints
| Endpoint | Descrizione |
|---|---|
| `POST /webhooks/vendors/create` | Onboarding venditore (3 email in sequenza) |
| `POST /alerts/subscribe` | Iscrizione avvisi zona |
| `POST /alerts/notify` | Notifica nuovi annunci ai subscriber |
| `POST /reports/trigger-weekly` | Report settimanale venditori |
| `GET /health` | Health check |

### Scheduled Emails
- **Review Request**: 5 giorni dopo la spedizione, richiesta di recensione
- **Abandoned Cart**: 1 ora dopo il checkout, se l'ordine non è stato completato
- **Vendor Onboarding Drip**:
  - Immediata: Benvenuto + come caricare il primo annuncio
  - 24h: Consigli per annunci perfetti
  - 72h: Gestione ordini e pagamenti
- **Weekly Seller Report**: Ogni lunedì alle 9:00 (Europe/Rome) via cron

## 📦 Setup

```bash
npm install
```

### Environment Variables

```bash
RESEND_API_KEY=re_your_key_here
SHOPIFY_WEBHOOK_SECRET=your_shopify_webhook_secret
PORT=3000

# Optional: override delays for testing (milliseconds)
REVIEW_DELAY_MS=432000000       # 5 days (default)
CART_ABANDON_DELAY_MS=3600000   # 1 hour (default)
VENDOR_EMAIL2_DELAY_MS=86400000 # 24 hours (default)
VENDOR_EMAIL3_DELAY_MS=259200000 # 72 hours (default)
```

### Run

```bash
node src/index.js
```

### Docker

```bash
docker build -t tmaxmarket-email .
docker run -p 3000:3000 \
  -e RESEND_API_KEY=re_xxx \
  -e SHOPIFY_WEBHOOK_SECRET=xxx \
  tmaxmarket-email
```

## 🧪 Tests

```bash
npm test
```

## 📌 API Reference

### `POST /webhooks/customers/create`
Shopify webhook — sends welcome email to new customers.
- **Headers**: `X-Shopify-Hmac-Sha256` (HMAC verification)
- **Body**: Shopify customer object (`{ email, first_name, ... }`)

### `POST /webhooks/orders/create`
Shopify webhook — sends order confirmation email.
- **Headers**: `X-Shopify-Hmac-Sha256`
- **Body**: Shopify order object (`{ order_number, email, line_items, total_price, ... }`)

### `POST /webhooks/orders/fulfilled`
Shopify webhook — sends shipping notification + schedules review request (5 days).
- **Headers**: `X-Shopify-Hmac-Sha256`
- **Body**: Shopify order object with fulfillments (`{ order_number, email, fulfillments: [{ tracking_number, tracking_url, tracking_company }], ... }`)

### `POST /webhooks/checkouts/create`
Shopify webhook — tracks checkout, sends abandoned cart email after 1 hour if no order.
- **Headers**: `X-Shopify-Hmac-Sha256`
- **Body**: Shopify checkout object (`{ token, email, line_items, total_price, abandoned_checkout_url, ... }`)

### `POST /webhooks/vendors/create`
Custom webhook — starts vendor onboarding sequence (3 emails).
- **Body**: `{ email, name }`
- No HMAC required (custom endpoint)

### `POST /alerts/subscribe`
Subscribe to zone-based listing alerts.
- **Body**: `{ email, zone, tmax_model? (optional), max_price? (optional) }`
- Example: `{ "email": "mario@example.com", "zone": "Roma", "tmax_model": "530", "max_price": 500 }`

### `POST /alerts/notify`
Notify matching subscribers about a new listing.
- **Body**: `{ listing: { title, price, zone, model?, url?, image_url? } }`
- Sends emails to all subscribers matching zone, model filter, and price filter.

### `POST /reports/trigger-weekly`
Manually trigger weekly vendor report.
- **Body** (single vendor):
```json
{
  "email": "vendor@example.com",
  "vendorName": "MotoShop",
  "totalOrders": 12,
  "totalRevenue": 1450.50,
  "topProducts": [
    { "name": "Cinghia Tmax 530", "quantity": 5, "revenue": 449.95 }
  ],
  "periodStart": "14 Set 2026",
  "periodEnd": "20 Set 2026"
}
```
- **Body** (multiple vendors):
```json
{
  "vendors": [
    { "email": "v1@example.com", "vendorName": "Shop A", "totalOrders": 5, "totalRevenue": 300 },
    { "email": "v2@example.com", "vendorName": "Shop B", "totalOrders": 8, "totalRevenue": 600 }
  ]
}
```

## 🎨 Branding
- **Primary color**: `#FF6B00` (arancione)
- **Dark header/footer**: `#1a1a1a`
- **All copy in Italian**
- **Mobile-friendly HTML templates**
- **From**: `TmaxMarket.it <noreply@tmaxmarket.it>`

## 📁 Project Structure

```
├── src/
│   ├── app.js                    # Express app with all routes
│   ├── index.js                  # Server startup + cron jobs
│   ├── email.js                  # Resend email sending
│   ├── scheduler.js              # In-memory setTimeout scheduler
│   ├── dataStore.js              # JSON file data persistence
│   ├── middleware/
│   │   └── verifyShopify.js      # Shopify HMAC webhook verification
│   └── templates/
│       ├── layout.js             # Shared email layout + CTA button
│       ├── welcome.js            # Customer welcome
│       ├── orderConfirmation.js  # Order confirmation
│       ├── fulfillment.js        # Shipping notification
│       ├── reviewRequest.js      # Post-purchase review request
│       ├── abandonedCart.js       # Abandoned cart reminder
│       ├── vendorOnboarding.js   # Vendor drip (3 emails)
│       ├── zoneAlert.js          # Zone listing alert
│       └── weeklyReport.js       # Weekly seller report
├── __tests__/
│   ├── app.test.js               # Tests for original endpoints
│   └── v2-features.test.js       # Tests for new features
├── data/                         # JSON file storage (gitignored)
│   └── .gitkeep
├── Dockerfile
├── package.json
└── README.md
```

## 🛠 Tech Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Email**: Resend API
- **Scheduling**: node-cron (weekly) + setTimeout (delayed emails)
- **Storage**: JSON files in `/data/`
- **Webhooks**: Shopify HMAC-SHA256 verification
