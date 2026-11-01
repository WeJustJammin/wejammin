import {
  rateLimitWaitSeconds,
  retryingSafeRead,
  type Sleep,
} from '../../lib/safe-read-retry';

/*
 * The browser transport of CMS-03C-02, -13, -14 and -15 (zod-free, FE03 AC261). The same-origin proxies have already
 * parsed every success against the strict contracts, so this layer only separates the four things a caller acts on: a
 * success, a typed refusal, a wait, and (for a mutation) an unknown outcome that keeps its `Idempotency-Key`.
 */
const UNKNOWN_OUTCOME_HEADER = 'x-cms-editorial-outcome';
const MAX_VIOLATIONS = 50;

/** The ApiError code each status carries in the composition catalog (BE03c 1304). */
const CATALOG_CODES: Readonly<Record<number, string>> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'COMPOSITION_FORBIDDEN',
  404: 'COMPOSITION_NOT_FOUND',
  409: 'COMPOSITION_VERSION_CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'COMPOSITION_VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'DEPENDENCY_UNAVAILABLE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_UNAVAILABLE',
};

type Json = Readonly<Record<string, unknown>>;
const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export type MutationAnswer =
  | {
      readonly kind: 'ok';
      readonly status: number;
      readonly body: unknown;
      readonly etag: string | null;
    }
  | {
      readonly kind: 'refused';
      readonly status: number;
      readonly reason: string | null;
      /** The RFC 6901 pointers of a 422 (`/slotPath`, `/overrides`, `/roots/0`), bounded. */
      readonly paths: readonly string[];
      readonly currentVersion: string | null;
    }
  | {
      readonly kind: 'rate_limited';
      readonly retryAfterSeconds: number | null;
    }
  | { readonly kind: 'uncertain' };

export type ReadAnswer =
  | {
      readonly kind: 'ok';
      readonly status: 200;
      readonly body: unknown;
      readonly etag: string | null;
    }
  | {
      readonly kind: 'failed';
      readonly status: number | null;
      readonly reason: string | null;
    }
  | {
      readonly kind: 'rate_limited';
      readonly retryAfterSeconds: number | null;
    };

/** The ApiError details of a response that is the catalog answer of its status, else null. */
const catalogDetails = async (response: Response): Promise<Json | null> => {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }
  return isRecord(body) &&
    body.code === CATALOG_CODES[response.status] &&
    isRecord(body.details)
    ? body.details
    : null;
};

const reasonOf = (details: Json): string | null =>
  typeof details.reasonCode === 'string' &&
  /^[a-z][a-z_]{2,63}$/u.test(details.reasonCode)
    ? details.reasonCode
    : null;

const pathsOf = (details: Json): string[] =>
  Array.isArray(details.violations)
    ? details.violations
        .slice(0, MAX_VIOLATIONS)
        .flatMap((violation: unknown) =>
          isRecord(violation) &&
          typeof violation.path === 'string' &&
          violation.path.startsWith('/')
            ? [violation.path]
            : [],
        )
    : [];

const versionOf = (value: unknown): string | null =>
  typeof value === 'string' && /^[1-9]\d{0,18}$/u.test(value) ? value : null;

export interface SendOptions {
  readonly csrfToken: string;
  readonly idempotencyKey: string;
  /** The entry `version`: sent as the strong `If-Match`. */
  readonly ifMatch: string;
  readonly okStatus: 200 | 201;
  readonly fetcher?: typeof fetch;
}

/** One mutation. A failure the caller cannot classify is `uncertain`: it replays under the same key. */
export const sendJson = async (
  path: string,
  body: unknown,
  options: SendOptions,
): Promise<MutationAnswer> => {
  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(path, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': options.csrfToken,
        'idempotency-key': options.idempotencyKey,
        'if-match': `"${options.ifMatch}"`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: 'uncertain' };
  }
  if (!(response instanceof Response)) return { kind: 'uncertain' };
  if (response.headers.get(UNKNOWN_OUTCOME_HEADER) === 'unknown')
    return { kind: 'uncertain' };
  if (response.status === options.okStatus) {
    try {
      return {
        kind: 'ok',
        status: response.status,
        body: await response.json(),
        etag: response.headers.get('etag'),
      };
    } catch {
      return { kind: 'uncertain' };
    }
  }
  const status = response.status;
  if (status >= 500 || !Object.hasOwn(CATALOG_CODES, status))
    return { kind: 'uncertain' };
  const wait =
    status === 429 ? await rateLimitWaitSeconds(response.clone()) : null;
  const details = await catalogDetails(response);
  if (details === null) return { kind: 'uncertain' };
  if (status === 429) return { kind: 'rate_limited', retryAfterSeconds: wait };
  return {
    kind: 'refused',
    status,
    reason: reasonOf(details),
    paths: status === 422 ? pathsOf(details) : [],
    currentVersion: status === 409 ? versionOf(details.currentVersion) : null,
  };
};

export interface ReadOptions {
  readonly fetcher?: typeof fetch;
  readonly signal?: AbortSignal;
  readonly sleep?: Sleep;
}

/** One safe read; a dependency failure that declares itself retryable is retried twice (FE03 :1173). */
export const readJson = async (
  path: string,
  options: ReadOptions = {},
): Promise<ReadAnswer> => {
  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await retryingSafeRead(
      () =>
        fetcher(path, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          redirect: 'error',
          ...(options.signal === undefined ? {} : { signal: options.signal }),
        }),
      options.sleep === undefined ? {} : { sleep: options.sleep },
    );
  } catch {
    return { kind: 'failed', status: null, reason: null };
  }
  if (!(response instanceof Response))
    return { kind: 'failed', status: null, reason: null };
  if (response.status === 200) {
    try {
      return {
        kind: 'ok',
        status: 200,
        body: await response.json(),
        etag: response.headers.get('etag'),
      };
    } catch {
      return { kind: 'failed', status: 200, reason: null };
    }
  }
  if (response.status === 429)
    return {
      kind: 'rate_limited',
      retryAfterSeconds: await rateLimitWaitSeconds(response),
    };
  const details = Object.hasOwn(CATALOG_CODES, response.status)
    ? await catalogDetails(response)
    : null;
  return {
    kind: 'failed',
    status: response.status,
    reason: details === null ? null : reasonOf(details),
  };
};
