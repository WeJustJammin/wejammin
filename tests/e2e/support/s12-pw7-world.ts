/**
 * Preconditions of the Slice 12 wave-7 real-route specs (page-level operations and the remaining
 * AC-273 journeys), made through the same chain the browser uses and layered on the Slice 10 /
 * Slice 12 governed worlds. Nothing is seeded by a direct write except the two documented
 * envelopes the older worlds also write: the owner's capability grants and the terminal state of the
 * 03a activation chain for a content type (its approval chain is the Slice 09 suites' subject).
 * This directory is not type-checked by `pnpm type-check`.
 *
 * `activateWithPolicy` below is the twin of the unexported helper in `s12-pw5-world.ts`; it is
 * repeated here because that file belongs to a finished lane (see the pw7 report, Requests to root).
 */
import { randomUUID } from 'node:crypto';

import {
  createCmsApp,
  draftTypeBody,
  ownerSession,
} from '../../postgrest/support/cms-app';
import { psql } from '../../postgrest/support/stack';
import type { S10Client } from './s10-real-api';
import type { S10World } from './s10-real-world';
import { GOVERNED_REVIEWS_API, type OpenReview } from './s12-governed-world';

/** Subject kinds the CMS-03C-06 submit command accepts. */
export type SubjectKind =
  'template_version' | 'pattern_version' | 'taxonomy_version';

/** The owner (the receipt owner) also holds the subject-kind capability the activation command checks. */
export const grantOwnerCapabilities = (
  world: S10World,
  capabilities: readonly string[],
): void => {
  psql(`
    insert into identity_private.organization_actor_grant(
      organization_id, person_id, capability_code, valid_from, valid_through, active)
    select '${world.owner.organizationId}', '${world.owner.personId}', capability,
           current_date, current_date + 400, true
      from (values ${capabilities.map((capability) => `('${capability}')`).join(', ')}) as capabilities(capability)
    on conflict (organization_id, person_id, capability_code)
    do update set active = true, valid_through = excluded.valid_through`);
};

/** CMS-03C-06 as the submitter: opens the review of one saved version of any subject kind. */
export const submitSubjectViaApi = async (
  submitter: S10Client,
  kind: SubjectKind,
  subject: Readonly<{ versionId: string; contentHash: string }>,
): Promise<OpenReview> => {
  const submitted = await submitter.post(GOVERNED_REVIEWS_API, {
    subjectKind: kind,
    subjectId: subject.versionId,
    subjectHash: subject.contentHash,
  });
  if (submitted.status !== 201)
    throw new Error(
      `CMS-03C-06 refused: ${submitted.status} ${submitted.text}`,
    );
  return {
    reviewId: String(submitted.body.id),
    reviewVersion: String(submitted.body.version),
  };
};

/** The terminal state of the 03a activation chain, with the REAL registry member named by `policyKey`. */
export const activateWithPolicy = (
  typeId: string,
  versionId: string,
  policyKey: string,
): void => {
  psql(`
    begin;
    select set_config('app.cms_rpc', 'true', true);
    update platform_private.cms_content_type_versions version_row
       set state = 'active',
           version = version_row.version + 1,
           activation_workflow_policy_key = member.m->>'key',
           activation_workflow_policy_version = (member.m->>'version')::bigint,
           activation_workflow_policy_hash = member.m->>'policyHash',
           activation_required_decision_count = (member.m->>'requiredDecisionCount')::integer,
           activation_required_capabilities = member.m->'requiredCapabilities',
           activation_approval_evidence_hash = repeat('b', 64),
           updated_at = clock_timestamp()
      from (select platform_private.cms_workflow_policy_member('${policyKey}', 1) as m) member
     where version_row.id = '${versionId}';
    update platform_private.cms_content_types
       set state = 'active', version = version + 1, updated_at = clock_timestamp()
     where id = '${typeId}';
    commit;`);
};

export type MixedLocaleWorld = S10World &
  Readonly<{
    /** The `no_fallback` field of the type (a short text the title shares no language with). */
    noFallbackFieldId: string;
  }>;

/**
 * An active content type supporting `en-US` (source) and `fr-FR` (chain `["en-US"]`) with a localized required `title`
 * (fallback allowed) and an optional `legal` short text whose localization mode is `no_fallback`: the page then lists
 * one field of each rule. Returned in place of the suite world's plain type, so `seedEntry` creates entries of it.
 */
export const mixedLocaleWorld = async (
  world: S10World,
): Promise<MixedLocaleWorld> => {
  const registry = createCmsApp(
    ownerSession(world.owner.authUserId, world.owner.organizationId, [
      'cms.schema_designer',
    ]),
  );
  const titleFieldId = randomUUID();
  const legalFieldId = randomUUID();
  const typeKey = `s12_mix_${randomUUID().slice(0, 8).replaceAll('-', '')}`;
  const field = (
    stableFieldId: string,
    key: string,
    label: string,
    localizationMode: 'localized' | 'no_fallback',
    required: boolean,
    order: number,
  ) => ({
    stableFieldId,
    key,
    kind: 'short_text',
    constraints: {},
    required,
    validatorKey: null,
    validatorVersion: null,
    defaultMode: 'none',
    localizationMode,
    editorConfig: { label, order },
    lifecycle: 'active',
  });
  const created = await registry.send('POST', '/api/v1/cms/content-types', {
    body: {
      ...draftTypeBody(typeKey),
      supportedLocales: ['en-US', 'fr-FR'],
      fallbackChains: { 'fr-FR': ['en-US'] },
      fields: [
        field(titleFieldId, 'title', 'Title', 'localized', true, 0),
        field(legalFieldId, 'legal', 'Legal notice', 'no_fallback', false, 1),
      ],
    },
  });
  if (created.status !== 201)
    throw new Error(
      `CMS-03A-01 refused the mixed locale type: ${created.status} ${JSON.stringify(created.body)}`,
    );
  const contentTypeId = String(created.body.contentTypeId);
  const contentTypeVersionId = String(created.body.id);
  activateWithPolicy(contentTypeId, contentTypeVersionId, 'editorial');
  return {
    ...world,
    contentTypeId,
    contentTypeVersionId,
    fields: { title: titleFieldId, summary: randomUUID(), body: randomUUID() },
    noFallbackFieldId: legalFieldId,
  };
};

/** The key of a content type, which a vocabulary's allowlist and the template form's checkbox name. */
export const typeKeyOf = (world: S10World): string =>
  psql(
    `select type_key from platform_private.cms_content_types where id = '${world.contentTypeId}'`,
  );
