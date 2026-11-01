import type { OrderStep } from './be00-order.test-support';

/**
 * BE00 line 386 (step 6) validates path, query, headers and body "before resource authorization";
 * line 387 (step 7) then evaluates the route capability and the domain quota; BE03c 408 puts the
 * Idempotency-Key grammar in the validation matrix. The shared `standardMutationSteps` list keeps
 * the key defect last (it predates the ruling), so a route that validates headers at step 6
 * moves the key step directly ahead of `capability`.
 */
export const headersBeforeAuthorization = <State>(
  steps: readonly OrderStep<State>[],
): readonly OrderStep<State>[] => {
  const key = steps.find((step) => step.name === 'idempotency key');
  if (key === undefined) throw new Error('No idempotency key step to move.');
  return steps
    .filter((step) => step !== key)
    .flatMap((step) => (step.name === 'capability' ? [key, step] : [step]));
};
