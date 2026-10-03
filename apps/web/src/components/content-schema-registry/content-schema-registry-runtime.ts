import { LOCALE_CONFIG_MESSAGES } from '@wejammin/contracts';

import {
  authoritativeResource,
  isAuthoritativeContentSchemaRegistryMutationResponse,
  reconcileContentSchemaRegistryMutation,
} from './content-schema-registry-runtime-mutation-reconciliation';
import { addClientBindingIdHeader } from '../../lib/client-binding';
import { parseContentSchemaRegistryRetryAfter } from './content-schema-registry-runtime-constants';
import {
  classifyStepUpResponse,
  type StepUpClassification,
} from './content-schema-registry-step-up-classify';

export {
  CONTENT_SCHEMA_REGISTRY_LOADING_DELAY_MS,
  CONTENT_SCHEMA_REGISTRY_MAX_RETRIES,
  CONTENT_SCHEMA_REGISTRY_RETRY_DELAYS_MS,
  parseContentSchemaRegistryRetryAfter,
} from './content-schema-registry-runtime-constants';
export {
  executeContentSchemaRegistryRead,
  type ContentSchemaRegistryReadResult,
} from './content-schema-registry-runtime-read';

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;
type Sleeper = (milliseconds: number) => Promise<void>;

export type ContentSchemaRegistryMutationOutcome =
  | 'success'
  | 'validation'
  | 'unauthenticated'
  | 'step-up-required'
  | 'step-up-unavailable'
  | 'step-up-malformed'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'rate-limited'
  | 'degraded';

export interface ContentSchemaRegistryMutationResult {
  readonly outcome: ContentSchemaRegistryMutationOutcome;
  readonly attempts: number;
  readonly reconciled: boolean;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;
  readonly location: string | null;
  /** Number of same-key mutation replays used to reconcile an ambiguity. */
  readonly statusChecks: number;
  readonly errorDetails: readonly string[];
  /** OD-4 locale refusals: exact server-owned messages with their pointers. */
  readonly localeIssues?: readonly ContentSchemaRegistryLocaleIssue[];
  readonly serverVersion: string | null;
  /** The request ID of a degraded step-up response, for recovery copy. */
  readonly requestId?: string | null;
  /** Unvalidated JSON body of an authoritative CMS-03A-04 answer, else null. */
  readonly resource?: unknown;
  readonly formData: FormData;
}

const copyFormData = (source: FormData): FormData => {
  const copy = new FormData();
  source.forEach((value, key) => copy.append(key, value));
  return copy;
};

const retryableMutationStatus = (status: number): boolean =>
  status === 503 || status === 504;

const idempotencyKeyFrom = (formData: FormData): string | null => {
  const value = formData.get('idempotency-key');
  return typeof value === 'string' && value.length > 0 ? value : null;
};

const safeVersion = (value: string | null): string | null => {
  if (value === null) return null;
  const normalized = value.trim().replace(/^"|"$/gu, '');
  return /^\d{1,19}$/u.test(normalized) ? normalized : null;
};

export interface ContentSchemaRegistryLocaleIssue {
  readonly pointer: string;
  readonly message: string;
}

const LOCALE_MESSAGES: ReadonlySet<string> = new Set(
  Object.values(LOCALE_CONFIG_MESSAGES),
);

/** Only the fixed BE03a OD-4 strings may be rendered; all else stays opaque. */
const mutationLocaleIssues = async (
  response: Response,
): Promise<readonly ContentSchemaRegistryLocaleIssue[]> => {
  if (response.status !== 422) return [];
  try {
    const body: unknown = await response.clone().json();
    const details = (body as { readonly details?: unknown } | null)?.details;
    const violations = (details as { readonly violations?: unknown } | null)
      ?.violations;
    if (!Array.isArray(violations)) return [];
    return violations
      .flatMap((violation): ContentSchemaRegistryLocaleIssue[] => {
        const { pointer, message } = (violation ?? {}) as {
          readonly pointer?: unknown;
          readonly message?: unknown;
        };
        return typeof pointer === 'string' &&
          pointer.length <= 256 &&
          typeof message === 'string' &&
          LOCALE_MESSAGES.has(message)
          ? [{ pointer, message }]
          : [];
      })
      .slice(0, 50);
  } catch {
    return [];
  }
};

const mutationErrorDetails = async (
  response: Response,
): Promise<readonly string[]> => {
  if (response.status !== 400 && response.status !== 422) return [];
  try {
    const body: unknown = await response.clone().json();
    if (typeof body !== 'object' || body === null) return [];
    const details = (body as { readonly details?: unknown }).details;
    if (typeof details !== 'object' || details === null) return [];
    const violations = (details as { readonly violations?: unknown })
      .violations;
    if (!Array.isArray(violations)) return [];
    return violations
      .map((violation) => {
        if (typeof violation !== 'object' || violation === null) return null;
        const pointer = (violation as { readonly pointer?: unknown }).pointer;
        return typeof pointer === 'string' && pointer.length <= 256
          ? pointer
          : null;
      })
      .filter((pointer): pointer is string => pointer !== null)
      .slice(0, 50);
  } catch {
    return [];
  }
};

