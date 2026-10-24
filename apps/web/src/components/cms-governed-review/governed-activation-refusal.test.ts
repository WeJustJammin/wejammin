import { describe, expect, it } from 'vitest';

import type { GovernedRefusal } from './governed-review-command-transport';
import {
  GOVERNED_REASONS,
  governedReasonStatus,
} from './governed-review-reasons';
import { classifyGovernedRefusal } from './governed-review-refusal';

const refusal = (
  reason: string | null,
  status: number,
  domain: string | null = null,
): GovernedRefusal => ({
  status,
  code: 'GOVERNED_REVIEW_VERSION_CONFLICT',
  reason: null,
  details: null,
  conflict: null,
  violations: [],
  retryAfterSeconds: null,
  preflightUnavailable: false,
  requestId: 'req-9',
  governed: { reason, domain },
});

const classify = (reason: string, status: number, domain?: string) =>
  classifyGovernedRefusal(
    'CMS-03C-09',
    refusal(reason, status, domain ?? null),
  );

describe('CMS-03C-09 refusal copy', () => {
  it.each([
    [
      'subject_not_activatable',
      'This version can no longer be activated or scheduled. Its state changed; review it before acting again.',
    ],
    [
      'subject_not_retirable',
      'Only an active version can be retired, and this version is not active now.',
    ],
    [
      'activation_conflict',
      'Another version of this lineage was activated first. Nothing changed. Review the current state before acting again.',
    ],
    ['schedule_exists', 'This version already has a scheduled activation.'],
    [
      'dependency_changed',
      'A dependency of this version changed, so its review was invalidated and the version is back to draft. Nothing was activated or scheduled.',
    ],
  ])('says %s in fixed words, then re-reads the review', (reason, message) => {
    expect(classify(reason, 409)).toMatchObject({
      kind: 'refetch',
      message,
      rotateKey: true,
      refetch: true,
      fields: [],
      requestId: 'req-9',
    });
  });

  it('names the unbuilt canonical domain of a vocabulary', () => {
    expect(
      classify('canonical_source_unavailable', 422, 'rights'),
    ).toMatchObject({
      kind: 'field',
      message:
        'The rights reference list is not available yet, so this vocabulary cannot be activated or scheduled.',
      refetch: false,
      rotateKey: true,
    });
    expect(classify('canonical_source_unavailable', 422)?.message).toBe(
      'A reference list this vocabulary declares is not available yet, so it cannot be activated or scheduled.',
    );
  });

  it.each([
    ['unknown_timezone', 'That time zone is not recognised.', 'timezone'],
    [
      'tzdb_version_mismatch',
      'The time zone data changed. Reload the page and choose the time again.',
      'timezone',
    ],
    [
      'nonexistent_local_time',
      'That local time does not exist in this time zone.',
      'localDateTime',
    ],
    [
      'ambiguous_local_time',
      'That local time happens twice. Choose the earlier or later one.',
      'disambiguation',
    ],
    [
      'disambiguation_not_applicable',
      'Earlier or later applies only to a local time that happens twice.',
      'disambiguation',
    ],
    [
      'resolved_utc_mismatch',
      'The resolved time did not match. Choose the time again.',
      'localDateTime',
    ],
    [
      'schedule_out_of_horizon',
      'Choose a time between one minute and 366 days from now.',
      'localDateTime',
    ],
    [
      'authority_ends_before_schedule',
      'Your owner access ends before this time. Choose an earlier time.',
      'localDateTime',
    ],
  ])('says the time token %s at its control', (reason, message, field) => {
    expect(classify(reason, 422)).toMatchObject({
      kind: 'field',
      message,
      fields: [field],
      refetch: false,
      rotateKey: true,
    });
  });

  it('speaks every token of the operation except the 403 the shared table already speaks', () => {
    const unspoken = GOVERNED_REASONS['CMS-03C-09'].filter(
      (reason) =>
        classify(reason, governedReasonStatus(reason) as number) === null,
    );
    expect(unspoken).toEqual(['capability_missing']);
  });

  it('defers a bare conflict and a capability refusal to the shared table', () => {
    expect(classify('capability_missing', 403)).toBeNull();
    expect(
      classifyGovernedRefusal('CMS-03C-09', refusal(null, 409)),
    ).toBeNull();
  });
});
