const { emailLayout, ctaButton } = require("./layout");

function radunoNotificaEmail({
  titolo,
  gruppo,
  dataEvento,
  luogo,
  link,
  descrizione,
  authorName,
  articleUrl,
}) {
  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">
      Nuovo raduno pubblicato! 📍
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#444444;line-height:1.6;">
      Un presidente di gruppo ha appena pubblicato un nuovo evento su <strong style="color:#FF6B00;">TmaxMarket.it</strong>.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eeeeee;border-radius:6px;overflow:hidden;margin:0 0 16px;">
      <tr>
        <td style="padding:16px;">
          <h3 style="margin:0 0 12px;font-size:18px;color:#1a1a1a;">${titolo}</h3>
          <p style="margin:0 0 8px;font-size:14px;color:#666666;">👤 <strong>Gruppo:</strong> ${gruppo}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#666666;">📅 <strong>Data:</strong> ${dataEvento}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#666666;">📍 <strong>Luogo:</strong> ${luogo}</p>
          ${authorName ? `<p style="margin:0 0 8px;font-size:14px;color:#666666;">✍️ <strong>Pubblicato da:</strong> ${authorName}</p>` : ""}
          ${link ? `<p style="margin:0 0 8px;font-size:14px;color:#666666;">🔗 <strong>Link:</strong> <a href="${link}" style="color:#FF6B00;text-decoration:none;">${link}</a></p>` : ""}
          ${descrizione ? `<p style="margin:12px 0 0;font-size:14px;color:#444444;line-height:1.5;border-top:1px solid #eeeeee;padding-top:12px;">${descrizione}</p>` : ""}
        </td>
      </tr>
    </table>
    ${ctaButton("Vedi l'articolo →", articleUrl)}`;

  return emailLayout({
    bannerEmoji: "🏍️",
    bannerTitle: "Nuovo Raduno Pubblicato",
    bannerColor: "#FF6B00",
    bodyHtml,
  });
}

module.exports = { radunoNotificaEmail };
