import { loadContractValidators } from './content-schema-registry-contract-validators';
import { isStepUpRequiredBody } from '../step-up-required';

/** The only second factor the step-up page can verify (FE01 / FE03). */
const SUPPORTED_METHOD = 'totp';

/**
 * How the browser reads one 401 response from a protected CMS command.
 *
 * - `null`: the 401 is not `STEP_UP_REQUIRED` (plain reauthentication).
 * - `navigate`: valid typed details and at least one supported method.
 * - `no-method`: valid typed details but no supported method remains.
 * - `malformed`: `STEP_UP_REQUIRED` with details that fail the typed schema.
 */
export type StepUpClassification =
  | { readonly kind: 'navigate' }
  | { readonly kind: 'no-method'; readonly requestId: string | null }
  | { readonly kind: 'malformed'; readonly requestId: string | null };

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;

const requestIdOf = (body: object): string | null => {
  const id = (body as { readonly requestId?: unknown }).requestId;
  return typeof id === 'string' && SAFE_REQUEST_ID.test(id) ? id : null;
};

/**
 * FE03 "Step-up recovery": a 401 `STEP_UP_REQUIRED` is parsed with the typed
 * CMS step-up schema (`{ recoveryAction: 'step_up', allowedMethods }`). Any
 * other shape is a malformed response, `allowedMethods` entries other than
 * `totp` are ignored and an empty list is a degraded state, never a redirect.
 */
export const classifyStepUpResponse = async (
  response: Response,
): Promise<StepUpClassification | null> => {
  if (response.status !== 401) return null;
  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return null;
  }
  if (typeof body !== 'object' || body === null) return null;
  if (!isStepUpRequiredBody(body)) return null;
  // The typed schema is loaded on this first need; a validator that cannot be
  // loaded leaves the body unverified, which is the malformed (degraded) state.
  let parsed;
  try {
    parsed = (
      await loadContractValidators()
    ).CmsStepUpRequiredErrorSchema.safeParse(body);
  } catch {
    return { kind: 'malformed', requestId: requestIdOf(body) };
  }
  if (!parsed.success)
    return { kind: 'malformed', requestId: requestIdOf(body) };
  const usable = parsed.data.details.allowedMethods.filter(
    (method) => method === SUPPORTED_METHOD,
  );
  return usable.length === 0
    ? { kind: 'no-method', requestId: parsed.data.requestId }
    : { kind: 'navigate' };
};
