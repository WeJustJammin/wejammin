import {
  CMS_PREFLIGHT_CATEGORIES,
  CMS_PREFLIGHT_REGISTRY,
  EditorialReviewStateSchema,
  EntryRevisionStateSchema,
  PublicationActionSchema,
  PublicationProjectionStateSchema,
  PublicationScheduleStateSchema,
  PublicationStateSchema,
  ReviewInvalidatedReasonSchema,
  ReviewNextActionSchema,
  ScheduleReasonCodeSchema,
  WorkflowNextActionSchema,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  ACTION_LABEL,
  INVALIDATED_REASON_COPY,
  PREFLIGHT_CATEGORY_LABEL,
  PREFLIGHT_OUTCOME_LABEL,
  PROJECTION_COPY,
  PUBLICATION_ACTION_LABEL,
  PUBLICATION_STATE_LABEL,
  REVIEW_STATE_LABEL,
  REVISION_STATE_LABEL,
  SCHEDULE_REASON_COPY,
  SCHEDULE_STATE_COPY,
  disabledActionCopy,
  preflightReasonCopy,
  type PreflightOutcome,
} from './cms-workflow-labels';

/*
 * Every member of every closed contract vocabulary has fixed copy here. The
 * browser renders nothing the server wrote, so a vocabulary that grows without
 * its copy fails this suite instead of rendering an empty or raw token.
 */
describe('closed vocabulary copy', () => {
  it('labels all seventeen preflight categories in registry order', () => {
    expect(Object.keys(PREFLIGHT_CATEGORY_LABEL)).toEqual([
      ...CMS_PREFLIGHT_CATEGORIES,
    ]);
    for (const label of Object.values(PREFLIGHT_CATEGORY_LABEL))
      expect(label.length).toBeGreaterThan(2);
  });

  it('has copy for every registered reason of every provider', () => {
    for (const row of CMS_PREFLIGHT_REGISTRY)
      for (const reason of row.reasonCodes)
        expect(
          preflightReasonCopy('failed', reason),
          `${row.category} ${reason}`,
        ).not.toMatch(/^This check did not pass\.$/u);
  });

  it('states the unbuilt-provider rule without an override', () => {
    expect(preflightReasonCopy('failed', 'provider_unbuilt_reference')).toBe(
      'Checks for this reference type are not available yet.',
    );
    expect(
      preflightReasonCopy('failed', 'provider_unbuilt_reference'),
    ).not.toMatch(/override|skip|ignore/iu);
  });

  it('falls back to a fixed sentence for an unregistered token and never echoes it', () => {
    expect(preflightReasonCopy('failed', 'secret_internal_token')).toBe(
      'This check did not pass.',
    );
    expect(preflightReasonCopy('unavailable', 'secret_internal_token')).toBe(
      'This check could not run. It is a degraded check, not an error.',
    );
    expect(preflightReasonCopy('failed', null)).toBe(
      'This check did not pass.',
    );
    expect(preflightReasonCopy('passed', null)).toBe('This check passed.');
  });

  it('labels the three outcomes as text', () => {
    const outcomes: PreflightOutcome[] = ['passed', 'failed', 'unavailable'];
    expect(outcomes.map((outcome) => PREFLIGHT_OUTCOME_LABEL[outcome])).toEqual(
      ['Passed', 'Failed', 'Unavailable'],
    );
  });

  it('covers the revision, review, schedule, publication and projection states', () => {
    expect(Object.keys(REVISION_STATE_LABEL).sort()).toEqual(
      [...EntryRevisionStateSchema.options].sort(),
    );
    expect(Object.keys(REVIEW_STATE_LABEL).sort()).toEqual(
      [...EditorialReviewStateSchema.options].sort(),
    );
    expect(Object.keys(SCHEDULE_STATE_COPY).sort()).toEqual(
      [...PublicationScheduleStateSchema.options].sort(),
    );
    expect(Object.keys(PUBLICATION_STATE_LABEL).sort()).toEqual(
      [...PublicationStateSchema.options].sort(),
    );
    expect(Object.keys(PUBLICATION_ACTION_LABEL).sort()).toEqual(
      [...PublicationActionSchema.options].sort(),
    );
    expect(Object.keys(PROJECTION_COPY).sort()).toEqual(
      [...PublicationProjectionStateSchema.options].sort(),
    );
    expect(Object.keys(INVALIDATED_REASON_COPY).sort()).toEqual(
      [...ReviewInvalidatedReasonSchema.options].sort(),
    );
    expect(Object.keys(SCHEDULE_REASON_COPY).sort()).toEqual(
      [...ScheduleReasonCodeSchema.options].sort(),
    );
  });

  it('never presents a pending projection or a scheduled item as public visibility', () => {
    expect(PROJECTION_COPY.pending).toBe(
      'Recorded. Public delivery has not reported yet, so this is not confirmed visible to readers.',
    );
    expect(SCHEDULE_STATE_COPY.pending).toBe('Scheduled, not published');
    expect(PROJECTION_COPY.converged).toBe(
      'Delivery reported this version live.',
    );
    expect(PROJECTION_COPY.degraded).toBe(
      'Delivery is degraded; readers may still see the previous version.',
    );
    for (const copy of Object.values(SCHEDULE_STATE_COPY))
      expect(copy).not.toMatch(/^Published$/u);
  });

  it('labels every action a permitted-actions list can carry', () => {
    const actions = new Set([
      ...WorkflowNextActionSchema.options,
      ...ReviewNextActionSchema.options,
    ]);
    for (const action of actions)
      expect(ACTION_LABEL[action], action).toBeDefined();
  });

  it('explains why a form is withheld when its action is not permitted', () => {
    expect(disabledActionCopy('publish')).toBe(
      'A second person with the publisher capability must publish this revision.',
    );
    for (const action of [
      'submit_review',
      'schedule',
      'preview',
      'record_decision',
      'assign_reviewer',
    ] as const)
      expect(disabledActionCopy(action).length).toBeGreaterThan(20);
  });
});
