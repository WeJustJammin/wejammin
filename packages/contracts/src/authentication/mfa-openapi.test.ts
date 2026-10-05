import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../../../infra/openapi-document.mjs';
import { platformRegistrySet } from '../platform-registries.ts';

type Parameter = { name: string; in: string; required: boolean };
type Operation = {
  operationId: string;
  parameters?: Parameter[];
  requestBody?: unknown;
  responses: Record<
    string,
    { content?: { 'application/json': { schema: unknown } }; headers?: object }
  >;
  'x-auth-class': string;
  'x-rate-class': string;
  'x-timeout-ms': number;
  'x-step-up': string;
  'x-request-schema': string;
  'x-success-schema': string;
};
type Document = {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, unknown> };
};

const document = buildOpenApiDocument() as unknown as Document;

const operation = (path: string, method: string): Operation => {
  const found = document.paths[path]?.[method];
  if (found === undefined) throw new Error(`missing ${method} ${path}`);
  return found;
};

const names = (operationValue: Operation): string[] =>
  (operationValue.parameters ?? []).map(({ name }) => name);

const stepUpUnion = {
  oneOf: [
    { $ref: '#/components/schemas/CmsUnauthenticatedError' },
    { $ref: '#/components/schemas/CmsStepUpRequiredError' },
  ],
};

const unauthorized = (operationValue: Operation): unknown =>
  operationValue.responses['401']?.content?.['application/json'].schema;

const statuses = (operationValue: Operation): string[] =>
  Object.keys(operationValue.responses).sort();

const commandStatuses = (success: string, extra: string[] = []): string[] =>
  [
    success,
    '400',
    '401',
    '403',
    '404',
    '409',
    '413',
    '415',
    '422',
    '429',
    '500',
    '502',
    '503',
    '504',
    ...extra,
  ].sort();

