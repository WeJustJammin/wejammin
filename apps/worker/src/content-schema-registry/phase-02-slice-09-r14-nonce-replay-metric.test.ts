/**
 * SEC-3 (audit): a replayed release nonce is counted as a rejected nonce claim.
 *
 * The database raises CONFLICT with DETAIL RELEASE_NONCE_REPLAYED for a (release key,
 * nonce) pair it has already claimed (migration 20261003130500). The production adapter
 * must keep that distinction on the internal result, because a bare 409 is
 * indistinguishable from a registration-pair, digest or lifecycle conflict and was never
 * counted as `cms_release_nonce_claim_total{outcome="rejected"}`, so the
 * nonce_rejection_spike alert (which keys on an error code naming the nonce) could not
 * fire. The wire answer is unchanged: 409 CONFLICT with the BE00 CONFLICT details.
 */
import { describe, expect, it } from 'vitest';

import { buildContentSchemaRegistryOperationalSnapshot } from './operational-alert-metrics';
import { mapRpcFailure } from './production-errors';
import { registryMetrics } from './route-registry-metrics';
import { safeDetails } from './route-response-details';
import type { ContentSchemaRegistryError } from './types';

const REPLAY_PAYLOAD = {
  code: 'P0001',
  message: 'CONFLICT',
  details: 'RELEASE_NONCE_REPLAYED',
  hint: null,
} as const;

const REJECTED = 'cms_release_nonce_claim_total{outcome="rejected"}' as const;

describe('release nonce replay: adapter, metric and alert', () => {
  it('[P2-S09-AC-208] a database CONFLICT whose detail is RELEASE_NONCE_REPLAYED keeps the replay on the 409 result', () => {
    const replay = mapRpcFailure(400, REPLAY_PAYLOAD);
    expect(replay).toMatchObject({
      ok: false,
      status: 409,
      code: 'RELEASE_NONCE_REPLAY_CONFLICT',
    });
    expect(JSON.stringify(replay)).not.toContain('RELEASE_NONCE_REPLAYED');
    const plain = mapRpcFailure(400, { ...REPLAY_PAYLOAD, details: null });
    expect(plain).toMatchObject({ status: 409, code: 'CONFLICT' });
    // The detail is only a replay marker on a CONFLICT: it never turns another refusal into one.
    expect(
      mapRpcFailure(400, { ...REPLAY_PAYLOAD, message: 'FORBIDDEN' }),
    ).toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('[P2-S09-AC-208] the wire body of a replay is the ordinary BE00 CONFLICT with no replay text', () => {
    const replay = mapRpcFailure(
      400,
      REPLAY_PAYLOAD,
    ) as ContentSchemaRegistryError;
    expect(safeDetails(replay, 'CMS-03A-05')).toEqual({
      conflict: 'INVALID_TRANSITION',
      recoveryAction: 'refresh',
    });
  });

  it('[P2-S09-AC-208] CMS-03A-05 and CMS-03A-08 count a replayed nonce as a rejected nonce claim; other conflicts are not counted', () => {
    const replay = mapRpcFailure(400, REPLAY_PAYLOAD);
    const plainConflict = mapRpcFailure(400, {
      ...REPLAY_PAYLOAD,
      details: null,
    });
    for (const operation of ['CMS-03A-05', 'CMS-03A-08'] as const) {
      expect(registryMetrics(operation, replay, 12)[REJECTED]).toBe(1);
      expect(registryMetrics(operation, plainConflict, 12)[REJECTED]).toBe(
        undefined,
      );
    }
    // the executor's existing 401 rejection is still counted
    const unauthenticated = mapRpcFailure(400, {
      code: 'P0001',
      message: 'UNAUTHENTICATED',
      details: null,
    });
    expect(registryMetrics('CMS-03A-05', unauthenticated, 12)[REJECTED]).toBe(
      1,
    );
  });

  it('[P2-S09-AC-208] a replay is still a conflict for the conflict-rate counter', () => {
    const replay = mapRpcFailure(400, REPLAY_PAYLOAD);
    const keys = Object.keys(registryMetrics('CMS-03A-08', replay, 12));
    expect(
      keys.some((key) =>
        key.startsWith('cms_definition_conflict_total{operation="CMS-03A-08"'),
      ),
    ).toBe(true);
  });

  it('the nonce_rejection_spike inputs see a replay: its error code names the nonce and the conflict', () => {
    const now = Date.parse('2026-10-03T12:00:00.000Z');
    const event = (secondsAgo: number) => ({
      source: {
        eventName: 'cms.registry.command',
        operation: 'cms.registry.CMS-03A-08',
        errorCode: 'RELEASE_NONCE_REPLAY_CONFLICT',
        timestamp: new Date(now - secondsAgo * 1000).toISOString(),
        metrics: { request_status: 409 },
      },
    });
    const snapshot = buildContentSchemaRegistryOperationalSnapshot({
      database: {},
      events: [event(10), event(20), event(400)],
      now,
    });
    expect(snapshot.nonceRejectionRate).toBe(2);
    expect(snapshot.nonceRejectionBaseline).toBe(1);
    expect(snapshot.conflictRate).toBe(1);
  });
});
