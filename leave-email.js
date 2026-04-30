// netlify/functions/leave-email.js
// Sends leave-decision emails via Resend (https://resend.com — free tier: 3000/month).
//
// Setup:
//   1. Sign up at resend.com (free, no credit card)
//   2. Add and verify your domain (adaptability.co) — or use their sandbox for testing
//   3. Generate an API key
//   4. In Netlify: Site Settings → Environment Variables, add:
//        RESEND_API_KEY = re_xxxxxxxxxxxxxxxxxxxx
//        LEAVE_FROM_EMAIL = scheduler@adaptability.co  (must be on a verified domain)
//   5. Drop this file in netlify/functions/leave-email.js
//   6. Commit + push — Netlify auto-deploys
//
// Front-end calls fetch('/.netlify/functions/leave-email') with { to, subject, html }.

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddr = process.env.LEAVE_FROM_EMAIL || 'scheduler@adaptability.co';

  if (!apiKey) {
    console.error('leave-email: RESEND_API_KEY not configured');
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { to, subject, html } = payload;
  if (!to || !subject || !html) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing to/subject/html' }) };
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'adaptABILITY Scheduler <' + fromAddr + '>',
        to: [to],
        subject: subject,
        html: html
      })
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error('Resend API error:', data);
      return { statusCode: resp.status, body: JSON.stringify(data) };
    }
    return { statusCode: 200, body: JSON.stringify({ id: data.id }) };
  } catch (e) {
    console.error('leave-email send error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
};
