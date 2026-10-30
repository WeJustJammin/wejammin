import { describe, expect, it } from 'vitest';

import {
  headingOf,
  isCapabilityDenial,
  resultCopy,
} from './pattern-status-copy';

describe('pattern status copy', () => {
  it('states a rate limit with and without the stated wait', () => {
    expect(resultCopy({ kind: 'rejected', status: 429 })).toBe(
      'The request was rate-limited. Wait before retrying.',
    );
    expect(
      resultCopy({ kind: 'rejected', status: 429, retryAfterSeconds: 7 }),
    ).toBe(
      'The request was rate-limited. Wait at least 7 seconds before retrying.',
    );
  });

  it('names the heading by outcome and the capability denial by 403 only', () => {
    expect(headingOf({ kind: 'uncertain' })).toBe('The result is unknown');
    expect(headingOf({ kind: 'conflict', currentVersion: '2' })).toBe(
      'Another version was saved',
    );
    expect(headingOf({ kind: 'rejected', status: 503 })).toBe(
      'The pattern was not saved',
    );
    expect(isCapabilityDenial({ kind: 'rejected', status: 403 })).toBe(true);
    expect(isCapabilityDenial({ kind: 'rejected', status: 404 })).toBe(false);
    expect(isCapabilityDenial({ kind: 'uncertain' })).toBe(false);
  });
});
