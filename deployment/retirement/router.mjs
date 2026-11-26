import {
  isLegacyOrigin,
  migrationPeer,
} from '../../src/lib/settings/domainMigration.ts';

/**
 * Respond to one request for the specified legacy origin. The two adapters pin
 * different origins. The payload contains only the recovery page and retirement SW.
 */
export function handleRetirement(request, legacyOrigin, payload) {
  const url = new URL(request.url);
  const legacy = new URL(legacyOrigin);
  const headers = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (
    !isLegacyOrigin(legacyOrigin) ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.host !== legacy.host ||
    url.username ||
    url.password
  )
    return new Response(null, {status: 421, headers});
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response(null, {
      status: 405,
      headers: {...headers, Allow: 'GET, HEAD'},
    });

  const peer = migrationPeer(legacyOrigin);
  if (!peer) return new Response(null, {status: 421, headers});
  const isSecure = url.protocol === 'https:';
  const content = (body, type, extra) =>
    new Response(request.method === 'HEAD' ? null : body, {
      headers: {
        ...headers,
        'Content-Type': type,
        'X-WSQ-Source-Season': payload.sourceSeason,
        ...extra,
      },
    });
  if (isSecure && url.pathname === '/sw.js')
    return content(payload.serviceWorker, 'text/javascript; charset=utf-8', {
      'Service-Worker-Allowed': '/',
    });
  // Fragments never reach the edge. The browser checks the token before starting the exchange.
  if (
    isSecure &&
    url.pathname === '/settings' &&
    [...url.searchParams].length === 2 &&
    url.searchParams.get('mirror-action') === 'fetch' &&
    url.searchParams.get('mirror-from') === peer.origin
  ) {
    return content(payload.recoveryPage, 'text/html; charset=utf-8', {
      'Content-Security-Policy': payload.contentPolicy,
      'Referrer-Policy': 'no-referrer',
    });
  }
  // Change the authority in-place so a path beginning with // remains a path.
  // Leave Location fragment-free; the browser carries its original fragment across.
  url.protocol = 'https:';
  url.host = new URL(peer.origin).host;
  url.hash = '';
  return new Response(null, {
    status: 307,
    headers: {...headers, Location: url.href},
  });
}
