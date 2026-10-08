import { describe, expect, it } from 'vitest';

import {
  ApiErrorSchema,
  CorrelationIdSchema,
  createCorrelationId,
  createRequestId,
  DiagnosticResponseSchema,
  getOpenApiComponentSchemas,
  ReadinessResponseSchema,
  RequestContextSchema,
  RequestIdSchema,
} from '@wejammin/contracts';

const requestId = '11111111-1111-4111-8111-111111111111';
const correlationId = '22222222-2222-4222-8222-222222222222';

describe('foundation wire contracts', () => {
  it('accepts UUID identifiers and replaces invalid ingress identifiers', () => {
    expect(RequestIdSchema.parse(requestId)).toBe(requestId);
    expect(CorrelationIdSchema.parse(correlationId)).toBe(correlationId);

    const generated = createRequestId('client-chosen-identity');
    expect(generated).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(
      createCorrelationId(undefined, RequestIdSchema.parse(requestId)),
    ).toBe(requestId);
  });

  it('enforces the exact bounded four-field API error envelope', () => {
    expect(
      ApiErrorSchema.parse({
        code: 'NOT_FOUND',
        details: { recoveryAction: 'return_to_list' },
        message: 'The requested resource does not exist.',
        requestId,
      }),
    ).toEqual({
      code: 'NOT_FOUND',
      details: { recoveryAction: 'return_to_list' },
      message: 'The requested resource does not exist.',
      requestId,
    });

    expect(() =>
      ApiErrorSchema.parse({
        code: 'route_not_found',
        details: {},
        message: 'Unsafe drift',
        requestId,
      }),
    ).toThrow();
    expect(() =>
      ApiErrorSchema.parse({
        code: 'INTERNAL_ERROR',
        details: { safeContext: 'x'.repeat(8_193) },
        message: 'Too many detail bytes',
        requestId,
      }),
    ).toThrow();
    expect(
      ApiErrorSchema.parse({
        code: 'INVALID_REQUEST',
        details: { values: [null, true, 1, 'safe'] },
        message: 'Safe JSON details',
        requestId,
      }).details,
    ).toEqual({ values: [null, true, 1, 'safe'] });
    expect(() =>
      ApiErrorSchema.parse({
        code: 'NOT_FOUND',
        details: {},
        message: 'Unsafe drift',
        requestId,
        status: 404,
      }),
    ).toThrow();
    expect(() =>
      ApiErrorSchema.parse({
        code: 'INTERNAL_ERROR',
        details: { a: { b: { c: { d: { e: true } } } } },
        message: 'Too deeply nested',
        requestId,
      }),
    ).toThrow();
    expect(() =>
      ApiErrorSchema.parse({
        code: 'INTERNAL_ERROR',
        details: Object.fromEntries(
          Array.from({ length: 17 }, (_, index) => [`key${index}`, index]),
        ),
        message: 'Too many detail keys',
        requestId,
      }),
    ).toThrow();
  });

  it('requires a strict server-derived request context snapshot', () => {
    const context = {
      requestId,
      correlationId,
      causationId: null,
      traceId: 'trace-111111111111',
      userId: '33333333-3333-4333-8333-333333333333',
      actingPartyId: null,
      capabilities: ['diagnostics.read'],
      locale: 'en-US',
      clientVersion: 'web-2026.08.30',
    } as const;

    expect(RequestContextSchema.parse(context)).toEqual(context);
    expect(() =>
      RequestContextSchema.parse({ ...context, role: 'service_role' }),
    ).toThrow();
    expect(() =>
      RequestContextSchema.parse({
        ...context,
        capabilities: ['diagnostics.read', 'diagnostics.read'],
      }),
    ).toThrow();
    expect(() =>
      RequestContextSchema.parse({ ...context, locale: 'not_a_locale' }),
    ).toThrow();
  });

  it('keeps readiness and diagnostic payloads topology-free', () => {
    expect(
      ReadinessResponseSchema.parse({
        requestId,
        service: 'wejammin-api',
        status: 'not_ready',
        version: 'v1',
      }),
    ).toEqual({
      requestId,
      service: 'wejammin-api',
      status: 'not_ready',
      version: 'v1',
    });
    expect(() =>
      DiagnosticResponseSchema.parse({
        requestId,
        checkedAt: '2026-08-30T08:00:00.000Z',
        state: 'degraded',
        checks: [
          { name: 'persistence', status: 'unavailable', provider: 'secret' },
        ],
      }),
    ).toThrow();
  });

  it('derives OpenAPI component schemas from the runtime contracts', () => {
    const components = getOpenApiComponentSchemas();

    expect(Object.keys(components).sort()).toEqual([
      'AcceptMembershipApiRequest',
      'AcceptMembershipRequest',
      'ActingContextBindingResponse',
      'ActingContextListResponse',
      'AddCapacityPeriodApiRequest',
      'AddFacetApiRequest',
      'AddOrganizationTypeApiRequest',
      'AddOrganizationTypeRequest',
      'AliasResponse',
      'ApiError',
      'AssertHistoricalMembershipApiRequest',
      'AuthCallbackApiRequest',
      'AuthEmptyBody',
      'AuthMergePath',
      'AuthStartAccepted',
      'AuthoringContextApiRequest',
      'AuthoringContextResource',
      'AuthorizationStart',
      'BindContextApiRequest',
      'CapacityPeriodRequest',
      'Cfg05b06MfaFactorResetRequest',
      'Cfg05b06MfaFactorResetResponse',
      'Cfg05b07CapabilitySnapshotResponse',
      'ChallengeApiRequest',
      'ChallengeResource',
      'ChangeHandleApiRequest',
      'ClaimCreateApiRequest',
      'ClaimPath',
      'ClaimResource',
      'CompositionInstanceResource',
      'ConflictDetailApiRequest',
      'ConflictDetailResource',
      'ConflictResolutionApiRequest',
      'ConversionApiRequest',
      'CreateAliasApiRequest',
      'CreateDisclosureApiRequest',
      'CreateOrganizationApiRequest',
      'CreateOrganizationRequest',
      'CreatePersonApiRequest',
      'CreateTransferOfferApiRequest',
      'DiagnosticResponse',
      'DisclosureEventResponse',
      'EmailStartRequest',
      'EndMembershipApiRequest',
      'EndMembershipRequest',
      'EntryCreateApiRequest',
      'EntryCreateResource',
      'EntryDraftDetailApiRequest',
      'EntryDraftDetailResource',
      'EntryListApiRequest',
      'EntryListPage',
      'EntryRevisionApiRequest',
      'EntryRevisionResource',
      'FacetMutationResponse',
      'HealthResponse',
      'HistoricalMembershipAssertionRequest',
      'InvitationApiRequest',
      'InvitationResource',
      'InviteMembershipApiRequest',
      'JobIdPath',
      'JobStatus',
      'LegalDisclosurePath',
      'LegalIdentityMetadataResponse',
      'LinkIntentApiRequest',
      'LocaleVariantApiRequest',
      'LocaleVariantResource',
      'LoginMethodsResource',
      'LogoutApiRequest',
      'MatchApiRequest',
      'MatchResponse',
      'MembershipCapacityPeriodResource',
      'MembershipCollection',
      'MembershipInvitationRequest',
      'MembershipTenurePath',
      'MembershipTenureResource',
      'MergeCaseResource',
      'MergeConfirmApiRequest',
      'MergeCreateApiRequest',
      'MergeProofApiRequest',
      'MfaFactorRemoveApiRequest',
      'MfaFactorVerifyApiRequest',
      'MfaFactorsResource',
      'OAuthStartRequest',
      'OrganizationMembershipsPath',
      'OrganizationPath',
      'OrganizationPublicResource',
      'OrganizationReadResponse',
      'OrganizationResource',
      'OrganizationTypeAssignmentPath',
      'OrganizationTypeAssignmentResource',
      'PatchAliasApiRequest',
      'PatternInstanceApiRequest',
      'PersonBootstrapApiRequest',
      'PersonBootstrapResource',
      'PersonIdentityResponse',
      'ProofApiRequest',
      'ProviderCatalog',
      'PublicPartyProjectionResponse',
      'PutLegalIdentityApiRequest',
      'ReadActingContextsApiRequest',
      'ReadMembershipsApiRequest',
      'ReadOrganizationApiRequest',
      'ReadPersonApiRequest',
      'ReadPublicProjectionApiRequest',
      'ReadinessResponse',
      'RelatedContentApiRequest',
      'RelatedContentResource',
      'RemedyApiRequest',
      'RemedyResource',
      'RemoveFacetApiRequest',
      'RemoveOrganizationTypeApiRequest',
      'RequestContext',
      'RetireAliasApiRequest',
      'RevisionHistoryApiRequest',
      'RevisionHistoryPage',
      'RevisionRestoreApiRequest',
      'SessionRefreshApiRequest',
      'SessionResource',
      'StepUpChallenge',
      'StepUpChallengeApiRequest',
      'StepUpResult',
      'StepUpVerifyApiRequest',
      'TaxonomyTermActionApiRequest',
      'TaxonomyTermResource',
      'TemplateDesignerContext',
      'TemplateLatestApiRequest',
      'TemplateVersionApiRequest',
      'TemplateVersionDetail',
      'TemplateVersionResource',
      'TotpEnrollmentStart',
      'TotpEnrollmentStartApiRequest',
      'TransferDecisionApiRequest',
      'TransferOfferResponse',
      'UnlinkApiRequest',
      'UploadAdmissionRequest',
      'UploadCompletionRequest',
      'UploadIntentResource',
    ]);
    expect(components.ApiError).toMatchObject({ type: 'object' });
  });
});
