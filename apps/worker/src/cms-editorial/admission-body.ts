import type { Result } from './admission-common';
import {
  invalid,
  isParsedFailure,
  isParsedSuccess,
  issues,
  MAX_BODY_BYTES,
  type UnknownSchema,
  unsupportedMediaType,
  UUID_PATTERN,
} from './admission-common';
import type { CmsEditorialError } from './types';

/**
 * Bounded body reader. BE03b registers no 413 row for the editorial command
 * family, so an oversize body is refused as INVALID_REQUEST rather than
 * emitting a status outside the locked error registry.
 */
export const readBytes = async (
  request: Request,
  signal?: AbortSignal,
): Promise<Result<Uint8Array>> => {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES)
    return invalid('The request body is too large.');
  const body = request.body;
  if (body === null) return { ok: true, value: new Uint8Array() };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let aborted = false;
  const onAbort = (): void => {
    aborted = true;
    void reader.cancel();
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    while (true) {
      if (aborted || signal?.aborted)
        return invalid('The request body could not be read.');
      const next = await reader.read();
      if (aborted || signal?.aborted)
        return invalid('The request body could not be read.');
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return invalid('The request body is too large.');
      }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, value: bytes };
  } catch {
    return invalid('The request body could not be read.');
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
};

const decodeJson = <T>(bytes: Uint8Array, schema: UnknownSchema): Result<T> => {
  let value: unknown;
  try {
    value = JSON.parse(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes),
    ) as unknown;
  } catch {
    return invalid('The request body is not valid JSON.');
  }
  const parsed = schema.safeParse(value);
  if (isParsedSuccess<T>(parsed)) return { ok: true, value: parsed.data };
  return isParsedFailure(parsed)
    ? invalid('The request body failed validation.', issues(parsed.error), 422)
    : invalid('The request body failed validation.', {}, 422);
};

/**
 * BE00 step 2 (security/transport), decided from headers alone: the declared
 * body ceiling, then the content type. `UNSUPPORTED_MEDIA_TYPE` carries the
 * route allowlist (BE00 error table).
 */
export const jsonBodyPreflight = (
  request: Request,
): CmsEditorialError | null => {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES)
    return invalid('The request body is too large.');
  const media = request.headers.get('content-type')?.split(';')[0]?.trim();
  return media === 'application/json' ? null : unsupportedMediaType();
};

/** BE00 step 6: JSON syntax and strict Zod on bytes read at step 2. */
export const decodeJsonBody = <T>(
  bytes: Uint8Array,
  schema: UnknownSchema,
): Result<T> => decodeJson<T>(bytes, schema);

/** Exact-body strict parse: path parameters are bound separately. */
export const parseJsonBody = async <T>(
  request: Request,
  schema: UnknownSchema,
  signal?: AbortSignal,
): Promise<Result<T>> => {
  const preflight = jsonBodyPreflight(request);
  if (preflight !== null) return preflight;
  const bytes = await readBytes(request, signal);
  return bytes.ok ? decodeJson<T>(bytes.value, schema) : bytes;
};

export const parseRequestPathId = (
  value: string | undefined,
): Result<string> =>
  value !== undefined && UUID_PATTERN.test(value)
    ? { ok: true, value }
    : invalid('The path parameters are invalid.');
