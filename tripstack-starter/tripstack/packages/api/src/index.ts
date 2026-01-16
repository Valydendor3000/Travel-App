export interface Env {
  DB: D1Database;
  TRIPSTACK_KV: KVNamespace;
  R2_BUCKET: R2Bucket;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (url.pathname === '/health') return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", ...cors }});
    if (url.pathname === '/api/trips') {
      // Demo static response
      return new Response(JSON.stringify([{ id: 't1', title: 'Bahamas Group Cruise' }]), { headers: { "Content-Type": "application/json", ...cors }});
    }
    return new Response('Not found', { status: 404, headers: cors });
  }
}
