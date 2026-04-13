// netlify/functions/slack-send.js
// Proxies Slack DMs server-side to avoid browser CORS restrictions.
// Uses Node built-in https module — no dependencies, works on all Node versions.
// Set SLACK_BOT_TOKEN in Netlify: Site config -> Environment variables.

const https = require('https');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://adaptability-therapie-scheduler.netlify.app',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'SLACK_BOT_TOKEN not set in Netlify environment variables' })
    };
  }

  let channel, text;
  try {
    const body = JSON.parse(event.body || '{}');
    channel = body.channel;
    text    = body.text;
  } catch (e) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!channel || !text) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing channel or text' }) };
  }

  try {
    const result = await slackPost(token, channel, text);
    if (!result.ok) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: result.error }) };
    }
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: e.message }) };
  }
};

// Call Slack API using Node built-in https — no fetch dependency needed
function slackPost(token, channel, text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ channel, text });
    const options = {
      hostname: 'slack.com',
      path: '/api/chat.postMessage',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Bad JSON from Slack: ' + data.slice(0, 100))); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
