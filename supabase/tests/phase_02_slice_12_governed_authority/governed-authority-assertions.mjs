/** Full-row oracles. These read through administrative probes, never the application writer. */
import assert from 'node:assert/strict';

import { queryValue } from './governed-authority-execution.mjs';
import { check, jsonb, sql } from './governed-authority-processes.mjs';
import {
  ranAsServiceRole,
  responseOf,
  sqlError,
} from './governed-authority-sessions.mjs';

/** One SQL snapshot; every row in each covered table is ordered by its unique primary key. */
export const snapshot = async () => {
  const serialized = await queryValue(`select jsonb_build_object(
  'reviews', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb)
    from platform_private.cms_governed_reviews r),
  'dependencies', (select coalesce(jsonb_agg(to_jsonb(d) order by d.id), '[]'::jsonb)
    from platform_private.cms_governed_review_dependencies d),
  'subjects', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb)
    from platform_private.cms_template_versions t),
  'audit', (select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb)
    from audit_private.audit_events a),
  'outbox', (select coalesce(jsonb_agg(to_jsonb(o) order by o.id), '[]'::jsonb)
    from platform_private.outbox_events o),
  'idempotency', (select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]'::jsonb)
    from platform_private.idempotency_records i))::text;`);
  // Retain PostgreSQL's bytes too: JSON.parse can round large persisted bigint/numeric values.
  return { ...JSON.parse(serialized), serialized };
};

const onlyAdded = (before, after, count, label) => {
  const oldIds = new Set(before.map((row) => row.id));
  assert.deepEqual(
    after.filter((row) => oldIds.has(row.id)),
    before,
    `${label}: old rows changed`,
  );
  const added = after.filter((row) => !oldIds.has(row.id));
  assert.equal(added.length, count, `${label}: wrong number of added rows`);
  return added;
};

const fields = (row, keys) =>
  Object.fromEntries(keys.map((key) => [key, row[key]]));

