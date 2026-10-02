import {
  CHALLENGE_ID,
  FACTOR_ID,
  NOW,
  OTHER_FACTOR_ID,
  PROVIDER_FACTOR_ID,
  SHAPES,
  crashOnSuccessBody,
  json,
  mintJar,
  rpcRefusal,
  type DetailsShape,
  type Handler,
  type Send,
} from './dec111-composition.test-support';

const LIST = '/api/v1/account/mfa/factors';
const CHALLENGES = '/api/v1/auth/step-up/challenges';

export const P_ENROLL = 'POST /auth/v1/factors';
export const P_CHALLENGE = `POST /auth/v1/factors/${PROVIDER_FACTOR_ID}/challenge`;
export const P_VERIFY = `POST /auth/v1/factors/${PROVIDER_FACTOR_ID}/verify`;
export const P_DELETE = `DELETE /auth/v1/factors/${PROVIDER_FACTOR_ID}`;

export type OperationNumber = 16 | 17 | 18 | 19 | 20 | 21;

export const BASE: Readonly<Record<OperationNumber, Send>> = {
  16: { method: 'GET', path: LIST },
  17: {
    method: 'POST',
    path: LIST,
    body: { method: 'totp', friendlyName: 'Phone authenticator' },
    headers: { 'if-match': '"3"' },
  },
  18: {
    method: 'POST',
    path: `${LIST}/${OTHER_FACTOR_ID}/verify`,
    body: { code: '123456' },
    headers: { 'if-match': '"5"' },
  },
  19: {
    method: 'DELETE',
    path: `${LIST}/${FACTOR_ID}`,
    body: { reason: 'user_request' },
    headers: { 'if-match': '"3"', 'idempotency-key': 'idem-key-0123456789' },
  },
  20: { method: 'POST', path: CHALLENGES, body: { method: 'totp' } },
  21: {
    method: 'POST',
    path: `${CHALLENGES}/${CHALLENGE_ID}/verify`,
    body: { code: '123456' },
  },
};

export type Scenario = Readonly<{
  op: OperationNumber;
  criterion: number;
  title: string;
  status: number;
  code: string;
  shape: DetailsShape;
  handlers?: Readonly<Record<string, Handler>>;
  send?: (base: Send) => Send | Promise<Send>;
  arrange?: () => { restore: () => void };
}>;

const providerDown = () => new Response('{}', { status: 500 });
const providerGarbage = () => new Response('not json', { status: 200 });
const aborted: Handler = () => {
  throw new DOMException('deadline', 'AbortError');
};
const rateExceeded: Handler = (call) =>
  json({
    allowed: false,
    limit: Number(call.body?.p_limit ?? 1),
    remaining: 0,
    resetAt: Math.floor(NOW / 1000) + 600,
  });
const suspended: Handler = () =>
  json({
    accountState: 'suspended',
    bootstrapState: 'complete',
    personId: '44444444-4444-4444-8444-444444444444',
    actingPartyId: '44444444-4444-4444-8444-444444444444',
  });

/** The persistence call each operation makes first, for dependency faults. */
const FIRST_RPC: Readonly<Record<OperationNumber, string>> = {
  16: 'auth_mfa_factors_read',
  17: 'auth_mfa_factors_read',
  18: 'auth_mfa_enrollment_verify_prepare',
  19: 'auth_mfa_factors_read',
  20: 'auth_step_up_challenge_begin',
  21: 'auth_step_up_challenge_verify_prepare',
};

/** The provider call that decides each operation, for 502 / 503 / 504. */
const PROVIDER_CALL: Readonly<Record<OperationNumber, string | null>> = {
  16: null,
  17: P_ENROLL,
  18: P_CHALLENGE,
  19: P_DELETE,
  20: P_CHALLENGE,
  21: P_VERIFY,
};

const withoutAccessCookie = async (base: Send): Promise<Send> => {
  const jar = await mintJar();
  return {
    ...base,
    jar: {
      ...jar,
      cookie: jar.cookie
        .split('; ')
        .filter((pair) => !pair.startsWith('wj_access='))
        .join('; '),
    },
  };
};

const oversize = (base: Send): Send => ({
  ...base,
  rawBody: JSON.stringify({ code: '1'.repeat(300_000) }),
});

const csrfRefused = async (base: Send): Promise<Send> => {
  const jar = await mintJar();
  return { ...base, jar: { ...jar, csrf: 'forged-token' } };
};

const MALFORMED: Readonly<Record<OperationNumber, (b: Send) => Send>> = {
  16: (b) => ({ ...b, path: `${b.path}?factorId=x` }),
  17: (b) => ({ ...b, rawBody: '{' }),
  18: (b) => ({ ...b, path: `${LIST}/not-a-uuid/verify` }),
  19: (b) => ({ ...b, path: `${LIST}/not-a-uuid` }),
  20: (b) => ({ ...b, rawBody: '{' }),
  21: (b) => ({ ...b, path: `${CHALLENGES}/not-a-uuid/verify` }),
};

