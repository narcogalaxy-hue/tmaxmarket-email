function formatCurrency(amount) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function orderConfirmationEmail({ orderNumber, lineItems, totalPrice, orderStatusUrl }) {
  const itemsHtml = (lineItems || [])
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 8px;border-bottom:1px solid #eeeeee;font-size:14px;color:#333333;">
          ${item.name}${item.variant_title ? ` — <span style="color:#888;">${item.variant_title}</span>` : ""}
        </td>
        <td style="padding:12px 8px;border-bottom:1px solid #eeeeee;font-size:14px;color:#333333;text-align:center;">
          ${item.quantity}
        </td>
        <td style="padding:12px 8px;border-bottom:1px solid #eeeeee;font-size:14px;color:#333333;text-align:right;">
          ${formatCurrency(item.price)}
        </td>
      </tr>`
    )
    .join("");

  const statusLink = orderStatusUrl || "https://tmaxmarket.it/account/orders";

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ordine confermato #${orderNumber}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a1a;padding:32px 24px;text-align:center;">
              <h1 style="margin:0;font-size:28px;color:#FF6B00;font-weight:bold;letter-spacing:1px;">
                TmaxMarket.it
              </h1>
              <p style="margin:8px 0 0;font-size:13px;color:#aaaaaa;letter-spacing:0.5px;">
                Ricambi &amp; Accessori Yamaha Tmax
              </p>
            </td>
          </tr>

          <!-- Confirmation Banner -->
          <tr>
            <td style="background-color:#FF6B00;padding:20px 24px;text-align:center;">
              <span style="font-size:36px;">✅</span>
              <h2 style="margin:8px 0 0;font-size:20px;color:#ffffff;font-weight:bold;">
                Ordine Confermato!
              </h2>
            </td>
          </tr>

          <!-- Order Info -->
          <tr>
            <td style="padding:32px 24px 16px;">
              <p style="margin:0 0 8px;font-size:15px;color:#444444;line-height:1.6;">
                Grazie per il tuo acquisto! Il tuo ordine <strong style="color:#FF6B00;">#${orderNumber}</strong> è stato confermato.
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#444444;line-height:1.6;">
                Stiamo preparando il tuo pacco con cura. Riceverai una notifica quando verrà spedito.
              </p>
            </td>
          </tr>

          <!-- Items Table -->
          <tr>
            <td style="padding:0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eeeeee;border-radius:6px;overflow:hidden;">
                <tr style="background-color:#f9f9f9;">
                  <th style="padding:12px 8px;font-size:13px;color:#666666;text-align:left;font-weight:600;text-transform:uppercase;">Prodotto</th>
                  <th style="padding:12px 8px;font-size:13px;color:#666666;text-align:center;font-weight:600;text-transform:uppercase;">Qtà</th>
                  <th style="padding:12px 8px;font-size:13px;color:#666666;text-align:right;font-weight:600;text-transform:uppercase;">Prezzo</th>
                </tr>
                ${itemsHtml}
                <tr style="background-color:#f9f9f9;">
                  <td colspan="2" style="padding:14px 8px;font-size:16px;color:#1a1a1a;font-weight:bold;">Totale</td>
                  <td style="padding:14px 8px;font-size:16px;color:#FF6B00;font-weight:bold;text-align:right;">${formatCurrency(totalPrice)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Delivery Estimate -->
          <tr>
            <td style="padding:24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff8f0;border-left:4px solid #FF6B00;border-radius:4px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0;font-size:14px;color:#444444;line-height:1.5;">
                      🚚 <strong>Consegna stimata:</strong> 3–5 giorni lavorativi in Italia.
                      Riceverai il tracking via email non appena il pacco sarà stato affidato al corriere.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:0 24px 32px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:6px;background-color:#FF6B00;">
                    <a href="${statusLink}"
                       target="_blank"
                       style="display:inline-block;padding:14px 32px;font-size:16px;color:#ffffff;text-decoration:none;font-weight:bold;letter-spacing:0.5px;">
                      Vedi il tuo ordine →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1a1a1a;padding:24px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#aaaaaa;">
                Hai domande sul tuo ordine? Rispondi a questa email o contattaci su
                <a href="https://tmaxmarket.it/contatti" style="color:#FF6B00;text-decoration:none;">tmaxmarket.it/contatti</a>
              </p>
              <p style="margin:0;font-size:12px;color:#666666;">
                © ${new Date().getFullYear()} TmaxMarket.it — Tutti i diritti riservati
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { orderConfirmationEmail, formatCurrency };
