function emailLayout({ bannerEmoji, bannerTitle, bannerColor, bodyHtml }) {
  const bg = bannerColor || "#FF6B00";
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
          <!-- Banner -->
          <tr>
            <td style="background-color:${bg};padding:20px 24px;text-align:center;">
              ${bannerEmoji ? `<span style="font-size:36px;">${bannerEmoji}</span>` : ""}
              ${bannerTitle ? `<h2 style="margin:8px 0 0;font-size:20px;color:#ffffff;font-weight:bold;">${bannerTitle}</h2>` : ""}
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 24px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#1a1a1a;padding:24px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#aaaaaa;">
                Hai domande? Rispondi a questa email o contattaci su
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

function ctaButton(text, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0;">
  <tr>
    <td style="border-radius:6px;background-color:#FF6B00;">
      <a href="${href}" target="_blank"
         style="display:inline-block;padding:14px 32px;font-size:16px;color:#ffffff;text-decoration:none;font-weight:bold;letter-spacing:0.5px;">
        ${text}
      </a>
    </td>
  </tr>
</table>`;
}

module.exports = { emailLayout, ctaButton };
