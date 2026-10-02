import { z } from 'zod';

import { anchorOpenApiSchemaReferences } from './openapi-reference-normalization.ts';
import { ApiErrorSchema } from './api-error.ts';
import {
  EntryCreateApiRequestSchema,
  EntryCreateResourceSchema,
} from './cms-editorial/entry-create.ts';
import {
  EntryDraftDetailApiRequestSchema,
  EntryDraftDetailResourceSchema,
} from './cms-editorial/entry-draft-detail.ts';
import { ConflictResolutionApiRequestSchema } from './cms-editorial/conflict-resolution.ts';
import { EntryRevisionApiRequestSchema } from './cms-editorial/requests.ts';
import {
  RevisionHistoryApiRequestSchema,
  RevisionHistoryPageSchema,
} from './cms-editorial/revision-history.ts';
import { RevisionRestoreApiRequestSchema } from './cms-editorial/revision-restore.ts';
import { EntryRevisionResourceSchema } from './cms-editorial/resources.ts';
import {
  TemplateDesignerContextSchema,
  TemplateVersionApiRequestSchema,
  TemplateVersionResourceSchema,
} from './cms-composition/template.ts';
import {
  TemplateLatestApiRequestSchema,
  TemplateVersionDetailSchema,
} from './cms-composition/template-detail.ts';
import {
  LocaleVariantApiRequestSchema,
  LocaleVariantResourceSchema,
} from './cms-composition/locale-variant.ts';
import {
  RelatedContentApiRequestSchema,
  RelatedContentResourceSchema,
} from './cms-composition/related-content.ts';
import {
  TaxonomyTermActionApiRequestSchema,
  TaxonomyTermResourceSchema,
} from './cms-composition/taxonomy-term.ts';
import {
  CompositionInstanceResourceSchema,
  PatternInstanceApiRequestSchema,
} from './cms-composition/pattern-instance.ts';
import {
  AuthCallbackApiRequestSchema,
  AuthMergePathSchema,
  EmailStartRequestSchema,
  LinkIntentApiRequestSchema,
  LogoutApiRequestSchema,
  MergeConfirmApiRequestSchema,
  MergeCreateApiRequestSchema,
  MergeProofApiRequestSchema,
  OAuthStartRequestSchema,
  PersonBootstrapApiRequestSchema,
  SessionRefreshApiRequestSchema,
  UnlinkApiRequestSchema,
} from './authentication/requests.ts';
import {
  MfaFactorRemoveApiRequestSchema,
  MfaFactorVerifyApiRequestSchema,
  StepUpChallengeApiRequestSchema,
  StepUpVerifyApiRequestSchema,
  TotpEnrollmentStartApiRequestSchema,
} from './authentication/requests-mfa.ts';
import { AuthEmptyBodySchema } from './authentication/primitives.ts';
import {
  MfaFactorsResourceSchema,
  StepUpChallengeSchema,
  StepUpResultSchema,
  TotpEnrollmentStartSchema,
} from './authentication/resources-mfa.ts';
import {
  AuthStartAcceptedSchema,
  AuthorizationStartSchema,
  LoginMethodsResourceSchema,
  MergeCaseResourceSchema,
  PersonBootstrapResourceSchema,
  ProviderCatalogSchema,
  SessionResourceSchema,
} from './authentication/resources.ts';
import {
  Cfg05b06MfaFactorResetRequestSchema,
  Cfg05b06MfaFactorResetResponseSchema,
} from './platform-configuration/admin-mfa-reset.ts';
import { Cfg05b07CapabilitySnapshotResponseSchema } from './platform-configuration/admin-capability-snapshot.ts';
import { JobIdPathSchema, JobStatusSchema } from './job-status.ts';
import {
  ChallengeApiRequestSchema,
  ChallengeResourceSchema,
  ClaimCreateApiRequestSchema,
  ClaimPathSchema,
  ClaimResourceSchema,
  ConversionApiRequestSchema,
  InvitationApiRequestSchema,
  InvitationResourceSchema,
  MatchApiRequestSchema,
  MatchResponseSchema,
  ProofApiRequestSchema,
  RemedyApiRequestSchema,
  RemedyResourceSchema,
} from './profiles-verification.ts';
import {
  ActingContextBindingResponseSchema,
  ActingContextListResponseSchema,
  AcceptMembershipApiRequestSchema,
  AcceptMembershipRequestSchema,
  AddFacetApiRequestSchema,
  AddCapacityPeriodApiRequestSchema,
  AddOrganizationTypeRequestSchema,
  AddOrganizationTypeApiRequestSchema,
  AssertHistoricalMembershipApiRequestSchema,
  AliasResponseSchema,
  BindContextApiRequestSchema,
  ChangeHandleApiRequestSchema,
  CreateDisclosureApiRequestSchema,
  CreateAliasApiRequestSchema,
  CreateOrganizationApiRequestSchema,
  CreateOrganizationRequestSchema,
  CreatePersonApiRequestSchema,
  CreateTransferOfferApiRequestSchema,
  FacetMutationResponseSchema,
  MembershipCollectionSchema,
  MembershipCapacityPeriodResourceSchema,
  CapacityPeriodRequestSchema,
  EndMembershipRequestSchema,
  HistoricalMembershipAssertionRequestSchema,
  MembershipInvitationRequestSchema,
  MembershipTenureResourceSchema,
  DisclosureEventResponseSchema,
  EndMembershipApiRequestSchema,
  InviteMembershipApiRequestSchema,
  LegalDisclosurePathSchema,
  LegalIdentityMetadataResponseSchema,
  PatchAliasApiRequestSchema,
  PersonIdentityResponseSchema,
  PublicPartyProjectionResponseSchema,
  PutLegalIdentityApiRequestSchema,
  ReadMembershipsApiRequestSchema,
  MembershipTenurePathSchema,
  OrganizationMembershipsPathSchema,
  OrganizationPathSchema,
  OrganizationTypeAssignmentPathSchema,
  ReadOrganizationApiRequestSchema,
  RemoveOrganizationTypeApiRequestSchema,
  OrganizationPublicResourceSchema,
  OrganizationReadResponseSchema,
  OrganizationResourceSchema,
  OrganizationTypeAssignmentResourceSchema,
  ReadActingContextsApiRequestSchema,
  ReadPersonApiRequestSchema,
  ReadPublicProjectionApiRequestSchema,
  RemoveFacetApiRequestSchema,
  RetireAliasApiRequestSchema,
  TransferDecisionApiRequestSchema,
  TransferOfferResponseSchema,
} from './identity-authority.ts';
import {
  DiagnosticResponseSchema,
  HealthResponseSchema,
  ReadinessResponseSchema,
} from './operational.ts';
import { RequestContextSchema } from './request-context.ts';
import {
  UploadAdmissionRequestSchema,
  UploadIntentResourceSchema,
} from './upload-admission.ts';
import { UploadCompletionRequestSchema } from './upload-completion.ts';

