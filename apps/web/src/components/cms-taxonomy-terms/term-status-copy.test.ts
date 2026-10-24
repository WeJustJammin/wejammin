import { describe, expect, it } from 'vitest';

import { CANONICAL_DOMAIN_LABEL } from '../cms-taxonomy-designer/taxonomy-vocabulary';
import { failureCopy, failureHeading } from './term-status-copy';
import type { TermActionResult } from './term-action-submit';

type Failure = Exclude<TermActionResult, { kind: 'done' }>;

describe('failureHeading', () => {
  it.each<[string, Failure, string]>([
    ['uncertain', { kind: 'uncertain' }, 'The result is unknown'],
    [
      'conflict',
      { kind: 'conflict', currentVersion: null },
      'The vocabulary changed',
    ],
    [
      'canonical overlap',
      {
        kind: 'refused',
        status: 422,
        reason: 'canonical_overlap',
        domain: 'place',
      },
      'This matches a canonical record',
    ],
    [
      'any other refusal',
      { kind: 'refused', status: 409, reason: 'taxonomy_not_active' },
      'The term was not saved',
    ],
    [
      'a rejection',
      { kind: 'rejected', status: 422 },
      'The term was not saved',
    ],
  ])('names %s', (_name, result, heading) => {
    expect(failureHeading(result)).toBe(heading);
  });
});

describe('failureCopy', () => {
  it('names the canonical domain of an overlap in words, for each of the six domains', () => {
    for (const [domain, label] of Object.entries(CANONICAL_DOMAIN_LABEL)) {
      const copy = failureCopy({
        kind: 'refused',
        status: 422,
        reason: 'canonical_overlap',
        domain: domain as keyof typeof CANONICAL_DOMAIN_LABEL,
      });
      expect(copy).toBe(
        `This matches a canonical ${label.toLowerCase()} record. Reference the canonical record instead. Nothing was saved.`,
      );
    }
  });

  it('falls back to a plain "canonical" record when no domain is named', () => {
    expect(
      failureCopy({
        kind: 'refused',
        status: 422,
        reason: 'canonical_overlap',
      }),
    ).toBe(
      'This matches a canonical canonical record. Reference the canonical record instead. Nothing was saved.',
    );
  });

  const UNAVAILABLE =
    'The vocabulary service is unavailable. Your entries remain here for a later retry.';
  it.each<[Failure, string]>([
    [
      { kind: 'refused', status: 403, reason: 'capability_missing' },
      'Taxonomy curator access is required for this acting context. Nothing was saved.',
    ],
    [
      { kind: 'refused', status: 409, reason: 'taxonomy_not_active' },
      'This vocabulary has no active version, so its terms cannot change. Nothing was saved.',
    ],
    [
      {
        kind: 'refused',
        status: 422,
        reason: 'canonical_source_unavailable',
        domain: 'jurisdiction',
      },
      'Checks against jurisdiction records are not available yet, and this vocabulary declares that domain. Terms cannot be created, renamed or aliased until a reviewed version no longer declares it. Nothing was saved.',
    ],
    [
      { kind: 'uncertain' },
      'The result is unknown. The list was refreshed: check whether your change appears before retrying. Retrying these unchanged values reuses the same idempotency key, so it cannot apply twice.',
    ],
    [
      { kind: 'conflict', currentVersion: '4' },
      'The vocabulary changed while you were working. The list and the active version were refreshed; review them and try again. Nothing was saved.',
    ],
    [
      { kind: 'rejected', status: 401 },
      'Your session expired. Sign in again before submitting; your entries remain here.',
    ],
    [
      { kind: 'rejected', status: 429, retryAfterSeconds: 30 },
      'The request was rate-limited. Wait at least 30 seconds before retrying.',
    ],
    [
      { kind: 'rejected', status: 429 },
      'The request was rate-limited. Wait before retrying.',
    ],
    [
      { kind: 'rejected', status: 400 },
      'The server could not read the term. Review the form and try again. Nothing was saved.',
    ],
    [
      { kind: 'rejected', status: 403 },
      'Taxonomy curator access is required for this acting context. Nothing was saved.',
    ],
    [
      { kind: 'rejected', status: 404 },
      'This vocabulary is unavailable to the current acting context. Nothing was saved.',
    ],
    [
      { kind: 'rejected', status: 415 },
      'The server could not read the term. Reload the page and try again. Nothing was saved.',
    ],
    [
      { kind: 'rejected', status: 422 },
      'The server rejected the term. Review the form and try again. Nothing was saved.',
    ],
    [{ kind: 'rejected', status: 500 }, UNAVAILABLE],
    [{ kind: 'rejected', status: 502 }, UNAVAILABLE],
    [{ kind: 'rejected', status: 503 }, UNAVAILABLE],
    [{ kind: 'rejected', status: 504 }, UNAVAILABLE],
  ])('words %j', (result, expected) => {
    expect(failureCopy(result)).toBe(expected);
  });
});
