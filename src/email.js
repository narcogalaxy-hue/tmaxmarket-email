const { Resend } = require("resend");

const FROM_ADDRESS = "noreply@tmaxmarket.it";
const FROM_NAME = "TmaxMarket.it";

let resendClient = null;

function getResendClient() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

async function sendEmail({ to, subject, html }) {
  const resend = getResendClient();
  const result = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_ADDRESS}>`,
    to: [to],
    subject,
    html,
  });
  return result;
}

// Allow overriding client for tests
function setResendClient(client) {
  resendClient = client;
}

module.exports = { sendEmail, setResendClient, FROM_ADDRESS, FROM_NAME };
