/**
 * Hard 404 for any /workers/* path.
 *
 * The workers/ folder used to live inside website/ and was inadvertently
 * served as static assets, exposing the source code and wrangler.toml of the
 * d1-backup, uptime-monitor, and usage-monitor workers. We've moved them out
 * of website/ entirely, but Cloudflare's internal CDN may keep stale copies
 * for some time.
 *
 * This catch-all dynamic route guarantees an immediate 404 for everything
 * under /workers/, independent of cache state. Pages Functions take
 * precedence over static asset routing.
 */
export function onRequest() {
  return new Response('Not Found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  });
}
