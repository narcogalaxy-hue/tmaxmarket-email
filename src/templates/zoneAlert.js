const { emailLayout, ctaButton } = require("./layout");
const { formatCurrency } = require("./orderConfirmation");

function zoneAlertEmail({ listing, subscriberZone }) {
  const { title, price, zone, model, url, image_url } = listing || {};
  const listingUrl = url || "https://tmaxmarket.it";

  const imageSection = image_url
    ? `<img src="${image_url}" alt="${title || "Annuncio"}" style="width:100%;max-width:100%;height:auto;border-radius:6px;margin:0 0 16px;" />`
    : "";

  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">
      Nuovo annuncio nella tua zona! 🛵
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#444444;line-height:1.6;">
      Abbiamo trovato un annuncio che potrebbe interessarti su <strong style="color:#FF6B00;">TmaxMarket.it</strong>:
    </p>
    ${imageSection}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eeeeee;border-radius:6px;overflow:hidden;margin:0 0 16px;">
      <tr>
        <td style="padding:16px;">
          <h3 style="margin:0 0 12px;font-size:18px;color:#1a1a1a;">${title || "Annuncio"}</h3>
          ${price ? `<p style="margin:0 0 8px;font-size:20px;color:#FF6B00;font-weight:bold;">${formatCurrency(price)}</p>` : ""}
          ${zone ? `<p style="margin:0 0 4px;font-size:14px;color:#666666;">📍 Zona: <strong>${zone}</strong></p>` : ""}
          ${model ? `<p style="margin:0 0 4px;font-size:14px;color:#666666;">🛵 Modello: <strong>${model}</strong></p>` : ""}
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;color:#888888;line-height:1.5;">
      Ricevi questa email perché sei iscritto agli avvisi per la zona <strong>${subscriberZone || zone || "Italia"}</strong>.
    </p>
    ${ctaButton("Vedi l'annuncio →", listingUrl)}`;

  return emailLayout({
    bannerEmoji: "📍",
    bannerTitle: "Avviso zona!",
    bodyHtml,
  });
}

module.exports = { zoneAlertEmail };
