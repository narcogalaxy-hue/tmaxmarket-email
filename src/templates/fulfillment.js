const { emailLayout, ctaButton } = require("./layout");

function fulfillmentEmail({ orderNumber, trackingNumber, trackingUrl, carrier, estimatedDelivery }) {
  const trackingInfo = trackingNumber
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff8f0;border-left:4px solid #FF6B00;border-radius:4px;margin:0 0 16px;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 8px;font-size:14px;color:#444444;line-height:1.5;">
            📦 <strong>Corriere:</strong> ${carrier || "Corriere espresso"}
          </p>
          <p style="margin:0 0 8px;font-size:14px;color:#444444;line-height:1.5;">
            🔢 <strong>Numero tracking:</strong> <span style="color:#FF6B00;font-weight:bold;">${trackingNumber}</span>
          </p>
          ${estimatedDelivery ? `<p style="margin:0;font-size:14px;color:#444444;line-height:1.5;">📅 <strong>Consegna prevista:</strong> ${estimatedDelivery}</p>` : ""}
        </td></tr>
      </table>`
    : `<p style="margin:0 0 16px;font-size:14px;color:#888888;line-height:1.5;">
        Il tracking sarà disponibile a breve. Ti invieremo un aggiornamento non appena possibile.
      </p>`;

  const trackBtn = trackingUrl
    ? ctaButton("Traccia il tuo pacco →", trackingUrl)
    : ctaButton("Vedi il tuo ordine →", "https://tmaxmarket.it/account/orders");

  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">
      Il tuo ordine <span style="color:#FF6B00;">#${orderNumber}</span> è stato spedito!
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#444444;line-height:1.6;">
      Ottime notizie! Il tuo ordine è in viaggio verso di te. Ecco i dettagli della spedizione:
    </p>
    ${trackingInfo}
    <p style="margin:0;font-size:15px;color:#444444;line-height:1.6;">
      Ti consigliamo di tenere d'occhio la casella di posta per eventuali aggiornamenti sulla consegna.
    </p>
    ${trackBtn}`;

  return emailLayout({
    bannerEmoji: "🚚",
    bannerTitle: "Il tuo ordine è in viaggio!",
    bodyHtml,
  });
}

module.exports = { fulfillmentEmail };
