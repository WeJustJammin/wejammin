import type { PatternVersionRequest } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { latestDetail } from './pattern-designer.test-support';
import {
  patternLatestIdentityValid,
  reconcileUnknownOutcome,
} from './pattern-outcome-reconcile';
import type { PatternLatestResult } from './pattern-latest-read';

const loaded = (
  overrides: Parameters<typeof latestDetail>[0] = {},
): PatternLatestResult => ({
  kind: 'loaded',
  detail: latestDetail(overrides),
});

/** What the person tried to save on top of version 2: the same content as `latestDetail()`. */
const attempt = (
  overrides: Partial<PatternVersionRequest> = {},
): PatternVersionRequest => {
  const detail = latestDetail();
  return {
    patternKey: detail.patternKey,
    compatibleTypeIds: [...detail.compatibleTypeIds],
    blockTree: detail.blockTree,
    expectedVersion: '2',
    ...overrides,
  };
};

describe('reconcileUnknownOutcome', () => {
  it('recognises its own committed successor: version base+1 with the attempted content', () => {
    const verdict = reconcileUnknownOutcome(
      attempt(),
      loaded({ version: '3', patternVersion: 3 }),
    );
    expect(verdict.kind).toBe('created');
    expect(verdict).toMatchObject({
      resource: { patternKey: 'profile-hero', version: '3', patternVersion: 3 },
    });
  });

  it('recognises its own committed first version', () => {
    const verdict = reconcileUnknownOutcome(
      attempt({ expectedVersion: null }),
      loaded({ version: '1', patternVersion: 1 }),
    );
    expect(verdict.kind).toBe('created');
  });

  it('is not created when the content or the types differ, or the version is not base+1', () => {
    for (const result of [
      loaded({ version: '3', patternVersion: 3, nodeCount: 1, blockTree: [] }),
      loaded({
        version: '3',
        patternVersion: 3,
        compatibleTypeIds: ['30000000-0000-4000-8000-000000000004'],
      }),
      loaded({ version: '4', patternVersion: 4 }),
    ])
      expect(reconcileUnknownOutcome(attempt(), result).kind).toBe(
        'undetermined',
      );
  });

  it('does not take another key for its own commit', () => {
    expect(
      reconcileUnknownOutcome(
        attempt(),
        loaded({
          version: '3',
          patternVersion: 3,
          patternKey: 'other-key',
        }),
      ).kind,
    ).toBe('undetermined');
  });

  it('is not saved when the latest is still the version the attempt was based on', () => {
    expect(reconcileUnknownOutcome(attempt(), loaded()).kind).toBe('not-saved');
  });

  it('is not saved when a first version is not found', () => {
    expect(
      reconcileUnknownOutcome(attempt({ expectedVersion: null }), {
        kind: 'rejected',
        status: 404,
      }).kind,
    ).toBe('not-saved');
  });

  it('cannot decide from a failed read or a 404 on a successor', () => {
    for (const result of [
      { kind: 'unavailable' },
      { kind: 'rejected', status: 403 },
      { kind: 'rejected', status: 404 },
    ] as const)
      expect(reconcileUnknownOutcome(attempt(), result).kind).toBe(
        'undetermined',
      );
    // A first version is "not saved" only on a 404; any other answer decides nothing.
    for (const result of [
      { kind: 'unavailable' },
      { kind: 'rejected', status: 401 },
      { kind: 'rejected', status: 403 },
      { kind: 'rejected', status: 429 },
    ] as const)
      expect(
        reconcileUnknownOutcome(attempt({ expectedVersion: null }), result)
          .kind,
      ).toBe('undetermined');
  });
});

describe('patternLatestIdentityValid', () => {
  const base = latestDetail();
  it('accepts a newer version, and the same version only with the same row and hash', () => {
    expect(
      patternLatestIdentityValid(base, latestDetail({ version: '3' })),
    ).toBe(true);
    expect(patternLatestIdentityValid(base, latestDetail())).toBe(true);
  });

  it('refuses an older version and a same-number version of another row or content', () => {
    expect(
      patternLatestIdentityValid(base, latestDetail({ version: '1' })),
    ).toBe(false);
    expect(
      patternLatestIdentityValid(
        base,
        latestDetail({ id: '20000000-0000-4000-8000-000000000009' }),
      ),
    ).toBe(false);
    expect(
      patternLatestIdentityValid(
        base,
        latestDetail({ contentHash: 'f'.repeat(64) }),
      ),
    ).toBe(false);
  });
});
