const express = require("express");
const { garageRouter } = require("./garage");
const { verifyShopifyWebhook } = require("./middleware/verifyShopify");
const { sendEmail } = require("./email");
const { welcomeEmail } = require("./templates/welcome");
const { orderConfirmationEmail } = require("./templates/orderConfirmation");
const { fulfillmentEmail } = require("./templates/fulfillment");
const { reviewRequestEmail } = require("./templates/reviewRequest");
const { abandonedCartEmail } = require("./templates/abandonedCart");
const {
  vendorWelcomeEmail,
  vendorListingTipsEmail,
  vendorOrdersPayoutEmail,
} = require("./templates/vendorOnboarding");
const { zoneAlertEmail } = require("./templates/zoneAlert");
const { weeklyReportEmail } = require("./templates/weeklyReport");
const { scheduleEmail } = require("./scheduler");
const {
  addZoneSubscriber,
  findMatchingSubscribers,
  trackCheckout,
  hasOrderForCheckout,
  removeCheckout,
  trackOrder,
} = require("./dataStore");

// Delay getters (read env at call time so tests can override)
function getDelay(envKey, defaultMs) {
  return process.env[envKey] ? Number(process.env[envKey]) : defaultMs;
}

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

  // ──────────────────────────────────────────
  // Webhook: customers/create (welcome email)
  // ──────────────────────────────────────────
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

  // ──────────────────────────────────────────
  // Webhook: orders/create (order confirmation)
  // ──────────────────────────────────────────
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

        // Track order to detect completed checkouts
        if (order.checkout_token || order.checkout_id) {
          trackOrder(order.id || order.order_number, order.checkout_token || order.checkout_id);
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

  // ──────────────────────────────────────────────────────
  // Webhook: orders/fulfilled (shipping + review schedule)
  // ──────────────────────────────────────────────────────
  app.post(
    "/webhooks/orders/fulfilled",
    verifyShopifyWebhook,
    async (req, res) => {
      try {
        const order = req.body;
        const email = order.email || order.contact_email;

        if (!email) {
          return res.status(400).json({ error: "Order email is required" });
        }

        const orderNumber = order.order_number || order.name;

        // Extract tracking info from fulfillments
        const fulfillment =
          (order.fulfillments && order.fulfillments[0]) || {};
        const trackingNumber =
          fulfillment.tracking_number || order.tracking_number || null;
        const trackingUrl =
          fulfillment.tracking_url || order.tracking_url || null;
        const carrier =
          fulfillment.tracking_company || order.tracking_company || null;
        const estimatedDelivery =
          fulfillment.estimated_delivery_at || order.estimated_delivery_at || null;

        // 1. Send fulfillment/shipping email
        const html = fulfillmentEmail({
          orderNumber,
          trackingNumber,
          trackingUrl,
          carrier,
          estimatedDelivery,
        });

        const result = await sendEmail({
          to: email,
          subject: "Il tuo ordine è in arrivo! 🚚 - TmaxMarket.it",
          html,
        });

        // 2. Schedule review request email (5 days later)
        const reviewDelayMs = getDelay("REVIEW_DELAY_MS", 5 * 24 * 60 * 60 * 1000);
        const customerName =
          order.customer?.first_name ||
          order.shipping_address?.first_name ||
          null;
        const reviewId = `review-${orderNumber}-${email}`;
        scheduleEmail(reviewId, reviewDelayMs, async () => {
          const reviewHtml = reviewRequestEmail({
            orderNumber,
            customerName,
            orderStatusUrl:
              order.order_status_url ||
              "https://tmaxmarket.it/account/orders",
          });
          await sendEmail({
            to: email,
            subject:
              "Come è andata? Lascia una recensione 🌟 - TmaxMarket.it",
            html: reviewHtml,
          });
          console.log(`Review request sent to ${email} for order #${orderNumber}`);
        });

        console.log(`Fulfillment email sent to ${email}`, result);
        res.status(200).json({
          success: true,
          emailId: result.data?.id,
          reviewScheduled: true,
        });
      } catch (err) {
        console.error("Error sending fulfillment email:", err);
        res
          .status(500)
          .json({ error: "Failed to send fulfillment email" });
      }
    }
  );

  // ──────────────────────────────────────────
  // Webhook: checkouts/create (abandoned cart)
  // ──────────────────────────────────────────
  app.post(
    "/webhooks/checkouts/create",
    verifyShopifyWebhook,
    async (req, res) => {
      try {
        const checkout = req.body;
        const email = checkout.email || checkout.customer?.email;
        const checkoutToken = checkout.token || checkout.id;

        if (!email || !checkoutToken) {
          return res.status(400).json({
            error: "Checkout email and token are required",
          });
        }

        // Store checkout data
        trackCheckout(checkoutToken, {
          email,
          customerName:
            checkout.customer?.first_name ||
            checkout.billing_address?.first_name ||
            null,
          checkoutUrl:
            checkout.abandoned_checkout_url ||
            checkout.webUrl ||
            `https://tmaxmarket.it/checkouts/${checkoutToken}`,
          lineItems: (checkout.line_items || []).map((item) => ({
            title: item.title || item.name,
            quantity: item.quantity,
            price: item.price,
          })),
          totalPrice: checkout.total_price,
        });

        // Schedule abandoned cart email (1 hour later)
        const cartDelayMs = getDelay("CART_ABANDON_DELAY_MS", 60 * 60 * 1000);
        const cartId = `cart-${checkoutToken}`;
        scheduleEmail(cartId, cartDelayMs, async () => {
          // Check if an order was placed for this checkout
          if (hasOrderForCheckout(checkoutToken)) {
            console.log(
              `Checkout ${checkoutToken} completed, skipping abandoned cart email`
            );
            removeCheckout(checkoutToken);
            return;
          }

          const checkoutData = {
            email,
            customerName:
              checkout.customer?.first_name ||
              checkout.billing_address?.first_name ||
              null,
            checkoutUrl:
              checkout.abandoned_checkout_url ||
              checkout.webUrl ||
              `https://tmaxmarket.it/checkouts/${checkoutToken}`,
            lineItems: (checkout.line_items || []).map((item) => ({
              title: item.title || item.name,
              quantity: item.quantity,
              price: item.price,
            })),
            totalPrice: checkout.total_price,
          };

          const html = abandonedCartEmail(checkoutData);
          await sendEmail({
            to: email,
            subject: "Hai dimenticato qualcosa? 🛒 - TmaxMarket.it",
            html,
          });
          console.log(`Abandoned cart email sent to ${email}`);
          removeCheckout(checkoutToken);
        });

        console.log(`Checkout ${checkoutToken} tracked for ${email}`);
        res.status(200).json({
          success: true,
          message: "Checkout tracked, reminder scheduled",
        });
      } catch (err) {
        console.error("Error processing checkout:", err);
        res.status(500).json({ error: "Failed to process checkout" });
      }
    }
  );

  // ──────────────────────────────────────────────────
  // Webhook: vendors/create (vendor onboarding drip)
  // ──────────────────────────────────────────────────
  app.post("/webhooks/vendors/create", async (req, res) => {
    try {
      const vendor = req.body;
      const email = vendor.email;

      if (!email) {
        return res.status(400).json({ error: "Vendor email is required" });
      }

      const vendorName = vendor.name || vendor.first_name || null;

      // Email 1: Immediate welcome
      const welcomeHtml = vendorWelcomeEmail({ vendorName });
      const result = await sendEmail({
        to: email,
        subject: "Benvenuto tra i venditori di TmaxMarket.it! 🏪",
        html: welcomeHtml,
      });

      // Email 2: 24h later - listing tips
      const email2Delay = getDelay("VENDOR_EMAIL2_DELAY_MS", 24 * 60 * 60 * 1000);
      const tipsId = `vendor-tips-${email}`;
      scheduleEmail(tipsId, email2Delay, async () => {
        const tipsHtml = vendorListingTipsEmail({ vendorName });
        await sendEmail({
          to: email,
          subject:
            "Consigli per annunci perfetti su TmaxMarket.it 💡",
          html: tipsHtml,
        });
        console.log(`Vendor tips email sent to ${email}`);
      });

      // Email 3: 72h later - orders & payouts
      const email3Delay = getDelay("VENDOR_EMAIL3_DELAY_MS", 72 * 60 * 60 * 1000);
      const payoutId = `vendor-payout-${email}`;
      scheduleEmail(payoutId, email3Delay, async () => {
        const payoutHtml = vendorOrdersPayoutEmail({ vendorName });
        await sendEmail({
          to: email,
          subject:
            "Gestire ordini e pagamenti su TmaxMarket.it 📊",
          html: payoutHtml,
        });
        console.log(`Vendor orders/payout email sent to ${email}`);
      });

      console.log(`Vendor onboarding started for ${email}`, result);
      res.status(200).json({
        success: true,
        emailId: result.data?.id,
        sequenceScheduled: true,
      });
    } catch (err) {
      console.error("Error sending vendor onboarding email:", err);
      res
        .status(500)
        .json({ error: "Failed to send vendor onboarding email" });
    }
  });

  // ──────────────────────────────────────────
  // Zone Alerts: subscribe
  // ──────────────────────────────────────────
  app.post("/alerts/subscribe", async (req, res) => {
    try {
      const { email, zone, tmax_model, max_price } = req.body;

      if (!email || !zone) {
        return res
          .status(400)
          .json({ error: "Email and zone are required" });
      }

      addZoneSubscriber({ email, zone, tmax_model, max_price });
      res
        .status(200)
        .json({ success: true, message: "Subscribed to zone alerts" });
    } catch (err) {
      console.error("Error subscribing to zone alerts:", err);
      res.status(500).json({ error: "Failed to subscribe" });
    }
  });

  // ──────────────────────────────────────────
  // Zone Alerts: notify matching subscribers
  // ──────────────────────────────────────────
  app.post("/alerts/notify", async (req, res) => {
    try {
      const { listing } = req.body;

      if (!listing || !listing.zone) {
        return res
          .status(400)
          .json({ error: "Listing with zone is required" });
      }

      const subscribers = findMatchingSubscribers(listing);

      if (subscribers.length === 0) {
        return res
          .status(200)
          .json({ success: true, notified: 0, message: "No matching subscribers" });
      }

      const results = [];
      for (const sub of subscribers) {
        try {
          const html = zoneAlertEmail({
            listing,
            subscriberZone: sub.zone,
          });
          const result = await sendEmail({
            to: sub.email,
            subject: "Nuovo annuncio nella tua zona! 🛵 - TmaxMarket.it",
            html,
          });
          results.push({ email: sub.email, success: true, emailId: result.data?.id });
        } catch (emailErr) {
          results.push({ email: sub.email, success: false, error: emailErr.message });
        }
      }

      console.log(
        `Zone alert: notified ${results.filter((r) => r.success).length}/${subscribers.length} subscribers`
      );
      res.status(200).json({
        success: true,
        notified: results.filter((r) => r.success).length,
        total: subscribers.length,
        results,
      });
    } catch (err) {
      console.error("Error sending zone alerts:", err);
      res.status(500).json({ error: "Failed to send zone alerts" });
    }
  });

  // ──────────────────────────────────────────
  // Weekly Report: manual trigger
  // ──────────────────────────────────────────
  app.post("/reports/trigger-weekly", async (req, res) => {
    try {
      const {
        vendors,
        vendorName,
        email,
        totalOrders,
        totalRevenue,
        topProducts,
        periodStart,
        periodEnd,
      } = req.body;

      // Support both single vendor and batch
      const vendorList = vendors || [
        { email, vendorName, totalOrders, totalRevenue, topProducts },
      ];

      if (!vendorList.length || !vendorList[0].email) {
        return res.status(400).json({ error: "At least one vendor with email is required" });
      }

      const results = [];
      for (const v of vendorList) {
        try {
          const html = weeklyReportEmail({
            vendorName: v.vendorName || v.name,
            totalOrders: v.totalOrders,
            totalRevenue: v.totalRevenue,
            topProducts: v.topProducts,
            periodStart: periodStart || v.periodStart,
            periodEnd: periodEnd || v.periodEnd,
          });
          const result = await sendEmail({
            to: v.email,
            subject:
              "Ecco il riepilogo della tua settimana su TmaxMarket.it 📊",
            html,
          });
          results.push({ email: v.email, success: true, emailId: result.data?.id });
        } catch (emailErr) {
          results.push({ email: v.email, success: false, error: emailErr.message });
        }
      }

      res.status(200).json({
        success: true,
        sent: results.filter((r) => r.success).length,
        results,
      });
    } catch (err) {
      console.error("Error sending weekly report:", err);
      res.status(500).json({ error: "Failed to send weekly report" });
    }
  });

  // Garage module
  app.use("/garage", garageRouter);

  return app;
}

module.exports = { createApp };
