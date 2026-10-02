import {
  announce,
  clearDynamicFeedback,
  focusWithoutScroll,
  safeOutcomeMessage,
  safeReauthentication,
  safeStepUp,
  sameOriginLocation,
  setFormBusy,
} from './content-schema-registry-runtime-dom-feedback';
import {
  renderCapabilityGate,
  renderConflict,
  renderRetryAction,
  renderValidationSummary,
  startRetryAfterCountdown,
} from './content-schema-registry-runtime-dom-renderers';
import type { ContentSchemaRegistryMutationResult } from './content-schema-registry-runtime';

export const completeContentSchemaRegistryMutation = (
  form: HTMLFormElement,
  result: ContentSchemaRegistryMutationResult,
  windowObject: Window,
  timers: Set<number>,
  navigate: (target: string) => void = (target) =>
    windowObject.location.assign(target),
): void => {
  setFormBusy(form, false);
  clearDynamicFeedback(form);
  if (result.outcome === 'unauthenticated') {
    const status = announce(
      form,
      safeOutcomeMessage(result.outcome, null),
      true,
    );
    focusWithoutScroll(status);
    safeReauthentication(form, windowObject, navigate);
    return;
  }
  if (result.outcome === 'step-up-required') {
    const status = announce(
      form,
      safeOutcomeMessage(result.outcome, null),
      false,
    );
    focusWithoutScroll(status);
    safeStepUp(windowObject, navigate);
    return;
  }
  if (result.outcome === 'forbidden') {
    focusWithoutScroll(renderCapabilityGate(form).querySelector('h3')!);
    return;
  }
  if (result.outcome === 'conflict') {
    focusWithoutScroll(
      renderConflict(form, result, windowObject, navigate).querySelector('h3')!,
    );
    return;
  }
  if (result.outcome === 'validation') {
    focusWithoutScroll(
      renderValidationSummary(
        form,
        result.errorDetails,
        result.localeIssues ?? [],
      ),
    );
    return;
  }
  const status = announce(
    form,
    safeOutcomeMessage(result.outcome, result.retryAfterSeconds),
    result.outcome !== 'success' && result.outcome !== 'rate-limited',
  );
  if (result.outcome === 'success') {
    const location =
      result.location === null
        ? null
        : sameOriginLocation(form, result.location);
    if (location !== null) navigate(location);
    return;
  }
  if (result.outcome === 'rate-limited') {
    if (result.retryAfterSeconds !== null) {
      setFormBusy(form, true);
      const countdownTimer = startRetryAfterCountdown(
        form,
        result.retryAfterSeconds,
        windowObject,
        () => setFormBusy(form, false),
      );
      if (countdownTimer !== undefined) timers.add(countdownTimer);
    }
    if (result.retryAfterSeconds === null) focusWithoutScroll(status);
    return;
  }
  renderRetryAction(form, windowObject);
  focusWithoutScroll(status);
};
