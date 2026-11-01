import { CANONICAL_DOMAIN_LABEL } from '../cms-taxonomy-designer/taxonomy-vocabulary';
import type { TermActionResult } from './term-action-submit';

type Failure = Exclude<TermActionResult, { kind: 'done' }>;

const domainName = (
  domain: keyof typeof CANONICAL_DOMAIN_LABEL | undefined,
): string =>
  domain === undefined
    ? 'canonical'
    : CANONICAL_DOMAIN_LABEL[domain].toLowerCase();

const REJECTED: Readonly<Record<number, string>> = {
  400: 'The server could not read the term. Review the form and try again. Nothing was saved.',
  403: 'Taxonomy curator access is required for this acting context. Nothing was saved.',
  404: 'This vocabulary is unavailable to the current acting context. Nothing was saved.',
  415: 'The server could not read the term. Reload the page and try again. Nothing was saved.',
  422: 'The server rejected the term. Review the form and try again. Nothing was saved.',
};

type Refused = Extract<Failure, { kind: 'refused' }>;

const refusedCopy = (result: Refused): string => {
  switch (result.reason) {
    case 'capability_missing':
      return 'Taxonomy curator access is required for this acting context. Nothing was saved.';
    case 'taxonomy_not_active':
      return 'This vocabulary has no active version, so its terms cannot change. Nothing was saved.';
    case 'canonical_overlap':
      return `This matches a canonical ${domainName(result.domain)} record. Reference the canonical record instead. Nothing was saved.`;
    case 'canonical_source_unavailable':
      return `Checks against ${domainName(result.domain)} records are not available yet, and this vocabulary declares that domain. Terms cannot be created, renamed or aliased until a reviewed version no longer declares it. Nothing was saved.`;
  }
};

/** Fixed copy per outcome and `reasonCode` (FE03 :887, :1046); nothing is taken from a response. */
export const failureCopy = (result: Failure): string => {
  switch (result.kind) {
    case 'uncertain':
      return 'The result is unknown. The list was refreshed: check whether your change appears before retrying. Retrying these unchanged values reuses the same idempotency key, so it cannot apply twice.';
    case 'conflict':
      return 'The vocabulary changed while you were working. The list and the active version were refreshed; review them and try again. Nothing was saved.';
    case 'refused':
      return refusedCopy(result);
    case 'rejected':
      if (result.status === 401)
        return 'Your session expired. Sign in again before submitting; your entries remain here.';
      if (result.status === 429)
        return result.retryAfterSeconds === undefined
          ? 'The request was rate-limited. Wait before retrying.'
          : `The request was rate-limited. Wait at least ${result.retryAfterSeconds} seconds before retrying.`;
      return (
        REJECTED[result.status] ??
        'The vocabulary service is unavailable. Your entries remain here for a later retry.'
      );
  }
};

export const failureHeading = (result: Failure): string =>
  result.kind === 'uncertain'
    ? 'The result is unknown'
    : result.kind === 'conflict'
      ? 'The vocabulary changed'
      : result.kind === 'refused' && result.reason === 'canonical_overlap'
        ? 'This matches a canonical record'
        : 'The term was not saved';