export const assertSubmissionEffects = async (
  ids,
  request,
  outcome,
  before,
) => {
  assert.equal(
    outcome.code,
    0,
    `S1 submit failed: ${JSON.stringify(sqlError(outcome))}`,
  );
  assert.equal(
    ranAsServiceRole(outcome),
    true,
    'S1 command did not run as service_role',
  );
  const response = responseOf(outcome);
  const after = await snapshot();
  const [review] = onlyAdded(before.reviews, after.reviews, 1, 'review');
  const original = before.subjects.find((row) => row.id === request.subjectId);
  const current = after.subjects.find((row) => row.id === request.subjectId);
  assert.ok(original && current, 'S1 subject is missing');
  assert.deepEqual(
    fields(review, [
      'owner_id',
      'state',
      'version',
      'subject_kind',
      'subject_id',
      'lineage_id',
      'subject_key',
      'subject_version',
      'subject_hash',
      'block_registry_digest',
      'submitted_by',
      'risk_class',
      'required_decision_count',
      'recorded_decision_count',
    ]),
    {
      owner_id: ids.org,
      state: 'open',
      version: 1,
      subject_kind: 'template_version',
      subject_id: request.subjectId,
      lineage_id: original.template_id,
      subject_key: original.template_key,
      subject_version: original.version,
      subject_hash: original.content_hash,
      block_registry_digest: original.block_registry_digest,
      submitted_by: ids.person,
      risk_class: 'ordinary',
      required_decision_count: 1,
      recorded_decision_count: 0,
    },
    'S1 review must freeze the exact ordinary subject definition',
  );
  assert.ok(response, 'S1 did not return a review body');
  assert.deepEqual(
    fields(response, [
      'id',
      'state',
      'version',
      'subjectKind',
      'subjectId',
      'lineageId',
      'subjectKey',
      'subjectVersion',
      'subjectHash',
      'riskClass',
      'requiredDecisionCount',
      'recordedDecisionCount',
    ]),
    {
      id: review.id,
      state: 'open',
      version: '1',
      subjectKind: 'template_version',
      subjectId: original.id,
      lineageId: original.template_id,
      subjectKey: original.template_key,
      subjectVersion: original.version,
      subjectHash: original.content_hash,
      riskClass: 'ordinary',
      requiredDecisionCount: 1,
      recordedDecisionCount: 0,
    },
    'S1 response must identify the persisted review and frozen definition',
  );
  assert.deepEqual(
    after.subjects,
    before.subjects.map((row) =>
      row.id === original.id
        ? {
            ...row,
            state: 'review',
            lifecycle_version: row.lifecycle_version + 1,
            updated_at: current.updated_at,
          }
        : row,
    ),
    'S1 may change only subject state, lifecycle counter and update time',
  );
  assert.ok(
    Date.parse(current.updated_at) >= Date.parse(original.updated_at),
    'S1 update time moved backwards',
  );
  check(
    true,
    'S1: exactly one open review freezes the unchanged definition; only lifecycle advances once',
  );

  const [dependency] = onlyAdded(
    before.dependencies,
    after.dependencies,
    1,
    'dependency',
  );
  assert.deepEqual(
    fields(dependency, [
      'owner_id',
      'state',
      'version',
      'review_id',
      'kind',
      'ref_id',
    ]),
    {
      owner_id: ids.org,
      state: 'active',
      version: 1,
      review_id: review.id,
      kind: 'content_type',
      ref_id: ids.typeVersion,
    },
    'S1 must freeze the bound ACTIVE content-type VERSION, not the lineage or another type',
  );
  assert.equal(
    dependency.updated_at,
    dependency.created_at,
    'dependency is immutable',
  );
  check(
    true,
    'S1: exact content_type dependency identity and immutable envelope persisted',
  );

  const [audit] = onlyAdded(before.audit, after.audit, 1, 'audit');
  assert.deepEqual(
    fields(audit, [
      'action',
      'actor_id',
      'acting_party_id',
      'target_type',
      'target_id',
      'reason_code',
      'correlation_id',
    ]),
    {
      action: 'cms.governed.review.submit',
      actor_id: ids.auth,
      acting_party_id: ids.org,
      target_type: 'cms_governed_review',
      target_id: review.id,
      reason_code: 'CMS_GOVERNED_REVIEW_SUBMITTED',
      correlation_id: request.context.correlationId,
    },
    'S1 audit must identify this command, actor, party and review',
  );
  assert.deepEqual(
    after.outbox,
    before.outbox,
    'S1 must not add or modify any outbox row',
  );
  check(
    true,
    'S1: exactly one attributable audit and the entire outbox unchanged',
  );

  const [reservation] = onlyAdded(
    before.idempotency,
    after.idempotency,
    1,
    'idempotency',
  );
  const expectedHashes = JSON.parse(
    await queryValue(`select jsonb_build_object(
    'key_hash', platform_private.cms_key_hash(${sql(request.idempotencyKey)}),
    'request_hash', extensions.digest(platform_private.cms_request_hash(${jsonb(request)})
      || pg_catalog.uuid_send(${sql(ids.org)}::uuid), 'sha256'))::text;`),
  );
  assert.deepEqual(
    fields(reservation, [
      'actor_id',
      'operation',
      'state',
      'key_hash',
      'request_hash',
      'response_ref',
    ]),
    {
      actor_id: ids.auth,
      operation: 'CMS-03C-06',
      state: 'completed',
      ...expectedHashes,
      response_ref: {
        status: 201,
        resourceRef: review.id,
        safeHeaders: { response },
      },
    },
    'S1 requires this exact completed key/fingerprint/actor/response receipt',
  );
  check(
    true,
    'S1: exactly one completed idempotency row stores this request and exact 201 response',
  );
};

export const assertRefusal = async (outcome, before, label) => {
  assert.notEqual(outcome.code, 0, `${label}: expected refusal`);
  assert.equal(
    ranAsServiceRole(outcome),
    true,
    `${label}: writer did not run as service_role`,
  );
  assert.deepEqual(
    sqlError(outcome),
    { state: 'P0001', message: 'capability_missing' },
    `${label}: wrong refusal`,
  );
  assert.equal(
    responseOf(outcome),
    null,
    `${label}: leaked a successful/cached body`,
  );
  assert.deepEqual(
    await snapshot(),
    before,
    `${label}: refusal changed a covered store`,
  );
  check(
    true,
    `${label}: capability_missing; no cached body; all full ordered rows unchanged`,
  );
};
