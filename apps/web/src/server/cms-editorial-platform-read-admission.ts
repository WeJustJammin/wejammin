import { cmsEditorialLocalError } from './cms-editorial-platform-shared';

/**
 * Admission shared by every protected CMS editorial read proxy: a safe read has
 * no body, no `Idempotency-Key`, and no `If-Match`, and carries no media type.
 * Each proxy refuses a request that breaks this before any upstream call.
 */

export const CMS_EDITORIAL_ENTRY_DETAIL_PATH_PREFIX = '/api/v1/cms/entries';

export const readAdmissionStatus = (request: Request): 400 | 415 | null => {
  if (request.headers.has('idempotency-key') || request.headers.has('if-match'))
    return 400;
  if (request.headers.has('content-type')) return 415;
  const contentLength = request.headers.get('content-length');
  if (
    request.body !== null ||
    request.headers.has('transfer-encoding') ||
    (contentLength !== null && contentLength !== '0')
  )
    return 400;
  return null;
};

export const readAdmissionError = (
  request: Request,
  status: 400 | 415,
): Response =>
  status === 415
    ? cmsEditorialLocalError(
        request,
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'A protected CMS read has no request media.',
      )
    : cmsEditorialLocalError(request, 400);
