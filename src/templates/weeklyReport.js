const { emailLayout, ctaButton } = require("./layout");
const { formatCurrency } = require("./orderConfirmation");

function weeklyReportEmail({ vendorName, totalOrders, totalRevenue, topProducts, periodStart, periodEnd }) {
  const name = vendorName || "Venditore";
  const orders = totalOrders || 0;
  const revenue = totalRevenue || 0;
  const period = periodStart && periodEnd ? `${periodStart} — ${periodEnd}` : "Ultima settimana";

  const productsHtml = (topProducts || [])
    .map(
      (p, i) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #eeeeee;font-size:14px;color:#333333;">
          ${i + 1}. ${p.name || p.title}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #eeeeee;font-size:14px;color:#333333;text-align:center;">
          ${p.quantity || 0} venduti
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #eeeeee;font-size:14px;color:#FF6B00;text-align:right;font-weight:bold;">
          ${formatCurrency(p.revenue || 0)}
        </td>
      </tr>`
    )
    .join("");

  const topProductsTable =
    topProducts && topProducts.length > 0
      ? `<h3 style="margin:24px 0 12px;font-size:16px;color:#1a1a1a;">🏆 Top Prodotti</h3>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eeeeee;border-radius:6px;overflow:hidden;margin:0 0 16px;">
        <tr style="background-color:#f9f9f9;">
          <th style="padding:12px 8px;font-size:13px;color:#666666;text-align:left;font-weight:600;">Prodotto</th>
          <th style="padding:12px 8px;font-size:13px;color:#666666;text-align:center;font-weight:600;">Vendite</th>
          <th style="padding:12px 8px;font-size:13px;color:#666666;text-align:right;font-weight:600;">Ricavo</th>
        </tr>
        ${productsHtml}
      </table>`
      : "";

  const bodyHtml = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#1a1a1a;">
      Riepilogo settimanale, ${name} 📈
    </h2>
    <p style="margin:0 0 24px;font-size:13px;color:#888888;">${period}</p>
    <!-- Stats Cards -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
      <tr>
        <td style="width:50%;padding:16px;background-color:#fff8f0;border-radius:6px;text-align:center;">
          <p style="margin:0 0 4px;font-size:32px;color:#FF6B00;font-weight:bold;">${orders}</p>
          <p style="margin:0;font-size:14px;color:#666666;">Ordini ricevuti</p>
        </td>
        <td style="width:8px;"></td>
        <td style="width:50%;padding:16px;background-color:#fff8f0;border-radius:6px;text-align:center;">
          <p style="margin:0 0 4px;font-size:32px;color:#FF6B00;font-weight:bold;">${formatCurrency(revenue)}</p>
          <p style="margin:0;font-size:14px;color:#666666;">Ricavo totale</p>
        </td>
      </tr>
    </table>
    ${topProductsTable}
    <p style="margin:16px 0 0;font-size:15px;color:#444444;line-height:1.6;">
      Continua così! Per vedere tutti i dettagli, visita il tuo pannello venditore.
    </p>
    ${ctaButton("Vai al pannello venditore →", "https://tmaxmarket.it/vendor/dashboard")}`;

  return emailLayout({
    bannerEmoji: "📊",
    bannerTitle: "Ecco il riepilogo della tua settimana",
    bodyHtml,
  });
}

module.exports = { weeklyReportEmail };
