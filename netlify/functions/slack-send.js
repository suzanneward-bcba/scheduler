// netlify/functions/slack-send.js
// Proxies Slack webhook posts server-side to avoid browser CORS restrictions.
// Uses Node built-in https module — no dependencies needed.
// Set SLACK_WEBHOOK_URL in Netlify: Site config -> Environment variables.

const https = require('https');

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

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'SLACK_WEBHOOK_URL not set in Netlify environment variables' }) };
  }

  let text;
  try {
    const body = JSON.parse(event.body || '{}');
    text = body.text;
  } catch (e) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!text) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing text' }) };
  }

  try {
    const result = await webhookPost(webhookUrl, text);
    if (result !== 'ok') {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: result }) };
    }
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: e.message }) };
  }
};

// POST to Slack webhook using Node built-in https
function webhookPost(webhookUrl, text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ text });
    const url = new URL(webhookUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { resolve(data.trim()); }); // Slack returns "ok" or error string
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
