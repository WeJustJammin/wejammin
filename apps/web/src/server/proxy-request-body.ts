/**
 * Body handling for the first-party web proxies that forward a browser request
 * to the private API Worker.
 *
 * BE00 step 2 (same-origin, size ceiling, content type, session-bound CSRF)
 * belongs to the Worker and runs before the body is read. A proxy that buffers
 * the body first (`await request.arrayBuffer()`) consumes a cookie-bearing,
 * possibly unauthorised request at the web ingress before any of those checks.
 * This helper hands the inbound stream to the upstream request untouched: the
 * web never pulls a byte, and the Worker decides whether it is read at all.
 */

type StreamingRequestInit = RequestInit & { duplex?: 'half' };

/** `RequestInit` members that carry the inbound body, unread, to the upstream request. */
export const untouchedBodyInit = (
  request: Request,
  method: string,
): StreamingRequestInit =>
  method === 'GET' || method === 'HEAD' || request.body === null
    ? {}
    : { body: request.body, duplex: 'half' };
