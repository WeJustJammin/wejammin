// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  reviewResource,
} from './content-schema-review-dec108.test-support';
import {
  WorkbenchUnderTest,
  commandForm,
  fieldRecord,
  renderDocument,
  requireForm,
  reviewPageProps,
} from './content-schema-review-dec108-render.test-support';

/**
 * FE03 "Reviewer selection (CMS-03A-14 create)": the owner-only assignment
 * form has one native UUID text input for the reviewer's person ID, validates
 * it on blur and on submit, bounds the expiry to seven days, and never echoes
 * the value back.
 */

const NOW = Date.parse('2026-10-02T12:00:00.000Z');
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const HELPER =
  'Enter the person ID exactly as the reviewer gave it to you. The reviewer must be an existing person; the assignment gives read and decide access to this one review for at most seven days.';
const INVALID_COPY = "Enter the reviewer's person ID as a UUID.";

const ownerReview = () =>
  reviewResource({ permittedNextActions: ['assign_reviewer'] });
const ownerPage = (overrides: Parameters<typeof reviewPageProps>[1] = {}) =>
  reviewPageProps(ownerReview(), {
    variant: 'ownerFull',
    access: 'full',
    ...overrides,
  });

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const mountOwner = (): HTMLFormElement => {
  container = document.createElement('div');
  (document.body as unknown as HTMLElement).appendChild(container);
  root = createRoot(container);
  act(() => root?.render(React.createElement(WorkbenchUnderTest, ownerPage())));
  return requireForm(container.ownerDocument, 'CMS-03A-14');
};

