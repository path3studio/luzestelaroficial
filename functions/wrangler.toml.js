/**
 * Hard 404 for /wrangler.toml.
 *
 * The file used to live at the root of the Pages build output and was
 * inadvertently served as a static asset, leaking D1/KV/R2 IDs and the list
 * of secret env-var names. We've moved the real wrangler.toml outside of
 * website/ entirely, but Cloudflare's internal CDN keeps content-addressed
 * copies around even after a deployment removes them from the manifest.
 *
 * A Pages Function takes precedence over static asset routing, so this
 * guarantees the leaked content is replaced by a real 404 immediately,
 * independent of any cache-purge state.
 */
export function onRequest() {
  return new Response('Not Found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  });
}
