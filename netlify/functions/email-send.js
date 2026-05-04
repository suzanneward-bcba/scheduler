// netlify/functions/email-send.js
// Proxies email sends server-side via Resend so the API key never reaches the browser.
// Modeled directly on slack-send.js style — Node built-in https, no dependencies.
// Set RESEND_API_KEY in Netlify: Site config -> Environment variables.
//
// Sender is hard-coded to scheduler@adaptability.co (the verified domain in Resend).
// This is intentional — the front-end can choose recipient, subject, and body, but
// not the sender, so admins can't spoof a different from-address.
const https = require('https');

const FROM_ADDRESS = 'adaptABILITY Scheduler <scheduler@adaptability.co>';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'RESEND_API_KEY not set in Netlify environment variables' }) };
  }
  let to, subject, body;
  try {
    const parsed = JSON.parse(event.body || '{}');
    to = parsed.to;
    subject = parsed.subject;
    body = parsed.body;
  } catch (e) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }
  if (!to || !subject || !body) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing to, subject, or body' }) };
  }
  // Light validation — recipient must look like an email. Resend will give us a better
  // error if it's a real-looking but invalid address; this just catches obvious junk.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Recipient does not look like a valid email address' }) };
  }
  try {
    const result = await sendViaResend(apiKey, to, subject, body);
    if (result.error) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: result.error }) };
    }
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, id: result.id }) };
  } catch (e) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: e.message }) };
  }
};

// POST to Resend API using Node built-in https.
// Body is plain text; Resend will render it as text/plain in the recipient's inbox.
// Returns { id } on success or { error } on failure.
function sendViaResend(apiKey, to, subject, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject: subject,
      text: body,
    });
    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ id: parsed.id });
          } else {
            // Resend returns { name, message, statusCode } on errors
            resolve({ error: parsed.message || ('HTTP ' + res.statusCode) });
          }
        } catch (e) {
          resolve({ error: 'Could not parse Resend response: ' + data.slice(0, 200) });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