const INVALID_FIELD: Readonly<Record<OperationNumber, (b: Send) => Send>> = {
  16: (b) => b,
  17: (b) => ({ ...b, body: { method: 'sms', friendlyName: '' } }),
  18: (b) => ({ ...b, body: { code: '12345' } }),
  19: (b) => ({ ...b, body: { reason: 'because' } }),
  20: (b) => ({ ...b, body: { method: 'sms' } }),
  21: (b) => ({ ...b, body: { code: 'abcdef' } }),
};

const CONFLICT_RPC: Readonly<
  Record<OperationNumber, readonly [string, string]>
> = {
  16: ['', ''],
  17: ['auth_mfa_enrollment_begin', 'MFA_FACTOR_LIMIT'],
  18: ['auth_mfa_enrollment_verify_prepare', 'FACTOR_NOT_PENDING'],
  19: ['auth_mfa_removal_begin', 'LAST_FACTOR_REQUIRED'],
  20: ['auth_step_up_challenge_begin', 'NO_VERIFIED_FACTOR'],
  21: ['auth_step_up_challenge_verify_prepare', 'CHALLENGE_CONSUMED'],
};

const dependency = (
  op: OperationNumber,
  criterion: number,
  status: 502 | 503 | 504,
  mode: 'persistence' | 'provider',
): Scenario => {
  const providerKey = PROVIDER_CALL[op];
  const useProvider = mode === 'provider' && providerKey !== null;
  const key = useProvider ? providerKey : FIRST_RPC[op];
  const handler: Handler =
    status === 504
      ? aborted
      : status === 503
        ? useProvider
          ? providerDown
          : () => rpcRefusal('boom', 500)
        : useProvider
          ? providerGarbage
          : () => json({ bogus: true });
  const word =
    status === 502
      ? 'an invalid dependency response'
      : status === 503
        ? 'an unavailable dependency'
        : 'an exceeded dependency deadline';
  return {
    op,
    criterion,
    title: `returns ${status} DEPENDENCY_UNAVAILABLE for ${word} (${useProvider ? 'provider' : 'persistence'})`,
    status,
    code: 'DEPENDENCY_UNAVAILABLE',
    shape: SHAPES.dependency,
    handlers: { [key]: handler },
  };
};

type Row = readonly [OperationNumber, number[]];
const ROWS: readonly Row[] = [
  [17, [752, 753, 754, 755, 756, 757, 758, 759, 760, 761, 762, 763]],
  [18, [779, 780, 781, 782, 783, 784, 785, 786, 787, 788, 789, 790, 791]],
  [19, [810, 811, 812, 813, 814, 815, 816, 817, 818, 819, 820, 821, 822]],
  [20, [840, 841, 842, 843, 844, 845, 846, 847, 848, 849, 850, 851, 852]],
  [21, [866, 867, 868, 869, 870, 871, 872, 873, 874, 875, 876, 877, 878]],
];
const STATUS_ORDER = [
  400, 401, 403, 404, 409, 413, 415, 422, 429, 502, 503, 504, 500,
];

const forOperation = (op: OperationNumber, ids: number[]): Scenario[] => {
  const has404 = op >= 18;
  const statuses = STATUS_ORDER.filter((s) =>
    s === 404 ? has404 : true,
  ).filter((s) => op !== 17 || s !== 404);
  const id = (status: number): number =>
    ids[statuses.indexOf(status)] as number;
  const [conflictRpc, conflictMessage] = CONFLICT_RPC[op];
  const out: Scenario[] = [
    {
      op,
      criterion: id(400),
      title: 'returns 400 INVALID_REQUEST for a malformed body, path or header',
      status: 400,
      code: 'INVALID_REQUEST',
      shape: SHAPES.invalidRequest,
      send: (b) => MALFORMED[op](b),
    },
    {
      op,
      criterion: id(401),
      title:
        'returns 401 UNAUTHENTICATED with recoveryAction reauthenticate for a missing session',
      status: 401,
      code: 'UNAUTHENTICATED',
      shape: SHAPES.reauthenticate,
      send: withoutAccessCookie,
    },
    {
      op,
      criterion: id(403),
      title:
        'returns 403 FORBIDDEN with a reasonCode for an ineligible account',
      status: 403,
      code: 'FORBIDDEN',
      shape: SHAPES.forbidden,
      handlers: { auth_session_read: suspended },
    },
    {
      op,
      criterion: id(409),
      title: 'returns 409 CONFLICT with the INVALID_TRANSITION details row',
      status: 409,
      code: 'CONFLICT',
      shape: SHAPES.conflict,
      handlers: { [conflictRpc]: () => rpcRefusal(conflictMessage, 409) },
    },
    {
      op,
      criterion: id(413),
      title: 'returns 413 PAYLOAD_TOO_LARGE for a body above 256 KiB',
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      shape: SHAPES.tooLarge,
      send: oversize,
    },
    {
      op,
      criterion: id(415),
      title: 'returns 415 UNSUPPORTED_MEDIA_TYPE for a non-JSON body',
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      shape: SHAPES.unsupported,
      send: (b) => ({
        ...b,
        rawBody: 'x',
        headers: { ...(b.headers ?? {}), 'content-type': 'text/plain' },
      }),
    },
    {
      op,
      criterion: id(422),
      title:
        'returns 422 VALIDATION_FAILED with violations for a field failure',
      status: 422,
      code: 'VALIDATION_FAILED',
      shape: SHAPES.validation,
      send: (b) => INVALID_FIELD[op](b),
    },
    {
      op,
      criterion: id(429),
      title:
        'returns 429 RATE_LIMITED with retryAfterSeconds, limit and resetAt',
      status: 429,
      code: 'RATE_LIMITED',
      shape: SHAPES.rate,
      handlers: { auth_rate_limit: rateExceeded },
    },
    dependency(op, id(502), 502, 'provider'),
    dependency(op, id(503), 503, 'provider'),
    dependency(op, id(504), 504, 'provider'),
    {
      op,
      criterion: id(500),
      title:
        'returns 500 INTERNAL_ERROR with empty details for an unexpected failure',
      status: 500,
      code: 'INTERNAL_ERROR',
      shape: SHAPES.empty,
      arrange: () => {
        const spy = crashOnSuccessBody();
        return { restore: () => spy.mockRestore() };
      },
    },
  ];
  if (has404)
    out.push({
      op,
      criterion: id(404),
      title:
        'returns 404 NOT_FOUND with empty details for a concealed resource',
      status: 404,
      code: 'NOT_FOUND',
      shape: SHAPES.empty,
      handlers:
        op === 19
          ? { auth_mfa_factors_read: () => json({ factors: [], version: '3' }) }
          : { [FIRST_RPC[op]]: () => rpcRefusal('NOT_FOUND', 404) },
    });
  return out;
};

