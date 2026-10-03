import type { ContentSchemaRegistryResult } from './types';
import {
  invalid,
  isParsedFailure,
  isParsedSuccess,
  issues,
  MAX_BODY_BYTES,
  type UnknownSchema,
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

export const parseJsonBody = async <T>(
  request: Request,
  schema: UnknownSchema,
  signal?: AbortSignal,
  options: BodyOptions = {},
): Promise<ContentSchemaRegistryResult<T>> => {
  const media = request.headers.get('content-type')?.split(';')[0]?.trim();
  if (media !== 'application/json')
    return invalid('Use application/json.', {}, 415);
  const bytes = await readBytes(request, signal);
  return bytes.ok ? decodeJson(bytes.value, schema, options) : bytes;
};

export const parseRequestPathId = (
  value: string | undefined,
): ContentSchemaRegistryResult<string> =>
  value !== undefined && UUID_PATTERN.test(value)
    ? { ok: true, value }
    : invalid('The path parameters are invalid.');
