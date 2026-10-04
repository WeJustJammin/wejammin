/**
 * The one bounded streaming reader for Worker request bodies (BE00 step 2).
 *
 * A declared `Content-Length` is only an early-rejection optimisation: it is
 * checked before any byte is read, and a malformed declaration is refused
 * unread. The ceiling itself is enforced on the bytes that actually arrive, so
 * a headerless chunked body (or one that under-declares) is cancelled the
 * moment `maxBytes + 1` bytes have been pulled instead of being buffered whole
 * and compared afterwards.
 */

export type BoundedBodyOutcome =
  | Readonly<{ kind: 'ok'; bytes: Uint8Array }>
  | Readonly<{ kind: 'too-large' }>
  | Readonly<{ kind: 'malformed-length' }>
  | Readonly<{ kind: 'unreadable' }>
  | Readonly<{ kind: 'aborted' }>;

export type BoundedBodyOptions = Readonly<{
  /** Inclusive ceiling: a body of exactly `maxBytes` is accepted. */
  maxBytes: number;
  /** BE00 deadline; an abort cancels the read and answers `aborted`. */
  signal?: AbortSignal | undefined;
  /**
   * Read a `request.clone()` branch and leave the original body unread. A tee
   * branch's cancel settles only when its sibling is cancelled too, so the
   * cancel is never awaited.
   */
  fromClone?: boolean;
}>;

const DECLARED_LENGTH = /^[0-9]+$/u;

const classifyDeclaredLength = (
  request: Request,
  maxBytes: number,
): 'too-large' | 'malformed-length' | 'unknown' | 'within' => {
  const raw = request.headers.get('content-length');
  if (raw === null) return 'unknown';
  if (!DECLARED_LENGTH.test(raw)) return 'malformed-length';
  const declared = Number(raw);
  if (!Number.isSafeInteger(declared)) return 'malformed-length';
  return declared > maxBytes ? 'too-large' : 'within';
};

const concatenate = (chunks: readonly Uint8Array[], total: number) => {
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

export const readBoundedRequestBytes = async (
  request: Request,
  options: BoundedBodyOptions,
): Promise<BoundedBodyOutcome> => {
  const { maxBytes, signal } = options;
  const declared = classifyDeclaredLength(request, maxBytes);
  if (declared === 'too-large') return { kind: 'too-large' };
  if (declared === 'malformed-length') return { kind: 'malformed-length' };
  if (signal?.aborted) return { kind: 'aborted' };

  let body: ReadableStream<Uint8Array> | null;
  try {
    body = options.fromClone ? request.clone().body : request.body;
  } catch {
    return { kind: 'unreadable' };
  }
  if (body === null) return { kind: 'ok', bytes: new Uint8Array() };

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = body.getReader();
  } catch {
    return { kind: 'unreadable' };
  }
  const cancel = (): void => {
    void reader.cancel().catch(() => undefined);
  };

  let wasAborted = false;
  let rejectAbort: ((reason: unknown) => void) | undefined;
  const abortion =
    signal === undefined
      ? undefined
      : new Promise<never>((_, reject) => {
          rejectAbort = reject;
        });
  void abortion?.catch(() => undefined);
  const onAbort = (): void => {
    wasAborted = true;
    cancel();
    rejectAbort?.(new Error('aborted'));
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await (abortion === undefined
        ? reader.read()
        : Promise.race([reader.read(), abortion]));
      if (wasAborted || signal?.aborted) return { kind: 'aborted' };
      if (next.done) break;
      if (!(next.value instanceof Uint8Array)) {
        cancel();
        return { kind: 'unreadable' };
      }
      total += next.value.byteLength;
      if (total > maxBytes) {
        cancel();
        return { kind: 'too-large' };
      }
      chunks.push(next.value);
    }
  } catch {
    cancel();
    return wasAborted ? { kind: 'aborted' } : { kind: 'unreadable' };
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
  return { kind: 'ok', bytes: concatenate(chunks, total) };
};

/** Lenient UTF-8 decode, matching `Request.text()` for a bounded body. */
export const decodeBoundedText = (bytes: Uint8Array): string =>
  new TextDecoder().decode(bytes);
