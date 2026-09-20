const { emailLayout, ctaButton } = require("./layout");

function vendorWelcomeEmail({ vendorName }) {
  const name = vendorName || "Venditore";

  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">
      Benvenuto su TmaxMarket.it, ${name}! 🎉
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#444444;line-height:1.6;">
      Siamo entusiasti di averti come venditore sulla nostra piattaforma! TmaxMarket.it è il punto di riferimento
      per gli appassionati di <strong>Yamaha Tmax</strong> in Italia.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#444444;line-height:1.6;">
      Ecco come iniziare a vendere in pochi passi:
    </p>
    <ol style="margin:0 0 16px;padding-left:20px;font-size:15px;color:#444444;line-height:1.8;">
      <li>📸 <strong>Carica il tuo primo annuncio</strong> — Accedi al pannello venditore e clicca "Nuovo Annuncio"</li>
      <li>📝 <strong>Compila i dettagli</strong> — Titolo, descrizione, prezzo e foto di qualità</li>
      <li>🏷️ <strong>Scegli la categoria</strong> — Ricambi, accessori, abbigliamento o altro</li>
      <li>✅ <strong>Pubblica!</strong> — Il tuo annuncio sarà subito visibile agli acquirenti</li>
    </ol>
    <p style="margin:0;font-size:15px;color:#444444;line-height:1.6;">
      Il nostro team è qui per aiutarti. Non esitare a contattarci per qualsiasi domanda!
    </p>
    ${ctaButton("Carica il primo annuncio →", "https://tmaxmarket.it/vendor/dashboard")}`;

  return emailLayout({
    bannerEmoji: "🏪",
    bannerTitle: "Benvenuto tra i venditori!",
    bodyHtml,
  });
}

function vendorListingTipsEmail({ vendorName }) {
  const name = vendorName || "Venditore";

  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">
      Consigli per annunci perfetti, ${name}! 💡
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#444444;line-height:1.6;">
      Vuoi che i tuoi annunci su <strong style="color:#FF6B00;">TmaxMarket.it</strong> attirino più acquirenti?
      Ecco i nostri migliori consigli:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
      <tr>
        <td style="padding:16px;background-color:#fff8f0;border-left:4px solid #FF6B00;border-radius:4px;margin-bottom:12px;">
          <p style="margin:0 0 8px;font-size:16px;color:#1a1a1a;font-weight:bold;">📸 Foto di alta qualità</p>
          <p style="margin:0;font-size:14px;color:#444444;line-height:1.5;">
            Scatta foto nitide con buona illuminazione. Mostra il prodotto da più angolazioni.
            I compratori vogliono vedere esattamente cosa stanno acquistando.
          </p>
        </td>
      </tr>
      <tr><td style="height:12px;"></td></tr>
      <tr>
        <td style="padding:16px;background-color:#fff8f0;border-left:4px solid #FF6B00;border-radius:4px;">
          <p style="margin:0 0 8px;font-size:16px;color:#1a1a1a;font-weight:bold;">📝 Descrizioni dettagliate</p>
          <p style="margin:0;font-size:14px;color:#444444;line-height:1.5;">
            Includi marca, modello compatibile (es. Tmax 530, 560), condizioni, anno e misure.
            Più dettagli = meno domande = vendite più rapide.
          </p>
        </td>
      </tr>
      <tr><td style="height:12px;"></td></tr>
      <tr>
        <td style="padding:16px;background-color:#fff8f0;border-left:4px solid #FF6B00;border-radius:4px;">
          <p style="margin:0 0 8px;font-size:16px;color:#1a1a1a;font-weight:bold;">💰 Prezzi competitivi</p>
          <p style="margin:0;font-size:14px;color:#444444;line-height:1.5;">
            Controlla i prezzi degli altri venditori prima di pubblicare.
            Un prezzo giusto attira più visualizzazioni e vendite.
          </p>
        </td>
      </tr>
      <tr><td style="height:12px;"></td></tr>
      <tr>
        <td style="padding:16px;background-color:#fff8f0;border-left:4px solid #FF6B00;border-radius:4px;">
          <p style="margin:0 0 8px;font-size:16px;color:#1a1a1a;font-weight:bold;">🏷️ Titoli efficaci</p>
          <p style="margin:0;font-size:14px;color:#444444;line-height:1.5;">
            Usa titoli chiari: "Cinghia trasmissione Tmax 530 2017-2020 - Nuova" è meglio di "Cinghia scooter".
          </p>
        </td>
      </tr>
    </table>
    ${ctaButton("Vai al pannello venditore →", "https://tmaxmarket.it/vendor/dashboard")}`;

  return emailLayout({
    bannerEmoji: "💡",
    bannerTitle: "Consigli per vendere meglio",
    bodyHtml,
  });
}

function vendorOrdersPayoutEmail({ vendorName }) {
  const name = vendorName || "Venditore";

  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">
      Gestire ordini e pagamenti, ${name} 📊
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#444444;line-height:1.6;">
      Ora che sei operativo su <strong style="color:#FF6B00;">TmaxMarket.it</strong>, ecco tutto quello che devi sapere
      sulla gestione degli ordini e dei pagamenti.
    </p>
    <h3 style="margin:0 0 12px;font-size:18px;color:#1a1a1a;">📦 Gestione Ordini</h3>
    <ul style="margin:0 0 20px;padding-left:20px;font-size:15px;color:#444444;line-height:1.8;">
      <li>Riceverai una notifica email per ogni nuovo ordine</li>
      <li>Prepara e spedisci entro <strong>48 ore</strong> dalla ricezione</li>
      <li>Inserisci il <strong>numero di tracking</strong> nel pannello venditore</li>
      <li>Comunica con l'acquirente in caso di ritardi</li>
    </ul>
    <h3 style="margin:0 0 12px;font-size:18px;color:#1a1a1a;">💳 Pagamenti</h3>
    <ul style="margin:0 0 20px;padding-left:20px;font-size:15px;color:#444444;line-height:1.8;">
      <li>I pagamenti vengono processati ogni <strong>lunedì</strong></li>
      <li>Riceverai il bonifico sul conto IBAN inserito nel profilo</li>
      <li>La commissione della piattaforma è del <strong>5%</strong> sul venduto</li>
      <li>Puoi consultare il riepilogo pagamenti nel pannello venditore</li>
    </ul>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff8f0;border-left:4px solid #FF6B00;border-radius:4px;margin:0 0 16px;">
      <tr><td style="padding:16px;">
        <p style="margin:0;font-size:14px;color:#444444;line-height:1.5;">
          💡 <strong>Suggerimento:</strong> Assicurati di avere l'IBAN aggiornato nel tuo profilo
          per ricevere i pagamenti senza ritardi.
        </p>
      </td></tr>
    </table>
    ${ctaButton("Gestisci i tuoi ordini →", "https://tmaxmarket.it/vendor/orders")}`;

  return emailLayout({
    bannerEmoji: "📊",
    bannerTitle: "Ordini e Pagamenti",
    bodyHtml,
  });
}

module.exports = { vendorWelcomeEmail, vendorListingTipsEmail, vendorOrdersPayoutEmail };
