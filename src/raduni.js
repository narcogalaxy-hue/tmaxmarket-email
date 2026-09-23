const express = require("express");
const fetch = require("node-fetch");
const multer = require("multer");
const FormData = require("form-data");
const { sendEmail } = require("./email");
const { radunoNotificaEmail } = require("./templates/radunoNotifica");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato immagine non supportato. Usa JPG, PNG o GIF."));
    }
  },
});

const SHOPIFY_GRAPHQL_URL =
  "https://tmaxmarket-it.myshopify.com/admin/api/2026-07/graphql.json";

function getAccessToken() {
  return process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_API_SECRET;
}

async function shopifyGraphQL(query, variables = {}) {
  const token = getAccessToken();
  if (!token) throw new Error("SHOPIFY_ACCESS_TOKEN is not set");
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
    const msg = json.errors.map((e) => e.message).join("; ");
    throw new Error(`Shopify GraphQL error: ${msg}`);
  }
  return json.data;
}

async function uploadImageToShopify(fileBuffer, originalName, mimeType) {
  const stagedQuery = `
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }`;

  const stagedData = await shopifyGraphQL(stagedQuery, {
    input: [{ resource: "FILE", filename: originalName, mimeType: mimeType, httpMethod: "POST" }],
  });

  const stagedResult = stagedData.stagedUploadsCreate;
  if (stagedResult.userErrors && stagedResult.userErrors.length > 0) {
    throw new Error(`Staged upload error: ${stagedResult.userErrors.map((e) => e.message).join("; ")}`);
  }

  const target = stagedResult.stagedTargets[0];
  if (!target) throw new Error("Staged upload failed: nessun target restituito");

  const form = new FormData();
  for (const param of target.parameters) {
    form.append(param.name, param.value);
  }
  form.append("file", fileBuffer, { filename: originalName, contentType: mimeType });

  const uploadRes = await fetch(target.url, { method: "POST", body: form, headers: form.getHeaders() });
  if (!uploadRes.ok && uploadRes.status !== 201) {
    const errText = await uploadRes.text().catch(() => "");
    throw new Error(`Staged upload POST failed: ${uploadRes.status} ${uploadRes.statusText} – ${errText}`);
  }

  const fileCreateQuery = `
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          ... on MediaImage { id image { url } fileStatus }
        }
        userErrors { field message }
      }
    }`;

  const fileData = await shopifyGraphQL(fileCreateQuery, {
    files: [{ originalSource: target.resourceUrl, contentType: "IMAGE" }],
  });

  const fileResult = fileData.fileCreate;
  if (fileResult.userErrors && fileResult.userErrors.length > 0) {
    throw new Error(`File create error: ${fileResult.userErrors.map((e) => e.message).join("; ")}`);
  }

  const createdFile = fileResult.files[0];
  if (!createdFile) throw new Error("fileCreate returned no files");

  return await pollForImageUrl(createdFile.id);
}

async function pollForImageUrl(fileId, maxRetries = 8, delayMs = 2500) {
  const query = `
    query getFile($id: ID!) {
      node(id: $id) {
        ... on MediaImage { fileStatus image { url } }
      }
    }`;

  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    const data = await shopifyGraphQL(query, { id: fileId });
    const node = data.node;
    if (node?.fileStatus === "FAILED") throw new Error("Shopify ha rifiutato l'immagine");
    if (node?.image?.url) return node.image.url;
    console.log(`[raduni] Image still processing (attempt ${i + 1}/${maxRetries})...`);
  }
  console.warn(`[raduni] Image not ready after ${maxRetries} retries – publishing without image`);
  return null;
}

async function getCustomerWithTags(customerId) {
  if (customerId.includes("@")) {
    const query = `
      query getCustomerByEmail($query: String!) {
        customers(first: 1, query: $query) {
          edges { node { id email firstName lastName tags } }
        }
      }`;
    const data = await shopifyGraphQL(query, { query: `email:${customerId}` });
    const edge = data.customers.edges[0];
    return edge ? edge.node : null;
  }
  const numericId = String(customerId).replace(/\D/g, "");
  const gid = `gid://shopify/Customer/${numericId}`;
  const query = `
    query getCustomerById($id: ID!) {
      customer(id: $id) { id email firstName lastName tags }
    }`;
  const data = await shopifyGraphQL(query, { id: gid });
  return data.customer;
}

const BLOG_ID = "gid://shopify/Blog/102029099148";

