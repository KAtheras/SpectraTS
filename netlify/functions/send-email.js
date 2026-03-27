const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async function handler(event) {
  try {
    const method = event?.httpMethod || 'GET';
    const from = process.env.EMAIL_FROM || 'no-reply@trakmetric.com';
    console.log('[send-email] request received', {
      method,
      hasApiKey: Boolean(process.env.RESEND_API_KEY),
      from,
    });

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
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    if (!to || !subject || !html) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing to, subject, or html' }),
      };
    }

    const response = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });
    console.log('[send-email] resend accepted', {
      to,
      from,
      id: response?.id || null,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, response }),
    };
  } catch (error) {
    console.error('[send-email] failed', {
      message: error?.message || 'Unknown error',
      stack: error?.stack || null,
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
