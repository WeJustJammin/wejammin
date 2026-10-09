export const EMPTY_REQUEST_SCHEMA = 'EmptyRequestSchema';

const identityResponse = (
  successStatus,
  successDescription,
  errors,
  { conditional = false, headers } = {},
) => [
  {
    status: successStatus,
    description: successDescription,
    schema: 'success',
    ...(headers ? { headers } : {}),
  },
  ...(conditional
    ? [
        {
          status: '304',
          description: 'Authorized representation has not changed',
          ...(headers ? { headers } : {}),
        },
      ]
    : []),
  ...errors.map(({ status, description }) => ({
    status,
    description,
    schema: 'error',
    ...(status === '429' ? { headers: 'rate' } : {}),
  })),
];

const relationshipMutationErrors = [
  { status: '400', description: 'Relationship command is malformed' },
  { status: '401', description: 'Authentication is required' },
  { status: '403', description: 'Current relationship authority is required' },
  { status: '404', description: 'Relationship target is absent or concealed' },
  { status: '409', description: 'Version, state, or idempotency conflict' },
  {
    status: '422',
    description: 'Relationship command fails domain validation',
  },
  { status: '429', description: 'Relationship command rate limit exceeded' },
  { status: '500', description: 'Relationship command failed safely' },
  { status: '503', description: 'Relationship dependency unavailable' },
  { status: '504', description: 'Relationship dependency timed out' },
];

const relationshipReadErrors = [
  { status: '400', description: 'Relationship read is malformed' },
  { status: '401', description: 'Authentication is required' },
  { status: '403', description: 'Relationship visibility is forbidden' },
  { status: '404', description: 'Relationship target is absent or concealed' },
  { status: '429', description: 'Relationship read rate limit exceeded' },
  { status: '500', description: 'Relationship read failed safely' },
  { status: '503', description: 'Relationship dependency unavailable' },
  { status: '504', description: 'Relationship dependency timed out' },
];

const profileResponse = (
  successStatus,
  successDescription,
  errors,
  { successHeaders } = {},
) => [
  {
    status: successStatus,
    description: successDescription,
    schema: 'success',
    ...(successHeaders ? { headers: successHeaders } : {}),
  },
  ...errors.map(({ status, description }) => ({
    status,
    description,
    schema: 'error',
    ...(status === '429' ? { headers: 'rate' } : {}),
  })),
];

const profileReadResponse = (successDescription, errors) => [
  {
    status: '200',
    description: successDescription,
    schema: 'success',
    headers: 'entity',
  },
  {
    status: '304',
    description: 'Authorized claim representation has not changed',
    headers: 'entity',
  },
  ...errors.map(({ status, description }) => ({
    status,
    description,
    schema: 'error',
    ...(status === '429' ? { headers: 'rate' } : {}),
  })),
];

const profileMatchErrors = [
  { status: '400', description: 'Match request is malformed' },
  { status: '401', description: 'Authentication is required' },
  { status: '403', description: 'Source matching authority is forbidden' },
  { status: '404', description: 'Source context is absent or concealed' },
  { status: '413', description: 'Match request is too large' },
  { status: '415', description: 'Request media type is unsupported' },
  { status: '422', description: 'Match fields fail semantic validation' },
  { status: '429', description: 'Match rate limit exceeded' },
  { status: '500', description: 'Match failed safely' },
  { status: '503', description: 'Matching dependency unavailable' },
  { status: '504', description: 'Matching dependency timed out' },
];

const profileMutationErrors = [
  { status: '400', description: 'Profile command is malformed' },
  { status: '401', description: 'Authentication is required' },
  { status: '403', description: 'Profile command authority is forbidden' },
  { status: '404', description: 'Profile target is absent or concealed' },
  { status: '409', description: 'Profile state or version conflicts' },
  { status: '413', description: 'Profile command is too large' },
  { status: '415', description: 'Request media type is unsupported' },
  { status: '422', description: 'Profile fields fail semantic validation' },
  { status: '429', description: 'Profile command rate limit exceeded' },
  { status: '500', description: 'Profile command failed safely' },
  { status: '503', description: 'Profile dependency unavailable' },
  { status: '504', description: 'Profile dependency timed out' },
];

const profileChallengeErrors = [
  ...profileMutationErrors,
  { status: '502', description: 'Proof provider returned an invalid result' },
];

const profileReadErrors = [
  { status: '400', description: 'Claim read is malformed' },
  { status: '401', description: 'Authentication is required' },
  { status: '404', description: 'Claim is absent or concealed' },
  { status: '429', description: 'Claim read rate limit exceeded' },
  { status: '500', description: 'Claim read failed safely' },
  { status: '503', description: 'Claim dependency unavailable' },
  { status: '504', description: 'Claim dependency timed out' },
];

const profileRemedyErrors = [
  { status: '400', description: 'Remedy request is malformed' },
  { status: '403', description: 'Remedy proof is forbidden' },
  { status: '404', description: 'Remedy pointer is absent or concealed' },
  { status: '409', description: 'Remedy state conflicts' },
  { status: '413', description: 'Remedy request is too large' },
  { status: '415', description: 'Request media type is unsupported' },
  { status: '422', description: 'Remedy fields fail semantic validation' },
  { status: '429', description: 'Remedy rate limit exceeded' },
  { status: '500', description: 'Remedy failed safely' },
  { status: '503', description: 'Remedy dependency unavailable' },
  { status: '504', description: 'Remedy dependency timed out' },
];

const contentSchemaRegistryResponses = (
  successStatuses,
  successDescription,
  errors,
  successHeaders,
) => [
  ...successStatuses.map((status) => ({
    status: String(status),
    description: successDescription,
    schema: 'success',
    headers: successHeaders,
  })),
  ...errors.map(({ status, description, schema = 'error', retryable }) => ({
    status: String(status),
    description,
    schema,
    // BE00/BE03b: 429 and a retryable 503 carry Retry-After and the RateLimit
    // headers; a definition marks its retryable 503 explicitly.
    ...(status === 429 || retryable === true ? { headers: 'rate' } : {}),
  })),
];

const contentSchemaRegistryHumanMutationErrors = [
  { status: 400, description: 'Content schema request is malformed' },
  { status: 401, description: 'Authentication is required' },
  { status: 403, description: 'Content schema capability is forbidden' },
  { status: 404, description: 'Content schema target is absent or concealed' },
  {
    status: 409,
    description: 'Content schema version or idempotency conflicts',
  },
  { status: 415, description: 'Request media type is unsupported' },
  { status: 422, description: 'Content schema fields fail validation' },
  { status: 429, description: 'Content schema rate limit exceeded' },
  { status: 500, description: 'Content schema request failed safely' },
  {
    status: 502,
    description: 'Content schema dependency returned invalid data',
  },
  { status: 503, description: 'Content schema dependency unavailable' },
  { status: 504, description: 'Content schema dependency timed out' },
];

/** The twelve command statuses of an editorial command that requires step-up (E6). */
const editorialStepUpErrors = (subject, rateDescription) => [
  { status: 400, description: `${subject} request is malformed` },
  {
    status: 401,
    description: 'Authentication or recent step-up verification is required',
    schema: 'stepUpUnauthorized',
  },
  {
    status: 403,
    description: `${subject} capability or separation of duties is forbidden`,
  },
  { status: 404, description: `${subject} target is absent or concealed` },
  {
    status: 409,
    description: `${subject} version, dependency or idempotency conflicts`,
  },
  { status: 415, description: 'Request media type is unsupported' },
  {
    status: 422,
    description: `${subject} fields fail validation or preflight`,
  },
  { status: 429, description: rateDescription },
  { status: 500, description: `${subject} request failed safely` },
  { status: 502, description: 'Editorial dependency returned invalid data' },
  {
    status: 503,
    description: 'Editorial or preflight dependency unavailable',
    retryable: true,
  },
  { status: 504, description: 'Editorial dependency timed out' },
];

/** The eleven bounded safe-read statuses: no 409, 415 kept. */
const editorialBoundedReadErrors = (subject) => [
  { status: 400, description: `${subject} request is malformed` },
  { status: 401, description: 'Authentication is required' },
  { status: 403, description: `${subject} read scope is forbidden` },
  { status: 404, description: `${subject} target is absent or concealed` },
  { status: 415, description: 'Request media type is unsupported' },
  { status: 422, description: `${subject} response bounds fail validation` },
  { status: 429, description: 'Read rate limit exceeded' },
  { status: 500, description: `${subject} read failed safely` },
  { status: 502, description: 'Editorial dependency returned invalid data' },
  {
    status: 503,
    description: 'Editorial dependency unavailable',
    retryable: true,
  },
  { status: 504, description: 'Editorial dependency timed out' },
];

const contentSchemaRegistryStepUpMutationErrors =
  contentSchemaRegistryHumanMutationErrors.map((error) =>
    error.status === 401
      ? {
          status: 401,
          description:
            'Authentication or recent step-up verification is required',
          schema: 'stepUpUnauthorized',
        }
      : error,
  );

const contentSchemaRegistryListErrors = [
  { status: 400, description: 'Content schema list query is malformed' },
  { status: 401, description: 'Authentication is required' },
  { status: 403, description: 'Content schema read capability is forbidden' },
  { status: 422, description: 'Content schema list query fails validation' },
  { status: 429, description: 'Content schema list rate limit exceeded' },
  { status: 500, description: 'Content schema list failed safely' },
  {
    status: 502,
    description: 'Content schema projection returned invalid data',
  },
  { status: 503, description: 'Content schema projection unavailable' },
  { status: 504, description: 'Content schema projection timed out' },
];

