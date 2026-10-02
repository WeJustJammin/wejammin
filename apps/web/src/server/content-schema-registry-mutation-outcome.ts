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
