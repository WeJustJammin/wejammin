// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { GRANTABLE_CMS_CAPABILITIES } from '@wejammin/contracts';

import {
  GRANT_ID,
  SUBJECT_ID,
} from '../../server/cms-capability-grant.test-support';
import {
  LAPSED_ID,
  REVOKED_ID,
  consoleProps,
  renderConsoleDocument,
  rowFor,
  successList,
} from './cms-capability-grant-console.test-support';

/**
 * FE03 `CmsCapabilityGrantConsole` server HTML: an owner-only island with the
 * grant list, the grant form and per-row actions, all as native controls.
 */

const text = (element: Element | Document | null | undefined): string =>
  ((element instanceof Document ? element.body : element)?.textContent ?? '')
    .replace(/\s+/gu, ' ')
    .trim();

describe('[DEC-119] grant list', () => {
  const doc = renderConsoleDocument(consoleProps());

  it('is a captioned table with sortable header buttons', () => {
    const table = doc.querySelector('table');
    expect(text(table?.querySelector('caption'))).toBe('CMS capability grants');
    const sorts = [
      ...doc.querySelectorAll<HTMLButtonElement>('th button[data-sort]'),
    ];
    expect(sorts.map((button) => button.dataset.sort)).toStrictEqual([
      'validThrough',
      'updatedAt',
    ]);
    for (const button of sorts) expect(button.type).toBe('button');
  });

  it('marks the active sort column with aria-sort', () => {
    const active = doc.querySelector('th[aria-sort]');
    expect(active?.getAttribute('aria-sort')).toBe('descending');
    expect(active?.querySelector('button')?.dataset.sort).toBe('updatedAt');
  });

  it('shows the plain capability label with the key in monospace', () => {
    const row = rowFor(doc, GRANT_ID);
    expect(text(row)).toContain('Author entries');
    expect(text(row?.querySelector('code[data-capability-key]'))).toBe(
      'cms.author',
    );
  });

  it('shows the person ID only inside the owner-only table cell', () => {
    const cell = rowFor(doc, GRANT_ID)?.querySelector('[data-person-cell]');
    expect(text(cell)).toContain(SUBJECT_ID);
    expect(doc.body.innerHTML.split(SUBJECT_ID).length - 1).toBe(
      rowFor(doc, GRANT_ID) === null ? 0 : 2,
    );
  });

  it('states the derived state as text plus icon, never colour alone', () => {
    for (const [id, state] of [
      [GRANT_ID, 'Active'],
      [LAPSED_ID, 'Lapsed'],
      [REVOKED_ID, 'Revoked'],
    ] as const) {
      const cell = rowFor(doc, id)?.querySelector('[data-state-cell]');
      expect(text(cell)).toContain(state);
      expect(cell?.querySelector('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('prints the term as UTC date with the derived end instant as secondary text', () => {
    const term = rowFor(doc, GRANT_ID)?.querySelector('[data-term-cell]');
    expect(text(term)).toContain('Valid through 2026-10-31 (UTC)');
    expect(term?.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-11-01T00:00:00.000Z',
    );
  });

  it('gives each row action a specific accessible name described by the person cell', () => {
    const row = rowFor(doc, GRANT_ID);
    const renew = row?.querySelector<HTMLButtonElement>(
      'button[data-action="renew"]',
    );
    const revoke = row?.querySelector<HTMLButtonElement>(
      'button[data-action="revoke"]',
    );
    expect(renew?.getAttribute('aria-label')).toBe(
      'Renew Author entries grant ending 2026-10-31',
    );
    expect(revoke?.getAttribute('aria-label')).toBe(
      'Revoke Author entries grant ending 2026-10-31',
    );
    const describedBy = renew?.getAttribute('aria-describedby') ?? '';
    expect(doc.getElementById(describedBy)).toBe(
      row?.querySelector('[data-person-cell]'),
    );
  });

  it('offers renew and revoke for lapsed rows and only "Grant again" for revoked rows', () => {
    const lapsed = rowFor(doc, LAPSED_ID);
    expect(lapsed?.querySelector('button[data-action="renew"]')).not.toBeNull();
    const revoked = rowFor(doc, REVOKED_ID);
    expect(revoked?.querySelector('button[data-action="renew"]')).toBeNull();
    expect(revoked?.querySelector('button[data-action="revoke"]')).toBeNull();
    expect(
      text(revoked?.querySelector('button[data-action="grant-again"]')),
    ).toBe('Grant again');
  });

  it('keeps 44 by 44 targets via the shared console class and a polite atomic live region', () => {
    expect(doc.querySelector('section.content-schema-registry')).not.toBeNull();
    const live = doc.querySelector(
      '[role="status"][aria-live="polite"][aria-atomic="true"]',
    );
    expect(live).not.toBeNull();
  });

  it('shows a next-page control only when a cursor exists', () => {
    expect(doc.querySelector('button[data-action="next-page"]')).toBeNull();
    const paged = renderConsoleDocument(
      consoleProps({ initialList: successList(undefined, 'opaque-next') }),
    );
    expect(text(paged.querySelector('button[data-action="next-page"]'))).toBe(
      'Next page',
    );
  });
});

describe('[DEC-119/120] grant form', () => {
  const doc = renderConsoleDocument(consoleProps());
  const form = doc.querySelector<HTMLFormElement>(
    'form[data-operation-id="CMS-03A-15"]',
  );

  it('is one native form carrying CSRF and an idempotency key, with no If-Match', () => {
    expect(form).not.toBeNull();
    const data = new FormData(form as HTMLFormElement);
    expect(data.get('operationId')).toBe('CMS-03A-15');
    expect(data.get('csrf')).toBe('csrf-token');
    expect(String(data.get('idempotency-key'))).toMatch(
      /^[\x20-\x7e]{8,128}$/u,
    );
    expect(data.has('if-match')).toBe(false);
    expect(form?.getAttribute('method')).toBe('post');
    expect(form?.getAttribute('action')).toBe(
      '/app/cms-content-modeling/capability-grants',
    );
  });

  it('has a text input for the person ID with the FE03 attributes and helper copy', () => {
    const input = form?.querySelector<HTMLInputElement>(
      'input[name="subjectPersonId"]',
    );
    expect(input?.type).toBe('text');
    expect(input?.required).toBe(true);
    expect(input?.getAttribute('autocomplete')).toBe('off');
    expect(input?.getAttribute('spellcheck')).toBe('false');
    const help = doc.getElementById(
      (input?.getAttribute('aria-describedby') ?? '').split(' ')[0] ?? '',
    );
    expect(text(help)).toBe(
      'Enter the person ID exactly as the person gave it to you. The person must already be a confirmed member of your organization.',
    );
    expect(text(form?.querySelector('label[for="' + input?.id + '"]'))).toBe(
      'Person ID',
    );
  });

  it('has a native select of the generated registry in four labelled groups', () => {
    const select = form?.querySelector(
      'select[name="capability"]',
    ) as unknown as HTMLSelectElement | null;
    expect(select?.required).toBe(true);
    const groups = [...(select?.querySelectorAll('optgroup') ?? [])];
    expect(groups.map((group) => group.label)).toStrictEqual([
      'Design',
      'Authoring',
      'Delivery and media',
      'Review',
    ]);
    const options = [
      ...(select?.querySelectorAll('option[value]:not([value=""])') ?? []),
    ];
    expect(
      options.map((option) => option.getAttribute('value')).sort(),
    ).toStrictEqual([...GRANTABLE_CMS_CAPABILITIES].sort());
    for (const option of options) {
      expect(text(option)).toContain(option.getAttribute('value') ?? '');
      expect(text(option).length).toBeGreaterThan(
        (option.getAttribute('value') ?? '').length,
      );
    }
    expect(select?.value).toBe('');
  });

  it('bounds the date input by the server-computed term window (DEC-120)', () => {
    const input = form?.querySelector<HTMLInputElement>(
      'input[name="validThrough"]',
    );
    expect(input?.type).toBe('date');
    expect(input?.required).toBe(true);
    expect(input?.min).toBe('2026-10-02');
    expect(input?.max).toBe('2026-12-30');
    const help = doc.getElementById(
      (input?.getAttribute('aria-describedby') ?? '').split(' ')[0] ?? '',
    );
    expect(text(help)).toBe(
      'The grant ends at the end of this date (UTC) and lasts at most 90 days. You can renew it or revoke it at any time.',
    );
  });

  it('has an optional reason textarea with a live remaining-count text', () => {
    const area = form?.querySelector<HTMLTextAreaElement>(
      'textarea[name="reason"]',
    );
    expect(area?.required).toBe(false);
    expect(area?.getAttribute('maxlength')).toBe('256');
    expect(text(form)).toContain('256 characters remaining');
  });

  it('commits with a named button and the consequence', () => {
    const submit = form?.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    expect(text(submit)).toBe('Grant capability');
    expect(text(form)).toMatch(/at most 90 days/u);
  });
});

describe('[DEC-119] list and console states', () => {
  it.each([
    ['no-records', 'Grant a capability'],
    ['filter-miss', 'Reset filters'],
  ] as const)(
    'renders the %s empty state with one action',
    (reason, action) => {
      const doc = renderConsoleDocument(
        consoleProps({ initialList: { status: 'empty', reason } }),
      );
      expect(doc.querySelector('table')).toBeNull();
      expect(text(doc.querySelector('[data-empty-state]'))).toContain(action);
    },
  );

  it('renders a typed error with the request ID and Retry only when retryable', () => {
    const base = {
      status: 'error' as const,
      error: {
        code: 'RATE_LIMITED' as const,
        message: 'x',
        requestId: 'req-9',
      },
    };
    const retryable = renderConsoleDocument(
      consoleProps({
        initialList: { ...base, retryable: true, httpStatus: 429 },
      }),
    );
    expect(retryable.querySelector('[role="alert"]')?.textContent).toContain(
      'req-9',
    );
    expect(retryable.querySelector('[data-cms-retry-control]')).not.toBeNull();
    const final = renderConsoleDocument(
      consoleProps({ initialList: { ...base, retryable: false } }),
    );
    expect(final.querySelector('[data-cms-retry-control]')).toBeNull();
  });

  it('degrades with the last verified page kept and every command disabled', () => {
    const initial = successList();
    const doc = renderConsoleDocument(
      consoleProps({
        initialList: {
          status: 'degraded',
          data: initial.status === 'success' ? initial.data : null,
          requestId: 'req-1',
          lastVerifiedAt: '2026-10-02T11:59:00.000Z',
          retryable: true,
          httpStatus: 503,
        },
      }),
    );
    expect(rowFor(doc, GRANT_ID)).not.toBeNull();
    expect(text(doc)).toContain('Last verified');
    for (const control of doc.querySelectorAll<HTMLButtonElement>(
      'button[data-action="renew"], button[data-action="revoke"], form[data-operation-id] button[type="submit"]',
    ))
      expect(control.disabled).toBe(true);
  });

  it('renders the disabled-prerequisite reason with no commands', () => {
    const doc = renderConsoleDocument(
      consoleProps({
        variant: 'disabledPrerequisite',
        access: 'disabled',
        initialList: { status: 'disabled', reason: 'Dependency unavailable.' },
      }),
    );
    expect(text(doc)).toContain('Dependency unavailable.');
    expect(doc.querySelector('form[data-operation-id]')).toBeNull();
  });

  it('renders only the owner gate, with no protected label, for a hidden variant', () => {
    const doc = renderConsoleDocument(
      consoleProps({ variant: 'forbiddenHidden', access: 'not-rendered' }),
    );
    expect(text(doc)).toContain(
      'Only the organization owner can manage CMS access.',
    );
    expect(doc.querySelector('table')).toBeNull();
    expect(doc.body.innerHTML).not.toContain(SUBJECT_ID);
  });

  it('discloses the acting context label and the step-up window, never an identifier', () => {
    const doc = renderConsoleDocument(consoleProps());
    expect(text(doc)).toContain('Northwind Collective');
    expect(text(doc)).toMatch(
      /Verified until 12:05 UTC|Step-up required before commit/u,
    );
    const required = renderConsoleDocument(
      consoleProps({ contextEvidence: { stepUpState: 'required' } }),
    );
    expect(text(required)).toContain('Step-up required before commit');
    expect(text(required)).toContain(
      'Server-verified acting context unavailable',
    );
  });
});