const mutationServerVersion = async (
  response: Response,
): Promise<string | null> => {
  const headerVersion = safeVersion(response.headers.get('etag'));
  if (headerVersion !== null || response.status !== 409) return headerVersion;
  try {
    const body: unknown = await response.clone().json();
    if (typeof body !== 'object' || body === null) return null;
    const details = (body as { readonly details?: unknown }).details;
    if (typeof details !== 'object' || details === null) return null;
    const currentVersion = (details as { readonly currentVersion?: unknown })
      .currentVersion;
    return typeof currentVersion === 'string'
      ? safeVersion(currentVersion)
      : null;
  } catch {
    return null;
  }
};

/**
 * Submit a native command and reconcile one ambiguous response at the
 * existing idempotency boundary before announcing success.
 */
export const executeContentSchemaRegistryMutation = async (input: {
  readonly action: string;
  readonly operationId: string;
  readonly formData: FormData;
  readonly fetcher?: Fetcher;
  readonly sleep?: Sleeper;
}): Promise<ContentSchemaRegistryMutationResult> => {
  const baseFetcher = input.fetcher ?? fetch;
  const fetcher: Fetcher = async (request, init) =>
    baseFetcher(request, await addClientBindingIdHeader(request, init));
  const idempotencyKey = idempotencyKeyFrom(input.formData);
  let statusChecks = 0;
  const outcomeFor = (
    response: Response | null,
    authoritative: boolean,
    stepUp: StepUpClassification | null,
  ): ContentSchemaRegistryMutationOutcome => {
    if (response === null || authoritative)
      return authoritative ? 'success' : 'degraded';
    if (response.status === 400 || response.status === 422) return 'validation';
    if (response.status === 401) {
      if (stepUp === null) return 'unauthenticated';
      if (stepUp.kind === 'navigate') return 'step-up-required';
      return stepUp.kind === 'no-method'
        ? 'step-up-unavailable'
        : 'step-up-malformed';
    }
    if (response.status === 403) return 'forbidden';
    if (response.status === 404) return 'not-found';
    if (response.status === 409) return 'conflict';
    if (response.status === 429) return 'rate-limited';
    return 'degraded';
  };
  const resultFor = async (
    response: Response | null,
    attempts: number,
    reconciled: boolean,
    authoritative = false,
  ): Promise<ContentSchemaRegistryMutationResult> => {
    const isAuthoritative =
      response !== null &&
      (authoritative ||
        (await isAuthoritativeContentSchemaRegistryMutationResponse(
          input.action,
          input.operationId,
          response,
        )));
    const stepUp =
      response === null ? null : await classifyStepUpResponse(response);
    const outcome = outcomeFor(response, isAuthoritative, stepUp);
    const resource =
      outcome === 'success' && response !== null
        ? await authoritativeResource(input.operationId, response)
        : null;
    return {
      outcome,
      attempts,
      reconciled,
      status: response?.status ?? null,
      retryAfterSeconds:
        outcome === 'rate-limited'
          ? parseContentSchemaRegistryRetryAfter(
              response?.headers.get('retry-after') ?? null,
            )
          : null,
      location: response?.headers.get('location') ?? null,
      statusChecks,
      errorDetails:
        response === null ? [] : await mutationErrorDetails(response),
      localeIssues:
        response === null ? [] : await mutationLocaleIssues(response),
      serverVersion:
        response === null ? null : await mutationServerVersion(response),
      requestId:
        stepUp !== null && stepUp.kind !== 'navigate' ? stepUp.requestId : null,
      resource,
      formData: input.formData,
    };
  };
  const reconcileAmbiguous = async (
    initialResponse: Response | null,
    initialAttempts: number,
  ): Promise<ContentSchemaRegistryMutationResult> => {
    if (idempotencyKey === null)
      return resultFor(initialResponse, initialAttempts, false);
    statusChecks += 1;
    const reconciliation = await reconcileContentSchemaRegistryMutation(
      fetcher,
      input.action,
      input.operationId,
      input.formData,
      idempotencyKey,
    );
    if (
      reconciliation.outcome === 'committed' &&
      reconciliation.response !== null
    )
      return resultFor(
        reconciliation.response,
        initialAttempts + 1,
        true,
        true,
      );
    return resultFor(initialResponse, initialAttempts + 1, true);
  };

  let response: Response;
  try {
    response = await fetcher(input.action, {
      method: 'POST',
      body: copyFormData(input.formData),
      // A manual-redirect browser fetch cannot read a 303; ask for the JSON
      // success answer instead (same Accept as the reconciliation replay).
      headers: new Headers({ accept: 'application/json, text/html' }),
      credentials: 'same-origin',
      redirect: 'manual',
    });
  } catch {
    return reconcileAmbiguous(null, 1);
  }
  if (retryableMutationStatus(response.status))
    return reconcileAmbiguous(response, 1);
  return resultFor(response, 1, false);
};
