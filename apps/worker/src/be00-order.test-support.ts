import { expect, it } from 'vitest';

/**
 * BE00 section "Hono Middleware Order" is executable contract. Every human
 * route family proves it the same way: a request that fails several steps at
 * once is answered by the EARLIEST failing step, and repairing that step
 * exposes the next one. `steps` lists the defects in BE00 order; `broken`
 * applies defects `index..end` to one fresh state, so a single request fails
 * every step from `index` onward and must report the one at `index`.
 */
export type OrderStep<State> = Readonly<{
  name: string;
  status: number;
  code: string;
  /** Applies this step's defect to the request state. */
  break: (state: State) => State;
  /** Optional extra assertion on the refusal body (details, headers). */
  check?: (response: Response, body: Record<string, unknown>) => void;
}>;

export type OrderProbe<State> = Readonly<{
  family: string;
  fresh: () => State;
  send: (state: State) => Promise<Response>;
  steps: readonly OrderStep<State>[];
  /** Asserts a request with no defect is accepted (2xx). */
  accepted: (response: Response) => void;
}>;

export const registerOrderTests = <State>(probe: OrderProbe<State>): void => {
  it(`${probe.family}: a request with no defect is accepted`, async () => {
    probe.accepted(await probe.send(probe.fresh()));
  });
  probe.steps.forEach((step, index) => {
    it(`${probe.family}: step ${index + 1} (${step.name}) wins over every later step`, async () => {
      const state = probe.steps
        .slice(index)
        .reduce((current, later) => later.break(current), probe.fresh());
      const response = await probe.send(state);
      const body = (await response.clone().json()) as Record<string, unknown>;
      expect({ status: response.status, code: body.code }).toEqual({
        status: step.status,
        code: step.code,
      });
      step.check?.(response, body);
    });
  });
};

/**
 * The BE00 defects every cookie-session human mutation shares, in contract
 * order. A route family supplies how to inject each defect into its own
 * request state and the error codes it publishes.
 */
export type MutationAdapter<State> = Readonly<{
  codes: Readonly<{
    forbidden: string;
    badRequest: string;
    unauthenticated: string;
    validation: string;
    rateLimited: string;
  }>;
  /** Oversize bodies are 413 where the family registers it, else 400. */
  oversize: Readonly<{ status: 400 | 413; code: string }>;
  setHeader: (state: State, name: string, value: string) => State;
  failAuthentication: (state: State) => State;
  dropCapability: (state: State) => State;
  exhaustRate: (state: State) => State;
  addQuery: (state: State) => State;
  /** Null when the route has no path parameter to corrupt. */
  breakPath: ((state: State) => State) | null;
  breakBody: (state: State) => State;
  breakIdempotencyKey: (state: State) => State;
  checkMediaDetails: (body: Record<string, unknown>) => void;
}>;

export const standardMutationSteps = <State>(
  adapter: MutationAdapter<State>,
): readonly OrderStep<State>[] => [
  {
    name: 'CORS origin allowlist',
    status: 403,
    code: adapter.codes.forbidden,
    break: (state) =>
      adapter.setHeader(state, 'origin', 'https://evil.example.test'),
  },
  {
    name: 'body size ceiling',
    status: adapter.oversize.status,
    code: adapter.oversize.code,
    break: (state) =>
      adapter.setHeader(state, 'content-length', String(256 * 1024 + 1)),
  },
  {
    name: 'content type',
    status: 415,
    code: 'UNSUPPORTED_MEDIA_TYPE',
    break: (state) => adapter.setHeader(state, 'content-type', 'text/plain'),
    check: (_response, body) => adapter.checkMediaDetails(body),
  },
  {
    name: 'session-bound CSRF',
    status: 403,
    code: adapter.codes.forbidden,
    break: (state) =>
      adapter.setHeader(state, 'cookie', 'wj_session_ref=ref-1'),
  },
  {
    name: 'authentication',
    status: 401,
    code: adapter.codes.unauthenticated,
    break: adapter.failAuthentication,
  },
  {
    name: 'strict query validation',
    status: 400,
    code: adapter.codes.badRequest,
    break: adapter.addQuery,
  },
  ...(adapter.breakPath === null
    ? []
    : [
        {
          name: 'strict path validation',
          status: 400,
          code: adapter.codes.badRequest,
          break: adapter.breakPath,
        },
      ]),
  {
    name: 'strict body validation',
    status: 422,
    code: adapter.codes.validation,
    break: adapter.breakBody,
  },
  {
    name: 'capability',
    status: 403,
    code: adapter.codes.forbidden,
    break: adapter.dropCapability,
  },
  {
    name: 'rate limit',
    status: 429,
    code: adapter.codes.rateLimited,
    break: adapter.exhaustRate,
  },
  {
    name: 'idempotency key',
    status: 400,
    code: adapter.codes.badRequest,
    break: adapter.breakIdempotencyKey,
  },
];

/** A plain HTTP request state plus the three dependency defects. */
export type HttpState = Readonly<{
  path: string;
  query: string;
  headers: Readonly<Record<string, string>>;
  body: unknown;
  unauthenticated: boolean;
  capabilityDropped: boolean;
  rateExhausted: boolean;
}>;

export const httpFresh = (
  path: string,
  body: unknown,
  headers: Readonly<Record<string, string>>,
): HttpState => ({
  path,
  query: '',
  headers,
  body,
  unauthenticated: false,
  capabilityDropped: false,
  rateExhausted: false,
});

export const httpRequest = (state: HttpState, host: string): Request =>
  new Request(`${host}${state.path}${state.query}`, {
    method: 'POST',
    headers: state.headers,
    body: JSON.stringify(state.body),
  });

export const httpAdapter = (
  options: Readonly<{
    codes: MutationAdapter<HttpState>['codes'];
    oversize: MutationAdapter<HttpState>['oversize'];
    badPath: string | null;
    badBody: unknown;
    badIdempotencyKey?: string;
  }>,
): MutationAdapter<HttpState> => ({
  codes: options.codes,
  oversize: options.oversize,
  setHeader: (state, name, value) => ({
    ...state,
    headers: { ...state.headers, [name]: value },
  }),
  failAuthentication: (state) => ({ ...state, unauthenticated: true }),
  dropCapability: (state) => ({ ...state, capabilityDropped: true }),
  exhaustRate: (state) => ({ ...state, rateExhausted: true }),
  addQuery: (state) => ({ ...state, query: '?unexpected=1' }),
  breakPath:
    options.badPath === null
      ? null
      : (state) => ({ ...state, path: options.badPath as string }),
  breakBody: (state) => ({ ...state, body: options.badBody }),
  breakIdempotencyKey: (state) => ({
    ...state,
    headers: {
      ...state.headers,
      'idempotency-key': options.badIdempotencyKey ?? 'short',
    },
  }),
  checkMediaDetails: (body) =>
    expect(body.details).toEqual({ allowedMediaTypes: ['application/json'] }),
});
