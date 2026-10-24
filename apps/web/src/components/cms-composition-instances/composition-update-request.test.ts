import { describe, expect, it } from 'vitest';

import {
  acceptRequest,
  detachRequests,
  planBulkAccept,
} from './composition-update-request';
import {
  diffOf,
  id,
  plainPath,
  propsPath,
  removedPath,
  structurePath,
} from './composition.test-support';

/*
 * CMS-03C-15 request construction (FE03 887, 1115, 1843; DEC-181, DEC-193): the entry `version` and each instance's
 * own `version` are the CAS operands, `choices` only on a single instance and covering every collision, bulk only when
 * nothing collides, never more than 32 instances in one request.
 */
describe('acceptRequest: one instance with its choices', () => {
  const diff = diffOf(1, [propsPath('/a'), plainPath('/b'), removedPath('/c')]);

  it('carries the target version, the instance version, one choice per collision and the entry version', () => {
    const built = acceptRequest(diff, { '/a': 'yours', '/c': 'theirs' }, '9');
    expect(built).toEqual({
      action: 'accept',
      targetPatternVersion: 2,
      instances: [
        {
          instanceId: id(1),
          expectedVersion: '3',
          choices: [
            { path: '/a', choice: 'yours' },
            { path: '/c', choice: 'theirs' },
          ],
        },
      ],
      expectedVersion: '9',
    });
  });

  it('refuses to build while a collision is unanswered (no automatic acceptance)', () => {
    expect(acceptRequest(diff, { '/a': 'yours' }, '9')).toBeNull();
    expect(acceptRequest(diff, {}, '9')).toBeNull();
  });

  it('accepts a version that changes none of the paths with no choice at all', () => {
    const none = diffOf(2, []);
    expect(acceptRequest(none, {}, '9')?.instances[0]?.choices).toEqual([]);
  });

  it('refuses an instance that has no newer version to accept', () => {
    const current = diffOf(3, [], {
      targetPatternVersion: 1,
      bulkEligible: false,
    });
    expect(acceptRequest(current, {}, '9')).toBeNull();
  });

  it('answers a structure collision with a choice just like any other kind', () => {
    const structural = diffOf(4, [structurePath('/s')]);
    expect(
      acceptRequest(structural, { '/s': 'theirs' }, '9')?.instances[0]?.choices,
    ).toEqual([{ path: '/s', choice: 'theirs' }]);
  });
});

describe('planBulkAccept: only when no instance collides', () => {
  const clean = (n: number, target = 2) =>
    diffOf(n, [plainPath()], { targetPatternVersion: target });

  it('plans one request for up to 32 clean instances, in selection order, without choices', () => {
    const plan = planBulkAccept([clean(1), clean(2)]);
    expect(plan).toEqual({
      ok: true,
      requests: [
        {
          targetPatternVersion: 2,
          instances: [
            { instanceId: id(1), expectedVersion: '3' },
            { instanceId: id(2), expectedVersion: '3' },
          ],
        },
      ],
    });
  });

  it('splits a selection above 32 into successive requests of at most 32 (DEC-181)', () => {
    const plan = planBulkAccept(
      Array.from({ length: 70 }, (_, i) => clean(i + 1)),
    );
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.requests.map((request) => request.instances.length)).toEqual([
        32, 32, 6,
      ]);
      expect(
        plan.requests.flatMap((request) =>
          request.instances.map((t) => t.instanceId),
        ),
      ).toEqual(Array.from({ length: 70 }, (_, i) => id(i + 1)));
    }
  });

  it('keeps instances with different target versions in different requests', () => {
    const plan = planBulkAccept([clean(1, 2), clean(2, 3), clean(3, 2)]);
    expect(
      plan.ok &&
        plan.requests.map((request) => [
          request.targetPatternVersion,
          request.instances.length,
        ]),
    ).toEqual([
      [2, 2],
      [3, 1],
    ]);
  });

  it('refuses a selection in which any instance collides or has no newer version', () => {
    expect(planBulkAccept([clean(1), diffOf(2, [propsPath()])])).toEqual({
      ok: false,
      reason: 'collision',
    });
    expect(
      planBulkAccept([
        diffOf(3, [], { targetPatternVersion: 1, bulkEligible: false }),
      ]),
    ).toEqual({ ok: false, reason: 'not_newer' });
  });
});

describe('detachRequests: successive requests of at most 32, no choices', () => {
  it('detaches one instance with the entry version and its own version', () => {
    expect(
      detachRequests([{ instanceId: id(1), expectedVersion: '3' }], '9'),
    ).toEqual([
      {
        action: 'detach',
        instances: [{ instanceId: id(1), expectedVersion: '3', choices: [] }],
        expectedVersion: '9',
      },
    ]);
  });

  it('splits 33 into 32 and 1', () => {
    const targets = Array.from({ length: 33 }, (_, i) => ({
      instanceId: id(i + 1),
      expectedVersion: '1',
    }));
    expect(
      detachRequests(targets, '9').map((request) => request.instances.length),
    ).toEqual([32, 1]);
  });
});
