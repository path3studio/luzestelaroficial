/**
 * POST /api/auth/logout — Clear auth cookie
 */
export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'le_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    },
  });
}
