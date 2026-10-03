// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/client-binding', () => ({
  addClientBindingIdHeader: async (_input: unknown, init?: RequestInit) => init,
}));

import {
  GRANT_ID,
  grantListPage,
  grantResource,
} from '../../server/cms-capability-grant.test-support';
import {
  REQUEST_ID,
  apiError,
  consoleProps,
  jsonResponse,
  sampleItems,
} from './cms-capability-grant-console.test-support';
import {
  GRANT_UUID,
  click,
  fillGrantForm,
  mountConsole,
  query,
  scriptFetch,
  submit,
  textOf,
  typeInto,
  type Mounted,
} from './cms-capability-grant-dom.test-support';

/**
 * R8 proofs for the grant console criteria the fresh audit found only partly
 * asserted: a command 403 through the live island (1002), every 422 field row
 * with preserved input (1005), and the unknown-outcome / refetch rule for
 * renewal and revocation as well as grant (1047).
 */

let mounted: Mounted | null = null;
const mount = () => {
  mounted = mountConsole(consoleProps());
  return mounted.container;
};
const listResponse = () => jsonResponse(200, grantListPage(sampleItems()));
const ROW = `tr[data-grant-id="${GRANT_ID}"]`;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.sessionStorage.clear();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
});

describe('[P2-S09-AC-1002] command 403 FORBIDDEN', () => {
  const FORBIDDEN_DETAILS = {
    reasonCode: 'capability_missing',
    capability: 'cms.owner.secret',
    subjectPersonId: GRANT_UUID,
  };

  it('[P2-S09-AC-1002] renders exactly the owner gate sentence as the command result for a grant', async () => {
    scriptFetch(() =>
      jsonResponse(403, apiError('FORBIDDEN', FORBIDDEN_DETAILS)),
    );
    const root = mount();
    await submit(fillGrantForm(root));
    const alert = query(root, '[data-command-error]');
    expect(textOf(alert)).toContain(
      'Only the organization owner can manage CMS access.',
    );
  });

  it('[P2-S09-AC-1002] discloses nothing from the 403 body beyond the request ID support reference', async () => {
    scriptFetch(() =>
      jsonResponse(403, apiError('FORBIDDEN', FORBIDDEN_DETAILS)),
    );
    const root = mount();
    await submit(fillGrantForm(root));
    const alert = textOf(query(root, '[data-command-error]'));
    expect(alert).not.toContain('capability_missing');
    expect(alert).not.toContain('cms.owner.secret');
    expect(alert).not.toContain(GRANT_UUID);
    // The request ID is the one support reference; nothing else of the body is shown.
    expect(alert).toBe(
      `This change needs attentionOnly the organization owner can manage CMS access.Request ID: ${REQUEST_ID}`,
    );
  });

  it('[P2-S09-AC-1002] renders the same owner gate sentence for a renewal 403', async () => {
    scriptFetch(() =>
      jsonResponse(403, apiError('FORBIDDEN', FORBIDDEN_DETAILS)),
    );
    const root = mount();
    click(query(root, `${ROW} button[data-action="renew"]`));
    const form = query<HTMLFormElement>(
      root,
      'form[data-operation-id="CMS-03A-16"]',
    );
    typeInto(query(form, 'input[name="validThrough"]'), '2026-12-01');
    await submit(form);
    expect(textOf(query(root, '[data-command-error]'))).toContain(
      'Only the organization owner can manage CMS access.',
    );
  });
});

