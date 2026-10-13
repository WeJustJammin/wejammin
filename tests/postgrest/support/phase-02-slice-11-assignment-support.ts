/** Assignment-specific safe effect oracles. No fixture guard bypasses. */
import { expect } from 'vitest';

import {
  expectSafeEqual,
  type EffectSnapshot,
} from './phase-02-slice-11-assert';
import { psql } from './stack';

const ASSIGNMENTS = 'platform_private.cms_editorial_review_assignments';
const IDEMPOTENCY = 'platform_private.idempotency_records';
const AUDIT = 'audit_private.audit_events';
const OUTBOX = 'platform_private.outbox_events';

/** Ordinary assignment changes have exactly four effect groups; DEC-161 is separate. */
export const expectOrdinaryAssignmentEffects = (
  before: EffectSnapshot,
  after: EffectSnapshot,
  action: 'create' | 'revoke',
): void => {
  const deltas: Readonly<Record<string, number>> = {
    [ASSIGNMENTS]: action === 'create' ? 1 : 0,
    [IDEMPOTENCY]: 1,
    [AUDIT]: 1,
    [OUTBOX]: 1,
  };
  for (const table of Object.keys(before)) {
    if (!Object.hasOwn(deltas, table)) {
      expectSafeEqual(
        after[table],
        before[table],
        `${action} leaves ${table} byte-identical`,
      );
      continue;
    }
    const countBefore = Number(before[table]!.split(':')[0]);
    const countAfter = Number(after[table]!.split(':')[0]);
    expect(
      countAfter - countBefore,
      `${action} ${table} exact count delta`,
    ).toBe(deltas[table]);
    expect(
      after[table] !== before[table],
      `${action} changes full-row fingerprint`,
    ).toBe(true);
  }
};

/** SQL returns only booleans/counts; raw identities and event payloads stay in DB. */
export const expectAssignmentEvent = (
  reviewId: string,
  revisionId: string,
  reviewVersion: string,
  correlationId: string,
  action: 'create' | 'revoke',
): void => {
  const result = psql(`
    select
      (select count(*) = 1 and bool_and(
          action = 'cms.editorial.review.assignment.${action}'
          and target_type = 'cms_editorial_review'
          and target_id = '${reviewId}'::uuid
          and decision::text = 'allowed'
          and reason_code = 'CMS_EDITORIAL_REVIEW_ASSIGNMENT_CHANGED')
       from audit_private.audit_events where correlation_id = '${correlationId}'::uuid),
      (select count(*) = 1 and bool_and(
          event_type = 'cms.entry.review-changed.v1' and schema_version = 1
          and aggregate_type = 'cms_editorial_review'
          and aggregate_id = '${reviewId}'::uuid
          and aggregate_version = '${reviewVersion}'::bigint
          and payload = jsonb_build_object('reviewId', '${reviewId}', 'revisionId', '${revisionId}'))
       from platform_private.outbox_events where correlation_id = '${correlationId}'::uuid)`);
  expectSafeEqual(result, 't|t', 'exact assignment audit and event bindings');
};
