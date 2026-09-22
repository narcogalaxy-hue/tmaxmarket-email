const fetch = require("node-fetch");

const SHOPIFY_GRAPHQL_URL = "https://tmaxmarket-it.myshopify.com/admin/api/2026-07/graphql.json";

function getAccessToken() {
  return process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_API_SECRET;
}

async function shopifyGraphQL(query, variables = {}) {
  const token = getAccessToken();
  if (!token) {
    throw new Error("SHOPIFY_ACCESS_TOKEN is not set");
  }
  const res = await fetch(SHOPIFY_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    if (!Array.isArray(json.errors)) throw new Error(`Shopify error: ${JSON.stringify(json.errors)}`);
    const msg = json.errors.map((e) => e.message).join("; ");
    throw new Error(`Shopify GraphQL error: ${msg}`);
  }
  return json.data;
}

function parseAcquisti(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function getGarageByHandle(handle) {
  const query = `
    query getGarageVehicle($handle: MetaobjectHandleInput!) {
      metaobjectByHandle(handle: $handle) {
        id
        handle
        fields {
          key
          value
        }
      }
    }
  `;
  const data = await shopifyGraphQL(query, {
    handle: { type: "veicolo_garage", handle },
  });
  return data.metaobjectByHandle;
}

async function updateMetaobjectAcquisti(metaobjectId, acquistiJson) {
  const query = `
    mutation metaobjectUpdate($id: ID!, $metaobject: MetaobjectUpdateInput!) {
      metaobjectUpdate(id: $id, metaobject: $metaobject) {
        metaobject {
          id
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const data = await shopifyGraphQL(query, {
    id: metaobjectId,
    metaobject: {
      fields: [{ key: "acquisti", value: acquistiJson }],
    },
  });
  const result = data.metaobjectUpdate;
  if (result.userErrors && result.userErrors.length > 0) {
    throw new Error(`Metaobject update error: ${result.userErrors.map((e) => e.message).join("; ")}`);
  }
  return result.metaobject;
}

async function createGarageWithAcquisti(handle, customerId, acquistiJson) {
  const query = `
    mutation metaobjectUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        metaobject {
          id
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const data = await shopifyGraphQL(query, {
    handle: { type: "veicolo_garage", handle },
    metaobject: {
      fields: [
        { key: "cliente", value: `gid://shopify/Customer/${customerId}` },
        { key: "acquisti", value: acquistiJson },
      ],
    },
  });
  const result = data.metaobjectUpsert;
  if (result.userErrors && result.userErrors.length > 0) {
    throw new Error(`Metaobject upsert error: ${result.userErrors.map((e) => e.message).join("; ")}`);
  }
  return result.metaobject;
}

function extractCustomerId(order) {
  if (order.customer && order.customer.id) {
    // Could be numeric or GID format
    const idStr = String(order.customer.id);
    if (idStr.startsWith("gid://")) {
      return idStr.split("/").pop();
    }
    return idStr;
  }
  return null;
}

function buildPurchaseItems(order) {
  const orderDate = order.created_at
    ? order.created_at.substring(0, 10)
    : new Date().toISOString().substring(0, 10);
  const orderId = String(order.id || order.order_number || "");

  return (order.line_items || []).map((item) => ({
    product: item.title || item.name || "Prodotto",
    date: orderDate,
    order_id: orderId,
    price: item.price || "0.00",
  }));
}

async function handleOrderPaid(order) {
  const customerId = extractCustomerId(order);
  if (!customerId) {
    return { skipped: true, reason: "No customer ID in order" };
  }

  const handle = `garage-${customerId}`;
  const newItems = buildPurchaseItems(order);

  if (newItems.length === 0) {
    return { skipped: true, reason: "No line items in order" };
  }

  // Try to find existing garage
  const existing = await getGarageByHandle(handle);

  if (existing) {
    // Read existing acquisti and append
    const acquistiField = existing.fields.find((f) => f.key === "acquisti");
    const currentAcquisti = parseAcquisti(acquistiField ? acquistiField.value : null);
    const updatedAcquisti = [...currentAcquisti, ...newItems];
    const updatedJson = JSON.stringify(updatedAcquisti);

    const metaobject = await updateMetaobjectAcquisti(existing.id, updatedJson);
    return {
      success: true,
      action: "updated",
      metaobject_id: metaobject.id,
      items_added: newItems.length,
      total_items: updatedAcquisti.length,
    };
  } else {
    // Create new garage with just acquisti
    const acquistiJson = JSON.stringify(newItems);
    const metaobject = await createGarageWithAcquisti(handle, customerId, acquistiJson);
    return {
      success: true,
      action: "created",
      metaobject_id: metaobject.id,
      items_added: newItems.length,
      total_items: newItems.length,
    };
  }
}

module.exports = {
  handleOrderPaid,
  // Exported for testing
  _internal: {
    shopifyGraphQL,
    parseAcquisti,
    getGarageByHandle,
    updateMetaobjectAcquisti,
    createGarageWithAcquisti,
    extractCustomerId,
    buildPurchaseItems,
  },
};
