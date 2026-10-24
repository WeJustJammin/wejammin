/**
 * Fixtures of the dependency-recheck real-stack suite (`phase-02-slice-11-recheck.apispec.ts`):
 * historical outbox rows the relay cannot turn into an envelope (review B-05) and the committed
 * rows of a locale-variant review whose source is then edited (review B-01). Fixture inserts only;
 * everything the suite asserts about them is production code.
 */
import { createHash, randomUUID } from 'node:crypto';

import { psql } from './stack';

/** A UUID Postgres stores but the queue envelope refuses: version 4, variant `c`. */
const nonRfcUuid = (): string => randomUUID().replace(/^(.{19})./u, '$1c');

/** RFC 4122 UUIDv5: SHA-1 over the namespace bytes and the UTF-8 name, version 5 and variant bits set. */
const uuidV5 = (namespace: string, name: string): string => {
  const bytes = createHash('sha1')
    .update(Buffer.from(namespace.replaceAll('-', ''), 'hex'))
    .update(name, 'utf8')
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/**
 * The outbox aggregate id of `cms.localization.changed.v1` (BE03c D12): the UUIDv5 of the lower-cased
 * `entry:locale` name under the namespace UUIDv5(DNS, 'cms.locale.aggregate.v1'). Computed here, not
 * read back from `platform_private.cms_locale_aggregate_id`, so the envelope pin has an independent oracle.
 */
export const localeAggregateId = (entryId: string, locale: string): string =>
  uuidV5(
    uuidV5('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'cms.locale.aggregate.v1'),
    `${entryId.toLowerCase()}:${locale.toLowerCase()}`,
  );

export type PoisonRow = Readonly<{ id: string; eventType: string }>;

/**
 * Two never-relayed HISTORICAL outbox rows of families the relay claims (migration 20261010164000
 * widened the claim) whose identifiers the queue envelope refuses: a cms.localization.changed.v1
 * with a correlation id of an invalid variant and a job.requested with a nil causation id. Their
 * occurred_at is years old, so the claim returns them FIRST, ahead of every event this suite
 * produces (review B-05: before the fix the first such row stopped the sweep, every sweep).
 */
export const seedPoisonHistory = (): readonly PoisonRow[] => {
  const rows = [
    { id: randomUUID(), eventType: 'cms.localization.changed.v1' },
    { id: randomUUID(), eventType: 'job.requested' },
  ] as const;
  const [localization, job] = rows;
  psql(`
    insert into platform_private.outbox_events(
      id, event_type, schema_version, aggregate_type, aggregate_id, aggregate_version,
      correlation_id, causation_id, payload, occurred_at)
    values
      ('${localization.id}', '${localization.eventType}', 1, 'cms_content_entry', '${randomUUID()}', 2,
       '${nonRfcUuid()}', null, '{}'::jsonb, timestamptz '2020-01-02T00:00:00Z'),
      ('${job.id}', '${job.eventType}', 1, 'job', '${randomUUID()}', 1,
       '${randomUUID()}', '00000000-0000-0000-0000-000000000000',
       '{"jobId":"${randomUUID()}","jobType":"platform.job.execute"}'::jsonb,
       timestamptz '2020-01-03T00:00:00Z')`);
  return rows;
};

export const deadLetters = (eventId: string): string =>
  psql(`select consumer || '/' || reason_code from platform_private.consumer_dead_letters
    where event_id = '${eventId}'`);
export const outboxDisposition = (eventId: string): string =>
  psql(`select (dispatched_at is not null)::text || '/' || (dispatch_lease_token is null)::text
    from platform_private.outbox_events where id = '${eventId}'`);

/**
 * The fr-FR variant revision of an en-US source revision, its LocaleVariant row, and an OPEN review
 * of it that freezes the real manifest (so `localeSources` names the source revision and its hash)
 * with its dependency index rows: what CMS-03C-04 and CMS-03B-05 write, for a type that supports only
 * its default locale, so the rows are fixture inserts. The review is then assigned and approved
 * through the production routes.
 */
export const localeVariantFixture = (input: {
  sourceRevisionId: string;
  variantRevisionId: string;
  variantRowId: string;
  reviewId: string;
  ownerPersonId: string;
  ownerAuthUserId: string;
}): string => `
  begin;
  select set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_entry_revisions(
    id, owner_id, entry_id, revision_number, schema_version_id, template_version_id,
    taxonomy_version_ids, parent_revision_ids, locale, payload_hash, author_person_id,
    acting_party_id, state, version, validation_state, validation_report, created_at, updated_at)
  select '${input.variantRevisionId}', source.owner_id, source.entry_id, source.revision_number + 1,
         source.schema_version_id, source.template_version_id, source.taxonomy_version_ids,
         jsonb_build_array(source.id), 'fr-FR', source.payload_hash, source.author_person_id,
         source.acting_party_id, 'draft', 1, 'valid', '{}'::jsonb, now(), now()
    from platform_private.cms_entry_revisions source where source.id = '${input.sourceRevisionId}';
  insert into platform_private.cms_entry_field_values(
    owner_id, state, version, revision_id, field_id, field_definition_id, locale, value,
    provenance, value_hash, created_at, updated_at)
  select value.owner_id, value.state, value.version, '${input.variantRevisionId}', value.field_id,
         value.field_definition_id, 'fr-FR', value.value, value.provenance, value.value_hash, now(), now()
    from platform_private.cms_entry_field_values value where value.revision_id = '${input.sourceRevisionId}';
  insert into platform_private.cms_locale_variants(
    id, owner_id, state, version, entry_id, revision_id, source_revision_id, locale, source_locale,
    source_hash, created_by)
  select '${input.variantRowId}', source.owner_id, 'draft', 1, source.entry_id,
         '${input.variantRevisionId}', source.id, 'fr-FR', source.locale, source.payload_hash,
         '${input.ownerAuthUserId}'
    from platform_private.cms_entry_revisions source where source.id = '${input.sourceRevisionId}';
  with built as (
    select platform_private.cms_build_dependency_manifest('${input.variantRevisionId}'::uuid) as manifest)
  insert into platform_private.cms_editorial_reviews(
    id, owner_id, revision_id, state, version, risk_class, frozen_hash, dependency_manifest,
    dependency_hash, activation_evidence, workflow_policy_key, workflow_policy_version,
    workflow_policy_hash, required_capabilities, required_decision_count, recorded_decision_count,
    approval_evidence_hash, submitted_by, submitted_at, invalidated_reason, decided_at, entry_id,
    created_at, updated_at)
  select '${input.reviewId}', revision.owner_id, revision.id, 'open', 1,
         built.manifest->'schema'->'workflowPolicy'->>'riskClass', revision.payload_hash::text,
         built.manifest, platform_private.cms_jcs_sha256(built.manifest),
         built.manifest->'schema'->'activationEvidence',
         built.manifest->'schema'->'workflowPolicy'->>'key',
         (built.manifest->'schema'->'workflowPolicy'->>'version')::bigint,
         built.manifest->'schema'->'workflowPolicy'->>'policyHash',
         built.manifest->'schema'->'workflowPolicy'->'requiredCapabilities',
         (built.manifest->'schema'->'workflowPolicy'->>'requiredDecisionCount')::smallint, 0,
         built.manifest->'schema'->'workflowPolicy'->>'approvalEvidenceHash',
         '${input.ownerPersonId}', now(), null, null, revision.entry_id, now(), now()
    from platform_private.cms_entry_revisions revision cross join built
   where revision.id = '${input.variantRevisionId}';
  insert into platform_private.cms_editorial_review_dependencies(
    owner_id, state, version, review_id, kind, ref_id, created_at, updated_at)
  select review.owner_id, 'active', 1, review.id, refs.kind, refs.ref_id, now(), now()
    from platform_private.cms_editorial_reviews review
    cross join lateral platform_private.cms_review_dependency_refs(
      review.revision_id, review.dependency_manifest) refs
   where review.id = '${input.reviewId}';
  commit;`;

/**
 * A newer en-US source revision with another payload hash, written like every revision writer
 * (cms_create_revision, cms_resolve_conflict, cms_restore_revision): the revision row, its field
 * values, then the draft head move last. The source-change fan-out (migration 20261014050310) is the
 * trigger on that head move, so the producer runs after the values exist and `stale_field_ids` is exact.
 * The variant row's state is `draft` here: `approved` is not a physical state (migration 20261014050000).
 */
export const editedSourceFixture = (
  sourceRevisionId: string,
  editedRevisionId: string,
): string => `
  begin;
  select set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_entry_revisions(
    id, owner_id, entry_id, revision_number, schema_version_id, template_version_id,
    taxonomy_version_ids, parent_revision_ids, locale, payload_hash, author_person_id,
    acting_party_id, state, version, validation_state, validation_report, created_at, updated_at)
  select '${editedRevisionId}', source.owner_id, source.entry_id, source.revision_number + 2,
         source.schema_version_id, source.template_version_id, source.taxonomy_version_ids,
         jsonb_build_array(source.id), source.locale,
         encode(extensions.digest(convert_to('edited:${editedRevisionId}', 'utf8'), 'sha256'), 'hex'),
         source.author_person_id, source.acting_party_id, 'draft', 1, 'valid', '{}'::jsonb, now(), now()
    from platform_private.cms_entry_revisions source where source.id = '${sourceRevisionId}';
  insert into platform_private.cms_entry_field_values(
    owner_id, state, version, revision_id, field_id, field_definition_id, locale, value,
    provenance, value_hash, created_at, updated_at)
  select value.owner_id, value.state, value.version, '${editedRevisionId}', value.field_id,
         value.field_definition_id, value.locale, value.value, value.provenance, value.value_hash, now(), now()
    from platform_private.cms_entry_field_values value where value.revision_id = '${sourceRevisionId}';
  update platform_private.cms_content_entries entry
     set current_draft_revision_id = '${editedRevisionId}', version = entry.version + 1, updated_at = now()
   where entry.id = (select source.entry_id from platform_private.cms_entry_revisions source
                      where source.id = '${sourceRevisionId}');
  commit;`;
