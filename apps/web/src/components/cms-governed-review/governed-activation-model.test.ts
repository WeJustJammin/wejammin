import { describe, expect, it } from 'vitest';

import type { ScheduleResolution } from '../cms-editorial-workflow/cms-workflow-schedule-resolution';
import {
  governedActivationFixture,
  governedDetailFixture,
  governedRetiredFixture,
  governedScheduledFixture,
} from '../../server/cms-governed-review-fixtures.test-support';
import type { GovernedActivationCommitted } from './governed-activation-command-spec';
import {
  activationCommittedLabel,
  activationLocalErrors,
  confirmationSentence,
  type ActivationTyped,
} from './governed-activation-model';

const EMPTY: ScheduleResolution = { kind: 'empty' };
const RESOLVED: ScheduleResolution = {
  kind: 'resolved',
  resolvedUtc: '2026-12-01T14:00:00Z',
  offsetSeconds: -18_000,
  disambiguation: 'none',
};

const typed = (overrides: Partial<ActivationTyped> = {}): ActivationTyped => ({
  action: 'schedule',
  local: '2026-12-01T09:00',
  zone: 'America/New_York',
  reason: '',
  disambiguation: 'none',
  ...overrides,
});

const errors = (
  resolution: ScheduleResolution,
  overrides: Partial<ActivationTyped> = {},
) =>
  activationLocalErrors({
    offered: ['activate', 'schedule'],
    typed: typed(overrides),
    timeStatus: 'ready',
    resolution,
    reasonError: null,
  });

describe('activationLocalErrors for a schedule whose resolution is not resolved (FE03 :882, :902)', () => {
  it('names a non-empty local value the resolver cannot parse, on the local field', () => {
    expect(errors(EMPTY, { local: '12345-10-20T10:00' })).toEqual([
      {
        id: 'schedule-local',
        label: 'Local date and time',
        message: 'Enter a valid local date and time.',
      },
    ]);
  });

  it('accepts a resolved schedule with no error', () => {
    expect(errors(RESOLVED)).toEqual([]);
  });

  it('still asks for the missing inputs first, never the parse sentence', () => {
    const messages = (overrides: Partial<ActivationTyped>) =>
      errors(EMPTY, overrides).map((error) => error.message);
    expect(messages({ local: '' })).toEqual(['Choose a local date and time.']);
    expect(messages({ zone: '' })).toEqual(['Choose a time zone.']);
  });
});

describe('confirmationSentence is exhaustive by action', () => {
  const review = governedDetailFixture({});

  it('states each action it can state', () => {
    expect(
      confirmationSentence(review, typed({ action: 'activate' }), EMPTY),
    ).toBe('Activate Template profile-header, version 2 now.');
    expect(
      confirmationSentence(review, typed({ action: 'retire' }), EMPTY),
    ).toBe('Retire Template profile-header, version 2.');
    expect(confirmationSentence(review, typed(), RESOLVED)).toBe(
      'Schedule activation of Template profile-header, version 2 for 2026-12-01T09:00 in America/New_York (2026-12-01T14:00:00Z).',
    );
  });

  it('has no sentence for a schedule that did not resolve and none for no action, never the activate one', () => {
    expect(confirmationSentence(review, typed(), EMPTY)).toBeNull();
    expect(
      confirmationSentence(review, typed({ action: '' }), RESOLVED),
    ).toBeNull();
  });
});

describe('activationCommittedLabel names the superseded version (DEC-191, FE03 :882)', () => {
  const review = governedDetailFixture({});
  const committed = (
    resource: ReturnType<typeof governedActivationFixture>,
  ): GovernedActivationCommitted => ({
    version: resource.reviewVersion,
    reviewId: resource.reviewId,
    action: resource.action,
    subjectKind: resource.subjectKind,
    subjectVersion: resource.subjectVersion,
    supersededVersion: resource.supersededVersion,
    subjectState: resource.subjectState,
    activatedAt: resource.activatedAt,
    scheduledForUtc: resource.scheduledForUtc,
  });

  it('prints the activated and the superseded version, never "published"', () => {
    const label = activationCommittedLabel(
      review,
      committed(governedActivationFixture({ supersededVersion: 1 })),
    );
    expect(label).toBe(
      'Activated, not published: Template profile-header, version 2 is now the active version. Version 1 is now superseded.',
    );
    expect(label).not.toMatch(/Any version/u);
  });

  it('follows the number the answer carries', () => {
    expect(
      activationCommittedLabel(
        review,
        committed(governedActivationFixture({ supersededVersion: 41 })),
      ),
    ).toContain('Version 41 is now superseded.');
  });

  it('says nothing about a superseded version for a lineage first activation', () => {
    expect(
      activationCommittedLabel(
        review,
        committed(governedActivationFixture({ supersededVersion: null })),
      ),
    ).toBe(
      'Activated, not published: Template profile-header, version 2 is now the active version.',
    );
  });

  it('keeps the scheduled and retired sentences free of a superseded version', () => {
    expect(
      activationCommittedLabel(review, committed(governedScheduledFixture())),
    ).toBe(
      'Scheduled, not active: Template profile-header, version 2 will activate at 2026-12-01T14:00:00Z. Nothing changes before then.',
    );
    expect(
      activationCommittedLabel(review, committed(governedRetiredFixture())),
    ).not.toMatch(/superseded/iu);
  });
});