const schemaContracts = {
  ApiErrorSchema,
  AuthCallbackApiRequestSchema,
  AuthEmptyBodySchema,
  AuthMergePathSchema,
  AuthStartAcceptedSchema,
  AuthorizationStartSchema,
  ActingContextBindingResponseSchema,
  ActingContextListResponseSchema,
  AcceptMembershipApiRequestSchema,
  AcceptMembershipRequestSchema,
  AddCapacityPeriodApiRequestSchema,
  AddFacetApiRequestSchema,
  AddOrganizationTypeApiRequestSchema,
  AddOrganizationTypeRequestSchema,
  AssertHistoricalMembershipApiRequestSchema,
  AliasResponseSchema,
  BindContextApiRequestSchema,
  ChangeHandleApiRequestSchema,
  CreateAliasApiRequestSchema,
  CreateDisclosureApiRequestSchema,
  CreateOrganizationApiRequestSchema,
  CreateOrganizationRequestSchema,
  CreatePersonApiRequestSchema,
  CreateTransferOfferApiRequestSchema,
  DiagnosticResponseSchema,
  ConflictResolutionApiRequestSchema,
  EntryRevisionApiRequestSchema,
  EntryRevisionResourceSchema,
  EntryCreateApiRequestSchema,
  EntryCreateResourceSchema,
  EntryDraftDetailApiRequestSchema,
  EntryDraftDetailResourceSchema,
  HealthResponseSchema,
  JobIdPathSchema,
  JobStatusSchema,
  ChallengeApiRequestSchema,
  ChallengeResourceSchema,
  ClaimCreateApiRequestSchema,
  ClaimPathSchema,
  ClaimResourceSchema,
  ConversionApiRequestSchema,
  FacetMutationResponseSchema,
  CapacityPeriodRequestSchema,
  DisclosureEventResponseSchema,
  EndMembershipApiRequestSchema,
  EndMembershipRequestSchema,
  HistoricalMembershipAssertionRequestSchema,
  InvitationApiRequestSchema,
  InvitationResourceSchema,
  InviteMembershipApiRequestSchema,
  LegalDisclosurePathSchema,
  LinkIntentApiRequestSchema,
  LoginMethodsResourceSchema,
  LegalIdentityMetadataResponseSchema,
  MembershipCollectionSchema,
  MembershipCapacityPeriodResourceSchema,
  MembershipInvitationRequestSchema,
  MembershipTenurePathSchema,
  MembershipTenureResourceSchema,
  MatchApiRequestSchema,
  MatchResponseSchema,
  LogoutApiRequestSchema,
  MergeCaseResourceSchema,
  MergeConfirmApiRequestSchema,
  MergeCreateApiRequestSchema,
  MergeProofApiRequestSchema,
  MfaFactorRemoveApiRequestSchema,
  MfaFactorVerifyApiRequestSchema,
  MfaFactorsResourceSchema,
  OAuthStartRequestSchema,
  PersonBootstrapApiRequestSchema,
  PersonBootstrapResourceSchema,
  ProviderCatalogSchema,
  ProofApiRequestSchema,
  StepUpChallengeApiRequestSchema,
  StepUpChallengeSchema,
  StepUpResultSchema,
  StepUpVerifyApiRequestSchema,
  TotpEnrollmentStartApiRequestSchema,
  TotpEnrollmentStartSchema,
  PatchAliasApiRequestSchema,
  PersonIdentityResponseSchema,
  PublicPartyProjectionResponseSchema,
  PutLegalIdentityApiRequestSchema,
  ReadActingContextsApiRequestSchema,
  ReadMembershipsApiRequestSchema,
  ReadOrganizationApiRequestSchema,
  RemoveOrganizationTypeApiRequestSchema,
  ReadPersonApiRequestSchema,
  ReadPublicProjectionApiRequestSchema,
  ReadinessResponseSchema,
  RemedyApiRequestSchema,
  RemedyResourceSchema,
  RemoveFacetApiRequestSchema,
  RetireAliasApiRequestSchema,
  OrganizationMembershipsPathSchema,
  OrganizationPathSchema,
  OrganizationPublicResourceSchema,
  OrganizationReadResponseSchema,
  OrganizationResourceSchema,
  OrganizationTypeAssignmentPathSchema,
  OrganizationTypeAssignmentResourceSchema,
  RequestContextSchema,
  RevisionHistoryApiRequestSchema,
  RevisionHistoryPageSchema,
  RevisionRestoreApiRequestSchema,
  SessionRefreshApiRequestSchema,
  SessionResourceSchema,
  UnlinkApiRequestSchema,
  TransferDecisionApiRequestSchema,
  TransferOfferResponseSchema,
  EmailStartRequestSchema,
  UploadAdmissionRequestSchema,
  UploadCompletionRequestSchema,
  UploadIntentResourceSchema,
  TemplateVersionApiRequestSchema,
  TemplateDesignerContextSchema,
  TemplateVersionResourceSchema,
  TemplateLatestApiRequestSchema,
  TemplateVersionDetailSchema,
  LocaleVariantApiRequestSchema,
  LocaleVariantResourceSchema,
  RelatedContentApiRequestSchema,
  RelatedContentResourceSchema,
  TaxonomyTermActionApiRequestSchema,
  TaxonomyTermResourceSchema,
  PatternInstanceApiRequestSchema,
  CompositionInstanceResourceSchema,
  Cfg05b06MfaFactorResetRequestSchema,
  Cfg05b06MfaFactorResetResponseSchema,
  Cfg05b07CapabilitySnapshotResponseSchema,
} as const;

