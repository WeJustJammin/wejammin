import { describe, expect, it } from 'vitest';

import { refusalMessage, UNKNOWN_OUTCOME_MESSAGE } from './composition-copy';

/*
 * Fixed copy per typed refusal (FE03 1114, 1115, 1599, 1615, 1616; BE03c 1304). No server text is ever shown: a
 * reason token or a status picks a sentence, and an unknown token falls back to its status.
 */
describe('refusalMessage', () => {
  it.each([
    ['place', 409, 'revision_not_editable', /no longer editable/u],
    ['place', 422, 'pattern_version_not_active', /no longer active/u],
    ['place', 422, 'pattern_incompatible', /not compatible with this entry/u],
    ['place', 422, 'nested_pattern_not_active', /nested/u],
    ['place', 422, 'block_registry_digest_mismatch', /registry changed/u],
    ['place', 422, 'block_rules_violated', /composition rules/u],
    ['update', 422, 'block_rules_violated', /composition rules/u],
    ['update', 409, 'diff_has_collisions', /collisions/u],
    ['update', 409, 'revision_not_editable', /no longer editable/u],
    ['diff', 422, 'diff_too_large', /too large/u],
  ] as const)('%s %s %s', (operation, status, reason, expected) => {
    expect(refusalMessage(operation, status, reason)).toMatch(expected);
  });

  it('names a plain update 422 as one that cannot form a consistent tree, with nothing applied and the choices kept', () => {
    const message = refusalMessage('update', 422, null);
    expect(message).toMatch(/one consistent/u);
    expect(message).toMatch(/Nothing was applied/u);
    expect(message).toMatch(/choices are kept/u);
  });

  it('names a plain 409 as a changed entry and says the input is kept', () => {
    expect(refusalMessage('place', 409, null)).toMatch(
      /changed since this page loaded/u,
    );
    expect(refusalMessage('update', 409, null)).toMatch(/choices are kept/u);
  });

  it.each([
    [401, /Sign in again/u],
    [403, /cannot edit/u],
    [404, /not available/u],
    [400, /could not be completed/u],
    [415, /could not be completed/u],
    [500, /could not be completed/u],
  ])('status %s', (status, expected) => {
    expect(refusalMessage('place', status, null)).toMatch(expected);
  });

  it('ignores a reason token the operation does not publish', () => {
    expect(refusalMessage('diff', 409, 'diff_has_collisions')).toBe(
      'The update could not be read right now.',
    );
    expect(refusalMessage('place', 422, 'diff_too_large')).not.toMatch(
      /too large/u,
    );
  });

  it('says a failed read could not be read, not that a change failed', () => {
    expect(refusalMessage('selector', 503, null)).toBe(
      'The pattern list could not be read right now.',
    );
    expect(refusalMessage('diff', 500, null)).toBe(
      'The update could not be read right now.',
    );
  });

  it('keeps one sentence for an unknown outcome', () => {
    expect(UNKNOWN_OUTCOME_MESSAGE).toMatch(/not known/u);
    expect(UNKNOWN_OUTCOME_MESSAGE).toMatch(/same request/u);
  });
});
