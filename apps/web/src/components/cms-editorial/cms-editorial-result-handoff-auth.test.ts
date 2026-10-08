// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearAllStepUpState } from '../identity-authority/step-up-mfa/step-up-binding';
import {
  saveCmsEditorialResult,
  takeCmsEditorialResult,
  type CmsEditorialResultSummary,
} from './cms-editorial-result-handoff';

/**
 * Codex final review (s10-final-4, MEDIUM): the one-shot result carries lineage identifiers (parent
 * revisions, migration chain). It is bound to the signed-in subject the way every other tab-scoped
 * detour record is (the `wj_step_up_scope` stamp), so user A's record can never be shown to user B
 * who signs in next in the same tab, and the auth-scope cleanup removes it.
 */

const ENTRY = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const SCOPE_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const SCOPE_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';

const summary = (): CmsEditorialResultSummary => ({
  kind: 'restored',
  entryId: ENTRY,
  revisionNumber: '5',
  entryVersion: '9',
  state: 'draft',
  parentRevisionIds: [
    '018f0c45-73fe-7dc2-9c09-68f7ecf132a1',
    '018f0c45-73fe-7dc2-9c09-68f7ecf132a2',
  ],
  migrationChainId: '018f0c45-73fe-7dc2-9c09-68f7ecf132c1',
  edgeCount: 2,
});

const signInAs = (scope: string | null): void => {
  document.cookie = `wj_step_up_scope=${scope ?? ''}; ${scope === null ? 'max-age=0' : 'path=/'}`;
};

beforeEach(() => signInAs(SCOPE_A));
afterEach(() => {
  signInAs(null);
  window.sessionStorage.clear();
});

describe('the result handoff is bound to the signed-in subject', () => {
  it('shows the record to the subject that left it', () => {
    saveCmsEditorialResult(window.sessionStorage, summary());
    expect(takeCmsEditorialResult(window.sessionStorage, ENTRY)).toEqual(
      summary(),
    );
  });

  it('never shows it to another subject on the same entry, and clears it', () => {
    saveCmsEditorialResult(window.sessionStorage, summary());
    signInAs(SCOPE_B);
    expect(takeCmsEditorialResult(window.sessionStorage, ENTRY)).toBeNull();
    // Back as the first subject: the record is gone, not merely hidden.
    signInAs(SCOPE_A);
    expect(takeCmsEditorialResult(window.sessionStorage, ENTRY)).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('never shows a record left while signed out to a subject who signs in afterwards', () => {
    signInAs(null);
    saveCmsEditorialResult(window.sessionStorage, summary());
    signInAs(SCOPE_B);
    expect(takeCmsEditorialResult(window.sessionStorage, ENTRY)).toBeNull();
  });

  it('is removed by the auth-scope cleanup (logout, session switch, reaching sign-in)', () => {
    saveCmsEditorialResult(window.sessionStorage, summary());
    expect(window.sessionStorage.length).toBeGreaterThan(0);
    clearAllStepUpState(window.sessionStorage);
    expect(window.sessionStorage.length).toBe(0);
    expect(takeCmsEditorialResult(window.sessionStorage, ENTRY)).toBeNull();
  });
});
