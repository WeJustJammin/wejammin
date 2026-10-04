/**
 * Bounded read of an inbound request body for a public web route that must parse
 * the body itself (a first-party form post). A `Content-Length` is only an
 * early-refusal hint: chunked HTTP/1.1 and HTTP/2 requests carry none, so the
 * ceiling is enforced while the stream is consumed and the stream is cancelled
 * the moment it crosses the ceiling, never buffering the overflow.
 *
 * The read is fail-closed on the surrounding request: a reader that cannot be
 * acquired, a stream that errors or yields a non-byte chunk, and a read that
 * outlives the request abort or the bounded deadline all answer `ok: false`
 * instead of escaping as a route exception or holding the handler open. Cancel
 * is best-effort and never awaited, because a `tee` branch's cancel does not
 * settle until its sibling is cancelled too.
 */

export type BoundedRequestBody =
  | Readonly<{ ok: true; bytes: Uint8Array<ArrayBuffer> }>
  | Readonly<{
      ok: false;
      reason: 'malformed-length' | 'too-large' | 'unreadable' | 'aborted';
    }>;

export type BoundedRequestBodyOptions = Readonly<{
  /** Inclusive ceiling: a body of exactly `maxBytes` is accepted. */
  maxBytes: number;
  /** A request/route abort cancels the read and answers `aborted`. */
  signal?: AbortSignal | undefined;
  /** A bounded deadline for the whole read; expiry answers `unreadable`. */
  deadlineMs?: number | undefined;
}>;

/** A declared length is plain digits: no sign, exponent, fraction, list or padding. */
const DECLARED_LENGTH = /^[0-9]{1,15}$/u;

/** `setTimeout` clamps delays above 2^31-1 to 1; keep the deadline sane first. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * A stream chunk is a `Uint8Array` regardless of the realm that produced it.
 * undici — and every runtime boundary that hands a body back across a realm —
 * yields a `Uint8Array` whose constructor differs, so a realm-sensitive
 * `instanceof` would refuse a valid body. The `ArrayBuffer.isView` slot check
 * plus the byte tag still rejects a genuine non-byte chunk.
 */
const isByteChunk = (value: unknown): value is Uint8Array =>
  ArrayBuffer.isView(value) &&
  Object.prototype.toString.call(value) === '[object Uint8Array]';

const classifyDeclaredLength = (
  request: Request,
  maxBytes: number,
): 'too-large' | 'malformed-length' | 'unknown' | 'within' => {
  const raw = request.headers.get('content-length');
  if (raw === null) return 'unknown';
  if (!DECLARED_LENGTH.test(raw)) return 'malformed-length';
  return Number(raw) > maxBytes ? 'too-large' : 'within';
};

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
 * it and refused; and a read that errors, stalls past `deadlineMs`, or is aborted
 * through `signal` is refused unread. An external abort answers `aborted`; an
 * internal deadline expiry or a failed read answers `unreadable`.
 */
export const readBoundedRequestBody = async (
  request: Request,
  options: BoundedRequestBodyOptions,
): Promise<BoundedRequestBody> => {
  const { maxBytes, signal } = options;
  const declared = classifyDeclaredLength(request, maxBytes);
  if (declared === 'too-large') return { ok: false, reason: 'too-large' };
  if (declared === 'malformed-length')
    return { ok: false, reason: 'malformed-length' };
  if (signal?.aborted) return { ok: false, reason: 'aborted' };

  let body: ReadableStream<Uint8Array> | null;
  try {
    body = request.body;
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  if (body === null) return { ok: true, bytes: new Uint8Array() };

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = body.getReader();
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  // Best-effort: a `tee` branch's cancel never settles on its own, so it is
  // started and dropped rather than awaited.
  const cancel = (): void => {
    void reader.cancel().catch(() => undefined);
  };

  let stopReason: 'aborted' | 'deadline' | undefined;
  let stopRead: ((reason: unknown) => void) | undefined;
  const stop = new Promise<never>((_, reject) => {
    stopRead = reject;
  });
  stop.catch(() => undefined);
  const stopNow = (reason: 'aborted' | 'deadline'): void => {
    stopReason ??= reason;
    stopRead?.(new Error(reason));
  };
  const onAbort = (): void => stopNow('aborted');
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) stopNow('aborted');

  let expiry: ReturnType<typeof setTimeout> | undefined;
  if (options.deadlineMs !== undefined) {
    const ms = Math.min(
      Math.max(Math.trunc(options.deadlineMs), 0),
      MAX_TIMER_MS,
    );
    expiry = setTimeout(() => stopNow('deadline'), ms);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const next = await Promise.race([reader.read(), stop]);
      if (next.done) break;
      if (!isByteChunk(next.value)) {
        cancel();
        return { ok: false, reason: 'unreadable' };
      }
      total += next.value.byteLength;
      if (total > maxBytes) {
        cancel();
        return { ok: false, reason: 'too-large' };
      }
      chunks.push(next.value);
    }
  } catch {
    cancel();
    return {
      ok: false,
      reason: stopReason === 'aborted' ? 'aborted' : 'unreadable',
    };
  } finally {
    if (expiry !== undefined) clearTimeout(expiry);
    signal?.removeEventListener('abort', onAbort);
  }
  return { ok: true, bytes: concat(chunks, total) };
};
