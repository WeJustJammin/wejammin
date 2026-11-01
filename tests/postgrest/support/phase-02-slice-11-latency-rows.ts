/**
 * Row images and bulk writers of the Slice 11 read-latency world.
 *
 * The images are the TypeScript twins of `supabase/tests/phase_02_slice_11_schema/002-row-builders.sqlinc`
 * (assignment, decision, schedule and publication-lineage rows) with the real organization, person and artifact
 * identifiers of the committed world. A bulk write inserts them through `jsonb_populate_record` with the table's
 * USER triggers disabled inside one transaction, which is how the SQL fixtures (`h11r_raw_insert`) write rows whose
 * state could not be reached by one command. The bounded populations are what the latency targets are about.
 */
import { createHash, randomUUID } from 'node:crypto';

import { psql } from './stack';

const sha256 = (text: string): string =>
  createHash('sha256').update(text).digest('hex');

export type Json = Record<string, unknown>;

/** Inserts the given row images into `table` in one transaction with the table's USER triggers disabled. */
export const insertImages = (table: string, images: readonly Json[]): void => {
  if (images.length === 0) return;
  psql(`
    begin;
    select set_config('app.cms_rpc', 'true', true);
    alter table ${table} disable trigger user;
    insert into ${table}
    select (jsonb_populate_record(null::${table}, image)).*
      from jsonb_array_elements($j$${JSON.stringify(images)}$j$::jsonb) as t(image);
    alter table ${table} enable trigger user;
    commit;`);
};

/** Inserts one copy of the committed `templateId` row per override object (the override wins per column). */
export const cloneRows = (
  table: string,
  templateId: string,
  overrides: readonly Json[],
): void => {
  if (overrides.length === 0) return;
  psql(`
    begin;
    select set_config('app.cms_rpc', 'true', true);
    alter table ${table} disable trigger user;
    insert into ${table}
    select (jsonb_populate_record(null::${table}, to_jsonb(template.*) || override)).*
      from ${table} template,
           jsonb_array_elements($j$${JSON.stringify(overrides)}$j$::jsonb) as t(override)
     where template.id = '${templateId}';
    alter table ${table} enable trigger user;
    commit;`);
};

/** Runs one UPDATE statement on a guarded table with its USER triggers disabled. */
export const rawUpdate = (table: string, statement: string): void => {
  psql(`
    begin;
    select set_config('app.cms_rpc', 'true', true);
    alter table ${table} disable trigger user;
    ${statement};
    alter table ${table} enable trigger user;
    commit;`);
};

const at = (iso: string, seconds: number): string =>
  new Date(Date.parse(iso) + seconds * 1000).toISOString();

/** A reviewer assignment image (`s11_assignment_row`): active, version 1, `cms.editorial_review`. */
export const assignmentImage = (input: {
  organizationId: string;
  reviewId: string;
  reviewerPersonId: string;
  grantorPersonId: string;
  state?: 'active' | 'revoked';
  createdAt: string;
  startsAt: string;
  endsAt: string;
}): Json => ({
  id: randomUUID(),
  owner_id: input.organizationId,
  review_id: input.reviewId,
  reviewer_person_id: input.reviewerPersonId,
  grantor_person_id: input.grantorPersonId,
  capability_key: 'cms.editorial_review',
  actions: ['read', 'decide'],
  state: input.state ?? 'active',
  starts_at: input.startsAt,
  ends_at: input.endsAt,
  reason: null,
  version: input.state === 'revoked' ? 2 : 1,
  created_at: input.createdAt,
  updated_at:
    input.state === 'revoked' ? at(input.createdAt, 60) : input.createdAt,
});

/** A recorded approve decision image (`s11_decision_row`) under the given assignment. */
export const decisionImage = (input: {
  organizationId: string;
  reviewId: string;
  reviewerPersonId: string;
  assignmentId: string;
  reviewedHash: string;
  decidedAt: string;
}): Json => ({
  id: randomUUID(),
  owner_id: input.organizationId,
  state: 'recorded',
  version: 1,
  review_id: input.reviewId,
  reviewer_person_id: input.reviewerPersonId,
  acting_party_id: input.organizationId,
  capability: 'cms.reviewer',
  assignment_id: input.assignmentId,
  assignment_version: 1,
  decision: 'approve',
  reason: 'Reads well; approved.',
  comment_hash: sha256('Reads well; approved.'),
  reviewed_hash: input.reviewedHash,
  step_up_at: at(input.decidedAt, -60),
  decided_at: input.decidedAt,
  created_at: input.decidedAt,
  updated_at: input.decidedAt,
});

/** A completed publication schedule image (`s11_schedule_row`) of the given entry, revision and review. */
export const scheduleImage = (input: {
  organizationId: string;
  entryId: string;
  revisionId: string;
  reviewId: string;
  createdBy: string;
  n: number;
}): Json => ({
  id: randomUUID(),
  owner_id: input.organizationId,
  entry_id: input.entryId,
  revision_id: input.revisionId,
  review_id: input.reviewId,
  dependency_hash: sha256('latency-dependency'),
  activation_evidence_hash: sha256('latency-activation'),
  action: 'publish',
  local_datetime: at('2027-02-01T09:00:00Z', input.n * 60).slice(0, 19),
  timezone: 'Europe/Paris',
  resolved_at_utc: at('2027-02-01T08:00:00Z', input.n * 60),
  local_datetime_submicro_ns: 0,
  resolved_utc_submicro_ns: 0,
  tzdb_version: '2026b',
  disambiguation: 'none',
  audience: `sched${String(input.n).padStart(2, '0')}`,
  state: 'completed',
  job_id: null,
  expected_version: 2,
  attempt_count: 0,
  next_attempt_at: null,
  lease_id: null,
  lease_until: null,
  reason_code: null,
  actual_at_utc: at('2027-02-01T08:00:01Z', input.n * 60),
  deviation_seconds: 1,
  version: 1,
  created_by: input.createdBy,
  created_at: at('2026-10-05T10:00:00Z', input.n * 60),
  updated_at: at('2026-10-05T10:00:00Z', input.n * 60),
});

/** An active `publish` lineage-root image (`s11_publication_row`) of the given entry and revision. */
export const publicationImage = (input: {
  organizationId: string;
  entryId: string;
  revisionId: string;
  publisherPersonId: string;
  schemaVersionId: string;
  artifactId: string;
  artifactHash: string;
  n: number;
}): Json => {
  const id = randomUUID();
  const stamp = at('2026-10-05T12:00:00Z', input.n * 60);
  return {
    id,
    owner_id: input.organizationId,
    publication_id: id,
    state: 'active',
    version: 1,
    supersedes_id: null,
    action: 'publish',
    entry_id: input.entryId,
    revision_id: input.revisionId,
    schedule_id: null,
    publisher_person_id: input.publisherPersonId,
    dependency_hash: sha256('latency-dependency'),
    activation_evidence_hash: sha256('latency-activation'),
    schema_artifact_id: input.artifactId,
    schema_artifact_hash: input.artifactHash,
    version_set: { settingsVersion: 1 },
    schema_version_id: input.schemaVersionId,
    template_version_id: null,
    taxonomy_version_ids: [],
    settings_version: 1,
    locale: 'en-US',
    audience: `aud${String(input.n).padStart(2, '0')}`,
    publication_hash: sha256(`latency-pub-${input.n}`),
    activated_at: stamp,
    revoked_at: null,
    created_at: stamp,
    updated_at: stamp,
  };
};
