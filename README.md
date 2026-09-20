# TmaxMarket.it — Shopify Webhook + Resend Email Automation

Node.js (Express) server that listens to Shopify webhooks and sends transactional emails via [Resend](https://resend.com).

## Features

- **Welcome email** — triggered on `customers/create` webhook (Italian, branded)
- **Order confirmation email** — triggered on `orders/create` webhook (Italian, branded)
- **HMAC verification** — validates Shopify webhook signatures
- **Health check** — `GET /health`

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `RESEND_API_KEY` | ✅ | Your Resend API key (starts with `re_`) |
| `SHOPIFY_WEBHOOK_SECRET` | ✅ | The HMAC secret from your Shopify webhook settings |
| `PORT` | ❌ | Server port (default: `3000`) |

## Quick Start

```bash
# Install dependencies
npm install

# Set environment variables
export RESEND_API_KEY="re_your_key_here"
export SHOPIFY_WEBHOOK_SECRET="your_shopify_webhook_secret"

# Start the server
npm start
```

The server starts on `http://localhost:3000`.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ "status": "ok" }` |
| `POST` | `/webhooks/customers/create` | Receives Shopify `customers/create` webhook |
| `POST` | `/webhooks/orders/create` | Receives Shopify `orders/create` webhook |

## Setting Up Shopify Webhooks

1. Go to your Shopify Admin → **Settings** → **Notifications** → **Webhooks**
2. Create two webhooks:

   | Event | Format | URL |
   |---|---|---|
   | Customer creation | JSON | `https://your-server.com/webhooks/customers/create` |
   | Order creation | JSON | `https://your-server.com/webhooks/orders/create` |

3. Copy the **Webhook signing secret** shown at the top of the webhooks page and set it as `SHOPIFY_WEBHOOK_SECRET`.

## Local Development with ngrok

To test webhooks locally, expose your server with [ngrok](https://ngrok.com):

```bash
# Start the server
npm start

# In another terminal, expose port 3000
ngrok http 3000
```

Copy the ngrok HTTPS URL (e.g. `https://abc123.ngrok-free.app`) and use it as the webhook URL in Shopify:

- `https://abc123.ngrok-free.app/webhooks/customers/create`
- `https://abc123.ngrok-free.app/webhooks/orders/create`

## Running Tests

```bash
npm test
```

Tests cover:
- Health endpoint
- Welcome email sending & template content
- Order confirmation email sending & template content
- HMAC signature verification (valid, invalid, missing)
- Edge cases (missing email, fallback fields)

## Project Structure

```
├── src/
│   ├── index.js                  # Entry point — starts Express server
│   ├── app.js                    # Express app factory with routes
│   ├── email.js                  # Resend email client wrapper
│   ├── middleware/
│   │   └── verifyShopify.js      # HMAC webhook signature verification
│   └── templates/
│       ├── welcome.js            # Welcome email HTML template
│       └── orderConfirmation.js  # Order confirmation HTML template
├── __tests__/
│   └── app.test.js               # Jest test suite
├── package.json
└── README.md
```

## Email Templates

Both templates feature:
- 🎨 TmaxMarket.it branding (orange `#FF6B00`, dark header)
- 📱 Mobile-friendly responsive design
- 🇮🇹 Italian copy
- CTA buttons linking to tmaxmarket.it
