const { emailLayout, ctaButton } = require("./layout");
const { formatCurrency } = require("./orderConfirmation");

function abandonedCartEmail({ customerName, checkoutUrl, lineItems, totalPrice }) {
  const name = customerName || "Cliente";
  const url = checkoutUrl || "https://tmaxmarket.it";

  const itemsHtml = (lineItems || [])
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #eeeeee;font-size:14px;color:#333333;">
          ${item.title || item.name}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #eeeeee;font-size:14px;color:#333333;text-align:center;">
          ${item.quantity || 1}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #eeeeee;font-size:14px;color:#333333;text-align:right;">
          ${formatCurrency(item.price || 0)}
        </td>
      </tr>`
    )
    .join("");

  const cartTable =
    lineItems && lineItems.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eeeeee;border-radius:6px;overflow:hidden;margin:0 0 16px;">
        <tr style="background-color:#f9f9f9;">
          <th style="padding:12px 8px;font-size:13px;color:#666666;text-align:left;font-weight:600;text-transform:uppercase;">Prodotto</th>
          <th style="padding:12px 8px;font-size:13px;color:#666666;text-align:center;font-weight:600;text-transform:uppercase;">Qtà</th>
          <th style="padding:12px 8px;font-size:13px;color:#666666;text-align:right;font-weight:600;text-transform:uppercase;">Prezzo</th>
        </tr>
        ${itemsHtml}
        ${totalPrice ? `<tr style="background-color:#f9f9f9;">
          <td colspan="2" style="padding:14px 8px;font-size:16px;color:#1a1a1a;font-weight:bold;">Totale</td>
          <td style="padding:14px 8px;font-size:16px;color:#FF6B00;font-weight:bold;text-align:right;">${formatCurrency(totalPrice)}</td>
        </tr>` : ""}
      </table>`
      : "";

  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">
      Ciao ${name}, hai dimenticato qualcosa?
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#444444;line-height:1.6;">
      Abbiamo notato che hai lasciato dei prodotti nel carrello su <strong style="color:#FF6B00;">TmaxMarket.it</strong>.
      Non preoccuparti, li abbiamo salvati per te! 😉
    </p>
    ${cartTable}
    <p style="margin:0 0 8px;font-size:15px;color:#444444;line-height:1.6;">
      Completa il tuo acquisto prima che i prodotti vadano esauriti!
    </p>
    ${ctaButton("Completa l'acquisto →", url)}`;

  return emailLayout({
    bannerEmoji: "🛒",
    bannerTitle: "Il tuo carrello ti aspetta!",
    bodyHtml,
  });
}

module.exports = { abandonedCartEmail };
