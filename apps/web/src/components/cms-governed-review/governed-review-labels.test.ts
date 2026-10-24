import {
  CMS_DEFINITION_VERSION_STATES,
  GovernedActivationScheduleReasonSchema,
  GovernedActivationScheduleStateSchema,
  GovernedInvalidatedReasonSchema,
  GovernedNextActionSchema,
  GovernedReviewQueueItemSchema,
  GovernedRiskClassSchema,
  GovernedReviewStateSchema,
  GovernedSubjectKindSchema,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  GOVERNED_ACTIVATION_SCHEDULE_REASON_COPY,
  GOVERNED_ACTIVATION_SCHEDULE_STATE_COPY,
  GOVERNED_DECISION_LABEL,
  GOVERNED_INVALIDATED_COPY,
  GOVERNED_MY_DECISION_LABEL,
  GOVERNED_RISK_CLASS_LABEL,
  GOVERNED_SUBJECT_KIND_LABEL,
  governedActivationScheduleSentence,
  governedDisabledActionCopy,
  governedSupersededSentence,
} from './governed-review-labels';
import {
  GOVERNED_REVIEW_STATE_LABEL,
  GOVERNED_SUBJECT_STATE_LABEL,
} from './governed-state-labels';

/*
 * The labels are written out (the island never ships zod); each table must cover
 * its generated vocabulary exactly, so a new contract member fails here.
 */
describe('governed review labels', () => {
  it('cover every review state, subject kind, lifecycle state and invalidation reason', () => {
    expect(Object.keys(GOVERNED_REVIEW_STATE_LABEL).sort()).toEqual(
      [...GovernedReviewStateSchema.options].sort(),
    );
    expect(Object.keys(GOVERNED_SUBJECT_KIND_LABEL).sort()).toEqual(
      [...GovernedSubjectKindSchema.options].sort(),
    );
    expect(Object.keys(GOVERNED_SUBJECT_STATE_LABEL).sort()).toEqual(
      [...CMS_DEFINITION_VERSION_STATES].sort(),
    );
    expect(Object.keys(GOVERNED_INVALIDATED_COPY).sort()).toEqual(
      [...GovernedInvalidatedReasonSchema.options].sort(),
    );
  });

  it('cover every risk class, own-decision token and recorded decision', () => {
    expect(Object.keys(GOVERNED_RISK_CLASS_LABEL).sort()).toEqual(
      [...GovernedRiskClassSchema.options].sort(),
    );
    const myDecisions = GovernedReviewQueueItemSchema.unwrap().shape.myDecision;
    expect(Object.keys(GOVERNED_MY_DECISION_LABEL).sort()).toEqual(
      [...myDecisions.options].sort(),
    );
    expect(Object.keys(GOVERNED_DECISION_LABEL).sort()).toEqual([
      'approve',
      'reject',
    ]);
  });

  it('never presents a scheduled version as active', () => {
    expect(GOVERNED_SUBJECT_STATE_LABEL.scheduled).toBe(
      'Scheduled, not active',
    );
    expect(GOVERNED_SUBJECT_STATE_LABEL.active).toBe('Active');
  });

  it('says a returned-to-draft version after an invalidation', () => {
    expect(GOVERNED_INVALIDATED_COPY.dependency_changed).toContain('draft');
  });

  it('gives a reason for every action a form is withheld for', () => {
    for (const action of [
      'record_decision',
      'assign_reviewer',
      'activate',
      'retire',
    ] as const)
      expect(governedDisabledActionCopy(action).length).toBeGreaterThan(10);
    expect(GovernedNextActionSchema.options).toContain('record_decision');
  });

  it('covers every schedule state and closed reason of DEC-191 exactly', () => {
    expect(Object.keys(GOVERNED_ACTIVATION_SCHEDULE_STATE_COPY).sort()).toEqual(
      [...GovernedActivationScheduleStateSchema.options].sort(),
    );
    expect(
      Object.keys(GOVERNED_ACTIVATION_SCHEDULE_REASON_COPY).sort(),
    ).toEqual([...GovernedActivationScheduleReasonSchema.options].sort());
  });

  it('gives each closed reason its own fixed sentence, never the token', () => {
    const sentences = Object.values(GOVERNED_ACTIVATION_SCHEDULE_REASON_COPY);
    expect(new Set(sentences).size).toBe(sentences.length);
    for (const sentence of sentences) {
      expect(sentence).toMatch(/^[A-Z].*\.$/u);
      expect(sentence).not.toMatch(/_/u);
    }
  });

  it('says a blocked or cancelled schedule with its reason and any other state without one', () => {
    expect(
      governedActivationScheduleSentence({
        state: 'blocked',
        reasonCode: 'dependency_changed',
      }),
    ).toBe(
      'Scheduled activation: blocked. A dependency changed after the review approved it.',
    );
    expect(
      governedActivationScheduleSentence({
        state: 'cancelled',
        reasonCode: 'approval_invalidated',
      }),
    ).toBe(
      'Scheduled activation: cancelled. The review approval no longer applies.',
    );
    expect(
      governedActivationScheduleSentence({
        state: 'pending',
        reasonCode: null,
      }),
    ).toBe('Scheduled activation: pending.');
  });

  it('names the superseded version of an activation and nothing for a first one', () => {
    expect(governedSupersededSentence(3)).toBe(' Version 3 is now superseded.');
    expect(governedSupersededSentence(null)).toBe('');
  });
});
