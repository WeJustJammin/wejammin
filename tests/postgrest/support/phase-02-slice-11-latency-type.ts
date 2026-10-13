/**
 * The 128-field content type and the 128-value draft entries of the Slice 11 read-latency world.
 *
 * Mirrors `supabase/tests/phase_02_slice_11_reads_bench128/000-world.sqlinc` for the composed measurement: the
 * type is created by the REAL CMS-03A-01 route (a designer member of the shared owner's organization) and receives
 * the terminal state of an activation with the REAL seeded editorial workflow policy, exactly as
 * `cms-editorial-world.ts` and the SQL bench do. The entries are written by SQL in the RPC context, because the
 * CMS-03B-10 route serves only compiled types and a 128-field aggregate is the bound under measurement, not the
 * authoring path. Commits fixtures.
 */
import { randomUUID } from 'node:crypto';

import { expect } from 'vitest';

import { createCmsApp, draftTypeBody, ownerSession } from './cms-app';
import { addMember, type S11World } from './phase-02-slice-11-world';
import { psql } from './stack';

/** The type key prefix that marks the latency world's type (`lat128_<uuid>`), found again by a rerun. */
export const LATENCY_TYPE_PREFIX = 'lat128';
export const LATENCY_FIELD_COUNT = 128;

export type LatencyType = Readonly<{
  typeId: string;
  versionId: string;
}>;

export type LatencyEntry = Readonly<{
  entryId: string;
  revisionId: string;
  /** The committed entry version, the operand of a submission's If-Match. */
  entryVersion: '1';
}>;

const fieldBody = (index: number) => ({
  stableFieldId: randomUUID(),
  key: `f${String(index).padStart(3, '0')}`,
  kind: 'short_text',
  constraints: {},
  required: false,
  validatorKey: null,
  validatorVersion: null,
  defaultMode: 'none',
  localizationMode: 'none',
  editorConfig: { label: `Field ${index}`, order: index },
  lifecycle: 'active',
});

/** The latency world's type when an earlier run of this suite already committed one. */
const findLatencyType = (organizationId: string): LatencyType | undefined => {
  const row = psql(`
    select type_row.id || '|' || version_row.id
      from platform_private.cms_content_types type_row
      join platform_private.cms_content_type_versions version_row
        on version_row.content_type_id = type_row.id
     where version_row.owner_id = '${organizationId}'
       and type_row.state = 'active' and version_row.state::text = 'active'
       and left(type_row.type_key, ${LATENCY_TYPE_PREFIX.length + 1}) = '${LATENCY_TYPE_PREFIX}_'
       and (select count(*) from platform_private.cms_field_definition_versions field
             where field.content_type_version_id = version_row.id) = ${LATENCY_FIELD_COUNT}
     order by version_row.created_at limit 1`);
  if (row === '') return undefined;
  const [typeId = '', versionId = ''] = row.split('|');
  return { typeId, versionId };
};

/** The terminal state of an activation with the real editorial policy member (see `cms-editorial-world.ts`). */
const activate = (type: LatencyType): void => {
  psql(`
    begin;
    select set_config('app.cms_rpc', 'true', true);
    update platform_private.cms_content_type_versions version_row
       set state = 'active', version = version_row.version + 1,
           activation_workflow_policy_key = member.m->>'key',
           activation_workflow_policy_version = (member.m->>'version')::bigint,
           activation_workflow_policy_hash = member.m->>'policyHash',
           activation_required_decision_count = (member.m->>'requiredDecisionCount')::integer,
           activation_required_capabilities = member.m->'requiredCapabilities',
           activation_approval_evidence_hash = repeat('b', 64),
           updated_at = clock_timestamp()
      from (select platform_private.cms_workflow_policy_member('editorial', 1) as m) member
     where version_row.id = '${type.versionId}';
    update platform_private.cms_content_types
       set state = 'active', version = version + 1, updated_at = clock_timestamp()
     where id = '${type.typeId}';
    commit;`);
};

