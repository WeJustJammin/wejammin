import { isSafeUuid } from './content-schema-registry-platform-context';

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
};

/**
 * The BE00 error `code` of a failed facade response, or null. Native form
 * posts use it to route a 401 `STEP_UP_REQUIRED` to the step-up page instead
 * of returning the raw JSON error to the browser document.
 */
export const mutationFailureCode = async (
  response: Response,
): Promise<string | null> => {
  const body = await readJson(response);
  if (typeof body !== 'object' || body === null) return null;
  const { code } = body as { readonly code?: unknown };
  return typeof code === 'string' ? code : null;
};

/**
 * The validated `id` of the resource a creating command (successor draft,
 * review submission) returned. It is a path identifier the first-party route
 * redirects to; anything that is not a canonical UUID yields null.
 */
export const createdResourceId = async (
  response: Response,
): Promise<string | null> => {
  const body = await readJson(response);
  if (typeof body !== 'object' || body === null) return null;
  const { id } = body as { readonly id?: unknown };
  return typeof id === 'string' && isSafeUuid(id) ? id : null;
};

/** True when the caller (the browser island) asked for a JSON answer. */
export const wantsJsonResponse = (request: Request): boolean =>
  /(?:^|[\s,])application\/json(?:[\s,;]|$)/iu.test(
    request.headers.get('accept') ?? '',
  );

/**
 * The success answer for a `fetch` client. A manual-redirect browser fetch
 * receives an opaque redirect (status 0, no Location), so the island could
 * never tell success from an ambiguous failure; it is instead answered with
 * the facade's own status and body plus a same-origin `Location` it can
 * follow. Native form posts keep their 303.
 */
export const jsonContinuation = (
  success: Response,
  location: string,
): Response => {
  if (!location.startsWith('/') || location.startsWith('//'))
    throw new TypeError('The continuation must be a same-origin path.');
  const headers = new Headers(success.headers);
  headers.set('location', location);
  return new Response(success.body, {
    status: success.status,
    statusText: success.statusText,
    headers,
  });
};
