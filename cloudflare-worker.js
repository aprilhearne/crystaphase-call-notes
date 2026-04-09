// Crystaphase Call Note Generator — Cloudflare Worker Proxy
// This worker sits between your public web app and Claude's API.
// Your API key is stored securely as an environment variable — never exposed to users.
//
// SETUP:
// 1. Go to https://dash.cloudflare.com → Workers & Pages → Create Worker
// 2. Paste this entire file into the editor
// 3. Click "Settings" → "Variables and Secrets" → Add:
//    - Variable name: ANTHROPIC_API_KEY
//    - Value: your sk-ant-api03-... key (mark as "Encrypt")
// 4. (Optional) Add variable: ALLOWED_ORIGIN = https://yourdomain.com
//    If not set, defaults to allowing all origins (fine for internal use)
// 5. Click "Save and Deploy"
// 6. Copy your worker URL (e.g. https://crystaphase-callnotes.yourname.workers.dev)
// 7. Paste that URL into the HTML app's Settings as the "Proxy URL"

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(env),
      });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders(env), 'Content-Type': 'application/json' },
      });
    }

    // Check API key is configured
    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'API key not configured on server' }), {
        status: 500,
        headers: { ...corsHeaders(env), 'Content-Type': 'application/json' },
      });
    }

    try {
      // Read the request body from the web app
      const body = await request.json();

      // Forward to Claude API
      const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: body.model || 'claude-sonnet-4-20250514',
          max_tokens: body.max_tokens || 2048,
          system: body.system || '',
          messages: body.messages || [],
        }),
      });

      const data = await claudeResponse.json();

      return new Response(JSON.stringify(data), {
        status: claudeResponse.status,
        headers: {
          ...corsHeaders(env),
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders(env), 'Content-Type': 'application/json' },
      });
    }
  },
};

function corsHeaders(env) {
  const origin = env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
