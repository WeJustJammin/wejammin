import { describe, expect } from 'vitest';

import { registerOrderTests, type OrderStep } from '../be00-order.test-support';
import {
  API_ORIGIN,
  CMS_ORIGIN,
  REQUEST_ID,
  TYPE_ID,
  VERSION_ID,
  error,
  ok,
  session,
  validActivation,
} from './phase-02-slice-09-test-values';
import { makeHarness } from './phase-02-slice-09-worker-test-support';
import type {
  ContentSchemaRegistryResult,
  ContentSchemaRegistrySession,
} from './index';

type RateResult = ContentSchemaRegistryResult<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}>;

type State = Readonly<{
  headers: Readonly<Record<string, string>>;
  path: string;
  body: unknown;
  session: ContentSchemaRegistryResult<ContentSchemaRegistrySession>;
  rate: RateResult;
}>;

const ACTIVATE = (versionId: string): string =>
  `/api/v1/cms/content-types/${TYPE_ID}/versions/${versionId}/activate`;

const fresh = (): State => ({
  headers: {
    'content-type': 'application/json',
    origin: CMS_ORIGIN,
    authorization: 'Bearer verified-session',
    'idempotency-key': 'cms-test-key-001',
    'if-match': '"1"',
    'x-request-id': REQUEST_ID,
  },
  path: ACTIVATE(VERSION_ID),
  body: validActivation,
  session: ok(session),
  rate: ok({ allowed: true, limit: 10, remaining: 9, resetAt: 1_788_345_660 }),
});

const withHeaders = (state: State, headers: Record<string, string>): State => ({
  ...state,
  headers: { ...state.headers, ...headers },
});

const steps: readonly OrderStep<State>[] = [
  {
    name: 'CORS origin allowlist',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) =>
      withHeaders(state, { origin: 'https://evil.example.test' }),
    check: (_response, body) =>
      expect(body.message).toBe('The request origin is not allowed.'),
  },
  {
    name: 'body size ceiling',
    status: 413,
    code: 'PAYLOAD_TOO_LARGE',
    break: (state) =>
      withHeaders(state, { 'content-length': String(256 * 1024 + 1) }),
  },
  {
    name: 'content type',
    status: 415,
    code: 'UNSUPPORTED_MEDIA_TYPE',
    break: (state) => withHeaders(state, { 'content-type': 'text/plain' }),
    check: (_response, body) =>
      expect(body.details).toEqual({ allowedMediaTypes: ['application/json'] }),
  },
  {
    name: 'session-bound CSRF',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) => withHeaders(state, { cookie: 'wj_session_ref=ref-1' }),
    check: (_response, body) =>
      expect(body.message).toBe('A valid CSRF token is required.'),
  },
  {
    name: 'authentication',
    status: 401,
    code: 'UNAUTHENTICATED',
    break: (state) => ({
      ...state,
      session: error(401, 'UNAUTHENTICATED', 'Sign in.', {
        recoveryAction: 'reauthenticate',
      }),
    }),
  },
  {
    name: 'strict path validation',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => ({ ...state, path: ACTIVATE('not-a-uuid') }),
  },
  {
    name: 'strict body validation',
    status: 422,
    code: 'VALIDATION_FAILED',
    break: (state) => ({ ...state, body: {} }),
  },
  {
    name: 'capability',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) => ({
      ...state,
      session: state.session.ok
        ? ok({ ...state.session.value, capabilities: [] })
        : state.session,
    }),
    check: (_response, body) =>
      expect(body.details).toEqual({ reasonCode: 'CAPABILITY_REQUIRED' }),
  },
  {
    name: 'step-up freshness',
    status: 401,
    code: 'STEP_UP_REQUIRED',
    break: (state) => ({
      ...state,
      session: state.session.ok
        ? ok({ ...state.session.value, mfaFresh: false })
        : state.session,
    }),
  },
  {
    name: 'rate limit',
    status: 429,
    code: 'RATE_LIMITED',
    break: (state) => ({
      ...state,
      rate: ok({
        allowed: false,
        limit: 10,
        remaining: 0,
        resetAt: 1_788_345_660,
      }),
    }),
  },
  {
    name: 'idempotency key and If-Match',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => withHeaders(state, { 'idempotency-key': '' }),
  },
];

describe('[P2-S09-AC-025] BE00 middleware order on the CMS registry human routes (CMS-03A-04)', () => {
  registerOrderTests<State>({
    family: 'content-schema-registry',
    fresh,
    steps,
    send: (state) => {
      const harness = makeHarness({ session: state.session, rate: state.rate });
      return Promise.resolve(
        harness.app.request(
          new Request(`${API_ORIGIN}${state.path}`, {
            method: 'POST',
            headers: state.headers,
            body: JSON.stringify(state.body),
          }),
        ),
      );
    },
    accepted: (response) => expect(response.ok).toBe(true),
  });
});

type ReadState = Readonly<{
  headers: Readonly<Record<string, string>>;
  query: string;
  session: ContentSchemaRegistryResult<ContentSchemaRegistrySession>;
  rate: RateResult;
}>;

const readFresh = (): ReadState => ({
  headers: {
    origin: CMS_ORIGIN,
    authorization: 'Bearer verified-session',
    'x-request-id': REQUEST_ID,
  },
  query: '',
  session: ok(session),
  rate: ok({
    allowed: true,
    limit: 120,
    remaining: 119,
    resetAt: 1_788_345_660,
  }),
});

const readSteps: readonly OrderStep<ReadState>[] = [
  {
    name: 'CORS origin allowlist',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) => ({
      ...state,
      headers: { ...state.headers, origin: 'https://evil.example.test' },
    }),
  },
  {
    name: 'authentication',
    status: 401,
    code: 'UNAUTHENTICATED',
    break: (state) => ({
      ...state,
      session: error(401, 'UNAUTHENTICATED', 'Sign in.', {
        recoveryAction: 'reauthenticate',
      }),
    }),
  },
  {
    name: 'strict query validation',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => ({ ...state, query: '?bogus=1' }),
  },
  {
    name: 'capability',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) => ({
      ...state,
      session: state.session.ok
        ? ok({ ...state.session.value, capabilities: [] })
        : state.session,
    }),
    check: (_response, body) =>
      expect(body.details).toEqual({ reasonCode: 'CAPABILITY_REQUIRED' }),
  },
  {
    name: 'rate limit',
    status: 429,
    code: 'RATE_LIMITED',
    break: (state) => ({
      ...state,
      rate: ok({
        allowed: false,
        limit: 120,
        remaining: 0,
        resetAt: 1_788_345_660,
      }),
    }),
  },
];

describe('[P2-S09-AC-025] BE00 middleware order on the CMS registry protected reads (CMS-03A-06)', () => {
  registerOrderTests<ReadState>({
    family: 'content-schema-registry read',
    fresh: readFresh,
    steps: readSteps,
    send: (state) => {
      const harness = makeHarness({ session: state.session, rate: state.rate });
      return Promise.resolve(
        harness.app.request(
          new Request(`${API_ORIGIN}/api/v1/cms/content-types${state.query}`, {
            headers: state.headers,
          }),
        ),
      );
    },
    accepted: (response) => expect(response.status).toBe(200),
  });
});
