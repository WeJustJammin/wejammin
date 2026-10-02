import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../infra/openapi-document.mjs';

type OpenApiOperation = Readonly<{
  operationId?: string;
  parameters?: readonly Readonly<{
    name?: string;
    in?: string;
    required?: boolean;
  }>[];
}>;

describe('authentication OpenAPI contract', () => {
  const document = buildOpenApiDocument() as Readonly<{
    paths: Readonly<Record<string, Readonly<Record<string, OpenApiOperation>>>>;
  }>;

  it('publishes every Slice 01, Slice 02 and DEC-111 authentication route with its canonical operation', () => {
    expect(
      Object.entries(document.paths)
        .flatMap(([path, methods]) =>
          Object.values(methods).map((operation) => [
            path,
            operation.operationId,
          ]),
        )
        .filter(([, operationId]) => operationId?.startsWith('auth')),
    ).toEqual([
      ['/api/v1/auth/providers', 'authProviderCatalogRead'],
      ['/api/v1/auth/email/start', 'authEmailStart'],
      ['/api/v1/auth/oauth/start', 'authOAuthStart'],
      ['/auth/callback', 'authCallbackComplete'],
      ['/api/v1/account/login-methods', 'authLoginMethodsRead'],
      [
        '/api/v1/account/login-methods/{provider}/link-intents',
        'authLoginMethodLinkIntentCreate',
      ],
      ['/api/v1/account/login-methods/{identityId}', 'authLoginMethodUnlink'],
      ['/api/v1/account-merges', 'authAccountMergeCreate'],
      ['/api/v1/account-merges/{mergeId}', 'authAccountMergeRead'],
      [
        '/api/v1/account-merges/{mergeId}/prove-duplicate',
        'authAccountMergeProofCreate',
      ],
      ['/api/v1/account-merges/{mergeId}/confirm', 'authAccountMergeConfirm'],
      ['/api/v1/auth/session', 'authSessionRead'],
      ['/api/v1/auth/session/refresh', 'authSessionRefresh'],
      ['/api/v1/auth/bootstrap', 'authPersonBootstrap'],
      ['/api/v1/auth/logout', 'authLogout'],
      ['/api/v1/account/mfa/factors', 'authMfaFactorsRead'],
      ['/api/v1/account/mfa/factors', 'authMfaEnrollmentStart'],
      ['/api/v1/account/mfa/factors/{factorId}/verify', 'authMfaFactorVerify'],
      ['/api/v1/account/mfa/factors/{factorId}', 'authMfaFactorRemove'],
      ['/api/v1/auth/step-up/challenges', 'authStepUpChallengeCreate'],
      [
        '/api/v1/auth/step-up/challenges/{challengeId}/verify',
        'authStepUpVerify',
      ],
    ]);
  });

  it('documents Slice 02 path parameters and optimistic mutation headers', () => {
    const link =
      document.paths['/api/v1/account/login-methods/{provider}/link-intents']
        ?.post;
    expect(link?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'provider',
          in: 'path',
          required: true,
        }),
        expect.objectContaining({
          name: 'Idempotency-Key',
          in: 'header',
          required: true,
        }),
        expect.objectContaining({
          name: 'If-Match',
          in: 'header',
          required: true,
        }),
        expect.objectContaining({
          name: 'X-CSRF-Token',
          in: 'header',
          required: true,
        }),
      ]),
    );

    const confirm =
      document.paths['/api/v1/account-merges/{mergeId}/confirm']?.post;
    expect(confirm?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'mergeId',
          in: 'path',
          required: true,
        }),
        expect.objectContaining({
          name: 'If-Match',
          in: 'header',
          required: true,
        }),
      ]),
    );
  });

  it('documents callback query fields and mutation security headers', () => {
    const callback = document.paths['/auth/callback']?.get;
    expect(callback?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'state', in: 'query', required: true }),
        expect.objectContaining({ name: 'code', in: 'query', required: false }),
      ]),
    );
    const logout = document.paths['/api/v1/auth/logout']?.post;
    expect(logout?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Idempotency-Key',
          in: 'header',
          required: true,
        }),
        expect.objectContaining({
          name: 'X-CSRF-Token',
          in: 'header',
          required: true,
        }),
      ]),
    );
  });
});