describe('AUTH-API-16..21 published OpenAPI operations', () => {
  it('registers the six operations with their canonical ids and paths', () => {
    const published = Object.entries(document.paths)
      .flatMap(([path, methods]) =>
        Object.entries(methods).map(
          ([method, value]) => [value.operationId, method, path] as const,
        ),
      )
      .filter(([operationId]) =>
        [
          'authMfaFactorsRead',
          'authMfaEnrollmentStart',
          'authMfaFactorVerify',
          'authMfaFactorRemove',
          'authStepUpChallengeCreate',
          'authStepUpVerify',
        ].includes(operationId ?? ''),
      );
    expect(published).toEqual([
      ['authMfaFactorsRead', 'get', '/api/v1/account/mfa/factors'],
      ['authMfaEnrollmentStart', 'post', '/api/v1/account/mfa/factors'],
      [
        'authMfaFactorVerify',
        'post',
        '/api/v1/account/mfa/factors/{factorId}/verify',
      ],
      [
        'authMfaFactorRemove',
        'delete',
        '/api/v1/account/mfa/factors/{factorId}',
      ],
      ['authStepUpChallengeCreate', 'post', '/api/v1/auth/step-up/challenges'],
      [
        'authStepUpVerify',
        'post',
        '/api/v1/auth/step-up/challenges/{challengeId}/verify',
      ],
    ]);
  });

  it('documents path parameters and the exact precondition headers', () => {
    expect(names(operation('/api/v1/account/mfa/factors', 'get'))).toEqual([]);
    expect(names(operation('/api/v1/account/mfa/factors', 'post'))).toEqual([
      'If-Match',
      'X-CSRF-Token',
    ]);
    expect(
      names(operation('/api/v1/account/mfa/factors/{factorId}/verify', 'post')),
    ).toEqual(['factorId', 'If-Match', 'X-CSRF-Token']);
    expect(
      names(operation('/api/v1/account/mfa/factors/{factorId}', 'delete')),
    ).toEqual(['factorId', 'Idempotency-Key', 'If-Match', 'X-CSRF-Token']);
    expect(names(operation('/api/v1/auth/step-up/challenges', 'post'))).toEqual(
      ['X-CSRF-Token'],
    );
    expect(
      names(
        operation(
          '/api/v1/auth/step-up/challenges/{challengeId}/verify',
          'post',
        ),
      ),
    ).toEqual(['challengeId', 'X-CSRF-Token']);
    for (const parameter of operation('/api/v1/account/mfa/factors', 'post')
      .parameters ?? [])
      expect(parameter.required).toBe(true);
  });

  it('publishes the unauthenticated/step-up 401 union on 17 and 19 only', () => {
    expect(
      unauthorized(operation('/api/v1/account/mfa/factors', 'post')),
    ).toEqual(stepUpUnion);
    expect(
      unauthorized(
        operation('/api/v1/account/mfa/factors/{factorId}', 'delete'),
      ),
    ).toEqual(stepUpUnion);
    for (const [path, method] of [
      ['/api/v1/account/mfa/factors', 'get'],
      ['/api/v1/account/mfa/factors/{factorId}/verify', 'post'],
      ['/api/v1/auth/step-up/challenges', 'post'],
      ['/api/v1/auth/step-up/challenges/{challengeId}/verify', 'post'],
    ] as const)
      expect(unauthorized(operation(path, method)), path).toEqual({
        $ref: '#/components/schemas/ApiError',
      });
  });

  it('declares the status set of each BE01a registry row', () => {
    expect(statuses(operation('/api/v1/account/mfa/factors', 'get'))).toEqual(
      ['200', '401', '403', '429', '500', '503', '504'].sort(),
    );
    expect(statuses(operation('/api/v1/account/mfa/factors', 'post'))).toEqual(
      commandStatuses('201'),
    );
    expect(
      statuses(
        operation('/api/v1/account/mfa/factors/{factorId}/verify', 'post'),
      ),
    ).toEqual(commandStatuses('200'));
    expect(
      statuses(operation('/api/v1/account/mfa/factors/{factorId}', 'delete')),
    ).toEqual(commandStatuses('200'));
    expect(
      statuses(operation('/api/v1/auth/step-up/challenges', 'post')),
    ).toEqual(commandStatuses('201'));
    expect(
      statuses(
        operation(
          '/api/v1/auth/step-up/challenges/{challengeId}/verify',
          'post',
        ),
      ),
    ).toEqual(commandStatuses('200'));
  });

  it('links each operation to its request and success components', () => {
    const expected = [
      [
        '/api/v1/account/mfa/factors',
        'get',
        'EmptyRequestSchema',
        'MfaFactorsResourceSchema',
      ],
      [
        '/api/v1/account/mfa/factors',
        'post',
        'TotpEnrollmentStartApiRequestSchema',
        'TotpEnrollmentStartSchema',
      ],
      [
        '/api/v1/account/mfa/factors/{factorId}/verify',
        'post',
        'MfaFactorVerifyApiRequestSchema',
        'MfaFactorsResourceSchema',
      ],
      [
        '/api/v1/account/mfa/factors/{factorId}',
        'delete',
        'MfaFactorRemoveApiRequestSchema',
        'MfaFactorsResourceSchema',
      ],
      [
        '/api/v1/auth/step-up/challenges',
        'post',
        'StepUpChallengeApiRequestSchema',
        'StepUpChallengeSchema',
      ],
      [
        '/api/v1/auth/step-up/challenges/{challengeId}/verify',
        'post',
        'StepUpVerifyApiRequestSchema',
        'StepUpResultSchema',
      ],
    ] as const;
    for (const [path, method, request, success] of expected) {
      const published = operation(path, method);
      expect(published['x-request-schema'], path).toBe(request);
      expect(published['x-success-schema'], path).toBe(success);
    }
    for (const component of [
      'MfaFactorsResource',
      'TotpEnrollmentStart',
      'StepUpChallenge',
      'StepUpResult',
      'TotpEnrollmentStartApiRequest',
      'MfaFactorVerifyApiRequest',
      'MfaFactorRemoveApiRequest',
      'StepUpChallengeApiRequest',
      'StepUpVerifyApiRequest',
    ])
      expect(document.components.schemas).toHaveProperty(component);
  });

  it('mirrors the registry auth classes, rate classes, and deadlines', () => {
    const rows = platformRegistrySet.routes.filter(({ operationId }) =>
      /^auth(?:Mfa|StepUp)/u.test(operationId),
    );
    expect(
      rows.map(({ operationId, authClass, timeoutMs, sloTier }) => [
        operationId,
        authClass,
        timeoutMs,
        sloTier,
      ]),
    ).toEqual([
      ['authMfaFactorsRead', 'authenticated', 8_000, 'tier_1'],
      [
        'authMfaEnrollmentStart',
        'authenticated_step_up_conditional',
        15_000,
        'tier_2',
      ],
      ['authMfaFactorVerify', 'authenticated', 15_000, 'tier_2'],
      [
        'authMfaFactorRemove',
        'authenticated_step_up_conditional',
        15_000,
        'tier_2',
      ],
      ['authStepUpChallengeCreate', 'authenticated', 8_000, 'tier_2'],
      ['authStepUpVerify', 'authenticated', 8_000, 'tier_2'],
    ]);
    for (const row of rows) {
      const path = row.path;
      const published = operation(path, row.method.toLowerCase());
      expect(published['x-auth-class']).toBe(row.authClass);
      expect(published['x-timeout-ms']).toBe(row.timeoutMs);
    }
    expect(
      rows.map(({ operationId, stepUp }) => [operationId, stepUp]),
    ).toEqual([
      ['authMfaFactorsRead', 'none'],
      ['authMfaEnrollmentStart', 'conditional'],
      ['authMfaFactorVerify', 'none'],
      ['authMfaFactorRemove', 'conditional'],
      ['authStepUpChallengeCreate', 'none'],
      ['authStepUpVerify', 'none'],
    ]);
    for (const row of rows)
      expect(operation(row.path, row.method.toLowerCase())['x-step-up']).toBe(
        row.stepUp,
      );
  });
});

describe('existing step-up authentication operations follow BE01a', () => {
  const stepUpOperations = [
    ['/api/v1/auth/oauth/start', 'post', 'conditional'],
    ['/api/v1/auth/logout', 'post', 'conditional'],
    [
      '/api/v1/account/login-methods/{provider}/link-intents',
      'post',
      'required',
    ],
    ['/api/v1/account/login-methods/{identityId}', 'delete', 'required'],
    ['/api/v1/account-merges', 'post', 'required'],
    ['/api/v1/account-merges/{mergeId}/prove-duplicate', 'post', 'required'],
    ['/api/v1/account-merges/{mergeId}/confirm', 'post', 'required'],
  ] as const;

  it('publishes the 401 union and never describes a step-up shortfall as 403', () => {
    for (const [path, method, stepUp] of stepUpOperations) {
      const published = operation(path, method);
      expect(published['x-step-up'], path).toBe(stepUp);
      expect(unauthorized(published), path).toEqual(stepUpUnion);
      const forbidden = published.responses['403'] as unknown as {
        description: string;
      };
      expect(forbidden.description, path).not.toMatch(/step-up/iu);
    }
  });
});
