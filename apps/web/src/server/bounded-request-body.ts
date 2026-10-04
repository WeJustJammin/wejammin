/**
 * Bounded read of an inbound request body for a public web route that must parse
 * the body itself (a first-party form post). A `Content-Length` is only an
 * early-refusal hint: chunked HTTP/1.1 and HTTP/2 requests carry none, so the
 * ceiling is enforced while the stream is consumed and the stream is cancelled
 * the moment it crosses the ceiling, never buffering the overflow.
 */

export type BoundedRequestBody =
  | Readonly<{ ok: true; bytes: Uint8Array<ArrayBuffer> }>
  | Readonly<{ ok: false; reason: 'malformed-length' | 'too-large' }>;

/** A declared length is plain digits: no sign, exponent, fraction, list or padding. */
const DECLARED_LENGTH = /^[0-9]{1,15}$/u;

const concat = (
  chunks: readonly Uint8Array[],
  total: number,
): Uint8Array<ArrayBuffer> => {
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

/**
 * Reads at most `maxBytes` of the request body. A present but malformed or
 * oversize `Content-Length` is refused before the body is touched; a body that
 * crosses `maxBytes` (declared or not) is cancelled after the chunk that crossed
 * it and refused.
 */
export const readBoundedRequestBody = async (
  request: Request,
  maxBytes: number,
): Promise<BoundedRequestBody> => {
  const declared = request.headers.get('content-length');
  if (declared !== null) {
    if (!DECLARED_LENGTH.test(declared))
      return { ok: false, reason: 'malformed-length' };
    if (Number(declared) > maxBytes) return { ok: false, reason: 'too-large' };
  }
  if (request.body === null) return { ok: true, bytes: new Uint8Array() };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    total += next.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, reason: 'too-large' };
    }
    chunks.push(next.value);
  }
  return { ok: true, bytes: concat(chunks, total) };
};
