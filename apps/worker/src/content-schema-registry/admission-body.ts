import type {
  ContentSchemaRegistryError,
  ContentSchemaRegistryResult,
} from './types';
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

export const readBytes = async (
  request: Request,
  signal?: AbortSignal,
): Promise<ContentSchemaRegistryResult<Uint8Array>> => {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES)
    return invalid('The request body is too large.', {}, 413);
  const body = request.clone().body;
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
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_BODY_BYTES) {
        // `request.clone()` tees the stream, and a tee branch's cancel promise
        // settles only when its sibling is cancelled too. The original branch
        // is never read here, so awaiting the cancel would hold an oversized
        // chunked body open forever instead of answering 413.
        void reader.cancel().catch(() => undefined);
        return invalid('The request body is too large.', {}, 413);
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

export type BodyOptions = Readonly<{
  /**
   * An operation whose BE03a matrix names an unknown request key as a
   * structural 400 INVALID_REQUEST (CMS-03A-10: a caller-supplied count, hash,
   * classification or report) sets this; every other operation answers an
   * unknown key as a 422 schema failure.
   */
  unknownKeyIsStructural?: boolean;
  /**
   * An operation whose complete refusal list needs database state the Worker
   * cannot see (CMS-03A-09 inherits the source and default locale from the
   * immutable source version) names here which Zod failures the database
   * validator re-evaluates in full. When it answers true the request is
   * forwarded unchanged, so the database's ordered issue list is the response
   * and no partial Worker list can stand in for it.
   */
  deferredToDatabase?: (
    value: unknown,
    issues: readonly Readonly<{ code?: string; message: string }>[],
  ) => boolean;
}>;

const decodeJson = <T>(
  bytes: Uint8Array,
  schema: UnknownSchema,
  options: BodyOptions,
): ContentSchemaRegistryResult<T> => {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return invalid('The request body is not valid JSON.');
  }
  const parsed = schema.safeParse(value);
  if (isParsedSuccess<T>(parsed)) return { ok: true, value: parsed.data };
  if (!isParsedFailure(parsed))
    return invalid('The request body failed validation.', {}, 422);
  if (options.deferredToDatabase?.(value, parsed.error.issues) === true)
    return { ok: true, value: value as T };
  if (options.unknownKeyIsStructural === true) {
    const unknownKeys = parsed.error.issues.filter(
      (issue) => issue.code === 'unrecognized_keys',
    );
    if (unknownKeys.length > 0)
      return invalid(
        'The request body has an unknown member.',
        issues({ issues: unknownKeys }),
      );
  }
  return invalid(
    'The request body failed validation.',
    issues(parsed.error),
    422,
  );
};

/**
 * BE00 step 2 (security/transport), the part decided from headers alone: the
 * declared body size ceiling, then the content type. `UNSUPPORTED_MEDIA_TYPE`
 * carries the route allowlist (BE00 error table).
 */
export const jsonBodyPreflight = (
  request: Request,
): ContentSchemaRegistryError | null => {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES)
    return invalid('The request body is too large.', {}, 413);
  const media = request.headers.get('content-type')?.split(';')[0]?.trim();
  return media === 'application/json' ? null : unsupportedMediaType();
};

/**
 * The raw bytes, bounded by the same ceiling while streaming. JSON syntax and
 * strict Zod validation are BE00 step 6 and run later through `decodeJsonBody`.
 */
export const readJsonBodyBytes = async (
  request: Request,
  signal?: AbortSignal,
): Promise<ContentSchemaRegistryResult<Uint8Array>> =>
  jsonBodyPreflight(request) ?? (await readBytes(request, signal));

export const decodeJsonBody = <T>(
  bytes: Uint8Array,
  schema: UnknownSchema,
  options: BodyOptions = {},
): ContentSchemaRegistryResult<T> => decodeJson<T>(bytes, schema, options);

export const parseJsonBody = async <T>(
  request: Request,
  schema: UnknownSchema,
  signal?: AbortSignal,
  options: BodyOptions = {},
): Promise<ContentSchemaRegistryResult<T>> => {
  const bytes = await readJsonBodyBytes(request, signal);
  return bytes.ok ? decodeJson(bytes.value, schema, options) : bytes;
};

export const parseRequestPathId = (
  value: string | undefined,
): ContentSchemaRegistryResult<string> =>
  value !== undefined && UUID_PATTERN.test(value)
    ? { ok: true, value }
    : invalid('The path parameters are invalid.');
