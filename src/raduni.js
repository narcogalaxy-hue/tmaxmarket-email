const express = require("express");
const fetch = require("node-fetch");
const { sendEmail } = require("./email");
const { radunoNotificaEmail } = require("./templates/radunoNotifica");

const router = express.Router();

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

function buildArticleBody({ gruppo, dataEvento, luogo, link, descrizione }) {
  const parts = [];
  parts.push(`<p><strong>Gruppo:</strong> ${gruppo}</p>`);
  parts.push(`<p><strong>Data evento:</strong> ${dataEvento}</p>`);
  parts.push(`<p><strong>Luogo:</strong> ${luogo}</p>`);
  if (link) parts.push(`<p><strong>Link:</strong> <a href="${link}" target="_blank">${link}</a></p>`);
  if (descrizione) parts.push(`<hr/><p>${descrizione}</p>`);
  return parts.join("\n");
}

async function createRadunoArticle({ titolo, gruppo, dataEvento, luogo, link, descrizione, authorName }) {
  const bodyHtml = buildArticleBody({ gruppo, dataEvento, luogo, link, descrizione });
  const query = `
    mutation articleCreate($article: ArticleCreateInput!) {
      articleCreate(article: $article) {
        article { id handle }
        userErrors { field message }
      }
    }`;
  const variables = {
    article: {
      blogId: BLOG_ID,
      title: titolo,
      body: bodyHtml,
      isPublished: true,
      author: { name: authorName || gruppo || "Presidente di gruppo" },
      metafields: [{
        namespace: "custom",
        key: "data_evento",
        value: dataEvento,
        type: "date",
      }],
    },
  };
  const data = await shopifyGraphQL(query, variables);
  const result = data.articleCreate;
  if (result.userErrors && result.userErrors.length > 0) {
    throw new Error(`Article create error: ${result.userErrors.map((e) => e.message).join("; ")}`);
  }
  return result.article;
}

router.post("/pubblica", async (req, res) => {
  try {
    const { customerId, gruppo, titolo, dataEvento, luogo, link, descrizione } = req.body;

    if (!customerId || !gruppo || !titolo || !dataEvento || !luogo) {
      return res.status(400).json({ error: "Campi obbligatori mancanti: customerId, gruppo, titolo, dataEvento, luogo" });
    }

    const customer = await getCustomerWithTags(customerId);
    if (!customer) return res.status(404).json({ error: "Cliente non trovato" });

    const tags = customer.tags || [];
    if (!tags.includes("presidente-verificato")) {
      return res.status(403).json({ error: "Accesso negato: il tuo account non ha il tag 'presidente-verificato'" });
    }

    const authorName = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || gruppo;
    const article = await createRadunoArticle({ titolo, gruppo, dataEvento, luogo, link, descrizione, authorName });
    const articleUrl = `https://tmaxmarket.it/blogs/raduni-eventi/${article.handle}`;

    const notificaHtml = radunoNotificaEmail({ titolo, gruppo, dataEvento, luogo, link, descrizione, authorName, articleUrl });
    await sendEmail({ to: "pablostmaxshop@gmail.com", subject: `Nuovo raduno pubblicato: ${titolo} 📍`, html: notificaHtml });

    console.log(`Raduno article created: ${article.id}`);
    res.status(200).json({ success: true, article_id: article.id, article_url: articleUrl, message: "Raduno pubblicato con successo" });
  } catch (err) {
    console.error("Error publishing raduno:", err);
    res.status(500).json({ error: "Errore nella pubblicazione del raduno", details: err.message });
  }
});

module.exports = { raduniRouter: router };