const contentSchemaRegistryGrantListErrors = [
  { status: 400, description: 'Capability grant list query is malformed' },
  { status: 401, description: 'Authentication is required' },
  { status: 403, description: 'Owner authority is required' },
  { status: 422, description: 'Capability grant list query fails validation' },
  { status: 429, description: 'Capability grant list rate limit exceeded' },
  { status: 500, description: 'Capability grant list failed safely' },
  {
    status: 502,
    description: 'Capability grant projection returned invalid data',
  },
  { status: 503, description: 'Capability grant projection unavailable' },
  { status: 504, description: 'Capability grant projection timed out' },
];

const contentSchemaRegistryDetailErrors = [
  { status: 400, description: 'Content schema detail path is malformed' },
  { status: 401, description: 'Authentication is required' },
  { status: 403, description: 'Content schema read capability is forbidden' },
  { status: 404, description: 'Content schema version is absent or concealed' },
  { status: 429, description: 'Content schema detail rate limit exceeded' },
  { status: 500, description: 'Content schema detail failed safely' },
  {
    status: 502,
    description: 'Content schema projection returned invalid data',
  },
  { status: 503, description: 'Content schema projection unavailable' },
  { status: 504, description: 'Content schema projection timed out' },
];

const contentSchemaRegistryReviewDetailErrors = [
  { status: 400, description: 'Schema review path is malformed' },
  { status: 401, description: 'Authentication is required' },
  { status: 403, description: 'Schema review read capability is forbidden' },
  { status: 404, description: 'Schema review is absent or concealed' },
  { status: 429, description: 'Schema review read rate limit exceeded' },
  { status: 500, description: 'Schema review read failed safely' },
  {
    status: 502,
    description: 'Schema review projection returned invalid data',
  },
  { status: 503, description: 'Schema review projection unavailable' },
  { status: 504, description: 'Schema review projection timed out' },
];

const contentSchemaRegistryReleaseErrors = [
  { status: 400, description: 'Signed content schema request is malformed' },
  { status: 401, description: 'Signed release admission was rejected' },
  { status: 403, description: 'Signed release capability is forbidden' },
  {
    status: 404,
    description: 'Signed content schema target is absent or concealed',
  },
  {
    status: 409,
    description: 'Signed content schema version or nonce conflicts',
  },
  { status: 415, description: 'Request media type is unsupported' },
  {
    status: 422,
    description: 'Signed content schema manifest fails validation',
  },
  { status: 429, description: 'Signed content schema rate limit exceeded' },
  { status: 500, description: 'Signed content schema request failed safely' },
  {
    status: 502,
    description: 'Signed content schema dependency returned invalid data',
  },
  { status: 503, description: 'Signed content schema dependency unavailable' },
  { status: 504, description: 'Signed content schema dependency timed out' },
];

const authMfaCommandErrors = (
  subject,
  { stepUp = false, notFound, conflict, validation, rate },
) => [
  { status: '400', description: `${subject} request or headers are malformed` },
  {
    status: '401',
    description: stepUp
      ? 'Verified session or recent step-up verification is required'
      : 'Verified session is required',
    ...(stepUp ? { schema: 'stepUpUnauthorized' } : {}),
  },
  { status: '403', description: 'Account is not eligible or CSRF failed' },
  { status: '404', description: notFound },
  { status: '409', description: conflict },
  { status: '413', description: `${subject} body is too large` },
  { status: '415', description: `${subject} media type is unsupported` },
  { status: '422', description: validation },
  { status: '429', description: rate },
  { status: '500', description: `${subject} failed safely` },
  {
    status: '502',
    description: 'Authentication provider returned an invalid response',
  },
  { status: '503', description: `${subject} dependency unavailable` },
  { status: '504', description: `${subject} dependency timed out` },
];

const authMfaResponses = (
  successStatus,
  successDescription,
  errors,
  headers,
) => [
  {
    status: successStatus,
    description: successDescription,
    schema: 'success',
    ...(headers ? { headers } : {}),
  },
  ...errors.map((error) => ({
    schema: 'error',
    ...error,
    ...(error.status === '429' ? { headers: 'rate' } : {}),
  })),
];

const authMfaFactorErrors = {
  notFound: 'Factor is absent or concealed',
  conflict: 'MFA state, factor, or version conflicts',
  validation: 'MFA fields fail semantic validation',
  rate: 'MFA rate limit exceeded',
};

const adminMfaFactorResetErrors = [
  {
    status: '400',
    description: 'MFA factor reset request or headers are malformed',
  },
  {
    status: '401',
    description: 'Verified session or recent step-up verification is required',
    schema: 'stepUpUnauthorized',
  },
  {
    status: '403',
    description:
      'Named admin.identity.mfa_reset capability or CSRF is forbidden',
  },
  { status: '404', description: 'Target person is absent or concealed' },
  {
    status: '409',
    description: 'Reset is already in progress or idempotency conflicts',
  },
  { status: '413', description: 'MFA factor reset body is too large' },
  { status: '415', description: 'MFA factor reset media type is unsupported' },
  {
    status: '422',
    description: 'Reset fails validation or targets the operator themselves',
  },
  { status: '429', description: 'MFA factor reset rate limit exceeded' },
  { status: '500', description: 'MFA factor reset failed safely' },
  {
    status: '502',
    description: 'Identity dependency returned an invalid response',
  },
  { status: '503', description: 'Identity service unavailable' },
  { status: '504', description: 'Identity dependency timed out' },
];