/** Creates (or finds) the active 128-field type through the real registry route. */
export const ensureLatencyType = async (
  world: Pick<S11World, 'organizationId' | 'owner'>,
): Promise<LatencyType> => {
  const existing = findLatencyType(world.organizationId);
  if (existing !== undefined) return existing;
  const designer = addMember(world.organizationId, world.owner.personId, [
    'cms.schema_designer',
  ]);
  const registry = createCmsApp(
    ownerSession(designer.authUserId, designer.organizationId, [
      'cms.schema_designer',
    ]),
  );
  const created = await registry.send('POST', '/api/v1/cms/content-types', {
    body: {
      ...draftTypeBody(
        `${LATENCY_TYPE_PREFIX}_${randomUUID().replaceAll('-', '')}`,
      ),
      fields: Array.from({ length: LATENCY_FIELD_COUNT }, (_, index) =>
        fieldBody(index + 1),
      ),
    },
  });
  expect(created.status, 'the 128-field draft is created').toBe(201);
  const type = {
    typeId: String(created.body.contentTypeId),
    versionId: String(created.body.id),
  };
  activate(type);
  expect(findLatencyType(world.organizationId)).toEqual(type);
  return type;
};

/**
 * An active entry (version 1) of the 128-field type with ONE draft revision that carries 128 values and the true
 * projection hash. The owner holds the author and editor assignments on it, as the creator of a Studio entry does.
 */
export const createLatencyEntry = (
  world: Pick<S11World, 'organizationId' | 'owner'>,
  type: LatencyType,
): LatencyEntry => {
  const entryId = randomUUID();
  const revisionId = randomUUID();
  const org = world.organizationId;
  const person = world.owner.personId;
  psql(`
    begin;
    select set_config('app.cms_rpc', 'true', true);
    insert into platform_private.cms_content_entries(
      id, owner_id, content_type_id, owner_party_id, lifecycle, current_draft_revision_id,
      version, created_by, created_at, updated_at)
    values ('${entryId}', '${org}', '${type.typeId}', '${org}', 'active', null, 1,
            '${world.owner.authUserId}', now(), now());
    insert into platform_private.cms_entry_revisions(
      id, owner_id, entry_id, revision_number, schema_version_id, template_version_id,
      taxonomy_version_ids, parent_revision_ids, locale, payload_hash, author_person_id,
      acting_party_id, state, version, validation_state, validation_report, created_at, updated_at)
    select '${revisionId}', '${org}', '${entryId}', 1, '${type.versionId}', null,
           '[]'::jsonb, '[]'::jsonb, 'en-US',
           platform_private.cms_jcs_sha256(jsonb_object_agg(field.stable_field_id::text, to_jsonb('Value ' || field.field_key))),
           '${person}', '${org}', 'draft', 1, 'valid', '{}'::jsonb, now(), now()
      from platform_private.cms_field_definition_versions field
     where field.content_type_version_id = '${type.versionId}';
    insert into platform_private.cms_entry_field_values(
      owner_id, state, version, revision_id, field_id, field_definition_id, locale, value,
      provenance, value_hash, created_at, updated_at)
    select '${org}', 'active', 1, '${revisionId}', field.stable_field_id, field.id, 'en-US',
           to_jsonb('Value ' || field.field_key), 'authored',
           platform_private.cms_jcs_sha256(to_jsonb('Value ' || field.field_key))::char(64),
           now(), now()
      from platform_private.cms_field_definition_versions field
     where field.content_type_version_id = '${type.versionId}';
    update platform_private.cms_content_entries
       set current_draft_revision_id = '${revisionId}' where id = '${entryId}';
    insert into platform_private.cms_entry_assignments(
      owner_id, entry_id, assignee_person_id, capability_key, state, version, created_at, updated_at)
    values ('${org}', '${entryId}', '${person}', 'cms.author', 'active', 1, now(), now()),
           ('${org}', '${entryId}', '${person}', 'cms.editor', 'active', 1, now(), now());
    commit;`);
  expect(
    psql(
      `select count(*) from platform_private.cms_entry_field_values where revision_id = '${revisionId}'`,
    ),
    'the draft revision carries 128 values',
  ).toBe(String(LATENCY_FIELD_COUNT));
  return { entryId, revisionId, entryVersion: '1' };
};