const schemaIo = {
  AuthCallbackApiRequestSchema: 'input',
  AuthMergePathSchema: 'input',
  AcceptMembershipApiRequestSchema: 'input',
  AcceptMembershipRequestSchema: 'input',
  AddCapacityPeriodApiRequestSchema: 'input',
  AddFacetApiRequestSchema: 'input',
  AddOrganizationTypeApiRequestSchema: 'input',
  AddOrganizationTypeRequestSchema: 'input',
  AssertHistoricalMembershipApiRequestSchema: 'input',
  BindContextApiRequestSchema: 'input',
  ChallengeApiRequestSchema: 'input',
  CapacityPeriodRequestSchema: 'input',
  ClaimCreateApiRequestSchema: 'input',
  ClaimPathSchema: 'input',
  ChangeHandleApiRequestSchema: 'input',
  CreateAliasApiRequestSchema: 'input',
  CreateDisclosureApiRequestSchema: 'input',
  CreateOrganizationApiRequestSchema: 'input',
  CreateOrganizationRequestSchema: 'input',
  CreatePersonApiRequestSchema: 'input',
  CreateTransferOfferApiRequestSchema: 'input',
  ConversionApiRequestSchema: 'input',
  EndMembershipApiRequestSchema: 'input',
  EndMembershipRequestSchema: 'input',
  EntryCreateApiRequestSchema: 'input',
  EntryDraftDetailApiRequestSchema: 'input',
  ConflictResolutionApiRequestSchema: 'input',
  EntryRevisionApiRequestSchema: 'input',
  RevisionHistoryApiRequestSchema: 'input',
  RevisionRestoreApiRequestSchema: 'input',
  EmailStartRequestSchema: 'input',
  HistoricalMembershipAssertionRequestSchema: 'input',
  InvitationApiRequestSchema: 'input',
  MatchApiRequestSchema: 'input',
  InviteMembershipApiRequestSchema: 'input',
  MembershipInvitationRequestSchema: 'input',
  MembershipTenurePathSchema: 'input',
  LegalDisclosurePathSchema: 'input',
  LogoutApiRequestSchema: 'input',
  LinkIntentApiRequestSchema: 'input',
  MergeConfirmApiRequestSchema: 'input',
  MergeCreateApiRequestSchema: 'input',
  MergeProofApiRequestSchema: 'input',
  MfaFactorRemoveApiRequestSchema: 'input',
  MfaFactorVerifyApiRequestSchema: 'input',
  OAuthStartRequestSchema: 'input',
  StepUpChallengeApiRequestSchema: 'input',
  StepUpVerifyApiRequestSchema: 'input',
  TotpEnrollmentStartApiRequestSchema: 'input',
  PersonBootstrapApiRequestSchema: 'input',
  PatchAliasApiRequestSchema: 'input',
  ProofApiRequestSchema: 'input',
  ReadActingContextsApiRequestSchema: 'input',
  ReadPersonApiRequestSchema: 'input',
  ReadPublicProjectionApiRequestSchema: 'input',
  RemedyApiRequestSchema: 'input',
  PutLegalIdentityApiRequestSchema: 'input',
  OrganizationMembershipsPathSchema: 'input',
  OrganizationPathSchema: 'input',
  OrganizationTypeAssignmentPathSchema: 'input',
  ReadMembershipsApiRequestSchema: 'input',
  ReadOrganizationApiRequestSchema: 'input',
  RemoveOrganizationTypeApiRequestSchema: 'input',
  RemoveFacetApiRequestSchema: 'input',
  RetireAliasApiRequestSchema: 'input',
  SessionRefreshApiRequestSchema: 'input',
  UnlinkApiRequestSchema: 'input',
  TransferDecisionApiRequestSchema: 'input',
  TemplateVersionApiRequestSchema: 'input',
  TemplateLatestApiRequestSchema: 'input',
  LocaleVariantApiRequestSchema: 'input',
  RelatedContentApiRequestSchema: 'input',
  TaxonomyTermActionApiRequestSchema: 'input',
  PatternInstanceApiRequestSchema: 'input',
  Cfg05b06MfaFactorResetRequestSchema: 'input',
  UploadAdmissionRequestSchema: 'input',
  UploadCompletionRequestSchema: 'input',
} as const satisfies Partial<
  Record<keyof typeof schemaContracts, 'input' | 'output'>
