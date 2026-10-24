import * as React from 'react';

import { whenRegionTouched } from './cms-lazy-intent';
import type { ReviewerOptionsResult } from './cms-workflow-reviewer-options';

/** The wait before the next read of a 429 that stated no delay. */
export const REVIEWER_OPTIONS_DEFAULT_WAIT_SECONDS = 5;

export interface ReviewerOptionsState {
  readonly reviewers: ReviewerOptionsResult | null;
  /** Reads the choices again (the button of a failed read); the list is loading meanwhile. */
  readonly retry: () => void;
}

/**
 * The reviewer choices of an assignment form: read once when the form mounts, and read again once
 * after a 429's stated wait (FE03 :1172), again as long as the answer is a 429. Any other
 * unavailable answer is final for this mount, as before. `null` while a read is in flight, and
 * while `enabled` is false (a form the server does not offer reads nothing).
 *
 * With a `region` (the form's `data-cms-lazy-region`) the first read waits for the first sign of
 * intent in it: the read loads the contract validators, so reading at mount would put that chunk
 * into the cold load of every review page an owner opens (FE03 "Performance budgets and loading
 * strategy": lazy modules load on explicit entry; P2-S11-AC-106).
 */
export const useReviewerOptions = (
  loadOptions: () => Promise<ReviewerOptionsResult>,
  enabled = true,
  region?: string,
): ReviewerOptionsState => {
  const [reviewers, setReviewers] =
    React.useState<ReviewerOptionsResult | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    const touched =
      region === undefined ? Promise.resolve() : whenRegionTouched(region);
    void touched
      .then(() => (current ? loadOptions() : null))
      .then((result) => {
        if (current && result !== null) setReviewers(result);
      });
    return () => {
      current = false;
    };
  }, [loadOptions, attempt, enabled, region]);
  const rateLimit =
    reviewers?.kind === 'unavailable' ? (reviewers.rateLimit ?? null) : null;
  React.useEffect(() => {
    if (rateLimit === null) return;
    const timer = setTimeout(
      () => setAttempt((count) => count + 1),
      (rateLimit.retryAfterSeconds ?? REVIEWER_OPTIONS_DEFAULT_WAIT_SECONDS) *
        1_000,
    );
    return () => clearTimeout(timer);
  }, [rateLimit]);
  const retry = React.useCallback(() => {
    setReviewers(null);
    setAttempt((count) => count + 1);
  }, []);
  return { reviewers, retry };
};
