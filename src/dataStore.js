const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON(filename) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJSON(filename, data) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// --- Zone Alerts ---
function getZoneAlerts() {
  return readJSON("zone-alerts.json") || { subscribers: [] };
}

function addZoneSubscriber({ email, zone, tmax_model, max_price }) {
  const data = getZoneAlerts();
  const existing = data.subscribers.find(
    (s) => s.email === email && s.zone === zone
  );
  if (existing) {
    existing.tmax_model = tmax_model || existing.tmax_model;
    existing.max_price = max_price || existing.max_price;
  } else {
    data.subscribers.push({
      email,
      zone,
      tmax_model: tmax_model || null,
      max_price: max_price != null ? Number(max_price) : null,
      created_at: new Date().toISOString(),
    });
  }
  writeJSON("zone-alerts.json", data);
  return data;
}

function findMatchingSubscribers(listing) {
  const data = getZoneAlerts();
  return data.subscribers.filter((sub) => {
    const zoneMatch =
      sub.zone.toLowerCase() === (listing.zone || "").toLowerCase();
    const modelMatch =
      !sub.tmax_model ||
      !listing.model ||
      listing.model.toLowerCase().includes(sub.tmax_model.toLowerCase());
    const priceMatch =
      sub.max_price == null ||
      listing.price == null ||
      Number(listing.price) <= sub.max_price;
    return zoneMatch && modelMatch && priceMatch;
  });
}

// --- Checkout tracking (abandoned cart) ---
function trackCheckout(checkoutId, data) {
  const checkouts = readJSON("checkouts.json") || {};
  checkouts[String(checkoutId)] = {
    ...data,
    created_at: new Date().toISOString(),
  };
  writeJSON("checkouts.json", checkouts);
}

function getCheckout(checkoutId) {
  const checkouts = readJSON("checkouts.json") || {};
  return checkouts[String(checkoutId)] || null;
}

function removeCheckout(checkoutId) {
  const checkouts = readJSON("checkouts.json") || {};
  delete checkouts[String(checkoutId)];
  writeJSON("checkouts.json", checkouts);
}

// --- Order tracking (to detect completed checkouts) ---
function trackOrder(orderId, checkoutToken) {
  const orders = readJSON("orders.json") || {};
  orders[String(checkoutToken || orderId)] = {
    orderId,
    created_at: new Date().toISOString(),
  };
  writeJSON("orders.json", orders);
}

function hasOrderForCheckout(checkoutToken) {
  const orders = readJSON("orders.json") || {};
  return !!orders[String(checkoutToken)];
}

module.exports = {
  readJSON,
  writeJSON,
  getZoneAlerts,
  addZoneSubscriber,
  findMatchingSubscribers,
  trackCheckout,
  getCheckout,
  removeCheckout,
  trackOrder,
  hasOrderForCheckout,
};
