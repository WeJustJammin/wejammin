import type { RelatedContentRuleRequest } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  DRAFT_PATH,
  RULE_PATH,
  canonicalReads,
  dependencyFailure,
  draftAnswer,
  noRuleAnswer,
  rateLimited,
  ruleAnswer,
} from './related-conflict.test-support';
import { reconcileSave, recordedSave } from './related-reconcile';
import { ENTRY_ID, id } from './related-content.test-support';
import type { RelatedConflictSnapshot } from './related-content-types';

/**
 * [P2-S12-AC-271] FE03 1050: an unknown save is "recorded" only when the saved rule is the answer to the request: the
 * entry advanced by exactly one version and the same pins, exclusions and derived rule. Anything else is not recorded,
 * and a read that did not verify decides nothing.
 */
const request = (
  extra: Partial<RelatedContentRuleRequest> = {},
): RelatedContentRuleRequest => ({
  entryId: ENTRY_ID,
  pins: [id(1)],
  exclusions: [id(3)],
  derivedRule: {
    key: 'shared-terms',
    version: '1',
    reasonCode: 'shared_terms',
    maxCandidates: 12,
  },
  expectedVersion: '4',
  ...extra,
});
const rule = (extra: Record<string, unknown> = {}) =>
  ({
    id: id(9),
    version: '5',
    contentHash: 'b'.repeat(64),
    createdAt: 'x',
    updatedAt: 'x',
    state: 'active',
    sourceEntryId: ENTRY_ID,
    pins: [id(1)],
    exclusions: [id(3)],
    derivedRule: { key: 'shared-terms', version: '1' },
    eligibleCount: 2,
    ...extra,
  }) as unknown as RelatedConflictSnapshot['rule'];
const snapshot = (
  stored: RelatedConflictSnapshot['rule'],
): RelatedConflictSnapshot =>
  ({
    draft: {},
    rule: stored,
    expectedVersion: '5',
  }) as RelatedConflictSnapshot;

describe('recordedSave', () => {
  it('[P2-S12-AC-271] recognises the saved rule as the answer to the request', () => {
    expect(recordedSave(snapshot(rule()), request())).toEqual({
      version: '5',
      eligibleCount: 2,
      pins: [id(1)],
      exclusions: [id(3)],
      derivedRule: { key: 'shared-terms', version: '1' },
    });
    expect(
      recordedSave(
        snapshot(rule({ derivedRule: null })),
        request({ derivedRule: null }),
      )?.derivedRule,
    ).toBeNull();
  });

  it.each([
    ['no saved rule', snapshot(null), request()],
    [
      'an entry that did not advance by one',
      snapshot(rule({ version: '7' })),
      request(),
    ],
    [
      'a version that is not a version',
      snapshot(rule()),
      request({ expectedVersion: 'x' }),
    ],
    ['other pins', snapshot(rule({ pins: [id(2)] })), request()],
    [
      'pins in another order',
      snapshot(rule({ pins: [id(2), id(1)] })),
      request({ pins: [id(1), id(2)] }),
    ],
    ['other exclusions', snapshot(rule({ exclusions: [] })), request()],
    [
      'a derived rule the request did not ask for',
      snapshot(rule()),
      request({ derivedRule: null }),
    ],
    [
      'no derived rule where one was asked',
      snapshot(rule({ derivedRule: null })),
      request(),
    ],
    [
      'another rule key',
      snapshot(
        rule({ derivedRule: { key: 'same-type-recent', version: '1' } }),
      ),
      request(),
    ],
    [
      'another rule version',
      snapshot(rule({ derivedRule: { key: 'shared-terms', version: '2' } })),
      request(),
    ],
  ])('finds %s not recorded', (_name, saved, asked) => {
    expect(recordedSave(saved, asked)).toBeNull();
  });
});

describe('reconcileSave', () => {
  const input = () => ({
    signal: new AbortController().signal,
    isCurrent: () => true,
  });

  it('[P2-S12-AC-271] reports a recorded save, a verified read without it, and a read that decided nothing', async () => {
    const recorded = await reconcileSave(request(), {
      ...input(),
      fetcher: canonicalReads({
        [DRAFT_PATH]: () => draftAnswer('5'),
        [RULE_PATH]: () =>
          ruleAnswer({
            version: '5',
            pins: [id(1)],
            exclusions: [id(3)],
            derivedRule: { key: 'shared-terms', version: '1' },
          }),
      }) as unknown as typeof fetch,
    });
    expect(recorded.kind).toBe('recorded');
    const none = await reconcileSave(request(), {
      ...input(),
      fetcher: canonicalReads({
        [DRAFT_PATH]: () => draftAnswer('4'),
        [RULE_PATH]: () => noRuleAnswer(),
      }) as unknown as typeof fetch,
    });
    expect(none).toEqual({ kind: 'not_recorded' });
    const failed = await reconcileSave(request(), {
      ...input(),
      fetcher: vi.fn(async () =>
        dependencyFailure(false),
      ) as unknown as typeof fetch,
    });
    expect(failed).toEqual({ kind: 'unverified', retryAfterSeconds: null });
    const limited = await reconcileSave(request(), {
      ...input(),
      fetcher: canonicalReads({
        [DRAFT_PATH]: () => rateLimited(5),
      }) as unknown as typeof fetch,
    });
    expect(limited).toEqual({ kind: 'unverified', retryAfterSeconds: 5 });
  });
});
