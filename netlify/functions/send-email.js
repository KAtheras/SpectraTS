import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function handler(event) {
  try {
    if (event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, message: 'send-email function is live' }),
      };
    }

    if (event.httpMethod === 'POST' && (!event.body || !String(event.body).trim())) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    const { to, subject, html } = JSON.parse(event.body);

    const response = await resend.emails.send({
      from: 'no-reply@trakmetric.com',
      to,
      subject,
      html,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, response }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