function buildArticleBody({ gruppo, dataEvento, luogo, link, descrizione, itinerario, ristorante, infoUtili }) {
  const parts = [];
  parts.push(`<p><strong>Gruppo:</strong> ${gruppo}</p>`);
  parts.push(`<p><strong>Data evento:</strong> ${dataEvento}</p>`);
  parts.push(`<p><strong>Luogo:</strong> ${luogo}</p>`);
  if (link) parts.push(`<p><strong>Link:</strong> <a href="${link}" target="_blank">${link}</a></p>`);
  if (descrizione) parts.push(`<hr/><p><strong>Descrizione:</strong></p><p>${descrizione}</p>`);
  if (itinerario) parts.push(`<hr/><p><strong>🗺️ Itinerario:</strong></p><p>${itinerario}</p>`);
  if (ristorante) parts.push(`<p><strong>🍽️ Ristorante consigliato:</strong> ${ristorante}</p>`);
  if (infoUtili) parts.push(`<hr/><p><strong>ℹ️ Info utili:</strong></p><p>${infoUtili}</p>`);
  return parts.join("\n");
}

async function createRadunoArticle({ titolo, gruppo, dataEvento, luogo, link, descrizione, itinerario, ristorante, infoUtili, authorName, imageUrl }) {
  const bodyHtml = buildArticleBody({ gruppo, dataEvento, luogo, link, descrizione, itinerario, ristorante, infoUtili });

  const query = `
    mutation articleCreate($article: ArticleCreateInput!) {
      articleCreate(article: $article) {
        article { id handle }
        userErrors { field message }
      }
    }`;

  const articleInput = {
    blogId: BLOG_ID,
    title: titolo,
    body: bodyHtml,
    isPublished: true,
    author: { name: authorName || gruppo || "Presidente di gruppo" },
    metafields: [{ namespace: "custom", key: "data_evento", value: dataEvento, type: "date" }],
  };

  if (imageUrl) {
    articleInput.image = { url: imageUrl, altText: `Locandina: ${titolo}` };
  }

  const data = await shopifyGraphQL(query, { article: articleInput });
  const result = data.articleCreate;
  if (result.userErrors && result.userErrors.length > 0) {
    throw new Error(`Article create error: ${result.userErrors.map((e) => e.message).join("; ")}`);
  }
  return result.article;
}

router.post("/pubblica", upload.single("immagine"), async (req, res) => {
  try {
    const { customerId, gruppo, titolo, dataEvento, luogo, link, descrizione, itinerario, ristorante, infoUtili } = req.body;

    if (!customerId || !gruppo || !titolo || !dataEvento || !luogo) {
      return res.status(400).json({ error: "Campi obbligatori mancanti: customerId, gruppo, titolo, dataEvento, luogo" });
    }

    const customer = await getCustomerWithTags(customerId);
    if (!customer) return res.status(404).json({ error: "Cliente non trovato" });

    const tags = customer.tags || [];
    if (!tags.includes("presidente-verificato")) {
      return res.status(403).json({ error: "Accesso negato: il tuo account non ha il tag 'presidente-verificato'" });
    }

    let imageUrl = null;
    if (req.file) {
      try {
        imageUrl = await uploadImageToShopify(req.file.buffer, req.file.originalname, req.file.mimetype);
      } catch (imgErr) {
        console.error("[raduni] Image upload failed, continuing without image:", imgErr.message);
      }
    }

    const authorName = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || gruppo;

    const article = await createRadunoArticle({ titolo, gruppo, dataEvento, luogo, link, descrizione, itinerario, ristorante, infoUtili, authorName, imageUrl });
    const articleUrl = `https://tmaxmarket.it/blogs/raduni-eventi/${article.handle}`;

    const notificaHtml = radunoNotificaEmail({ titolo, gruppo, dataEvento, luogo, link, descrizione, authorName, articleUrl });
    await sendEmail({ to: "pablostmaxshop@gmail.com", subject: `Nuovo raduno pubblicato: ${titolo} 📍`, html: notificaHtml });

    console.log(`Raduno article created: ${article.id}`);
    res.status(200).json({ success: true, article_id: article.id, article_url: articleUrl, image_url: imageUrl, message: "Raduno pubblicato con successo" });
  } catch (err) {
    console.error("Error publishing raduno:", err);
    if (err instanceof multer.MulterError) {
      const messages = { LIMIT_FILE_SIZE: "L'immagine supera il limite di 5 MB", LIMIT_UNEXPECTED_FILE: "Campo file non atteso" };
      return res.status(400).json({ error: messages[err.code] || `Errore upload: ${err.message}` });
    }
    if (err.message && err.message.includes("Formato immagine")) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Errore nella pubblicazione del raduno", details: err.message });
  }
});

module.exports = { raduniRouter: router };
