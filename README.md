# TmaxMarket.it — Email Automation System

Sistema di automazione email per [TmaxMarket.it](https://tmaxmarket.it), il marketplace italiano per ricambi e accessori Yamaha Tmax.

## 🚀 Features

### Webhook Endpoints (Shopify)
| Endpoint | Trigger | Azione |
|---|---|---|
| `POST /webhooks/customers/create` | Nuovo cliente | Email di benvenuto |
| `POST /webhooks/orders/create` | Nuovo ordine | Conferma ordine |
| `POST /webhooks/orders/fulfilled` | Ordine spedito | Notifica spedizione + tracking |
| `POST /webhooks/orders/paid` | Ordine pagato | Aggiorna storico acquisti nel Garage |
| `POST /webhooks/checkouts/create` | Checkout iniziato | Carrello abbandonato (1h dopo) |

### Custom Endpoints
| Endpoint | Descrizione |
|---|---|
| `POST /webhooks/vendors/create` | Onboarding venditore (3 email in sequenza) |
| `POST /alerts/subscribe` | Iscrizione avvisi zona |
| `POST /alerts/notify` | Notifica nuovi annunci ai subscriber |
| `POST /reports/trigger-weekly` | Report settimanale venditori |
| `GET /health` | Health check |

### Garage Endpoints
| Endpoint | Descrizione |
|---|---|
| `POST /garage/save` | Salva/aggiorna il veicolo nel garage (con foto opzionale) |
| `GET /garage/:customer_id` | Recupera dati garage + storico acquisti |

### Scheduled Emails
- **Review Request**: 5 giorni dopo la spedizione, richiesta di recensione
- **Abandoned Cart**: 1 ora dopo il checkout, se l'ordine non è stato completato
- **Vendor Onboarding Drip**:
  - Immediata: Benvenuto + come caricare il primo annuncio
  - 24h: Consigli per annunci perfetti
  - 72h: Gestione ordini e pagamenti
- **Weekly Seller Report**: Ogni lunedì alle 9:00 (Europe/Rome) via cron

## ⚠️ Shopify Admin Setup Required

### Metaobject: `acquisti` field
Il metaobject `veicolo_garage` necessita di un campo `acquisti` per lo storico acquisti.

**Come aggiungerlo:**
1. Vai su Shopify Admin → **Content** → **Metaobject definitions**
2. Apri **Veicolo Garage** (`veicolo_garage`)
3. Clicca **Add field**
4. Nome: `acquisti`
5. Tipo: **Multi-line text**
6. Salva

Questo campo memorizza un array JSON di acquisti:
```json
[
  {
    "product": "Marmitta Akrapovic",
    "date": "2026-09-22",
    "order_id": "1234",
    "price": "299.00"
  }
]
```

### Shopify Webhooks da registrare
In Shopify Admin → Settings → Notifications → Webhooks, registra:

| Evento | URL |
|---|---|
| Customer creation | `https://YOUR-APP-URL/webhooks/customers/create` |
| Order creation | `https://YOUR-APP-URL/webhooks/orders/create` |
| Order payment | `https://YOUR-APP-URL/webhooks/orders/paid` |
| Order fulfillment | `https://YOUR-APP-URL/webhooks/orders/fulfilled` |
| Checkout creation | `https://YOUR-APP-URL/webhooks/checkouts/create` |

## 📦 Setup

```bash
npm install
```

### Environment Variables

```bash
RESEND_API_KEY=re_your_key_here
SHOPIFY_WEBHOOK_SECRET=your_shopify_webhook_secret
SHOPIFY_ACCESS_TOKEN=your_shopify_access_token
PORT=3000

# Optional: override delays for testing (milliseconds)
REVIEW_DELAY_MS=432000000       # 5 days (default)
CART_ABANDON_DELAY_MS=3600000   # 1 hour (default)
VENDOR_EMAIL2_DELAY_MS=86400000 # 24 hours (default)
VENDOR_EMAIL3_DELAY_MS=259200000 # 72 hours (default)

# Legacy / alternative names
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_access_token
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
  -e SHOPIFY_ACCESS_TOKEN=xxx \
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

### `POST /webhooks/orders/paid`
Shopify webhook — tracks purchases in the customer's Garage.
- **Headers**: `X-Shopify-Hmac-Sha256`
- **Body**: Shopify order object (`{ id, customer: { id }, line_items: [{ title, price }], created_at, ... }`)
- **Behavior**:
  - Extracts customer ID, line items (product + price), order date
  - Finds the customer's `veicolo_garage` metaobject (`garage-{customer_id}`)
  - Reads existing `acquisti` JSON array, appends new purchases, saves back
  - If no garage exists yet, creates one with just the `acquisti` field
  - Gracefully skips if no customer ID or no line items

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

### `GET /garage/:customer_id`
Fetch customer's garage data including purchase history.
- **Response**:
```json
{
  "success": true,
  "garage": {
    "id": "gid://shopify/Metaobject/12345",
    "handle": "garage-67890",
    "anno": "2022",
    "cilindrata": "530",
    "modello": "T-Max 530",
    "modifiche": "Marmitta Akrapovic",
    "foto_url": "https://cdn.shopify.com/...",
    "acquisti": [
      {
        "product": "Marmitta Akrapovic",
        "date": "2026-09-22",
        "order_id": "1234",
        "price": "299.00"
      }
    ]
  }
}
```

### `POST /garage/save`
Save/update garage data (multipart form with optional photo).
- **Body**: `customer_id`, `anno`, `cilindrata`, `modello`, `modifiche`, `foto` (file)

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
│   ├── garage.js                 # Garage CRUD (metaobject + file upload)
│   ├── ordersWebhook.js          # Orders/paid webhook → garage acquisti
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
│   ├── garage.test.js            # Tests for garage CRUD
│   ├── orders-webhook.test.js    # Tests for orders/paid webhook
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
- **Storage**: JSON files in `/data/`; Shopify metaobjects for garage data
- **Webhooks**: Shopify HMAC-SHA256 verification
- **Shopify API**: Admin GraphQL API (2026-07) for metaobject CRUD