>;

const schemaComponentName = (schemaName: string): string =>
  schemaName.slice(0, -'Schema'.length);

const schemaForName = (schemaName: string): z.ZodTypeAny => {
  const schema =
    schemaContracts[schemaName as keyof typeof schemaContracts] ?? undefined;
  if (schema === undefined) {
    throw new Error(
      `OpenAPI schema ${schemaName} is absent from runtime contracts.`,
    );
  }
  return schema;
};

export const getOpenApiSchemaJson = (schemaName: string): unknown =>
  anchorOpenApiSchemaReferences(
    schemaComponentName(schemaName),
    z.toJSONSchema(schemaForName(schemaName), {
      io:
        schemaIo[schemaName as keyof typeof schemaIo] === 'input'
          ? 'input'
          : 'output',
      target: 'draft-7',
      unrepresentable: 'throw',
    }),
  );

export const getOpenApiSchemaReference = (
  schemaName: string,
): Readonly<{ $ref: string }> => {
  schemaForName(schemaName);
  return {
    $ref: `#/components/schemas/${schemaComponentName(schemaName)}`,
  };
};

export const getOpenApiComponentSchemas = (): Readonly<
  Record<string, unknown>
> =>
  Object.fromEntries(
    Object.keys(schemaContracts).map((schemaName) => [
      schemaComponentName(schemaName),
      getOpenApiSchemaJson(schemaName),
    ]),
  );
