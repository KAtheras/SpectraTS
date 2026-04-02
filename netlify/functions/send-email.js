const { Resend } = require("resend");
const {
  ensureSchema,
  errorResponse,
  getSessionContext,
  getSql,
  json,
  requireAuth,
} = require("./_db");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  if (!to || !subject || !html) {
    throw new Error("Missing to, subject, or html");
  }

  const from = process.env.EMAIL_FROM || "no-reply@trakmetric.com";
  return resend.emails.send({
    from,
    to,
    subject,
    html,
  });
}

exports.sendEmail = sendEmail;

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return errorResponse(405, "Method not allowed.");
  }

  try {
    const sql = await getSql();
    await ensureSchema(sql);
    const context = await getSessionContext(sql, event);
    const authError = requireAuth(context);
    if (authError) {
      return authError;
    }

    if (!event.body || !String(event.body).trim()) {
      return errorResponse(400, "Missing request body");
    }

    const { to, subject, html } = JSON.parse(event.body);
    const response = await sendEmail({ to, subject, html });
    return json(200, { success: true, response });
  } catch (error) {
    console.error("[send-email] failed", {
      message: error?.message || "Unknown error",
      stack: error?.stack || null,
    });
    return errorResponse(500, error.message || "Unable to send email.");
  }
};
