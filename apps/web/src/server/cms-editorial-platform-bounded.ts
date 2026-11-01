import {
  ApiErrorSchema,
  cmsEditorialDeclaredStatuses,
  cmsEditorialDeclaresError,
  type CmsEditorialErrorDeclaration,
} from '@wejammin/contracts';

import {
  CMS_EDITORIAL_DETAIL_POLICIES,
  projectCmsEditorialErrorDetails,
  type CmsEditorialErrorDetailPolicy,
} from './cms-editorial-platform-error-details';
import {
  cmsEditorialCopyResponseHeaders,
  cmsEditorialErrorMessage,
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

/**
 * DEC-188/DEC-189: the decoded JSON response of CMS-03C-02 is the one response
 * ceiling exception at 1 MiB, because its bounded 1-512-row
 * `PatternPlacementResource` can exceed 256 KiB. It is response-only: the
 * request body and every other response stay at `CMS_EDITORIAL_MAX_BODY_BYTES`.
 * The 1 MiB value is an approved allowance, not a proven producer bound.
 */
export const CMS_PATTERN_PLACEMENT_MAX_RESPONSE_BYTES = 1_048_576;

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
  maximumBytes: number,
): Promise<CmsEditorialBoundedBytes> => {
  if (declaredLength !== null && declaredLength > maximumBytes)
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
      if (total > maximumBytes) {
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
    CMS_EDITORIAL_MAX_BODY_BYTES,
  );
  return read.ok ? decodeJson(read.bytes) : { ok: false };
};

export const cmsEditorialBoundedResponseJson = async (
  response: Response,
): Promise<CmsEditorialBoundedJson> => {
  const read = await readBounded(
    response.body,
    declaredLengthOf(response.headers),
    CMS_EDITORIAL_MAX_BODY_BYTES,
  );
  return read.ok ? decodeJson(read.bytes) : { ok: false };
};

/**
 * DEC-188/DEC-189: the CMS-03C-02 success response reader. It is the same
 * bounded, fatal-UTF-8 read as the ordinary response reader, raised only for
 * this operation to `CMS_PATTERN_PLACEMENT_MAX_RESPONSE_BYTES`. An over-cap
 * body is refused and its source cancelled rather than truncated.
 */
export const cmsPatternPlacementBoundedResponseJson = async (
  response: Response,
): Promise<CmsEditorialBoundedJson> => {
  const read = await readBounded(
    response.body,
    declaredLengthOf(response.headers),
    CMS_PATTERN_PLACEMENT_MAX_RESPONSE_BYTES,
  );
  return read.ok ? decodeJson(read.bytes) : { ok: false };
};

/*
 * Relay an upstream error, but only when it is a real ApiError of a declared
 * code/status pair, read under the cap. Nothing the upstream wrote is published
 * verbatim (Codex review M2): the message is the route's canonical message for
 * the code, and the details are rebuilt from the operation-specific allowlist,
 * keeping only the upstream request id as correlation. A malformed, oversize,
 * non-JSON, or out-of-range error collapses to a local safe error.
 */
/**
 * An operation family that publishes structured details of its own (the Slice 11
 * workflow) supplies its projector: it receives the upstream status, code and
 * details and returns the rebuilt, allowlisted details.
 */
export type CmsEditorialDetailProjector = (
  status: number,
  code: string,
  upstreamDetails: unknown,
) => Record<string, unknown>;

export const cmsEditorialForwardedError = async (
  request: Request,
  upstream: Response,
  allowedErrors: CmsEditorialErrorDeclaration,
  detailPolicy: CmsEditorialErrorDetailPolicy = CMS_EDITORIAL_DETAIL_POLICIES.read,
  projector?: CmsEditorialDetailProjector,
): Promise<Response> => {
  // Each BE03b operation publishes a closed code/status registry. A valid
  // ApiError envelope is not enough: an upstream 403 carrying INTERNAL_ERROR,
  // or a draft read returning an undeclared 409, must not be relayed as truth.
  if (!cmsEditorialDeclaredStatuses(allowedErrors).includes(upstream.status))
    return cmsEditorialLocalError(request, 502);
  const body = await cmsEditorialBoundedResponseJson(upstream);
  if (!body.ok) return cmsEditorialLocalError(request, upstream.status);
  const parsed = ApiErrorSchema.safeParse(body.value);
  if (
    !parsed.success ||
    !cmsEditorialDeclaresError(allowedErrors, parsed.data.code, upstream.status)
  )
    return cmsEditorialLocalError(request, upstream.status);
  const headers = cmsEditorialCopyResponseHeaders(upstream);
  headers.set('x-request-id', parsed.data.requestId);
  const published = ApiErrorSchema.safeParse({
    code: parsed.data.code,
    message: cmsEditorialErrorMessage(parsed.data.code, upstream.status),
    details:
      projector === undefined
        ? projectCmsEditorialErrorDetails(
            upstream.status,
            parsed.data.details,
            detailPolicy,
          )
        : projector(upstream.status, parsed.data.code, parsed.data.details),
    requestId: parsed.data.requestId,
  });
  if (!published.success)
    return cmsEditorialLocalError(request, upstream.status);
  return new Response(JSON.stringify(published.data), {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
};
