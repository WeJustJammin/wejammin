import {
  ChallengeResourceSchema,
  ClaimResourceSchema,
  JobStatusSchema,
  MatchResponseSchema,
  RemedyResourceSchema,
} from '@wejammin/contracts';

import { isStepUpRequiredBody } from '../step-up-required';

export const responseSchemas = {
  'PRF-API-01': MatchResponseSchema,
  'PRF-API-02': JobStatusSchema,
  'PRF-API-03': RemedyResourceSchema,
  'PRF-API-04': ClaimResourceSchema,
  'PRF-API-05': ClaimResourceSchema,
  'PRF-API-06': ChallengeResourceSchema,
  'PRF-API-07': ClaimResourceSchema,
  'PRF-API-08': ClaimResourceSchema,
} as const;

export type ProfileOwnershipOperation = keyof typeof responseSchemas;
type FormValues = Record<string, FormDataEntryValue>;

const text = (values: FormValues, name: string): string | undefined => {
  const value = values[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

export const bodyFor = (
  operation: ProfileOwnershipOperation,
  form: HTMLFormElement | FormData,
): Record<string, unknown> => {
  const values = Object.fromEntries(
    (form instanceof FormData ? form : new FormData(form)).entries(),
  ) as FormValues;
  const pick = (names: readonly string[]): Record<string, string> =>
    Object.fromEntries(
      names.flatMap((name) => {
        const value = text(values, name);
        return value === undefined ? [] : [[name, value]];
      }),
    );

  switch (operation) {
    case 'PRF-API-01':
      return pick([
        'partyId',
        'sourceDomain',
        'sourceEntityId',
        'sourceVersion',
        'roleCode',
        'instrumentCode',
      ]);
    case 'PRF-API-02':
      return pick(['contactRouteId', 'trigger', 'attesterPersonId']);
    case 'PRF-API-03':
      return {
        ...pick(['pointerToken', 'action', 'scope']),
        proof: {
          kind: text(values, 'proofKind'),
          code: text(values, 'proofCode'),
        },
      };
    case 'PRF-API-04':
      return pick(['targetPartyId', 'claimKind']);
    case 'PRF-API-06':
      return pick(['method', 'routeId', 'attesterPersonId']);
    case 'PRF-API-07':
      return pick(['kind', 'challengeId', 'code', 'reasonCode']);
    case 'PRF-API-08':
      return pick(['reasonCode']);
    case 'PRF-API-05':
      return {};
  }
};

export const parseProfileOwnershipResponse = (
  operation: ProfileOwnershipOperation,
  value: unknown,
): unknown => responseSchemas[operation].safeParse(value);

export type CommandOutcome = Readonly<{
  message: string;
  payload?: unknown;
  /** Set for a 401 STEP_UP_REQUIRED: the command form navigates here. */
  stepUp?: true;
}>;

export const STEP_UP_STATUS_MESSAGE =
  'Recent verification is required. Continuing to verification.';

export const readCommandResult = async (
  response: Response,
  operation: ProfileOwnershipOperation,
): Promise<CommandOutcome> => {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Status mapping remains safe when the upstream body is absent.
  }
  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    return {
      message: retryAfter
        ? `Try again after cooldown (${retryAfter} seconds).`
        : 'Try again after the cooldown.',
    };
  }
  if (response.status === 409)
    return { message: 'The ownership state changed. Refresh and retry.' };
  if (response.status === 401) {
    // FE00 error-per-class (DEC-111): a step-up shortfall is navigation to
    // /step-up, never the sign-in prompt reserved for UNAUTHENTICATED.
    if (isStepUpRequiredBody(payload))
      return { message: STEP_UP_STATUS_MESSAGE, stepUp: true };
    return { message: 'Sign in again to continue.' };
  }
  if (response.status === 403)
    return { message: 'This capability is not available in this context.' };
  if (response.status === 404)
    return { message: 'This record is not available.' };
  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : 'The request could not be completed.';
    return { message };
  }
  const parsed = responseSchemas[operation].safeParse(payload);
  if (!parsed.success)
    return { message: 'The service returned an invalid ownership response.' };
  const state = 'state' in parsed.data ? parsed.data.state : undefined;
  return {
    message:
      typeof state === 'string' ? `Request ${state}.` : 'Request completed.',
    payload: parsed.data,
  };
};

export const newIdempotencyKey = (
  operation: ProfileOwnershipOperation,
): string => `s05-${operation.toLowerCase()}-${globalThis.crypto.randomUUID()}`;
