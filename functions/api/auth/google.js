/**
 * GET /api/auth/google — Redirect to Google OAuth2 consent screen
 */
export async function onRequestGet(context) {
  const { GOOGLE_CLIENT_ID } = context.env;
  const url = new URL(context.request.url);
  const redirectUri = url.origin + '/api/auth/google-callback';
  const lang = url.searchParams.get('lang') || 'es';
  const newsletter = url.searchParams.get('newsletter') === '1';
  const redirect = url.searchParams.get('redirect') || null;

  // Generate CSRF state token — store JSON with lang + newsletter preference + app redirect
  const state = crypto.randomUUID();
  await context.env.AUTH_KV.put('oauth_state:' + state, JSON.stringify({ lang, newsletter, redirect }), { expirationTtl: 900 });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: state,
    prompt: 'select_account',
  });

  return Response.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString(), 302);
}
