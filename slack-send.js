// netlify/functions/slack-send.js
// Proxies Slack messages server-side to avoid browser CORS restrictions.
// Deploy by placing in netlify/functions/ in your GitHub repo.
// Set SLACK_BOT_TOKEN in Netlify environment variables (Site → Environment variables).

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // CORS headers — allow requests from your Netlify app
  const headers = {
    'Access-Control-Allow-Origin': 'https://adaptability-therapie-scheduler.netlify.app',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { channel, text } = JSON.parse(event.body);

    if (!channel || !text) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing channel or text' }) };
    }

    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'SLACK_BOT_TOKEN not configured in Netlify environment variables' }) };
    }

    const resp = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({ channel, text }),
    });

    const data = await resp.json();

    if (!data.ok) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: data.error }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
