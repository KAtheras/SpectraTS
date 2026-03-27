import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function handler(event) {
  try {
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
