/** TEST ONLY: pure assertion helpers; no runtime or database access. */
/** Effective correlation: cms_correlation() reads context.correlationId first (cfg_correlation, 20260901070000:496-509); the request-level correlationId key is accepted but never read. */
import assert from 'node:assert/strict';

const table = (name) => `platform_private.${name}`;
const omit = (value, keys) =>
  Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key)),
  );
const unchanged = (before, after, exceptions = []) => {
  assert.deepEqual(Object.keys(after), Object.keys(before));
  for (const key of Object.keys(before))
    if (!exceptions.includes(key)) {
      assert.deepEqual(
        after[key],
        before[key],
        `complete unchanged store: ${key}`,
      );
    }
};
const appended = (before, after, key, count) => {
  const old = new Map(before[key].map((row) => [row.id, row]));
  for (const [id, row] of old)
    assert.deepEqual(
      after[key].find((item) => item.id === id),
      row,
      `${key} history intact`,
    );
  const added = after[key].filter((row) => !old.has(row.id));
  assert.equal(added.length, count, `${key} exact append count`);
  return added;
};
const mutated = (before, after, keys) => {
  assert.deepEqual(
    omit(after, keys),
    omit(before, keys),
    'all immutable row members preserved',
  );
  assert.equal(after.version, before.version + 1);
  assert.ok(Date.parse(after.updated_at) >= Date.parse(before.updated_at));
};
const succeeded = (result) => {
  assert.equal(result?.state, '00000', JSON.stringify(result));
  assert.equal(result.callRole, 'service_role');
  assert.equal(result.scopeRestored, true);
};
const receipt = (row, response, status, resource, actor, keyHash) => {
  assert.equal(row.state, 'completed');
  assert.equal(row.operation, 'CMS-03B-09');
  assert.equal(row.actor_id, actor);
  assert.equal(row.key_hash, `\\x${keyHash}`);
  assert.deepEqual(row.response_ref, {
    status,
    resourceRef: resource,
    safeHeaders: { response },
  });
};
const activationEffects = (before, after, item, response, actors) => {
  const allowed = ['cms_pattern_versions', 'cms_governed_reviews'].map(table);
  allowed.push(
    table('idempotency_records'),
    table('outbox_events'),
    'audit_private.audit_events',
  );
  unchanged(before, after, allowed);
  for (const row of before[table('cms_pattern_versions')]) {
    const next = after[table('cms_pattern_versions')].find(
      (candidate) => candidate.id === row.id,
    );
    if (![item.child, item.next].includes(row.id)) assert.deepEqual(next, row);
    else {
      assert.deepEqual(
        omit(next, [
          'state',
          'lifecycle_version',
          'updated_at',
          'activated_at',
        ]),
        omit(row, ['state', 'lifecycle_version', 'updated_at', 'activated_at']),
      );
      assert.equal(next.lifecycle_version, row.lifecycle_version + 1);
      assert.equal(next.state, row.id === item.child ? 'superseded' : 'active');
      if (row.id === item.child)
        assert.equal(next.activated_at, row.activated_at);
      else assert.ok(Date.parse(next.activated_at));
    }
  }
  assert.equal(
    after[table('cms_pattern_versions')].length,
    before[table('cms_pattern_versions')].length,
  );
  for (const row of before[table('cms_governed_reviews')]) {
    const next = after[table('cms_governed_reviews')].find(
      (candidate) => candidate.id === row.id,
    );
    if (row.id === item.activation.reviewId)
      mutated(row, next, ['version', 'activated_at', 'updated_at']);
    else assert.deepEqual(next, row);
  }
  assert.equal(
    after[table('cms_governed_reviews')].length,
    before[table('cms_governed_reviews')].length,
  );
  const [record] = appended(before, after, table('idempotency_records'), 1);
  assert.equal(record.operation, 'CMS-03C-09');
  assert.equal(record.state, 'completed');
  assert.equal(record.actor_id, actors.activator);
  assert.deepEqual(record.response_ref, {
    status: 200,
    resourceRef: item.next,
    safeHeaders: { response },
  });
  const [audit] = appended(before, after, 'audit_private.audit_events', 1);
  const [event] = appended(before, after, table('outbox_events'), 1);
  assert.equal(audit.action, 'cms.governed.activate');
  assert.equal(audit.actor_id, actors.activator);
  assert.equal(audit.acting_party_id, actors.owner);
  assert.equal(audit.target_id, item.next);
  assert.equal(audit.correlation_id, item.activation.context.correlationId);
  assert.equal(event.correlation_id, item.activation.context.correlationId);
  assert.equal(event.event_type, 'cms.pattern.activated.v1');
  assert.equal(event.aggregate_id, item.next);
  assert.deepEqual(event.payload, {
    patternId: before[table('cms_pattern_versions')].find(
      (row) => row.id === item.child,
    ).pattern_id,
    patternVersionId: item.next,
  });
};
const publicationEffects = (
  before,
  after,
  initial,
  final,
  item,
  response,
  actors,
  refused,
) => {
  const changed = [
    'cms_publication_versions',
    'cms_command_accessibility_evidence',
    'idempotency_records',
    'outbox_events',
  ].map(table);
  changed.push('audit_private.audit_events');
  if (refused)
    changed.push(
      table('cms_editorial_reviews'),
      table('cms_publication_schedules'),
    );
  unchanged(before, after, changed);
  receipt(
    appended(before, after, table('idempotency_records'), 1)[0],
    response,
    refused ? 409 : 202,
    refused ? item.review : response.publicationVersionId,
    actors.publisher,
    final.keyHash,
  );
  const [audit] = appended(before, after, 'audit_private.audit_events', 1);
  const [event] = appended(before, after, table('outbox_events'), 1);
  assert.equal(audit.actor_id, actors.publisher);
  assert.equal(audit.acting_party_id, actors.owner);
  assert.equal(audit.correlation_id, item.publish.context.correlationId);
  assert.equal(event.correlation_id, item.publish.context.correlationId);
  if (refused) {
    assert.deepEqual(response, {
      kind: 'refusal',
      reasonCode: 'version_set_stale',
      details: {},
    });
    mutated(initial.review, final.review, [
      'state',
      'invalidated_reason',
      'decided_at',
      'version',
      'updated_at',
    ]);
    assert.equal(final.review.state, 'invalidated');
    assert.equal(final.review.invalidated_reason, 'dependency_changed');
    assert.equal(final.review.decided_at, null);
    assert.equal(initial.schedules.length, 1);
    assert.equal(final.schedules.length, 1);
    mutated(initial.schedules[0], final.schedules[0], [
      'state',
      'reason_code',
      'next_attempt_at',
      'version',
      'updated_at',
    ]);
    assert.equal(final.schedules[0].state, 'cancelled');
    assert.equal(final.schedules[0].reason_code, 'approval_invalidated');
    assert.equal(final.schedules[0].next_attempt_at, null);
    assert.deepEqual(final.publications, []);
    assert.deepEqual(final.evidence, []);
    assert.equal(audit.action, 'cms.entry.review.invalidate');
    assert.equal(audit.target_id, item.review);
    assert.equal(event.event_type, 'cms.entry.review-changed.v1');
    assert.equal(event.aggregate_id, item.review);
    assert.equal(event.aggregate_version, final.review.version);
    assert.deepEqual(event.payload, {
      reviewId: item.review,
      revisionId: item.revision,
    });
    for (const name of ['cms_editorial_reviews', 'cms_publication_schedules']) {
      for (const row of before[table(name)].filter(
        (row) =>
          row.id !== (name.includes('reviews') ? item.review : item.schedule),
      )) {
        assert.deepEqual(
          after[table(name)].find((next) => next.id === row.id),
          row,
        );
      }
      assert.equal(after[table(name)].length, before[table(name)].length);
    }
  } else {
    assert.equal(response.revisionId, item.revision);
    assert.equal(final.publications.length, 1);
    const [publication] = appended(
      before,
      after,
      table('cms_publication_versions'),
      1,
    );
    assert.equal(publication.id, response.publicationVersionId);
    assert.deepEqual(
      [publication.version, publication.action, publication.state],
      [1, 'publish', 'active'],
    );
    assert.deepEqual(publication.version_set, item.publish.expectedVersionSet);
    assert.equal(publication.revision_id, item.revision);
    assert.equal(publication.dependency_hash, initial.review.dependency_hash);
    assert.equal(response.id, publication.publication_id);
    assert.equal(response.publicationHash, publication.publication_hash);
    assert.equal(audit.action, 'cms.publication.publish');
    assert.equal(audit.target_id, publication.id);
    assert.equal(event.event_type, 'cms.publication.changed.v1');
    assert.equal(event.aggregate_id, publication.publication_id);
    assert.equal(event.aggregate_version, 1);
    assert.deepEqual(event.payload, {
      entryId: item.entry,
      publicationVersionId: publication.id,
    });
    const [evidence] = appended(
      before,
      after,
      table('cms_command_accessibility_evidence'),
      1,
    );
    assert.deepEqual(
      [
        evidence.operation_id,
        evidence.subject_id,
        evidence.revision_id,
        evidence.owner_id,
      ],
      ['CMS-03B-09', publication.id, item.revision, actors.owner],
    );
    assert.deepEqual(
      [
        evidence.audit_event_id,
        evidence.outbox_event_id,
        evidence.correlation_id,
      ],
      [audit.id, event.id, item.publish.context.correlationId],
    );
  }
};

export { succeeded, activationEffects, publicationEffects };
