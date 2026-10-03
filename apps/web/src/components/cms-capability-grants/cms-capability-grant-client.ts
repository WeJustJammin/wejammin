import {
  CmsCapabilityGrantListPageSchema,
  CmsCapabilityGrantResourceSchema,
} from '@wejammin/contracts';

import { addClientBindingIdHeader } from '../../lib/client-binding';
import {
  executeContentSchemaRegistryMutation,
  parseContentSchemaRegistryRetryAfter,
  type ContentSchemaRegistryMutationOutcome,
} from '../content-schema-registry/content-schema-registry-runtime';
import type {
  CmsCapabilityGrantListPage,
  CmsCapabilityGrantQueryState,
  CmsCapabilityGrantResource,
} from './cms-capability-grant-types';
import type { GrantViolation } from './cms-capability-grant-validation';

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export const CMS_CAPABILITY_GRANTS_PROXY = '/api/v1/cms/capability-grants';

export interface GrantCommandResult {
  readonly outcome: ContentSchemaRegistryMutationOutcome;
  readonly attempts: number;
  readonly reconciled: boolean;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;
  /** Present only for a verified 2xx that parses as the grant contract. */
  readonly resource: CmsCapabilityGrantResource | null;
  /** Violation paths (JSON Pointers) and codes only; submitted values are never read. */
  readonly violations: readonly GrantViolation[];
  /** The platform request id of the last response, for recovery copy. */
  readonly requestId: string | null;
}

const SAFE_CODE = /^[A-Za-z0-9_.:-]{1,128}$/u;
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;

const readBody = async (response: Response | null): Promise<unknown> => {
  if (response === null) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const violationsOf = (body: unknown): readonly GrantViolation[] => {
  const details = (body as { readonly details?: unknown } | null)?.details;
  const list = (details as { readonly violations?: unknown } | null)
    ?.violations;
  if (!Array.isArray(list)) return [];
  return list
    .flatMap((entry: unknown): GrantViolation[] => {
      const { path, code } = (entry ?? {}) as {
        readonly path?: unknown;
        readonly code?: unknown;
      };
      return typeof path === 'string' && path.length <= 256
        ? [
            {
              pointer: path,
              code:
                typeof code === 'string' && SAFE_CODE.test(code) ? code : null,
            },
          ]
        : [];
    })
    .slice(0, 50);
};

const requestIdOf = (body: unknown): string | null => {
  const id = (body as { readonly requestId?: unknown } | null)?.requestId;
  return typeof id === 'string' && REQUEST_ID.test(id) ? id : null;
};

const resourceOf = (body: unknown): CmsCapabilityGrantResource | null => {
  const parsed = CmsCapabilityGrantResourceSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
};

/**
 * Submit one grant command through the same-origin first-party proxy. The
 * shared registry executor owns same-key reconciliation of ambiguous
 * outcomes; this wrapper only adds the typed resource and violation parse.
 */
export const runGrantCommand = async (input: {
  readonly action: string;
  readonly operationId: string;
  readonly formData: FormData;
  readonly fetcher?: Fetcher;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}): Promise<GrantCommandResult> => {
  const baseFetcher: Fetcher = input.fetcher ?? ((...args) => fetch(...args));
  let last: Response | null = null;
  const capturing: Fetcher = async (target, init) => {
    const response = await baseFetcher(target, init);
    last = response.clone();
    return response;
  };
  const result = await executeContentSchemaRegistryMutation({
    action: input.action,
    operationId: input.operationId,
    formData: input.formData,
    fetcher: capturing,
    ...(input.sleep === undefined ? {} : { sleep: input.sleep }),
  });
  const body = await readBody(last);
  const success = result.outcome === 'success';
  return {
    outcome: result.outcome,
    attempts: result.attempts,
    reconciled: result.reconciled,
    status: result.status,
    retryAfterSeconds: result.retryAfterSeconds,
    resource: success ? resourceOf(body) : null,
    violations: result.outcome === 'validation' ? violationsOf(body) : [],
    requestId: success ? null : requestIdOf(body),
  };
};

export type GrantListReadResult =
  | { readonly kind: 'ok'; readonly page: CmsCapabilityGrantListPage }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'unauthenticated' }
  | { readonly kind: 'forbidden' }
  | {
      readonly kind: 'error';
      readonly status: number;
      readonly retryable: boolean;
      readonly retryAfterSeconds: number | null;
    }
  | { readonly kind: 'degraded' };

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

export const grantListUrl = (
  query: CmsCapabilityGrantQueryState,
  subjectPersonId: string,
): string => {
  const params = new URLSearchParams();
  const person = subjectPersonId.trim();
  if (person !== '') params.set('subjectPersonId', person);
  for (const key of [
    'capability',
    'state',
    'limit',
    'cursor',
    'sort',
    'direction',
  ] as const) {
    const value = query[key];
    if (value !== undefined) params.set(key, String(value));
  }
  return `${CMS_CAPABILITY_GRANTS_PROXY}?${params.toString()}`;
};

/** No-store canonical list refetch (CMS-03A-18) through the first-party proxy. */
export const readGrantList = async (input: {
  readonly query: CmsCapabilityGrantQueryState;
  readonly subjectPersonId?: string;
  readonly fetcher?: Fetcher;
}): Promise<GrantListReadResult> => {
  const fetcher: Fetcher = input.fetcher ?? ((...args) => fetch(...args));
  const url = grantListUrl(input.query, input.subjectPersonId ?? '');
  let response: Response;
  try {
    response = await fetcher(
      url,
      await addClientBindingIdHeader(url, {
        method: 'GET',
        headers: new Headers({
          accept: 'application/json',
          'cache-control': 'no-store',
        }),
        credentials: 'same-origin',
      }),
    );
  } catch {
    return { kind: 'degraded' };
  }
  if (response.status === 401) return { kind: 'unauthenticated' };
  if (response.status === 403) return { kind: 'forbidden' };
  if (!response.ok)
    return {
      kind: 'error',
      status: response.status,
      retryable: RETRYABLE_STATUSES.has(response.status),
      retryAfterSeconds: parseContentSchemaRegistryRetryAfter(
        response.headers.get('retry-after'),
      ),
    };
  try {
    const parsed = CmsCapabilityGrantListPageSchema.safeParse(
      await response.json(),
    );
    return parsed.success
      ? { kind: 'ok', page: parsed.data }
      : { kind: 'invalid' };
  } catch {
    return { kind: 'invalid' };
  }
};
