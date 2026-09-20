const crypto = require("crypto");

function verifyShopifyWebhook(req, res, next) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("SHOPIFY_WEBHOOK_SECRET is not set");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
  if (!hmacHeader) {
    return res.status(401).json({ error: "Missing HMAC header" });
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    return res.status(400).json({ error: "Missing request body" });
  }

  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  const hmacBuf = Buffer.from(hmacHeader);
  const computedBuf = Buffer.from(computed);

  if (hmacBuf.length !== computedBuf.length) {
    return res.status(401).json({ error: "Invalid HMAC signature" });
  }

  const isValid = crypto.timingSafeEqual(hmacBuf, computedBuf);

  if (!isValid) {
    return res.status(401).json({ error: "Invalid HMAC signature" });
  }

  next();
}

module.exports = { verifyShopifyWebhook };
