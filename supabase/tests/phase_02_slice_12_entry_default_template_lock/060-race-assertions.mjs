import assert from 'node:assert/strict';
import { jsonb, lastJson, sql } from './030-race-fixture.mjs';

async function stored(session, fixture, response, label) {
  const revision = response.revision.id;
  return lastJson(
    await session.query(`select jsonb_build_object(
    'entry', (select to_jsonb(e) from platform_private.cms_content_entries e
      where id = ${sql(response.entry.id)}::uuid),
    'revision', (select to_jsonb(r) from platform_private.cms_entry_revisions r
      where id = ${sql(revision)}::uuid),
    'fields', (select jsonb_object_agg(field_id::text, value)
      from platform_private.cms_entry_field_values where revision_id = ${sql(revision)}::uuid),
    'relations', (select jsonb_agg(jsonb_build_array(field_id, field_definition_id,
      target_kind, target_id, expected_target_version, position, on_unavailable) order by position)
      from platform_private.cms_entry_relations where revision_id = ${sql(revision)}::uuid),
    'assignments', (select jsonb_agg(jsonb_build_array(owner_id, assignee_person_id,
      capability_key, state, version) order by id) from platform_private.cms_entry_assignments
      where entry_id = ${sql(response.entry.id)}::uuid),
    'counts', jsonb_build_array((select count(*) from platform_private.cms_content_entries),
      (select count(*) from platform_private.cms_entry_revisions)),
    'expectedHash', platform_private.cms_jcs_sha256(${jsonb({
      [fixture.titleField]: `EDTL ${label}`,
    })}));`),
  );
}

function publicSuccess(result, body) {
  assert.equal(
    result.role,
    'service_role',
    'real public SQL service-role caller',
  );
  assert.equal(result.state, '00000', `public create: ${result.message ?? ''}`);
  assert.deepEqual(Object.keys(result.response).sort(), [
    'contentHash',
    'entry',
    'lifecycle',
    'locale',
    'revision',
    'revisionNumber',
    'state',
    'validationState',
  ]);
  assert.equal(result.response.revisionNumber, '1');
  assert.equal(result.response.lifecycle, 'active');
  assert.equal(result.response.state, 'draft');
  assert.equal(result.response.locale, 'en-US');
  assert.equal(result.response.validationState, 'valid');
  assert.equal(result.response.entry.version, '1');
  assert.equal(result.response.revision.version, '1');
  assert.ok(
    !Object.keys(body).some((key) =>
      /template|ifMatch|expectedVersion/i.test(key),
    ),
    'strict create carries no template operand or new concurrency header',
  );
}

function literalRows(actual, fixture, response, label, before) {
  const entry = actual.entry;
  const revision = actual.revision;
  assert.equal(entry.id, response.entry.id);
  assert.equal(entry.owner_id, fixture.actor.party);
  assert.equal(entry.owner_party_id, fixture.actor.party);
  assert.equal(entry.content_type_id, fixture.type);
  assert.equal(entry.created_by, fixture.actor.auth);
  assert.equal(entry.lifecycle, 'active');
  assert.equal(entry.version, 1);
  assert.equal(entry.current_draft_revision_id, revision.id);
  assert.equal(revision.id, response.revision.id);
  assert.equal(revision.owner_id, fixture.actor.party);
  assert.equal(revision.entry_id, entry.id);
  assert.equal(revision.schema_version_id, fixture.schema);
  assert.equal(revision.revision_number, 1);
  assert.equal(revision.version, 1);
  assert.equal(revision.state, 'draft');
  assert.equal(revision.locale, 'en-US');
  assert.equal(revision.author_person_id, fixture.actor.person);
  assert.equal(revision.acting_party_id, fixture.actor.party);
  assert.deepEqual(revision.parent_revision_ids, []);
  assert.deepEqual(actual.fields, { [fixture.titleField]: `EDTL ${label}` });
  assert.deepEqual(actual.relations, [
    [
      fixture.relationField,
      fixture.relationFieldDefinition,
      'content',
      fixture.target,
      null,
      0,
      'omit',
    ],
  ]);
  assert.deepEqual(actual.assignments, [
    [fixture.actor.party, fixture.actor.person, 'cms.author', 'active', 1],
  ]);
  assert.equal(
    response.contentHash,
    actual.expectedHash,
    'independent literal field hash',
  );
  assert.equal(revision.payload_hash, actual.expectedHash);
  assert.deepEqual(
    actual.counts,
    [
      before['platform_private.cms_content_entries'].count + 1,
      before['platform_private.cms_entry_revisions'].count + 1,
    ],
    'exactly one entry and first revision in the caller transaction',
  );
}

function order(observation, mode) {
  assert.equal(
    observation.gate.kind,
    'blocked',
    `ORDER: create crossed held ${mode === 'A' ? 'relation2' : 'default3'} without waiting`,
  );
  assert.equal(
    observation.held,
    '55P03',
    'exact held tuple still locked at observation',
  );
  assert.equal(
    observation.after.blocked,
    true,
    'same owned blocker still held before release',
  );
  if (mode === 'A') {
    assert.equal(
      observation.template,
      'free',
      'ORDER: default3 must remain free while waiting at relation2',
    );
  } else {
    assert.equal(
      observation.target,
      '55P03',
      'ORDER: relation2 must already be fenced before default3',
    );
  }
  assert.equal(
    observation.schema,
    'free',
    'ORDER: schema4 must remain free before the earlier dependency',
  );
}

export { stored, publicSuccess, literalRows, order };
