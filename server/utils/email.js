const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

function getClient() {
  const region = process.env.AWS_REGION || "us-east-1";
  const accessKey = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!accessKey || !secretKey) {
    throw new Error("AWS email is not configured: AWS_ACCESS_KEY and AWS_SECRET_KEY are required in .env");
  }
  return new SESClient({
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
}

/**
 * Send email via AWS SES.
 * @param {{ to: string; subject: string; text?: string; html?: string }} options
 */
async function sendEmail({ to, subject, text, html }) {
  const from = (process.env.ZEN_EMAIL || "").trim();
  if (!from) {
    throw new Error("AWS email is not configured: ZEN_EMAIL is required in .env (verified sender address)");
  }
  const client = getClient();
  const body = {};
  if (text) body.Text = { Data: text };
  if (html) body.Html = { Data: html };
  if (!body.Text && !body.Html) body.Text = { Data: subject };

  const command = new SendEmailCommand({
    Source: from,
    Destination: { ToAddresses: [String(to).trim()] },
    Message: {
      Subject: { Data: subject },
      Body: body,
    },
  });

  await client.send(command);
}

module.exports = { sendEmail };