describe('[P2-S09-AC-1005] command 422 VALIDATION_FAILED', () => {
  const violation = (path: string) => ({
    path,
    code: 'invalid',
    message: 'Server message that is never shown verbatim.',
  });
  const scripted422 = (paths: readonly string[]) =>
    scriptFetch(() =>
      jsonResponse(
        422,
        apiError('VALIDATION_FAILED', { violations: paths.map(violation) }),
      ),
    );
  const FIELD_COPY: readonly (readonly [string, string, string])[] = [
    [
      '/subjectPersonId',
      'input[name="subjectPersonId"]',
      "Enter the person's ID as a UUID.",
    ],
    [
      '/capability',
      'select[name="capability"]',
      'Choose a capability from the list.',
    ],
    [
      '/reason',
      'textarea[name="reason"]',
      'Keep the reason to 256 characters.',
    ],
  ];

  for (const [path, selector, copy] of FIELD_COPY)
    it(`[P2-S09-AC-1005] maps ${path} onto its own field error and links the summary to it`, async () => {
      scripted422([path]);
      const root = mount();
      await submit(fillGrantForm(root, { reason: 'Quarterly access review' }));
      const field = query<HTMLElement>(root, selector);
      expect(textOf(root)).toContain(copy);
      const summary = query(root, '[data-command-error]');
      expect(query(summary, `a[href="#${field.id}"]`)).not.toBeNull();
    });

  it('[P2-S09-AC-1005] keeps every typed value in the form after the 422', async () => {
    scripted422(['/validThrough']);
    const root = mount();
    const form = fillGrantForm(root, {
      capability: 'cms.editor',
      validThrough: '2026-12-01',
      reason: 'Quarterly access review',
    });
    await submit(form);
    expect(
      query<HTMLInputElement>(form, 'input[name="subjectPersonId"]').value,
    ).toBe(GRANT_UUID);
    expect(
      query<HTMLSelectElement>(form, 'select[name="capability"]').value,
    ).toBe('cms.editor');
    expect(
      query<HTMLInputElement>(form, 'input[name="validThrough"]').value,
    ).toBe('2026-12-01');
    expect(
      query<HTMLTextAreaElement>(form, 'textarea[name="reason"]').value,
    ).toBe('Quarterly access review');
  });

  it('[P2-S09-AC-1005] drops a violation for a field the form does not have', async () => {
    scripted422(['/nonexistent']);
    const root = mount();
    await submit(fillGrantForm(root));
    expect(textOf(query(root, '[data-command-error]'))).toContain(
      'Check the highlighted fields.',
    );
    expect(root.querySelectorAll('[data-command-error] a')).toHaveLength(0);
  });
});

describe('[P2-S09-AC-1047] reconciliation against a canonical refetch', () => {
  const renewForm = (root: HTMLElement): HTMLFormElement => {
    click(query(root, `${ROW} button[data-action="renew"]`));
    const form = query<HTMLFormElement>(
      root,
      'form[data-operation-id="CMS-03A-16"]',
    );
    typeInto(query(form, 'input[name="validThrough"]'), '2026-12-01');
    return form;
  };
  const revokeForm = (root: HTMLElement): HTMLFormElement => {
    click(query(root, `${ROW} button[data-action="revoke"]`));
    const form = query<HTMLFormElement>(
      root,
      'form[data-operation-id="CMS-03A-17"]',
    );
    click(query(form, 'input[type="checkbox"][name="confirmed"]'));
    return form;
  };

  it('[P2-S09-AC-1047] refetches the canonical list after a confirmed renewal', async () => {
    const { calls } = scriptFetch(
      () =>
        jsonResponse(
          200,
          grantResource({ version: '3', lastAction: 'renewed' }),
        ),
      () => listResponse(),
    );
    const root = mount();
    await submit(renewForm(root));
    expect(calls.map((call) => call.method)).toEqual(['POST', 'GET']);
  });

  it('[P2-S09-AC-1047] renders an unconfirmed renewal as pending, never as renewed, and refetches', async () => {
    const { calls } = scriptFetch(
      () => jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE')),
      () => jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE')),
      () => listResponse(),
    );
    const root = mount();
    await submit(renewForm(root));
    expect(textOf(root)).toContain('not confirmed yet');
    expect(textOf(root)).not.toContain('Grant renewed');
    expect(calls.some((call) => call.method === 'GET')).toBe(true);
  });

  it('[P2-S09-AC-1047] renders an unconfirmed revocation as pending, never as revoked, and refetches', async () => {
    const { calls } = scriptFetch(
      () => jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE')),
      () => jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE')),
      () => listResponse(),
    );
    const root = mount();
    await submit(revokeForm(root));
    expect(textOf(root)).toContain('not confirmed yet');
    expect(textOf(root)).not.toContain('Grant revoked');
    expect(calls.some((call) => call.method === 'GET')).toBe(true);
  });
});
