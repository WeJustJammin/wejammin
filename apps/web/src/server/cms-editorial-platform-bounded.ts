import { ApiErrorSchema } from '@wejammin/contracts';

import {
  cmsEditorialCopyResponseHeaders,
  cmsEditorialLocalError,
} from './cms-editorial-platform-shared';

/*
 * Bounded byte reads for the CMS editorial web boundary.
 *
 * The locked CMS-03B-10 and CMS-03B-11 maxBodyBytes is 256 KiB. Each read is
 * measured against the declared content-length first and then streamed, so a
 * lying or unbounded upstream can never force an unbounded buffer ahead of the
 * contract parse. This mirrors the Worker bounded reader in
 * apps/worker/src/cms-editorial/admission-body.ts: an over-cap read cancels its
 * source and reports failure instead of buffering the overflow.
 *
 * BE03b registers no 413 row for this command family, so callers map a
 * refusal onto their own locked status rather than inventing one here.
 */

/** BE03b maxBodyBytes, identical for create, revision, and draft read. */
export const CMS_EDITORIAL_MAX_BODY_BYTES = 262_144;

export type CmsEditorialBoundedBytes =
  Readonly<{ ok: true; bytes: Uint8Array }> | Readonly<{ ok: false }>;

export type CmsEditorialBoundedJson =
  Readonly<{ ok: true; value: unknown }> | Readonly<{ ok: false }>;

const declaredLengthOf = (headers: Headers): number | null => {
  const raw = headers.get('content-length');
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

const readBounded = async (
  body: ReadableStream<Uint8Array> | null,
  declaredLength: number | null,
): Promise<CmsEditorialBoundedBytes> => {
  if (declaredLength !== null && declaredLength > CMS_EDITORIAL_MAX_BODY_BYTES)
    return { ok: false };
  if (body === null) return { ok: true, bytes: new Uint8Array() };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > CMS_EDITORIAL_MAX_BODY_BYTES) {
        await reader.cancel();
        return { ok: false };
      }
      chunks.push(next.value);
    }
  } catch {
    return { ok: false };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
};

const decodeJson = (bytes: Uint8Array): CmsEditorialBoundedJson => {
  try {
    // Fatal decoding: a non-fatal decoder replaces an invalid byte sequence
    // with U+FFFD, which JSON.parse then accepts as an ordinary character, so
    // a corrupt upload could land in a draft value as a silently substituted
    // string. Strict decoding throws instead and the payload is refused.
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
};

/*
 * The inbound request body is read directly rather than from a clone: tee-ing
 * a stream would leave the original branch alive after an over-cap cancel, so
 * the source would never observe cancellation.
 */
export const cmsEditorialBoundedRequestJson = async (
  request: Request,
): Promise<CmsEditorialBoundedJson> => {
  const read = await readBounded(
    request.body,
    declaredLengthOf(request.headers),
  );
  return read.ok ? decodeJson(read.bytes) : { ok: false };
};

export const cmsEditorialBoundedResponseJson = async (
  response: Response,
): Promise<CmsEditorialBoundedJson> => {
  const read = await readBounded(
    response.body,
    declaredLengthOf(response.headers),
  );
  return read.ok ? decodeJson(read.bytes) : { ok: false };
};

/*
 * Relay an upstream error, but only when it is a real ApiError and is read
 * under the cap. A malformed, oversize, non-JSON, or out-of-range error
 * collapses to a local safe error, so an unexpected upstream body can never
 * pass through as the contract.
 */
export const cmsEditorialForwardedError = async (
  request: Request,
  upstream: Response,
  allowedErrors: Readonly<Record<string, number>>,
): Promise<Response> => {
  // Each BE03b operation publishes a closed code/status registry. A valid
  // ApiError envelope is not enough: an upstream 403 carrying INTERNAL_ERROR,
  // or a draft read returning an undeclared 409, must not be relayed as truth.
  if (!Object.values(allowedErrors).includes(upstream.status))
    return cmsEditorialLocalError(request, 502);
  const body = await cmsEditorialBoundedResponseJson(upstream);
  if (!body.ok) return cmsEditorialLocalError(request, upstream.status);
  const parsed = ApiErrorSchema.safeParse(body.value);
  if (!parsed.success || allowedErrors[parsed.data.code] !== upstream.status)
    return cmsEditorialLocalError(request, upstream.status);
  const headers = cmsEditorialCopyResponseHeaders(upstream);
  headers.set('x-request-id', parsed.data.requestId);
  return new Response(JSON.stringify(parsed.data), {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
};
