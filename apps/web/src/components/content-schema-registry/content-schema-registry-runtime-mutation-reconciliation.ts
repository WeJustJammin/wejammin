type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type ContentSchemaRegistryMutationReconciliationOutcome =
  'committed' | 'pending' | 'unknown';

export interface ContentSchemaRegistryMutationReconciliation {
  readonly outcome: ContentSchemaRegistryMutationReconciliationOutcome;
  readonly status: number | null;
  readonly response: Response | null;
}

/** BE03a success statuses per human command; unknown operations have none. */
const SUCCESS_STATUSES: Readonly<Record<string, readonly number[]>> = {
  'CMS-03A-01': [201],
  'CMS-03A-02': [201],
  'CMS-03A-03': [201],
  'CMS-03A-04': [200, 202],
  'CMS-03A-09': [201],
  'CMS-03A-10': [202],
  'CMS-03A-11': [201],
  'CMS-03A-12': [201],
  'CMS-03A-14': [200, 201],
};

const successStatusesFor = (operationId: string): readonly number[] =>
  Object.hasOwn(SUCCESS_STATUSES, operationId)
    ? (SUCCESS_STATUSES[operationId] ?? [])
    : [];

const copyFormData = (source: FormData): FormData => {
  const copy = new FormData();
  source.forEach((value, key) => copy.append(key, value));
  return copy;
};

const hasSafeRedirect = (action: string, response: Response): boolean => {
  const location = response.headers.get('location');
  if (location === null || location.trim().length === 0) return false;
  try {
    const base = new URL(action, 'https://content-schema-registry.invalid');
    return new URL(location, base).origin === base.origin;
  } catch {
    return false;
  }
};

const hasJsonObjectBody = async (response: Response): Promise<boolean> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (!/^application\/json(?:\s*;|$)/iu.test(contentType)) return false;
  try {
    const body: unknown = await response.clone().json();
    return typeof body === 'object' && body !== null && !Array.isArray(body);
  } catch {
    return false;
  }
};

/**
 * A native mutation POST is the authoritative idempotency/status boundary.
 * Replaying the exact form and key lets the existing Worker/RPC idempotency
 * record return the committed response without adding a public status route.
 */
export const isAuthoritativeContentSchemaRegistryMutationResponse = async (
  action: string,
  operationId: string,
  response: Response,
): Promise<boolean> => {
  if (successStatusesFor(operationId).length === 0) return false;
  if (response.status === 303) return hasSafeRedirect(action, response);
  if (!successStatusesFor(operationId).includes(response.status)) return false;
  return hasJsonObjectBody(response);
};

/** Replay one ambiguous mutation; pending and unknown outcomes fail closed. */
export const reconcileContentSchemaRegistryMutation = async (
  fetcher: Fetcher,
  action: string,
  operationId: string,
  formData: FormData,
  idempotencyKey: string | null,
): Promise<ContentSchemaRegistryMutationReconciliation> => {
  if (idempotencyKey === null || successStatusesFor(operationId).length === 0)
    return { outcome: 'unknown', status: null, response: null };
  const suppliedKey = formData.get('idempotency-key');
  const suppliedOperation = formData.get('operationId');
  if (
    suppliedKey !== idempotencyKey ||
    (suppliedOperation !== null && suppliedOperation !== operationId)
  )
    return { outcome: 'unknown', status: null, response: null };
  try {
    const response = await fetcher(action, {
      method: 'POST',
      body: copyFormData(formData),
      headers: new Headers({
        accept: 'application/json, text/html',
        'cache-control': 'no-store',
        'idempotency-key': idempotencyKey,
      }),
      credentials: 'same-origin',
      redirect: 'manual',
    });
    if (
      await isAuthoritativeContentSchemaRegistryMutationResponse(
        action,
        operationId,
        response,
      )
    )
      return { outcome: 'committed', status: response.status, response };
    return {
      outcome:
        response.status === 503 || response.status === 504
          ? 'pending'
          : 'unknown',
      status: response.status,
      response,
    };
  } catch {
    return { outcome: 'unknown', status: null, response: null };
  }
};
