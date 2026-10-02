// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import { createMemoryLockManager } from '../../lib/test-support/memory-lock-manager';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';
import {
  APPROVE_A_ID,
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  approveDecision,
  reviewResource,
} from './content-schema-review-dec108.test-support';
import {
  WorkbenchUnderTest,
  renderDocument,
  requireForm,
  reviewPageProps,
} from './content-schema-review-dec108-render.test-support';

/**
 * FE03 CMS-03A-12 / CMS-03A-14: the refreshed review announces the exact
 * decision with the updated recorded and required counts, and the assignment
 * state with its expiry, after the success redirect.
 */

const REVIEW_PATH = `/app/cms-content-modeling/schema-reviews/${REVIEW_ID}`;
const locks = createMemoryLockManager();
let root: Root | null = null;

const succeed = (): Response =>
  new Response(null, { status: 303, headers: { location: REVIEW_PATH } });

const stored = (): string => {
  const entries: [string, string | null][] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key !== null) entries.push([key, window.sessionStorage.getItem(key)]);
  }
  return JSON.stringify(entries);
};

const mountStatic = (operationId: 'CMS-03A-12' | 'CMS-03A-14') => {
  window.history.replaceState({}, '', REVIEW_PATH);
  const decision = operationId === 'CMS-03A-12';
  document.body.innerHTML = renderDocument(
    reviewPageProps(
      reviewResource(
        decision ? {} : { permittedNextActions: ['assign_reviewer'] },
      ),
      decision
        ? { variant: 'schemaReviewAssigned', access: 'read-only' }
        : { variant: 'ownerFull', access: 'full' },
    ),
  ).body.innerHTML;
  return requireForm(document, operationId);
};

const submitSucceeding = async (
  form: HTMLFormElement,
  navigate: Mock<(target: string) => void>,
): Promise<void> => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => succeed()),
  );
  const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
    navigate,
  });
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
  cleanup();
};

const mountReview = (review = reviewResource()): HTMLElement => {
  const container = document.createElement('div');
  (document.body as unknown as HTMLElement).replaceChildren(container);
  root = createRoot(container);
  const props = reviewPageProps(review, {
    variant: 'schemaReviewAssigned',
    access: 'read-only',
  });
  act(() => root?.render(React.createElement(WorkbenchUnderTest, props)));
  return container;
};

const flashText = (container: HTMLElement): string | null =>
  container.querySelector('[data-review-flash]')?.textContent ?? null;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: new MemoryStorage(),
  });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: locks.manager,
  });
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  vi.unstubAllGlobals();
  locks.releaseAll();
  document.body.replaceChildren();
});

describe('decision announcement after the success redirect', () => {
  it('[P2-S09-AC-982] leaves an identifier-free note naming only the decision', async () => {
    const form = mountStatic('CMS-03A-12');
    form.querySelector<HTMLInputElement>(
      'input[name="decision"][value="approve"]',
    )!.checked = true;
    const navigate = vi.fn<(target: string) => void>();
    await submitSucceeding(form, navigate);
    expect(navigate).toHaveBeenCalledWith(REVIEW_PATH);
    expect(stored()).toContain('approve');
    expect(stored()).not.toContain(REVIEWER_PERSON_ID);
  });

  it('[P2-S09-AC-982] announces the exact decision and the updated recorded and required counts once', async () => {
    const form = mountStatic('CMS-03A-12');
    form.querySelector<HTMLInputElement>(
      'input[name="decision"][value="approve"]',
    )!.checked = true;
    await submitSucceeding(form, vi.fn<(target: string) => void>());
    const refreshed = reviewResource({
      requiredDecisionCount: 2,
      recordedDecisionCount: 1,
      distinctApprovalCount: 1,
      decisions: [approveDecision(APPROVE_A_ID)],
    });
    const container = mountReview(refreshed);
    expect(flashText(container)).toBe(
      'Your approve decision was recorded. 1 of 2 required decisions are recorded.',
    );
    const status = container.querySelector('[data-review-flash]');
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    act(() => root?.unmount());
    root = null;
    expect(flashText(mountReview(refreshed))).toBeNull();
  });

  it('[P2-S09-AC-982] announces nothing when no decision was just recorded', () => {
    expect(flashText(mountReview())).toBeNull();
  });
});

describe('assignment announcement after the success redirect', () => {
  it('[P2-S09-AC-983] announces the active assignment state and its expiry', async () => {
    const form = mountStatic('CMS-03A-14');
    form.querySelector<HTMLInputElement>('[name="reviewerPersonId"]')!.value =
      REVIEWER_PERSON_ID;
    form.querySelector<HTMLInputElement>('[name="expiresAt"]')!.value =
      '2026-10-05T12:00:00.000Z';
    await submitSucceeding(form, vi.fn<(target: string) => void>());
    expect(stored()).not.toContain(REVIEWER_PERSON_ID);
    expect(flashText(mountReview())).toBe(
      'Reviewer assignment is active. Access ends 2026-10-05T12:00:00.000Z.',
    );
  });

  it('[P2-S09-AC-983] announces a revoked assignment', async () => {
    window.history.replaceState({}, '', REVIEW_PATH);
    document.body.innerHTML = `<form data-cms-command-form="true" data-operation-id="CMS-03A-14" action="${REVIEW_PATH}" method="post">
      <input type="hidden" name="idempotency-key" value="revoke-key-123" />
      <input type="hidden" name="action" value="revoke" />
      <input type="hidden" name="assignmentId" value="b4a1c2d3-0000-7000-8000-000000000001" />
      <fieldset><button type="submit">Revoke</button></fieldset></form>`;
    const form = document.querySelector('form') as HTMLFormElement;
    await submitSucceeding(form, vi.fn<(target: string) => void>());
    expect(flashText(mountReview())).toBe('Reviewer assignment revoked.');
  });
});
