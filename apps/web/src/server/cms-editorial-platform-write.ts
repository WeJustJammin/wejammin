import {
  cmsEditorialForwardedError,
  type CmsEditorialDetailProjector,
} from './cms-editorial-platform-bounded';
import type { CmsEditorialErrorDetailPolicy } from './cms-editorial-platform-error-details';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialCsrfCookie,
  cmsEditorialLocalError,
  cmsEditorialOutcomeUnknown,
  cmsEditorialPrintableToken,
  cmsEditorialSameOriginRequest,
  isCmsEditorialPlatformBinding,
  type CmsEditorialPlatformApiBinding,
} from './cms-editorial-platform-shared';

/**
 * The transport steps every first-party CMS editorial command shares
 * (CMS-03B-01, -02, -04, -10): admit the request, dispatch it to the private
 * Worker binding with the browser's own cancellation signal, and classify what
 * comes back.
 *
 * Outcome-unknown contract. A command may have committed even when the browser
 * never receives a verified success: the binding threw, the Worker answered a
 * post-dispatch 5xx, or a 2xx failed verification. Each of those responses
 * carries `x-cms-editorial-outcome: unknown`. The client then keeps its
 * Idempotency-Key and replays the byte-identical request; the Worker returns the
 * first outcome without a second effect. A definite refusal (4xx, or a refusal
 * before dispatch) never carries the marker and rotates the key. The proxy never
 * rewrites, strips or mints an Idempotency-Key.
 */

const JSON_MEDIA = 'application/json';

/** Binding, method and same-origin admission shared by every command. */
export const admitCmsEditorialWrite = (
  request: Request,
  binding: unknown,
): Readonly<{ binding: CmsEditorialPlatformApiBinding }> | Response => {
  if (!isCmsEditorialPlatformBinding(binding) || request.method !== 'POST')
    return cmsEditorialLocalError(request, 503);
  if (!cmsEditorialSameOriginRequest(request))
    return cmsEditorialLocalError(request, 403);
  return { binding };
};

/** The session-bound CSRF double-submit token, or the 403 refusal. */
export const cmsEditorialCsrfToken = (request: Request): string | Response => {
  const token = request.headers.get('x-csrf-token');
  return cmsEditorialPrintableToken(token, 512) &&
    cmsEditorialCsrfCookie(request) === token
    ? (token as string)
    : cmsEditorialLocalError(request, 403);
};

/** Every command accepts only JSON; anything else is a 415 naming the allowlist. */
export const cmsEditorialJsonMedia = (request: Request): string | Response => {
  const media = request.headers.get('content-type')?.split(';')[0]?.trim();
  return media === JSON_MEDIA
    ? media
    : cmsEditorialLocalError(request, 415, undefined, undefined, {
        allowedMediaTypes: [JSON_MEDIA],
      });
};

/** Local 502 for a 2xx the proxy could not verify: the effect is unknown. */
export const cmsEditorialUnverifiedSuccess = (request: Request): Response =>
  cmsEditorialOutcomeUnknown(cmsEditorialLocalError(request, 502));

/**
 * Send the command to the Worker. `request.signal` is the parent of the
 * upstream request, so a browser disconnect cancels the call; a transport loss
 * is a 503 whose outcome is unknown.
 */
export const dispatchCmsEditorialWrite = async (
  request: Request,
  binding: CmsEditorialPlatformApiBinding,
  route: string,
  headers: Headers,
  body: string,
): Promise<Readonly<{ upstream: Response }> | Response> => {
  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(`${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${route}`, {
        method: 'POST',
        headers,
        body,
        signal: request.signal,
      }),
    );
  } catch {
    return cmsEditorialOutcomeUnknown(cmsEditorialLocalError(request, 503));
  }
  if (!(upstream instanceof Response))
    return cmsEditorialOutcomeUnknown(cmsEditorialLocalError(request, 503));
  return { upstream };
};

/** Relay a non-2xx command answer; a 5xx (or an unrelayable one) is unknown. */
export const relayCmsEditorialWriteFailure = async (
  request: Request,
  upstream: Response,
  allowedErrors: Readonly<Record<string, number>>,
  detailPolicy: CmsEditorialErrorDetailPolicy,
  projector?: CmsEditorialDetailProjector,
): Promise<Response> => {
  const response = await cmsEditorialForwardedError(
    request,
    upstream,
    allowedErrors,
    detailPolicy,
    projector,
  );
  return response.status >= 500
    ? cmsEditorialOutcomeUnknown(response)
    : response;
};
