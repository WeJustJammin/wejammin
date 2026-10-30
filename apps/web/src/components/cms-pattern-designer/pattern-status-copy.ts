/** Fixed copy of every non-success outcome of CMS-03C-12 (nothing is taken from a response). */
import { PATTERN_REFUSAL_COPY } from './pattern-designer-reasons';
import type { PatternSubmitResult } from './pattern-designer-submit';

type Failed = Exclude<PatternSubmitResult, { kind: 'created' }>;

export const PATTERN_REJECTED_COPY: Readonly<Record<number, string>> = {
  400: 'The server could not read the pattern. Review the form and try again. Nothing was saved.',
  403: 'Template designer access is required for this acting context. Nothing was saved.',
  404: 'This pattern is unavailable to the current acting context. Nothing was saved.',
  415: 'The server could not read the pattern. Reload the page and try again. Nothing was saved.',
  422: 'The server rejected the pattern. Review the form and try again. Nothing was saved.',
};
const UNAVAILABLE =
  'The pattern service is unavailable. Your tree remains here for a later retry.';

export const resultCopy = (result: Failed): string => {
  switch (result.kind) {
    case 'uncertain':
      return 'The result is unknown. The latest version could not settle it. Your tree remains here. Check the latest version before changing anything; retrying these unchanged values reuses the same idempotency key, so it cannot save twice.';
    case 'conflict':
      return 'Another version of this pattern was saved after the one you started from. Nothing was overwritten. Check the latest version, then choose how to continue.';
    case 'refused':
      return PATTERN_REFUSAL_COPY[result.reason];
    case 'rejected':
      if (result.status === 401)
        return 'Your session expired. Sign in again before submitting; your tree remains here.';
      if (result.status === 429)
        return result.retryAfterSeconds === undefined
          ? 'The request was rate-limited. Wait before retrying.'
          : `The request was rate-limited. Wait at least ${result.retryAfterSeconds} seconds before retrying.`;
      return PATTERN_REJECTED_COPY[result.status] ?? UNAVAILABLE;
  }
};

export const headingOf = (result: Failed): string =>
  result.kind === 'uncertain'
    ? 'The result is unknown'
    : result.kind === 'conflict'
      ? 'Another version was saved'
      : 'The pattern was not saved';

/** FE03 1048: a 403 renders the CapabilityGate copy (never a step-up route). */
export const isCapabilityDenial = (result: Failed): boolean =>
  (result.kind === 'refused' && result.status === 403) ||
  (result.kind === 'rejected' && result.status === 403);
