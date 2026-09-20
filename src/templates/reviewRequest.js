const { emailLayout, ctaButton } = require("./layout");

function reviewRequestEmail({ orderNumber, customerName, orderStatusUrl }) {
  const name = customerName || "Cliente";
  const reviewUrl = orderStatusUrl || "https://tmaxmarket.it/account/orders";

  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">
      Ciao ${name}, com'è andata?
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#444444;line-height:1.6;">
      Speriamo che il tuo ordine <strong style="color:#FF6B00;">#${orderNumber}</strong> ti abbia soddisfatto! 😊
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#444444;line-height:1.6;">
      La tua opinione è fondamentale per noi e per la community di <strong style="color:#FF6B00;">TmaxMarket.it</strong>.
      Una recensione aiuta gli altri appassionati di Tmax a fare la scelta giusta!
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:#444444;line-height:1.6;">
      Bastano pochi secondi:
    </p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;color:#444444;line-height:1.8;">
      <li>⭐ Valuta i prodotti ricevuti</li>
      <li>📝 Scrivi un breve commento</li>
      <li>📸 Aggiungi una foto (opzionale)</li>
    </ul>
    ${ctaButton("Lascia una recensione ⭐", reviewUrl)}`;

  return emailLayout({
    bannerEmoji: "🌟",
    bannerTitle: "La tua opinione conta!",
    bodyHtml,
  });
}

module.exports = { reviewRequestEmail };