export const routeDefinitions = {
  authProviderCatalogRead: {
    responses: [
      {
        status: '200',
        description: 'Reviewed authentication provider catalog',
        schema: 'success',
      },
      {
        status: '429',
        description: 'Provider catalog rate limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '503',
        description: 'Provider catalog unavailable',
        schema: 'error',
      },
    ],
  },
  authEmailStart: {
    responses: [
      {
        status: '202',
        description: 'Enumeration-safe email flow accepted',
        schema: 'success',
      },
      {
        status: '400',
        description: 'Email flow request is malformed',
        schema: 'error',
      },
      {
        status: '422',
        description: 'Email flow fields fail semantic validation',
        schema: 'error',
      },
      {
        status: '429',
        description: 'Email flow rate limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '502',
        description: 'Authentication provider returned an invalid response',
        schema: 'error',
      },
      {
        status: '503',
        description: 'Authentication provider unavailable',
        schema: 'error',
      },
    ],
  },
  authOAuthStart: {
    responses: [
      {
        status: '200',
        description: 'Authorization redirect created',
        schema: 'success',
      },
      {
        status: '400',
        description: 'OAuth request is malformed',
        schema: 'error',
      },
      {
        status: '401',
        description:
          'Verified session or recent step-up verification is required',
        schema: 'stepUpUnauthorized',
      },
      {
        status: '403',
        description: 'Account is not eligible or CSRF verification failed',
        schema: 'error',
      },
      {
        status: '404',
        description: 'Merge target is absent or concealed',
        schema: 'error',
      },
      {
        status: '422',
        description: 'Provider or intent is unavailable',
        schema: 'error',
      },
      {
        status: '429',
        description: 'OAuth start rate limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '502',
        description: 'Authentication provider returned an invalid response',
        schema: 'error',
      },
      {
        status: '503',
        description: 'Authentication provider unavailable',
        schema: 'error',
      },
    ],
  },
  authCallbackComplete: {
    responses: [
      {
        status: '302',
        description: 'Validated callback completed and redirected',
      },
      {
        status: '400',
        description: 'Callback state or provider result is invalid',
        schema: 'error',
      },
      {
        status: '429',
        description: 'Callback rate limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '502',
        description:
          'Provider response or persisted callback result is invalid',
        schema: 'error',
      },
      {
        status: '503',
        description: 'Callback dependency unavailable',
        schema: 'error',
      },
    ],
  },
  authSessionRead: {
    responses: [
      {
        status: '200',
        description: 'Verified current session',
        schema: 'success',
      },
      {
        status: '401',
        description: 'Authentication session is absent or invalid',
        schema: 'error',
      },
      {
        status: '429',
        description: 'Session read rate limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '503',
        description: 'Session dependency unavailable',
        schema: 'error',
      },
    ],
  },
  authSessionRefresh: {
    responses: [
      {
        status: '200',
        description: 'Session refreshed and cookies rotated',
        schema: 'success',
      },
      {
        status: '400',
        description: 'Refresh body is not empty',
        schema: 'error',
      },
      {
        status: '401',
        description: 'Refresh session is absent, reused, or invalid',
        schema: 'error',
      },
      {
        status: '403',
        description: 'CSRF verification failed',
        schema: 'error',
      },
      {
        status: '429',
        description: 'Session refresh rate limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '502',
        description: 'Provider refresh response is invalid',
        schema: 'error',
      },
      {
        status: '503',
        description: 'Session refresh dependency unavailable',
        schema: 'error',
      },
    ],
  },
  authPersonBootstrap: {
    responses: [
      {
        status: '200',
        description: 'Existing person binding returned',
        schema: 'success',
        headers: 'mutation',
      },
      {
        status: '201',
        description: 'Self person binding created',
        schema: 'success',
        headers: 'mutation',
      },
      {
        status: '400',
        description: 'Bootstrap body or headers are malformed',
        schema: 'error',
      },
      {
        status: '401',
        description: 'Verified active Auth user is required',
        schema: 'error',
      },
      {
        status: '409',
        description: 'Idempotency binding conflicts',
        schema: 'error',
      },
      {
        status: '429',
        description: 'Bootstrap rate limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '503',
        description: 'Bootstrap dependency unavailable',
        schema: 'error',
      },
    ],
  },
  authLogout: {
    responses: [
      { status: '204', description: 'Local session authority revoked' },
      {
        status: '400',
        description: 'Logout request or headers are malformed',
        schema: 'error',
      },
      {
        status: '401',
        description:
          'Verified session or recent step-up verification is required',
        schema: 'stepUpUnauthorized',
      },
      {
        status: '403',
        description: 'Account is not eligible or CSRF verification failed',
        schema: 'error',
      },
      {
        status: '409',
        description: 'Idempotency binding conflicts',
        schema: 'error',
      },
      {
        status: '429',
        description: 'Logout rate limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '503',
        description:
          'Logout dependency unavailable after local recovery boundary',
        schema: 'error',
      },
    ],
  },
  authLoginMethodsRead: {
    responses: [
      {
        status: '200',
        description: 'Current login methods',
        schema: 'success',
        headers: 'entity',
      },
      {
        status: '401',
        description: 'Verified session is required',
        schema: 'error',
      },
      {
        status: '429',
        description: 'Login-method read rate limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '503',
        description: 'Login-method dependency unavailable',
        schema: 'error',
      },
      {
        status: '504',
        description: 'Login-method read timed out',
        schema: 'error',
      },
      {
        status: '500',
        description: 'Login-method read failed safely',
        schema: 'error',
      },
    ],
  },
  authLoginMethodLinkIntentCreate: {
    responses: [
      {
        status: '201',
        description: 'Provider-link authorization created',
        schema: 'success',
        headers: 'mutation',
      },
      {
        status: '400',
        description: 'Link-intent request or headers are malformed',
        schema: 'error',
      },
      {
        status: '401',
        description:
          'Verified session or recent step-up verification is required',
        schema: 'stepUpUnauthorized',
      },
      {
        status: '403',
        description: 'Account is not eligible or CSRF verification failed',
        schema: 'error',
      },
      {
        status: '409',
        description: 'Provider is already linked or idempotency conflicts',
        schema: 'error',
      },
      {
        status: '422',
        description: 'Provider or return target is unavailable',
        schema: 'error',
      },
      {
        status: '429',
        description: 'Provider-link rate limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '502',
        description: 'Authentication provider returned an invalid response',
        schema: 'error',
      },
      {
        status: '503',
        description: 'Provider-link dependency unavailable',
        schema: 'error',
      },
      {
        status: '413',
        description: 'Link-intent body is too large',
        schema: 'error',
      },
      {
        status: '415',
        description: 'Link-intent media type is unsupported',
        schema: 'error',
      },
      {
        status: '504',
        description: 'Provider-link operation timed out',
        schema: 'error',
      },
      {
        status: '500',
        description: 'Provider-link operation failed safely',
        schema: 'error',
      },
    ],
  },
  authLoginMethodUnlink: {
    responses: [
      {
        status: '200',
        description: 'Login method unlinked',
        schema: 'success',
        headers: 'mutation',
      },
      {
        status: '400',
        description: 'Unlink request, identifier, or headers are malformed',
        schema: 'error',
      },
      {
        status: '401',
        description:
          'Verified session or recent step-up verification is required',
        schema: 'stepUpUnauthorized',
      },
      {
        status: '403',
        description: 'Account is not eligible or CSRF verification failed',
        schema: 'error',
      },
      {
        status: '404',
        description: 'Login method is absent or concealed',
        schema: 'error',
      },
      {
        status: '409',
        description: 'Final login method or idempotency conflict',
        schema: 'error',
      },
      {
        status: '422',
        description: 'Unlink reason is invalid',
        schema: 'error',
      },
      {
        status: '429',
        description: 'Login-method unlink rate limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '503',
        description: 'Login-method dependency unavailable',
        schema: 'error',
      },
      {
        status: '413',
        description: 'Unlink body is too large',
        schema: 'error',
      },
      {
        status: '415',
        description: 'Unlink media type is unsupported',
        schema: 'error',
      },
      {
        status: '502',
        description: 'Identity provider returned an invalid response',
        schema: 'error',
      },
      {
        status: '504',
        description: 'Login-method unlink timed out',
        schema: 'error',
      },
      {
        status: '500',
        description: 'Login-method unlink failed safely',
        schema: 'error',
      },
    ],
  },
  authAccountMergeCreate: {
    responses: [
      {
        status: '201',
        description: 'Account-merge case created',
        schema: 'success',
        headers: 'mutation',
      },
      {
        status: '400',
        description: 'Merge request or headers are malformed',
        schema: 'error',
      },
      {
        status: '401',
        description:
          'Verified session or recent step-up verification is required',
        schema: 'stepUpUnauthorized',
      },
      {
        status: '403',
        description: 'Account is not eligible or CSRF verification failed',
        schema: 'error',
      },
      {
        status: '409',
        description: 'Active merge or idempotency conflicts',
        schema: 'error',
      },
      {
        status: '422',
        description: 'Merge return target is invalid',
        schema: 'error',
      },
      {
        status: '429',
        description: 'Account-merge create rate limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '503',
        description: 'Account-merge dependency unavailable',
        schema: 'error',
      },
      {
        status: '413',
        description: 'Account-merge body is too large',
        schema: 'error',
      },
      {
        status: '415',
        description: 'Account-merge media type is unsupported',
        schema: 'error',
      },
      {
        status: '504',
        description: 'Account-merge create timed out',
        schema: 'error',
      },
      {
        status: '500',
        description: 'Account-merge create failed safely',
        schema: 'error',
      },
    ],
  },
  authAccountMergeRead: {
    responses: [
      {
        status: '200',
        description: 'Current account-merge case',
        schema: 'success',
        headers: 'entity',
      },
      {
        status: '400',
        description: 'Merge identifier is malformed',
        schema: 'error',
      },
      {
        status: '401',
        description: 'Verified session is required',
        schema: 'error',
      },
      {
        status: '404',
        description: 'Merge case is absent or concealed',
        schema: 'error',
      },
      {
        status: '429',
        description: 'Account-merge read rate limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '503',
        description: 'Account-merge dependency unavailable',
        schema: 'error',
      },
      {
        status: '504',
        description: 'Account-merge read timed out',
        schema: 'error',
      },
      {
        status: '500',
        description: 'Account-merge read failed safely',
        schema: 'error',
      },
    ],
  },
  authAccountMergeProofCreate: {
    responses: [
      {
        status: '201',
        description: 'Duplicate-proof authorization created',
        schema: 'success',
        headers: 'mutation',
      },
      {
        status: '400',
        description: 'Duplicate-proof request or headers are malformed',
        schema: 'error',
      },
      {
        status: '401',
        description:
          'Verified session or recent step-up verification is required',
        schema: 'stepUpUnauthorized',
      },
      {
        status: '403',
        description: 'Account is not eligible or CSRF verification failed',
        schema: 'error',
      },
      {
        status: '404',
        description: 'Merge case is absent or concealed',
        schema: 'error',
      },
      {
        status: '409',
        description: 'Merge state, identity, or idempotency conflicts',
        schema: 'error',
      },
      {
        status: '422',
        description: 'Provider or return target is unavailable',
        schema: 'error',
      },
      {
        status: '429',
        description: 'Duplicate-proof rate limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '503',
        description: 'Duplicate-proof dependency unavailable',
        schema: 'error',
      },
      {
        status: '413',
        description: 'Duplicate-proof body is too large',
        schema: 'error',
      },
      {
        status: '415',
        description: 'Duplicate-proof media type is unsupported',
        schema: 'error',
      },
      {
        status: '504',
        description: 'Duplicate-proof operation timed out',
        schema: 'error',
      },
      {
        status: '500',
        description: 'Duplicate-proof operation failed safely',
        schema: 'error',
      },
    ],
  },
  authAccountMergeConfirm: {
    responses: [
      {
        status: '202',
        description: 'Account-merge job accepted',
        schema: 'success',
        headers: 'mutation',
      },
      {
        status: '400',
        description: 'Merge confirmation or headers are malformed',
        schema: 'error',
      },
      {
        status: '401',
        description:
          'Verified session or recent step-up verification is required',
        schema: 'stepUpUnauthorized',
      },
      {
        status: '403',
        description: 'Account is not eligible or CSRF verification failed',
        schema: 'error',
      },
      {
        status: '404',
        description: 'Merge case is absent or concealed',
        schema: 'error',
      },
      {
        status: '409',
        description: 'Merge state, acknowledgements, or idempotency conflicts',
        schema: 'error',
      },
      {
        status: '422',
        description: 'Confirmation fields are invalid',
        schema: 'error',
      },
      {
        status: '429',
        description: 'Account-merge confirmation rate limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '503',
        description: 'Account-merge dependency unavailable',
        schema: 'error',
      },
      {
        status: '413',
        description: 'Merge-confirm body is too large',
        schema: 'error',
      },
      {
        status: '415',
        description: 'Merge-confirm media type is unsupported',
        schema: 'error',
      },
      {
        status: '504',
        description: 'Merge-confirm operation timed out',
        schema: 'error',
      },
      {
        status: '500',
        description: 'Merge-confirm operation failed safely',
        schema: 'error',
      },
    ],
  },
  authMfaFactorsRead: {
    responses: [
      {
        status: '200',
        description: 'Current MFA factors and step-up state',
        schema: 'success',
        headers: 'entity',
      },
      {
        status: '401',
        description: 'Verified session is required',
        schema: 'error',
      },
      {
        status: '403',
        description: 'Account is not eligible',
        schema: 'error',
      },
      {
        status: '429',
        description: 'MFA factor read rate limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '503',
        description: 'MFA factor dependency unavailable',
        schema: 'error',
      },
      {
        status: '504',
        description: 'MFA factor read timed out',
        schema: 'error',
      },
      {
        status: '500',
        description: 'MFA factor read failed safely',
        schema: 'error',
      },
    ],
  },
  authMfaEnrollmentStart: {
    responses: authMfaResponses(
      '201',
      'TOTP enrollment started; secret shown once',
      authMfaCommandErrors('Enrollment', {
        stepUp: true,
        ...authMfaFactorErrors,
        notFound: 'Enrollment target is absent or concealed',
      }),
      'entity',
    ),
  },
  authMfaFactorVerify: {
    responses: authMfaResponses(
      '200',
      'MFA factor verified and session rotated to aal2',
      authMfaCommandErrors('Factor verification', authMfaFactorErrors),
      'entity',
    ),
  },
  authMfaFactorRemove: {
    responses: authMfaResponses(
      '200',
      'MFA factor removed',
      authMfaCommandErrors('Factor removal', {
        stepUp: true,
        ...authMfaFactorErrors,
      }),
      'entity',
    ),
  },
  authStepUpChallengeCreate: {
    responses: authMfaResponses(
      '201',
      'Step-up challenge created',
      authMfaCommandErrors('Challenge', authMfaFactorErrors),
    ),
  },
  authStepUpVerify: {
    responses: authMfaResponses(
      '200',
      'Step-up verified and session rotated to aal2',
      authMfaCommandErrors('Step-up verification', {
        ...authMfaFactorErrors,
        notFound: 'Challenge is absent or concealed',
        conflict: 'Challenge is expired or already consumed',
      }),
    ),
  },
  identityCreate: {
    responses: identityResponse(
      '201',
      'Person identity created',
      [
        { status: '400', description: 'Identity request is malformed' },
        { status: '401', description: 'Authentication is required' },
        { status: '409', description: 'Person identity already exists' },
        {
          status: '429',
          description: 'Identity-provisioning rate limit exceeded',
        },
        { status: '500', description: 'Identity creation failed safely' },
        { status: '503', description: 'Identity dependency unavailable' },
      ],
      { headers: 'mutation' },
    ),
  },
  identityReadSelf: {
    responses: identityResponse(
      '200',
      'Current person identity',
      [
        { status: '400', description: 'Identity read request is malformed' },
        { status: '401', description: 'Authentication is required' },
        {
          status: '404',
          description: 'Person identity is absent or concealed',
        },
        { status: '429', description: 'Identity read rate limit exceeded' },
        { status: '500', description: 'Identity read failed safely' },
        { status: '503', description: 'Identity dependency unavailable' },
      ],
      { conditional: true, headers: 'entity' },
    ),
  },
  identityFacetAdd: {
    responses: identityResponse(
      '201',
      'Identity facet added',
      [
        { status: '400', description: 'Facet request is malformed' },
        { status: '401', description: 'Authentication is required' },
        { status: '403', description: 'Facet authority is forbidden' },
        {
          status: '409',
          description: 'Facet already exists or version conflicts',
        },
        {
          status: '422',
          description: 'Facet request fails semantic validation',
        },
        { status: '429', description: 'Facet rate limit exceeded' },
        { status: '500', description: 'Facet addition failed safely' },
        { status: '503', description: 'Facet dependency unavailable' },
      ],
      { headers: 'mutation' },
    ),
  },
  identityFacetRemove: {
    responses: identityResponse(
      '200',
      'Identity facet removed',
      [
        { status: '400', description: 'Facet removal request is malformed' },
        { status: '401', description: 'Authentication is required' },
        { status: '403', description: 'Facet authority is forbidden' },
        { status: '404', description: 'Facet is absent or concealed' },
        {
          status: '409',
          description: 'Facet state, obligation, or version conflicts',
        },
        { status: '422', description: 'Facet path fails semantic validation' },
        { status: '429', description: 'Facet-removal rate limit exceeded' },
        { status: '500', description: 'Facet removal failed safely' },
        { status: '503', description: 'Facet dependency unavailable' },
      ],
      { headers: 'mutation' },
    ),
  },
  identityAliasCreate: {
    responses: identityResponse(
      '201',
      'Alias created',
      [
        { status: '400', description: 'Alias request is malformed' },
        { status: '401', description: 'Authentication is required' },
        { status: '403', description: 'Alias authority is forbidden' },
        { status: '409', description: 'Handle or alias quota conflicts' },
        { status: '422', description: 'Alias fields fail semantic validation' },
        { status: '429', description: 'Alias-create rate limit exceeded' },
        { status: '500', description: 'Alias creation failed safely' },
        { status: '503', description: 'Alias dependency unavailable' },
      ],
      { headers: 'mutation' },
    ),
  },
  identityAliasPatch: {
    responses: identityResponse(
      '200',
      'Alias updated',
      [
        { status: '400', description: 'Alias patch request is malformed' },
        { status: '401', description: 'Authentication is required' },
        { status: '403', description: 'Alias ownership is forbidden' },
        { status: '404', description: 'Alias is absent or concealed' },
        { status: '409', description: 'Alias version or state conflicts' },
        { status: '422', description: 'Alias patch fails semantic validation' },
        { status: '429', description: 'Alias-patch rate limit exceeded' },
        { status: '500', description: 'Alias patch failed safely' },
        { status: '503', description: 'Alias dependency unavailable' },
      ],
      { headers: 'mutation' },
    ),
  },
  identityHandleChange: {
    responses: identityResponse(
      '200',
      'Alias handle changed',
      [
        { status: '400', description: 'Handle-change request is malformed' },
        { status: '401', description: 'Authentication is required' },
        { status: '403', description: 'Alias ownership or state is forbidden' },
        { status: '404', description: 'Alias is absent or concealed' },
        { status: '409', description: 'Handle or alias version conflicts' },
        {
          status: '422',
          description: 'Handle candidate fails semantic validation',
        },
        { status: '429', description: 'Handle-change rate limit exceeded' },
        { status: '500', description: 'Handle change failed safely' },
        { status: '503', description: 'Handle-change dependency unavailable' },
      ],
      { headers: 'mutation' },
    ),
  },
  identityAliasRetire: {
    responses: identityResponse(
      '200',
      'Alias retired',
      [
        { status: '400', description: 'Alias-retirement request is malformed' },
        { status: '401', description: 'Authentication is required' },
        { status: '403', description: 'Alias retirement is forbidden' },
        { status: '404', description: 'Alias is absent or concealed' },
        { status: '409', description: 'Alias obligation or version conflicts' },
        {
          status: '422',
          description: 'Alias-retirement request fails validation',
        },
        { status: '429', description: 'Alias-retirement rate limit exceeded' },
        { status: '500', description: 'Alias retirement failed safely' },
        { status: '503', description: 'Alias dependency unavailable' },
      ],
      { headers: 'mutation' },
    ),
  },
  identityTransferOfferCreate: {
    responses: identityResponse(
      '201',
      'Alias transfer offer created',
      [
        { status: '400', description: 'Transfer-offer request is malformed' },
        { status: '401', description: 'Authentication is required' },
        { status: '403', description: 'Alias transfer is forbidden' },
        { status: '404', description: 'Alias is absent or concealed' },
        { status: '409', description: 'Transfer state or alias conflict' },
        { status: '422', description: 'Transfer recipient fails validation' },
        { status: '429', description: 'Transfer-offer rate limit exceeded' },
        { status: '500', description: 'Transfer-offer creation failed safely' },
        { status: '503', description: 'Transfer dependency unavailable' },
      ],
      { headers: 'mutation' },
    ),
  },
  identityTransferAccept: {
    responses: identityResponse(
      '200',
      'Alias transfer accepted',
      [
        {
          status: '400',
          description: 'Transfer acceptance request is malformed',
        },
        { status: '401', description: 'Authentication is required' },
        {
          status: '403',
          description: 'Transfer recipient authority is forbidden',
        },
        { status: '404', description: 'Transfer offer is absent or concealed' },
        {
          status: '409',
          description: 'Transfer expiry, state, or version conflicts',
        },
        { status: '422', description: 'Transfer acceptance fails validation' },
        { status: '429', description: 'Transfer-accept rate limit exceeded' },
        { status: '500', description: 'Transfer acceptance failed safely' },
        { status: '503', description: 'Transfer dependency unavailable' },
      ],
      { headers: 'mutation' },
    ),
  },
  identityTransferDecline: {
    responses: identityResponse(
      '200',
      'Alias transfer declined',
      [
        { status: '400', description: 'Transfer-decline request is malformed' },
        { status: '401', description: 'Authentication is required' },
        {
          status: '403',
          description: 'Transfer-decline authority is forbidden',
        },
        { status: '404', description: 'Transfer offer is absent or concealed' },
        {
          status: '409',
          description: 'Transfer expiry, state, or version conflicts',
        },
        { status: '422', description: 'Transfer decline fails validation' },
        { status: '429', description: 'Transfer-decline rate limit exceeded' },
        { status: '500', description: 'Transfer decline failed safely' },
        { status: '503', description: 'Transfer dependency unavailable' },
      ],
      { headers: 'mutation' },
    ),
  },
  identityContextsRead: {
    responses: identityResponse(
      '200',
      'Available acting contexts',
      [
        { status: '400', description: 'Acting-context query is malformed' },
        { status: '401', description: 'Authentication is required' },
        { status: '404', description: 'Person context is absent or concealed' },
        {
          status: '429',
          description: 'Acting-context read rate limit exceeded',
        },
        { status: '500', description: 'Acting-context read failed safely' },
        { status: '503', description: 'Acting-context dependency unavailable' },
      ],
      { conditional: true, headers: 'entity' },
    ),
  },
  identityContextBind: {
    responses: identityResponse(
      '201',
      'Acting context bound',
      [
        { status: '400', description: 'Acting-context binding is malformed' },
        { status: '401', description: 'Authentication is required' },
        { status: '403', description: 'Acting-context authority is forbidden' },
        { status: '404', description: 'Acting context is absent or concealed' },
        {
          status: '409',
          description: 'Acting-context state or binding conflict',
        },
        {
          status: '422',
          description: 'Acting-context binding fails validation',
        },
        {
          status: '429',
          description: 'Acting-context bind rate limit exceeded',
        },
        { status: '500', description: 'Acting-context binding failed safely' },
        { status: '503', description: 'Acting-context dependency unavailable' },
      ],
      { headers: 'mutation' },
    ),
  },
  identityLegalRead: {
    responses: identityResponse(
      '200',
      'Legal identity metadata',
      [
        {
          status: '400',
          description: 'Legal-identity read request is malformed',
        },
        { status: '401', description: 'Authentication or step-up is required' },
        { status: '403', description: 'Legal-identity authority is forbidden' },
        { status: '404', description: 'Legal identity is absent or concealed' },
        {
          status: '429',
          description: 'Legal-identity read rate limit exceeded',
        },
        { status: '500', description: 'Legal-identity read failed safely' },
        { status: '503', description: 'Legal-identity dependency unavailable' },
      ],
      { conditional: true, headers: 'entity' },
    ),
  },
  identityLegalUpsert: {
    responses: identityResponse(
      '200',
      'Legal identity metadata updated',
      [
        { status: '400', description: 'Legal-identity request is malformed' },
        { status: '401', description: 'Authentication or step-up is required' },
        { status: '403', description: 'Legal-identity authority is forbidden' },
        {
          status: '404',
          description: 'Person identity is absent or concealed',
        },
        {
          status: '409',
          description: 'Legal-identity version or period conflicts',
        },
        {
          status: '422',
          description: 'Protected references or dates fail validation',
        },
        {
          status: '429',
          description: 'Legal-identity write rate limit exceeded',
        },
        { status: '500', description: 'Legal-identity update failed safely' },
        { status: '503', description: 'Legal-identity dependency unavailable' },
      ],
      { headers: 'mutation' },
    ),
  },
  identityLegalDisclose: {
    responses: identityResponse(
      '201',
      'Legal-identity disclosure recorded',
      [
        { status: '400', description: 'Disclosure request is malformed' },
        { status: '401', description: 'Authentication or step-up is required' },
        { status: '403', description: 'Disclosure authority is forbidden' },
        {
          status: '404',
          description: 'Legal identity or transaction is absent or concealed',
        },
        {
          status: '409',
          description: 'Legal-identity version or idempotency conflicts',
        },
        {
          status: '422',
          description: 'Disclosure purpose or fields fail validation',
        },
        { status: '429', description: 'Legal disclosure rate limit exceeded' },
        { status: '500', description: 'Legal disclosure failed safely' },
        { status: '503', description: 'Disclosure dependency unavailable' },
      ],
      { headers: 'mutation' },
    ),
  },
  identityDisclosureRead: {
    responses: identityResponse(
      '200',
      'Legal-identity disclosure metadata',
      [
        { status: '400', description: 'Disclosure identifier is malformed' },
        { status: '401', description: 'Authentication or step-up is required' },
        { status: '403', description: 'Disclosure visibility is forbidden' },
        { status: '404', description: 'Disclosure is absent or concealed' },
        { status: '429', description: 'Disclosure read rate limit exceeded' },
        { status: '500', description: 'Disclosure read failed safely' },
        { status: '503', description: 'Disclosure dependency unavailable' },
      ],
      { conditional: true, headers: 'entity' },
    ),
  },
  identityPublicProjection: {
    responses: identityResponse(
      '200',
      'Publication-approved party projection',
      [
        { status: '400', description: 'Party identifier is malformed' },
        { status: '404', description: 'Public party projection is absent' },
        { status: '429', description: 'Public projection rate limit exceeded' },
        { status: '500', description: 'Public projection failed safely' },
        {
          status: '503',
          description: 'Public projection dependency unavailable',
        },
      ],
      { conditional: true, headers: 'entity' },
    ),
  },
  organizationCreate: {
    responses: identityResponse(
      '201',
      'Canonical organization created',
      relationshipMutationErrors,
      { headers: 'mutation' },
    ),
  },
  organizationRead: {
    responses: identityResponse(
      '200',
      'Publication-approved or authorized organization projection',
      relationshipReadErrors.filter(({ status }) => status !== '401'),
      { conditional: true, headers: 'entity' },
    ),
  },
  organizationTypeAdd: {
    responses: identityResponse(
      '201',
      'Organization type assignment created',
      relationshipMutationErrors,
      { headers: 'mutation' },
    ),
  },
  organizationTypeRemove: {
    responses: identityResponse(
      '200',
      'Organization type assignment ended',
      relationshipMutationErrors,
      { headers: 'mutation' },
    ),
  },
  membershipInvite: {
    responses: identityResponse(
      '201',
      'Membership invitation created',
      relationshipMutationErrors,
      { headers: 'mutation' },
    ),
  },
  membershipAssert: {
    responses: identityResponse(
      '201',
      'Historical membership asserted',
      relationshipMutationErrors,
      { headers: 'mutation' },
    ),
  },
  membershipAccept: {
    responses: identityResponse(
      '200',
      'Membership invitation accepted',
      relationshipMutationErrors,
      { headers: 'mutation' },
    ),
  },
  membershipEnd: {
    responses: identityResponse(
      '200',
      'Membership tenure ended',
      relationshipMutationErrors,
      { headers: 'mutation' },
    ),
  },
  membershipCapacityAdd: {
    responses: identityResponse(
      '201',
      'Membership capacity period created',
      relationshipMutationErrors,
      { headers: 'mutation' },
    ),
  },
  membershipsRead: {
    responses: identityResponse(
      '200',
      'Authorized organization membership collection',
      relationshipReadErrors,
      { headers: 'entity' },
    ),
  },
  profileMatchCreate: {
    responses: profileResponse(
      '200',
      'Advisory shadow-party match suggestions',
      profileMatchErrors,
    ),
  },
  profileInvitationCreate: {
    responses: profileResponse(
      '202',
      'Invitation dispatch accepted',
      profileMutationErrors,
      { successHeaders: 'mutation' },
    ),
  },
  profileRemedyCreate: {
    responses: profileResponse(
      '200',
      'Account-free remedy accepted',
      profileRemedyErrors,
    ),
  },
  profileClaimCreate: {
    responses: profileResponse(
      '201',
      'Party claim created',
      profileMutationErrors,
      { successHeaders: 'mutation' },
    ),
  },
  profileClaimRead: {
    responses: profileReadResponse('Authorized party claim', profileReadErrors),
  },
  profileChallengeCreate: {
    responses: profileResponse(
      '201',
      'Bounded proof challenge issued',
      profileChallengeErrors,
      { successHeaders: 'mutation' },
    ),
  },
  profileProofCreate: {
    responses: profileResponse(
      '200',
      'Party claim proof evaluated',
      profileChallengeErrors,
      { successHeaders: 'mutation' },
    ),
  },
  profileConversionCreate: {
    responses: profileResponse(
      '200',
      'Party claim converted to ownership',
      profileMutationErrors,
      { successHeaders: 'mutation' },
    ),
  },
  'CMS-03A-01': {
    responses: contentSchemaRegistryResponses(
      [201],
      'Content type draft created',
      contentSchemaRegistryHumanMutationErrors,
      'mutation',
    ),
  },
  'CMS-03A-02': {
    responses: contentSchemaRegistryResponses(
      [201],
      'Field definition version created',
      contentSchemaRegistryHumanMutationErrors,
      'mutation',
    ),
  },
  'CMS-03A-03': {
    responses: contentSchemaRegistryResponses(
      [201],
      'Relation definition created',
      contentSchemaRegistryHumanMutationErrors,
      'mutation',
    ),
  },
  'CMS-03A-04': {
    responses: contentSchemaRegistryResponses(
      [200, 202],
      'Schema activation accepted',
      contentSchemaRegistryStepUpMutationErrors,
      'mutation',
    ),
  },
  'CFG-05B-06': {
    responses: [
      ...['200', '202'].map((status) => ({
        status,
        description:
          status === '200'
            ? 'MFA factors reset and removed'
            : 'MFA factor removal is reconciling',
        schema: 'success',
      })),
      ...adminMfaFactorResetErrors.map((error) => ({
        schema: 'error',
        ...error,
        ...(error.status === '429' ? { headers: 'rate' } : {}),
      })),
    ],
  },
  'CFG-05B-07': {
    responses: identityResponse(
      '200',
      'Named admin capabilities of the verified session and acting party',
      [
        { status: '401', description: 'Verified session is required' },
        {
          status: '403',
          description: 'Acting context is not allowed or CSRF is forbidden',
        },
        {
          status: '429',
          description: 'Capability snapshot rate limit exceeded',
        },
        { status: '500', description: 'Capability snapshot failed safely' },
        { status: '503', description: 'Authorization context unavailable' },
        { status: '504', description: 'Authorization context timed out' },
      ],
    ),
  },
  'CMS-03A-05': {
    responses: contentSchemaRegistryResponses(
      [201],
      'Block definition registered',
      contentSchemaRegistryReleaseErrors,
      'mutation',
    ),
  },
  'CMS-03A-06': {
    responses: contentSchemaRegistryResponses(
      [200],
      'Authorized content schema registry page',
      contentSchemaRegistryListErrors,
      'entity',
    ),
  },
  'CMS-03A-07': {
    responses: contentSchemaRegistryResponses(
      [200],
      'Authorized content schema registry detail',
      contentSchemaRegistryDetailErrors,
      'entity',
    ),
  },
  'CMS-03A-08': {
    responses: contentSchemaRegistryResponses(
      [201],
      'Block lifecycle event appended',
      contentSchemaRegistryReleaseErrors,
      'mutation',
    ),
  },
  'CMS-03A-09': {
    responses: contentSchemaRegistryResponses(
      [201],
      'Successor schema draft created',
      contentSchemaRegistryHumanMutationErrors,
      'mutation',
    ),
  },
  'CMS-03A-10': {
    responses: contentSchemaRegistryResponses(
      [202],
      'Schema dry run accepted',
      contentSchemaRegistryHumanMutationErrors,
      'mutation',
    ),
  },
  'CMS-03A-11': {
    responses: contentSchemaRegistryResponses(
      [201],
      'Schema review submitted',
      contentSchemaRegistryHumanMutationErrors,
      'mutation',
    ),
  },
  'CMS-03A-12': {
    responses: contentSchemaRegistryResponses(
      [201],
      'Schema review decision recorded',
      contentSchemaRegistryStepUpMutationErrors,
      'mutation',
    ),
  },
  'CMS-03A-13': {
    responses: contentSchemaRegistryResponses(
      [200],
      'Capability-safe schema review',
      contentSchemaRegistryReviewDetailErrors,
      'entity',
    ),
  },
  'CMS-03A-14': {
    responses: contentSchemaRegistryResponses(
      [200, 201],
      'Schema review assignment revoked or created',
      contentSchemaRegistryStepUpMutationErrors,
      'mutation',
    ),
  },
  'CMS-03A-15': {
    responses: contentSchemaRegistryResponses(
      [201],
      'CMS capability grant created',
      contentSchemaRegistryStepUpMutationErrors,
      'mutation',
    ),
  },
  'CMS-03A-16': {
    responses: contentSchemaRegistryResponses(
      [200],
      'CMS capability grant renewed',
      contentSchemaRegistryStepUpMutationErrors,
      'mutation',
    ),
  },
  'CMS-03A-17': {
    responses: contentSchemaRegistryResponses(
      [200],
      'CMS capability grant revoked',
      contentSchemaRegistryStepUpMutationErrors,
      'mutation',
    ),
  },
  'CMS-03A-18': {
    responses: contentSchemaRegistryResponses(
      [200],
      'Owner CMS capability grant page',
      contentSchemaRegistryGrantListErrors,
      'entity',
    ),
  },
  'CMS-03B-01': {
    responses: contentSchemaRegistryResponses(
      [201],
      'Immutable entry revision created',
      [
        { status: 400, description: 'Revision request is malformed' },
        { status: 401, description: 'Authentication is required' },
        {
          status: 403,
          description: 'Revision assignment or edit capability is forbidden',
        },
        { status: 404, description: 'Entry is absent or concealed' },
        {
          status: 409,
          description: 'Stale base, conflict, or idempotency mismatch',
        },
        { status: 415, description: 'Request media type is unsupported' },
        { status: 422, description: 'Revision fields fail validation' },
        { status: 429, description: 'Author-write rate limit exceeded' },
        { status: 500, description: 'Revision write failed safely' },
        {
          status: 502,
          description: 'Editorial dependency returned invalid data',
        },
        { status: 503, description: 'Editorial dependency unavailable' },
        { status: 504, description: 'Editorial dependency timed out' },
      ],
      'mutation',
    ),
  },
  'CMS-03B-02': {
    responses: contentSchemaRegistryResponses(
      [201],
      'Two-parent conflict-resolution revision created',
      [
        { status: 400, description: 'Conflict request is malformed' },
        { status: 401, description: 'Authentication is required' },
        {
          status: 403,
          description: 'Conflict resolve capability is forbidden',
        },
        {
          status: 404,
          description: 'Entry or conflict is absent or concealed',
        },
        {
          status: 409,
          description: 'Moved base, invalid choice, or idempotency conflict',
        },
        { status: 415, description: 'Request media type is unsupported' },
        { status: 422, description: 'Conflict choice or value fails schema' },
        { status: 429, description: 'Conflict-write rate limit exceeded' },
        { status: 500, description: 'Conflict resolution failed safely' },
        {
          status: 502,
          description: 'Editorial dependency returned invalid data',
        },
        { status: 503, description: 'Editorial dependency unavailable' },
        { status: 504, description: 'Editorial dependency timed out' },
      ],
      'mutation',
    ),
  },
  'CMS-03B-03': {
    responses: contentSchemaRegistryResponses(
      [200],
      'Authorized revision history page',
      [
        {
          status: 400,
          description: 'History path, query, or cursor is malformed',
        },
        { status: 401, description: 'Authentication is required' },
        { status: 403, description: 'History read scope is forbidden' },
        {
          status: 404,
          description: 'Entry or revision is absent or concealed',
        },
        { status: 409, description: 'Cursor or context mismatch' },
        { status: 415, description: 'Request media type is unsupported' },
        { status: 422, description: 'History query bounds fail validation' },
        { status: 429, description: 'Read rate limit exceeded' },
        { status: 500, description: 'History read failed safely' },
        {
          status: 502,
          description: 'History dependency returned invalid data',
        },
        { status: 503, description: 'History dependency unavailable' },
        { status: 504, description: 'History dependency timed out' },
      ],
      'entity',
    ),
  },
  'CMS-03B-04': {
    responses: contentSchemaRegistryResponses(
      [201],
      'New draft revision restored from a readable source revision',
      [
        { status: 400, description: 'Restore request is malformed' },
        { status: 401, description: 'Authentication is required' },
        { status: 403, description: 'Restore edit capability is forbidden' },
        {
          status: 404,
          description: 'Entry or source revision is absent or concealed',
        },
        {
          status: 409,
          description:
            'Stale version, migration mismatch, or idempotency conflict',
        },
        { status: 415, description: 'Request media type is unsupported' },
        { status: 422, description: 'Restore fields fail validation' },
        { status: 429, description: 'Restore rate limit exceeded' },
        { status: 500, description: 'Restore failed safely' },
        {
          status: 502,
          description: 'Migration dependency returned invalid data',
        },
        { status: 503, description: 'Migration dependency unavailable' },
        { status: 504, description: 'Migration dependency timed out' },
      ],
      'mutation',
    ),
  },
  'CMS-03B-10': {
    responses: contentSchemaRegistryResponses(
      [201],
      'Entry and initial draft revision created',
      [
        { status: 400, description: 'Entry create request is malformed' },
        { status: 401, description: 'Authentication is required' },
        { status: 403, description: 'Entry create capability is forbidden' },
        { status: 404, description: 'Content schema is absent or concealed' },
        { status: 409, description: 'Entry create or idempotency conflicts' },
        { status: 415, description: 'Request media type is unsupported' },
        { status: 422, description: 'Entry create fields fail validation' },
        { status: 429, description: 'Entry create rate limit exceeded' },
        { status: 500, description: 'Entry create failed safely' },
        {
          status: 502,
          description: 'Editorial dependency returned invalid data',
        },
        { status: 503, description: 'Editorial dependency unavailable' },
        { status: 504, description: 'Editorial dependency timed out' },
      ],
      'mutation',
    ),
  },
  'CMS-03B-11': {
    responses: contentSchemaRegistryResponses(
      [200],
      'Authorized current draft detail',
      [
        { status: 400, description: 'Draft-detail request is malformed' },
        { status: 401, description: 'Authentication is required' },
        {
          status: 403,
          description: 'Draft-detail read capability is forbidden',
        },
        { status: 404, description: 'Entry is absent or concealed' },
        { status: 415, description: 'Request media type is unsupported' },
        { status: 422, description: 'Draft-detail fields fail validation' },
        { status: 429, description: 'Draft-detail rate limit exceeded' },
        { status: 500, description: 'Draft-detail read failed safely' },
        {
          status: 502,
          description: 'Editorial dependency returned invalid data',
        },
        { status: 503, description: 'Editorial dependency unavailable' },
        { status: 504, description: 'Editorial dependency timed out' },
      ],
      'entity',
    ),
  },
  'CMS-03B-12': {
    responses: contentSchemaRegistryResponses(
      [200],
      'Authorized open conflict detail',
      [
        { status: 400, description: 'Conflict-detail request is malformed' },
        { status: 401, description: 'Authentication is required' },
        {
          status: 403,
          description: 'Conflict-detail read capability is forbidden',
        },
        {
          status: 404,
          description: 'Entry or conflict is absent or concealed',
        },
        { status: 415, description: 'Request media type is unsupported' },
        { status: 422, description: 'Conflict-detail fields fail validation' },
        { status: 429, description: 'Conflict-detail rate limit exceeded' },
        { status: 500, description: 'Conflict-detail read failed safely' },
        {
          status: 502,
          description: 'Editorial dependency returned invalid data',
        },
        { status: 503, description: 'Editorial dependency unavailable' },
        { status: 504, description: 'Editorial dependency timed out' },
      ],
      'entity',
    ),
  },
  'CMS-03B-13': {
    responses: contentSchemaRegistryResponses(
      [200],
      'Authorized entry list page',
      [
        { status: 400, description: 'Entry-list request is malformed' },
        { status: 401, description: 'Authentication is required' },
        { status: 403, description: 'Entry-list read capability is forbidden' },
        { status: 404, description: 'Entry scope is absent or concealed' },
        { status: 415, description: 'Request media type is unsupported' },
        { status: 422, description: 'Entry-list query bounds fail validation' },
        { status: 429, description: 'Entry-list rate limit exceeded' },
        { status: 500, description: 'Entry-list read failed safely' },
        {
          status: 502,
          description: 'Editorial dependency returned invalid data',
        },
        { status: 503, description: 'Editorial dependency unavailable' },
        { status: 504, description: 'Editorial dependency timed out' },
      ],
      'entity',
    ),
  },
  'CMS-03B-14': {
    responses: contentSchemaRegistryResponses(
      [200],
      'Authorized authoring context',
      [
        { status: 400, description: 'Authoring-context request is malformed' },
        { status: 401, description: 'Authentication is required' },
        {
          status: 403,
          description: 'Authoring-context capability is forbidden',
        },
        {
          status: 404,
          description: 'Content type version is absent or concealed',
        },
        { status: 415, description: 'Request media type is unsupported' },
        {
          status: 422,
          description: 'Authoring-context selector fails validation',
        },
        { status: 429, description: 'Authoring-context rate limit exceeded' },
        { status: 500, description: 'Authoring-context read failed safely' },
        {
          status: 502,
          description: 'Authoring dependency returned invalid data',
        },
        { status: 503, description: 'Authoring dependency unavailable' },
        { status: 504, description: 'Authoring dependency timed out' },
      ],
      'entity',
    ),
  },
  'CMS-03B-05': {
    responses: contentSchemaRegistryResponses(
      [201],
      'Editorial review submitted with its frozen candidate',
      [
        { status: 400, description: 'Review submission is malformed' },
        { status: 401, description: 'Authentication is required' },
        {
          status: 403,
          description: 'Submit capability or assignment is forbidden',
        },
        {
          status: 404,
          description: 'Entry or revision is absent or concealed',
        },
        {
          status: 409,
          description:
            'Revision not submittable, dependency changed, or idempotency conflict',
        },
        { status: 415, description: 'Request media type is unsupported' },
        {
          status: 422,
          description: 'Frozen hash, manifest or preflight validation failed',
        },
        { status: 429, description: 'Review-write rate limit exceeded' },
        { status: 500, description: 'Review submission failed safely' },
        {
          status: 502,
          description: 'Editorial dependency returned invalid data',
        },
        {
          status: 503,
          description: 'Editorial or preflight dependency unavailable',
          retryable: true,
        },
        { status: 504, description: 'Editorial dependency timed out' },
      ],
      'mutation',
    ),
  },
  'CMS-03B-06': {
    responses: contentSchemaRegistryResponses(
      [200],
      'Editorial review decision recorded',
      editorialStepUpErrors('Review decision', 'Decision rate limit exceeded'),
      'entity',
    ),
  },
  'CMS-03B-07': {
    responses: contentSchemaRegistryResponses(
      [202],
      'Publication scheduled; not yet published',
      editorialStepUpErrors(
        'Publication schedule',
        'Schedule rate limit exceeded',
      ),
      'mutation',
    ),
  },
  'CMS-03B-08': {
    responses: contentSchemaRegistryResponses(
      [201],
      'Preview token minted; the plaintext appears only in this response',
      [
        { status: 400, description: 'Preview request is malformed' },
        { status: 401, description: 'Authentication is required' },
        { status: 403, description: 'Preview scope is forbidden' },
        {
          status: 404,
          description: 'Entry or revision is absent or concealed',
        },
        {
          status: 409,
          description:
            'Stale entry or version set, expired replay, or idempotency conflict',
        },
        { status: 415, description: 'Request media type is unsupported' },
        {
          status: 422,
          description:
            'Preview route, audience or version set fails validation',
        },
        { status: 429, description: 'Preview rate limit exceeded' },
        { status: 500, description: 'Preview mint failed safely' },
        {
          status: 502,
          description: 'Editorial dependency returned invalid data',
        },
        {
          status: 503,
          description: 'Editorial dependency unavailable',
          retryable: true,
        },
        { status: 504, description: 'Editorial dependency timed out' },
      ],
      'unversioned',
    ),
  },
  'CMS-03B-09': {
    responses: contentSchemaRegistryResponses(
      [202],
      'Publication lineage row committed; projection pending',
      editorialStepUpErrors('Publication', 'Publish rate limit exceeded'),
      'mutation',
    ),
  },
  'CMS-03B-15': {
    responses: contentSchemaRegistryResponses(
      [200],
      'Workflow and submission preparation of an entry revision',
      editorialBoundedReadErrors('Workflow'),
      'entity',
    ),
  },
  'CMS-03B-16': {
    responses: contentSchemaRegistryResponses(
      [200],
      'Review detail with safe decision metadata',
      editorialBoundedReadErrors('Review detail'),
      'entity',
    ),
  },
  'CMS-03B-17': {
    responses: contentSchemaRegistryResponses(
      [200],
      'Reviewer queue page',
      [
        { status: 400, description: 'Queue query or cursor is malformed' },
        { status: 401, description: 'Authentication is required' },
        {
          status: 409,
          description:
            'Cursor is expired, tampered or bound to another context',
        },
        { status: 415, description: 'Request media type is unsupported' },
        { status: 422, description: 'Queue query bounds fail validation' },
        { status: 429, description: 'Read rate limit exceeded' },
        { status: 500, description: 'Queue read failed safely' },
        {
          status: 502,
          description: 'Queue dependency returned invalid data',
        },
        {
          status: 503,
          description: 'Queue dependency unavailable',
          retryable: true,
        },
        { status: 504, description: 'Queue dependency timed out' },
      ],
      'entity',
    ),
  },
  'CMS-03B-18': {
    responses: [
      ...contentSchemaRegistryResponses(
        [201],
        'Reviewer assignment created',
        editorialStepUpErrors(
          'Reviewer assignment',
          'Assignment rate limit exceeded',
        ),
        'mutation',
      ),
      {
        status: '200',
        description: 'Reviewer assignment revoked',
        schema: 'success',
        headers: 'entity',
      },
    ],
  },
  'CMS-03C-01': {
    responses: contentSchemaRegistryResponses(
      [201],
      'Template version created',
      contentSchemaRegistryHumanMutationErrors,
      'mutation',
    ),
  },
  cmsTemplateContextRead: {
    responses: contentSchemaRegistryResponses(
      [200],
      'Protected template designer selector context',
      [
        { status: 400, description: 'Context request is malformed' },
        { status: 401, description: 'Authentication is required' },
        {
          status: 403,
          description: 'Template designer capability is forbidden',
        },
        { status: 429, description: 'Context read rate limit exceeded' },
        { status: 500, description: 'Context read failed safely' },
        {
          status: 502,
          description: 'Context projection returned invalid data',
        },
        { status: 503, description: 'Context dependency unavailable' },
        { status: 504, description: 'Context dependency timed out' },
      ],
    ),
  },
  cmsTemplateLatestRead: {
    responses: contentSchemaRegistryResponses(
      [200],
      'Current authorized editable template definition',
      [
        { status: 400, description: 'Template key or query is invalid' },
        { status: 401, description: 'Authentication is required' },
        {
          status: 403,
          description: 'Template designer capability is forbidden',
        },
        { status: 404, description: 'Template is absent or not visible' },
        { status: 429, description: 'Template read rate limit exceeded' },
        { status: 500, description: 'Template read failed safely' },
        { status: 502, description: 'Template detail returned invalid data' },
        { status: 503, description: 'Template dependency unavailable' },
        { status: 504, description: 'Template dependency timed out' },
      ],
      'entity',
    ),
  },
  'CMS-03C-04': {
    responses: contentSchemaRegistryResponses(
      [201],
      'Locale variant revision created',
      [
        { status: 400, description: 'Locale variant request is malformed' },
        { status: 401, description: 'Authentication is required' },
        {
          status: 403,
          description: 'Locale authoring capability is forbidden',
        },
        {
          status: 404,
          description: 'Entry or source revision is absent or concealed',
        },
        {
          status: 409,
          description:
            'Source, version, or idempotency conflicts; LOCALE_VERSION_CONFLICT with reasonCode FALLBACK_CHAIN_MISMATCH and details.activeFallbackChain when fallbackChain differs from the active content type version chain',
        },
        { status: 415, description: 'Request media type is unsupported' },
        {
          status: 422,
          description:
            'Locale fields fail validation, or locale is not in the active content type version supportedLocales',
        },
        { status: 429, description: 'Locale authoring rate limit exceeded' },
        { status: 500, description: 'Locale authoring failed safely' },
        {
          status: 502,
          description: 'Editorial dependency returned invalid data',
        },
        { status: 503, description: 'Editorial dependency unavailable' },
        { status: 504, description: 'Editorial dependency timed out' },
      ],
      'mutation',
    ),
  },
  'CMS-03C-02': {
    responses: contentSchemaRegistryResponses(
      [201],
      'Immutable pattern instance created on an authorized draft',
      [
        { status: 400, description: 'Composition request is malformed' },
        { status: 401, description: 'Authentication is required' },
        { status: 403, description: 'Draft edit capability is forbidden' },
        {
          status: 404,
          description: 'Revision or pattern is absent or concealed',
        },
        {
          status: 409,
          description: 'Revision, slot, graph, or idempotency conflict',
        },
        { status: 415, description: 'Request media type is unsupported' },
        {
          status: 422,
          description: 'Pattern graph or overrides fail validation',
        },
        { status: 429, description: 'Composition write rate limit exceeded' },
        { status: 500, description: 'Composition mutation failed safely' },
        {
          status: 502,
          description: 'Editorial dependency returned invalid data',
        },
        { status: 503, description: 'Editorial dependency unavailable' },
        { status: 504, description: 'Editorial dependency timed out' },
      ],
      'mutation',
    ),
  },
  'CMS-03C-03': {
    responses: contentSchemaRegistryResponses(
      [200],
      'Taxonomy term action applied to the authorized vocabulary',
      [
        { status: 400, description: 'Taxonomy term request is malformed' },
        { status: 401, description: 'Authentication is required' },
        {
          status: 403,
          description: 'Taxonomy curator capability is forbidden',
        },
        { status: 404, description: 'Taxonomy or term is absent or concealed' },
        {
          status: 409,
          description: 'Term version, survivor, or idempotency conflicts',
        },
        { status: 415, description: 'Request media type is unsupported' },
        { status: 422, description: 'Taxonomy term fields fail validation' },
        { status: 429, description: 'Taxonomy write rate limit exceeded' },
        { status: 500, description: 'Taxonomy mutation failed safely' },
        {
          status: 502,
          description: 'Taxonomy dependency returned invalid data',
        },
        { status: 503, description: 'Taxonomy dependency unavailable' },
        { status: 504, description: 'Taxonomy dependency timed out' },
      ],
      'mutation',
    ),
  },
  'CMS-03C-05': {
    responses: contentSchemaRegistryResponses(
      [201],
      'Related content rule revision created',
      [
        { status: 400, description: 'Related content request is malformed' },
        { status: 401, description: 'Authentication is required' },
        {
          status: 403,
          description: 'Related content capability is forbidden',
        },
        {
          status: 404,
          description: 'Source entry is absent or concealed',
        },
        {
          status: 409,
          description: 'Source, version, or idempotency conflicts',
        },
        { status: 415, description: 'Request media type is unsupported' },
        {
          status: 422,
          description: 'Pins, exclusions, or rule fail validation',
        },
        {
          status: 429,
          description: 'Related content rate limit exceeded',
        },
        { status: 500, description: 'Related content failed safely' },
        {
          status: 502,
          description: 'Editorial dependency returned invalid data',
        },
        { status: 503, description: 'Editorial dependency unavailable' },
        { status: 504, description: 'Editorial dependency timed out' },
      ],
      'mutation',
    ),
  },
  healthRead: {
    responses: [
      { status: '200', description: 'Process is healthy', schema: 'success' },
    ],
  },
  readinessRead: {
    responses: [
      { status: '200', description: 'Service is ready', schema: 'success' },
      {
        status: '503',
        description: 'Service is not ready',
        schema: 'success',
      },
    ],
  },
  diagnosticsRead: {
    responses: [
      {
        status: '200',
        description: 'Authorized diagnostic summary',
        schema: 'success',
      },
      {
        status: '400',
        description: 'A bounded diagnostic reason is required',
        schema: 'error',
      },
      {
        status: '401',
        description: 'Authentication or step-up required',
        schema: 'error',
      },
      {
        status: '403',
        description: 'Named capability required',
        schema: 'error',
      },
      {
        status: '503',
        description: 'Diagnostic composition unavailable',
        schema: 'error',
      },
    ],
  },
  jobStatusRead: {
    responses: [
      {
        status: '200',
        description: 'Authorized current job status',
        schema: 'success',
        headers: 'entity',
      },
      {
        status: '304',
        description: 'Authorized status has not changed',
        headers: 'entity',
      },
      {
        status: '400',
        description: 'Job identifier is invalid',
        schema: 'error',
      },
      {
        status: '401',
        description: 'Authentication is required',
        schema: 'error',
      },
      {
        status: '404',
        description: 'Job is absent or not visible',
        schema: 'error',
      },
      {
        status: '429',
        description: 'Job read rate limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '500',
        description: 'Job status composition failed',
        schema: 'error',
      },
      {
        status: '503',
        description: 'Job status dependency unavailable',
        schema: 'error',
      },
    ],
  },
  uploadIntentCreate: {
    responses: [
      {
        status: '201',
        description: 'Authorized upload intent created',
        schema: 'success',
        headers: 'mutation',
      },
      {
        status: '400',
        description: 'Upload-admission request is malformed',
        schema: 'error',
      },
      {
        status: '401',
        description: 'Authentication is required',
        schema: 'error',
      },
      {
        status: '403',
        description: 'Visible upload target is forbidden',
        schema: 'error',
      },
      {
        status: '404',
        description: 'Upload target is absent or concealed',
        schema: 'error',
      },
      {
        status: '409',
        description: 'Version or idempotency binding conflicts',
        schema: 'error',
      },
      {
        status: '413',
        description: 'Declared upload exceeds the route or target limit',
        schema: 'error',
      },
      {
        status: '415',
        description: 'Request media type is unsupported',
        schema: 'error',
      },
      {
        status: '422',
        description: 'Upload-admission fields fail semantic validation',
        schema: 'error',
      },
      {
        status: '429',
        description: 'Upload-admission rate or concurrency limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '500',
        description: 'Upload-admission composition failed',
        schema: 'error',
      },
      {
        status: '503',
        description: 'Upload-admission dependency unavailable',
        schema: 'error',
      },
    ],
  },
  uploadIntentComplete: {
    responses: [
      {
        status: '202',
        description: 'Upload accepted for asynchronous verification',
        schema: 'success',
        headers: 'mutation',
      },
      {
        status: '400',
        description: 'Upload-completion request is malformed',
        schema: 'error',
      },
      {
        status: '401',
        description: 'Authentication is required',
        schema: 'error',
      },
      {
        status: '403',
        description: 'Live upload intent or target is forbidden',
        schema: 'error',
      },
      {
        status: '404',
        description: 'Upload intent is absent or concealed',
        schema: 'error',
      },
      {
        status: '409',
        description: 'Version or idempotency binding conflicts',
        schema: 'error',
      },
      {
        status: '415',
        description: 'Request media type is unsupported',
        schema: 'error',
      },
      {
        status: '422',
        description: 'Completion evidence fails semantic validation',
        schema: 'error',
      },
      {
        status: '429',
        description: 'Completion rate or concurrency limit exceeded',
        schema: 'error',
        headers: 'rate',
      },
      {
        status: '500',
        description: 'Upload-completion composition failed',
        schema: 'error',
      },
      {
        status: '503',
        description: 'Upload-completion dependency unavailable',
        schema: 'error',
      },
    ],
  },
};

const integerHeader = (description) => ({
  description,
  schema: { type: 'integer', minimum: 0 },
});

const rateHeaders = {
  'RateLimit-Limit': integerHeader('Maximum reads permitted in the window.'),
  'RateLimit-Remaining': integerHeader('Reads remaining in the window.'),
  'RateLimit-Reset': integerHeader('UTC epoch second when the window resets.'),
};

export const entityHeaders = {
  ETag: {
    description: 'Strong validator for the authorized job representation.',
    schema: { type: 'string' },
  },
  ...rateHeaders,
};

export const mutationHeaders = {
  ETag: {
    description: 'Strong validator for the canonical affected object.',
    schema: { type: 'string' },
  },
  Location: {
    description: 'Canonical URL of the created or accepted resource.',
    schema: { type: 'string', format: 'uri-reference' },
  },
  ...rateHeaders,
};

/** A derived token response has no validator and no Location, only the rate headers. */
export const unversionedHeaders = {
  ...rateHeaders,
};

export const retryHeaders = {
  ...rateHeaders,
  'Retry-After': integerHeader('Seconds until another read may be attempted.'),
};
