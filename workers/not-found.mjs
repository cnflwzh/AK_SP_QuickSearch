// Cloudflare serves matching assets and rewrites first. Only misses reach this Worker.
const errorHeaders = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
};

export default {
  /** Return our static 404 document on GET, retaining its status even under immutable asset paths. */
  async fetch(request, env) {
    const headers = new Headers(errorHeaders);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      headers.set('Allow', 'GET, HEAD');
      return new Response(null, {status: 405, headers});
    }
    headers.set('Content-Type', 'text/html; charset=utf-8');
    // The binding resolves the clean URL directly; it never recurses into this handler.
    const body =
      request.method === 'HEAD'
        ? null
        : (await env.ASSETS.fetch(new Request(new URL('/404', request.url))))
            .body;
    return new Response(body, {status: 404, headers});
  },
};