const typeInto = (input: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const blur = (input: HTMLInputElement): void => {
  act(() => {
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
};

const submitEvent = (form: HTMLFormElement): boolean => {
  let allowed = true;
  act(() => {
    allowed = form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  });
  return allowed;
};

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
});

describe('[DEC-108] assignment form visibility (owner only)', () => {
  it('[P2-S09-AC-988] renders for the owner when the server permits assign_reviewer on an open review', () => {
    expect(
      commandForm(renderDocument(ownerPage()), 'CMS-03A-14'),
    ).not.toBeNull();
  });

  it.each([
    [
      'the review-only variant',
      { variant: 'schemaReviewAssigned', access: 'read-only' },
    ],
    [
      'an entitled read variant',
      { variant: 'entitledRead', access: 'read-only' },
    ],
  ] as const)(
    '[P2-S09-AC-988] [P2-S09-AC-989] is not rendered for %s even if assign_reviewer is listed',
    (_label, overrides) => {
      // Control: the owner variant with the same review renders it.
      expect(
        commandForm(renderDocument(ownerPage()), 'CMS-03A-14'),
      ).not.toBeNull();
      const doc = renderDocument(ownerPage(overrides));
      expect(commandForm(doc, 'CMS-03A-14')).toBeNull();
    },
  );

  it('[P2-S09-AC-988] [P2-S09-AC-989] is not rendered unless the server lists assign_reviewer', () => {
    expect(
      commandForm(renderDocument(ownerPage()), 'CMS-03A-14'),
    ).not.toBeNull();
    const doc = renderDocument(
      reviewPageProps(reviewResource({ permittedNextActions: [] }), {
        variant: 'ownerFull',
        access: 'full',
      }),
    );
    expect(commandForm(doc, 'CMS-03A-14')).toBeNull();
  });

  it('is not rendered for a review that is no longer open', () => {
    expect(
      commandForm(renderDocument(ownerPage()), 'CMS-03A-14'),
    ).not.toBeNull();
    const doc = renderDocument(
      reviewPageProps(
        reviewResource({
          state: 'rejected',
          permittedNextActions: ['assign_reviewer'],
        }),
        { variant: 'ownerFull', access: 'full' },
      ),
    );
    expect(commandForm(doc, 'CMS-03A-14')).toBeNull();
  });
});

describe('[DEC-108] assignment form fields', () => {
  const form = () => requireForm(renderDocument(ownerPage()), 'CMS-03A-14');

  it('posts the create variant natively with the review ETag and version', () => {
    const fields = fieldRecord(form());
    expect(form().getAttribute('action')).toBe(
      `/app/cms-content-modeling/schema-reviews/${REVIEW_ID}`,
    );
    expect(fields.operationId).toBe('CMS-03A-14');
    expect(fields.action).toBe('create');
    expect(fields.expectedVersion).toBe('3');
    expect(fields['if-match']).toBe('"3"');
  });

  it('[P2-S09-AC-975] [P2-S09-AC-976] has one labelled native UUID text input with the exact helper copy', () => {
    const input = form().querySelector<HTMLInputElement>(
      '[name="reviewerPersonId"]',
    );
    expect(input?.tagName).toBe('INPUT');
    expect(input?.type).toBe('text');
    expect(input?.required).toBe(true);
    expect(input?.value).toBe('');
    expect(form().querySelector(`label[for="${input?.id}"]`)).not.toBeNull();
    const describedBy = input?.getAttribute('aria-describedby') ?? '';
    const helper = describedBy
      .split(/\s+/u)
      .map((id) => form().ownerDocument.getElementById(id)?.textContent)
      .join(' ');
    expect(helper).toContain(HELPER);
  });

  it('offers no reviewer picker, search or list', () => {
    expect(
      form().querySelectorAll('select, datalist, [role="listbox"]'),
    ).toHaveLength(0);
  });

  it('collects an expiry as a named expiresAt field', () => {
    expect(form().querySelector('[name="expiresAt"]')).not.toBeNull();
  });
});

describe('[DEC-108] reviewer UUID validation', () => {
  it('[P2-S09-AC-975] [P2-S09-AC-976] shows the inline error on blur for a non-UUID and links it to the field', () => {
    const form = mountOwner();
    const input = form.querySelector<HTMLInputElement>(
      '[name="reviewerPersonId"]',
    )!;
    typeInto(input, 'not-a-uuid');
    blur(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const error = form.querySelector(
      `#${(input.getAttribute('aria-describedby') ?? '').split(/\s+/u).join(', #')}`,
    );
    expect(form.textContent).toContain(INVALID_COPY);
    expect(error).not.toBeNull();
  });

  it('clears the error once a valid UUID is entered', () => {
    const form = mountOwner();
    const input = form.querySelector<HTMLInputElement>(
      '[name="reviewerPersonId"]',
    )!;
    typeInto(input, 'not-a-uuid');
    blur(input);
    typeInto(input, REVIEWER_PERSON_ID);
    blur(input);
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    expect(form.textContent).not.toContain(INVALID_COPY);
  });

  it('[P2-S09-AC-975] blocks submit for an invalid UUID and allows it for a valid one', () => {
    const form = mountOwner();
    const input = form.querySelector<HTMLInputElement>(
      '[name="reviewerPersonId"]',
    )!;
    const expiry = form.querySelector<HTMLInputElement>('[name="expiresAt"]')!;
    typeInto(expiry, new Date(NOW + 24 * 60 * 60 * 1000).toISOString());
    typeInto(input, 'not-a-uuid');
    expect(submitEvent(form)).toBe(false);
    expect(form.textContent).toContain(INVALID_COPY);
    typeInto(input, REVIEWER_PERSON_ID);
    expect(submitEvent(form)).toBe(true);
  });
});

describe('[DEC-108] seven-day expiry bound', () => {
  const attempt = (offsetMs: number): { allowed: boolean; text: string } => {
    const form = mountOwner();
    typeInto(
      form.querySelector<HTMLInputElement>('[name="reviewerPersonId"]')!,
      REVIEWER_PERSON_ID,
    );
    typeInto(
      form.querySelector<HTMLInputElement>('[name="expiresAt"]')!,
      new Date(NOW + offsetMs).toISOString(),
    );
    const allowed = submitEvent(form);
    return { allowed, text: form.textContent ?? '' };
  };

  it('accepts an expiry up to exactly seven days from now', () => {
    expect(attempt(SEVEN_DAYS_MS).allowed).toBe(true);
  });

  it('refuses an expiry beyond seven days and says why', () => {
    const outcome = attempt(SEVEN_DAYS_MS + 1_000);
    expect(outcome.allowed).toBe(false);
    expect(outcome.text).toMatch(/seven days/iu);
  });

  it('refuses an expiry that is not in the future', () => {
    expect(attempt(-1_000).allowed).toBe(false);
  });
});
