const express = require("express");
const multer = require("multer");
const fetch = require("node-fetch");
const FormData = require("form-data");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const SHOPIFY_GRAPHQL_URL = "https://tmaxmarket-it.myshopify.com/admin/api/2026-07/graphql.json";

function getAccessToken() {
  return process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_API_SECRET;
}

async function shopifyGraphQL(query, variables = {}) {
  const token = getAccessToken();
  if (!token) {
    throw new Error("SHOPIFY_API_SECRET is not set");
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

// Step 1: Create a staged upload target
async function createStagedUpload(filename, mimeType, fileSize) {
  const query = `
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const variables = {
    input: [
      {
        resource: "FILE",
        filename,
        mimeType,
        httpMethod: "POST",
        fileSize: String(fileSize),
      },
    ],
  };
  const data = await shopifyGraphQL(query, variables);
  const result = data.stagedUploadsCreate;
  if (result.userErrors && result.userErrors.length > 0) {
    throw new Error(`Staged upload error: ${result.userErrors.map((e) => e.message).join("; ")}`);
  }
  return result.stagedTargets[0];
}

// Step 2: Upload the file to the staged URL
async function uploadToStagedTarget(target, fileBuffer, mimeType) {
  const form = new FormData();
  for (const param of target.parameters) {
    form.append(param.name, param.value);
  }
  form.append("file", fileBuffer, {
    filename: "garage-photo.jpg",
    contentType: mimeType,
  });

  const res = await fetch(target.url, {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`File upload failed (${res.status}): ${text}`);
  }
  return target.resourceUrl;
}

// Step 3: Register file in Shopify
async function createShopifyFile(resourceUrl, filename) {
  const query = `
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          alt
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const variables = {
    files: [
      {
        alt: `Garage photo - ${filename}`,
        contentType: "IMAGE",
        originalSource: resourceUrl,
      },
    ],
  };
  const data = await shopifyGraphQL(query, variables);
  const result = data.fileCreate;
  if (result.userErrors && result.userErrors.length > 0) {
    throw new Error(`File create error: ${result.userErrors.map((e) => e.message).join("; ")}`);
  }
  return result.files[0];
}

// Step 4: Upsert metaobject
async function upsertGarageMetaobject({ handle, customerId, anno, cilindrata, modello, modifiche, fotoFileId }) {
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

  const fields = [
    { key: "cliente", value: `gid://shopify/Customer/${customerId}` },
    { key: "anno", value: anno },
    { key: "cilindrata", value: cilindrata },
    { key: "modello", value: modello },
    { key: "modifiche", value: modifiche },
  ];

  if (fotoFileId) {
    fields.push({ key: "foto", value: fotoFileId });
  }

  const variables = {
    handle: {
      type: "veicolo_garage",
      handle,
    },
    metaobject: {
      fields,
    },
  };

  const data = await shopifyGraphQL(query, variables);
  const result = data.metaobjectUpsert;
  if (result.userErrors && result.userErrors.length > 0) {
    throw new Error(`Metaobject upsert error: ${result.userErrors.map((e) => e.message).join("; ")}`);
  }
  return result.metaobject;
}

// Fetch metaobject by handle
async function getGarageMetaobject(handle) {
  const query = `
    query getGarageVehicle($handle: MetaobjectHandleInput!) {
      metaobjectByHandle(handle: $handle) {
        id
        handle
        fields {
          key
          value
          reference {
            ... on MediaImage {
              image {
                url
              }
            }
          }
        }
      }
    }
  `;

  const variables = {
    handle: {
      type: "veicolo_garage",
      handle,
    },
  };

  const data = await shopifyGraphQL(query, variables);
  return data.metaobjectByHandle;
}

// ──────────────────────────────────────
// POST /garage/save
// ──────────────────────────────────────
router.post("/save", upload.single("foto"), async (req, res) => {
  try {
    const { customer_id, anno, cilindrata, modello, modifiche } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: "customer_id is required" });
    }

    const handle = `garage-${customer_id}`;
    let fotoFileId = null;

    // Upload photo if provided
    if (req.file) {
      const file = req.file;
      const mimeType = file.mimetype || "image/jpeg";
      const filename = file.originalname || "garage-photo.jpg";

      // Step 1: Get staged upload URL
      const stagedTarget = await createStagedUpload(filename, mimeType, file.size);

      // Step 2: Upload file to staged target
      const resourceUrl = await uploadToStagedTarget(stagedTarget, file.buffer, mimeType);

      // Step 3: Register file in Shopify
      const shopifyFile = await createShopifyFile(resourceUrl, filename);
      fotoFileId = shopifyFile.id;
    }

    // Step 4: Create/update metaobject
    const metaobject = await upsertGarageMetaobject({
      handle,
      customerId: customer_id,
      anno: anno || "",
      cilindrata: cilindrata || "",
      modello: modello || "",
      modifiche: modifiche || "",
      fotoFileId,
    });

    res.status(200).json({
      success: true,
      metaobject_id: metaobject.id,
    });
  } catch (err) {
    console.error("Error saving garage:", err);
    res.status(500).json({ error: "Failed to save garage data", details: err.message });
  }
});

// ──────────────────────────────────────
// GET /garage/:customer_id
// ──────────────────────────────────────
router.get("/:customer_id", async (req, res) => {
  try {
    const { customer_id } = req.params;

    if (!customer_id) {
      return res.status(400).json({ error: "customer_id is required" });
    }

    const handle = `garage-${customer_id}`;
    const metaobject = await getGarageMetaobject(handle);

    if (!metaobject) {
      return res.status(404).json({ error: "Garage not found for this customer" });
    }

    // Transform fields into a flat object
    const garage = { id: metaobject.id, handle: metaobject.handle };
    for (const field of metaobject.fields) {
      if (field.key === "foto" && field.reference?.image?.url) {
        garage.foto_url = field.reference.image.url;
      }
      garage[field.key] = field.value;
    }

    res.status(200).json({ success: true, garage });
  } catch (err) {
    console.error("Error fetching garage:", err);
    res.status(500).json({ error: "Failed to fetch garage data", details: err.message });
  }
});

module.exports = {
  garageRouter: router,
  // Exported for testing
  _internal: {
    shopifyGraphQL,
    createStagedUpload,
    uploadToStagedTarget,
    createShopifyFile,
    upsertGarageMetaobject,
    getGarageMetaobject,
  },
};
