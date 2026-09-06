// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const KIRA_TARGET_URL = 'https://kiraai.vn/api/v1/chat/completions';

Deno.serve(async (req) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    // 2. Validate secret key from Supabase Secrets
    const serverApiKey = Deno.env.get('KIRA_API_KEY');
    if (!serverApiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Chưa cấu hình KIRA_API_KEY trong Supabase Secrets! Vui lòng vào Project Settings -> Secrets để thiết lập.' 
        }),
        { 
          status: 500, 
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 3. Parse incoming request body
    const body = await req.json();
    const isStream = Boolean(body.stream);

    // 4. Forward request to KiraAI with server-side secret key
    const response = await fetch(KIRA_TARGET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serverApiKey}`
      },
      body: JSON.stringify(body)
    });

    // 5. Handle Streaming Response (Server-Sent Events)
    if (isStream && response.body) {
      return new Response(response.body, {
        status: response.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    // 6. Handle Standard JSON Response
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json'
      }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Lỗi xử lý yêu cầu AI qua proxy.' }),
      { 
        status: 500, 
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
      }
    );
  }
});
