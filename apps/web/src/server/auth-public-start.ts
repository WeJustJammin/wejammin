/**
 * Headers for the JSON request `/auth/start` forwards to AUTH-API-02/03.
 *
 * The Worker treats any request that carries a session cookie as a
 * cookie-authenticated mutation (BE00 step 2: same-origin and session-bound CSRF
 * before the body is read). An HTML sign-in form cannot send a CSRF header, so a
 * browser that still holds a stale session cookie would be refused the public
 * sign-in. A `sign_in` start needs no session, so the web edge drops the
 * browser's cookies and CSRF header before forwarding it. Every other intent
 * keeps its credentials and is gated by the Worker.
 */
export const publicStartHeaders = (
  source: Headers,
  intent: unknown,
): Headers => {
  const headers = new Headers(source);
  headers.set('content-type', 'application/json');
  if (intent === 'sign_in') {
    headers.delete('cookie');
    headers.delete('x-csrf-token');
  }
  return headers;
};
