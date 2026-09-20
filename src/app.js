const express = require("express");
const { verifyShopifyWebhook } = require("./middleware/verifyShopify");
const { sendEmail } = require("./email");
const { welcomeEmail } = require("./templates/welcome");
const { orderConfirmationEmail } = require("./templates/orderConfirmation");

function createApp() {
  const app = express();

  // Parse JSON while preserving rawBody for HMAC verification
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf.toString("utf8");
      },
    })
  );

  // Health check
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Webhook: customers/create
  app.post(
    "/webhooks/customers/create",
    verifyShopifyWebhook,
    async (req, res) => {
      try {
        const customer = req.body;
        const email = customer.email;

        if (!email) {
          return res.status(400).json({ error: "Customer email is required" });
        }

        const html = welcomeEmail({ firstName: customer.first_name });

        const result = await sendEmail({
          to: email,
          subject: "Benvenuto su TmaxMarket.it! 🛵",
          html,
        });

        console.log(`Welcome email sent to ${email}`, result);
        res.status(200).json({ success: true, emailId: result.data?.id });
      } catch (err) {
        console.error("Error sending welcome email:", err);
        res.status(500).json({ error: "Failed to send welcome email" });
      }
    }
  );

  // Webhook: orders/create
  app.post(
    "/webhooks/orders/create",
    verifyShopifyWebhook,
    async (req, res) => {
      try {
        const order = req.body;
        const email = order.email || order.contact_email;

        if (!email) {
          return res.status(400).json({ error: "Order email is required" });
        }

        const lineItems = (order.line_items || []).map((item) => ({
          name: item.title || item.name,
          variant_title: item.variant_title,
          quantity: item.quantity,
          price: item.price,
        }));

        const html = orderConfirmationEmail({
          orderNumber: order.order_number || order.name,
          lineItems,
          totalPrice: order.total_price,
          orderStatusUrl: order.order_status_url,
        });

        const result = await sendEmail({
          to: email,
          subject: `Ordine confermato #${order.order_number || order.name} - TmaxMarket.it`,
          html,
        });

        console.log(`Order confirmation email sent to ${email}`, result);
        res.status(200).json({ success: true, emailId: result.data?.id });
      } catch (err) {
        console.error("Error sending order confirmation email:", err);
        res
          .status(500)
          .json({ error: "Failed to send order confirmation email" });
      }
    }
  );

  return app;
}

module.exports = { createApp };