export const SCENARIOS: readonly Scenario[] = [
  ...(
    [
      [726, 401, 'UNAUTHENTICATED', SHAPES.reauthenticate, 'missing session'],
    ] as const
  ).map(([criterion, status, code, shape, label]): Scenario => ({
    op: 16,
    criterion,
    title: `returns ${status} ${code} with recoveryAction reauthenticate for a ${label}`,
    status,
    code,
    shape,
    send: withoutAccessCookie,
  })),
  {
    op: 16,
    criterion: 727,
    title: 'returns 403 FORBIDDEN with a reasonCode for account_not_eligible',
    status: 403,
    code: 'FORBIDDEN',
    shape: SHAPES.forbidden,
    handlers: { auth_session_read: suspended },
  },
  {
    op: 16,
    criterion: 728,
    title: 'returns 429 RATE_LIMITED when 300 per minute per user is exceeded',
    status: 429,
    code: 'RATE_LIMITED',
    shape: SHAPES.rate,
    handlers: { auth_rate_limit: rateExceeded },
  },
  {
    ...dependency(16, 729, 503, 'persistence'),
  },
  { ...dependency(16, 730, 504, 'persistence') },
  {
    op: 16,
    criterion: 731,
    title:
      'returns 500 INTERNAL_ERROR with empty details for an unexpected failure',
    status: 500,
    code: 'INTERNAL_ERROR',
    shape: SHAPES.empty,
    arrange: () => {
      const spy = crashOnSuccessBody();
      return { restore: () => spy.mockRestore() };
    },
  },
  ...ROWS.flatMap(([op, ids]) => forOperation(op, ids)),
  {
    op: 17,
    criterion: 764,
    title:
      'returns 401 STEP_UP_REQUIRED with recoveryAction step_up and allowedMethods, never 403, with no retained effect',
    status: 401,
    code: 'STEP_UP_REQUIRED',
    shape: SHAPES.stepUp,
    send: async (b) => ({
      ...b,
      jar: await mintJar({ stepUpAt: null }),
    }),
  },
  {
    op: 19,
    criterion: 823,
    title:
      'returns 401 STEP_UP_REQUIRED with recoveryAction step_up and allowedMethods, never 403, with no retained effect',
    status: 401,
    code: 'STEP_UP_REQUIRED',
    shape: SHAPES.stepUp,
    send: async (b) => ({
      ...b,
      jar: await mintJar({ stepUpAt: null }),
    }),
  },
];

/** CSRF and origin refusals are 403 on every browser mutation (AUTH-API-17..21). */
export const CSRF_SCENARIOS: readonly Scenario[] = (
  [
    [17, 754],
    [18, 781],
    [19, 812],
    [20, 842],
    [21, 868],
  ] as const
).flatMap(([op, criterion]): Scenario[] => [
  {
    op,
    criterion,
    title: 'returns 403 FORBIDDEN with a reasonCode for a CSRF refusal',
    status: 403,
    code: 'FORBIDDEN',
    shape: SHAPES.forbidden,
    send: csrfRefused,
  },
  {
    op,
    criterion,
    title: 'returns 403 FORBIDDEN with a reasonCode for an origin refusal',
    status: 403,
    code: 'FORBIDDEN',
    shape: SHAPES.forbidden,
    send: (b) => ({
      ...b,
      headers: { ...(b.headers ?? {}), origin: 'https://evil.example' },
    }),
  },
]);
