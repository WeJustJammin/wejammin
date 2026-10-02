// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryLockManager } from '../../lib/test-support/memory-lock-manager';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import {
  activationPreparation,
  passedDryRunPreparation,
} from './content-schema-registry-activation-preparation.test-support';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';
import {
  APPROVE_A_ID,
  DRY_RUN_ID,
  JOB_ID,
  REQUEST_ID,
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  approveDecision,
  draftDetail,
  reviewResource,
} from './content-schema-review-dec108.test-support';
import {
  WorkbenchUnderTest,
  commandForm,
  renderDocument,
  requireForm,
  reviewPageProps,
  successDetail,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';

/**
 * FE03 review criteria that need composition rather than a single component:
 * submit-review readiness, the non-disclosing reviewer-assignment refusal, the
 * reviewer identifier never reaching a browser sink, and the decision form's
 * step-up disclosure re-evaluated on expiry.
 */

const REVIEW_PATH = `/app/cms-content-modeling/schema-reviews/${REVIEW_ID}`;
const locks = createMemoryLockManager();
const REVIEW_ID_FOR_REF = '3c7a51e8-9f24-7b60-8d13-a5e4c2f09b78';

const dryRun = (
  state: 'queued' | 'running' | 'completed' | 'failed',
  result: 'passed' | 'failed' | null,
) => ({ id: DRY_RUN_ID, state, result, jobId: JOB_ID });

describe('submit review readiness', () => {
  const FORM = 'CMS-03A-11';
  const page = (preparation: Parameters<typeof draftDetail>[0]) =>
    renderDocument(
      versionPageProps({
        initialDetail: successDetail(draftDetail(preparation)),
      }),
    );

  it.each([
    ['no dry run', null, null],
    ['a queued dry run', dryRun('queued', null), 'running'],
    ['a running dry run', dryRun('running', null), 'running'],
    ['a sealed failed dry run', dryRun('completed', 'failed'), 'succeeded'],
    ['an unsealed failed dry run', dryRun('failed', null), 'failed'],
    [
      'a succeeded job with no sealed report',
      dryRun('running', null),
      'succeeded',
    ],
    ['a cancelled job', dryRun('failed', null), 'cancelled'],
  ] as const)(
    '[P2-S09-AC-960] [P2-S09-AC-981] [P2-S09-AC-1045] renders no submit-review form for %s even when the server lists submit_review',
    (_label, dryRunRef, job) => {
      const preparation = activationPreparation({
        dryRunRef,
        jobRef: job === null ? null : { id: JOB_ID, state: job },
        permittedNextActions: ['submit_review'],
      });
      expect(commandForm(page(preparation), FORM)).toBeNull();
    },
  );

  it('[P2-S09-AC-981] renders the form only for a sealed passed dry run that the server lists', () => {
    expect(commandForm(page(passedDryRunPreparation), FORM)).not.toBeNull();
    const unlisted = activationPreparation({
      dryRunRef: dryRun('completed', 'passed'),
      jobRef: { id: JOB_ID, state: 'succeeded' },
      permittedNextActions: [],
    });
    expect(commandForm(page(unlisted), FORM)).toBeNull();
  });
});

describe('reviewer assignment refusal and privacy', () => {
  let root: Root | null = null;

  const mountOwner = (): HTMLFormElement => {
    window.history.replaceState({}, '', REVIEW_PATH);
    const container = document.createElement('div');
    (document.body as unknown as HTMLElement).appendChild(container);
    root = createRoot(container);
    const props = reviewPageProps(
      reviewResource({ permittedNextActions: ['assign_reviewer'] }),
      { variant: 'ownerFull', access: 'full' },
    );
    act(() => root?.render(React.createElement(WorkbenchUnderTest, props)));
    const form = requireForm(document, 'CMS-03A-14');
    form.querySelector<HTMLInputElement>('[name="reviewerPersonId"]')!.value =
      REVIEWER_PERSON_ID;
    form.querySelector<HTMLInputElement>('[name="expiresAt"]')!.value =
      new Date(Date.now() + 86_400_000).toISOString();
    return form;
  };

  const refuse = async (message: string): Promise<string> => {
    const form = mountOwner();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 'CONFLICT',
              details: { expectedVersion: '3', currentVersion: '3' },
              message,
              requestId: REQUEST_ID,
            }),
            { status: 409, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate: vi.fn(),
    });
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() =>
      expect(form.querySelector('[data-cms-sync-conflict]')).not.toBeNull(),
    );
    const visible = form.querySelector('[data-cms-sync-conflict]')
      ?.textContent as string;
    cleanup();
    act(() => root?.unmount());
    document.body.replaceChildren();
    return visible;
  };

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
    vi.unstubAllGlobals();
    locks.releaseAll();
    document.body.replaceChildren();
  });

  it('[P2-S09-AC-977] renders one identical refusal for unknown, ineligible, submitter and broad-scope targets', async () => {
    const unknown = await refuse('reviewer person does not exist');
    const ineligible = await refuse('reviewer is not eligible');
    const submitter = await refuse('reviewer is the submitter');
    const broad = await refuse('reviewer holds broad scope');
    expect(unknown.length).toBeGreaterThan(0);
    expect(new Set([unknown, ineligible, submitter, broad]).size).toBe(1);
    for (const text of [unknown, ineligible, submitter, broad]) {
      expect(text).not.toMatch(/exist|eligible|submitter|broad/iu);
      expect(text).not.toContain(REVIEWER_PERSON_ID);
    }
  });

  it('[P2-S09-AC-978] never writes the reviewer ID to a URL, Web Storage, cookie, history or a message', async () => {
    const form = mountOwner();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 'CONFLICT',
              details: { expectedVersion: '3', currentVersion: '4' },
              message: 'refused',
              requestId: REQUEST_ID,
            }),
            { status: 409, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate: vi.fn(),
    });
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() =>
      expect(form.querySelector('[data-cms-sync-conflict]')).not.toBeNull(),
    );
    expect(window.location.href).not.toContain(REVIEWER_PERSON_ID);
    expect(JSON.stringify(window.history.state ?? null)).not.toContain(
      REVIEWER_PERSON_ID,
    );
    expect(document.cookie).not.toContain(REVIEWER_PERSON_ID);
    expect(JSON.stringify(Object.entries(window.sessionStorage))).not.toContain(
      REVIEWER_PERSON_ID,
    );
    expect(JSON.stringify(Object.entries(window.localStorage))).not.toContain(
      REVIEWER_PERSON_ID,
    );
    for (const message of document.querySelectorAll(
      '[role="status"], [role="alert"], [data-cms-command-status]',
    ))
      expect(message.textContent).not.toContain(REVIEWER_PERSON_ID);
    cleanup();
    act(() => root?.unmount());
  });
});

describe('decision form step-up disclosure', () => {
  let root: Root | null = null;
  const NOW = Date.parse('2026-10-02T12:00:00.000Z');

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    act(() => root?.unmount());
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it('[P2-S09-AC-982] [P2-S09-AC-1040] re-evaluates the disclosure on expiry without a reload', () => {
    const container = document.createElement('div');
    (document.body as unknown as HTMLElement).appendChild(container);
    root = createRoot(container);
    const props = reviewPageProps(reviewResource(), {
      variant: 'schemaReviewAssigned',
      access: 'read-only',
      stepUpState: 'verified',
      stepUpFreshUntil: '2026-10-02T12:05:00.000Z',
      actingContextLabel: 'Northwind Collective',
    });
    act(() => root?.render(React.createElement(WorkbenchUnderTest, props)));
    const form = requireForm(document, 'CMS-03A-12');
    expect(form.textContent).toContain('Verified until 12:05 UTC');
    act(() => {
      vi.setSystemTime(NOW + 6 * 60_000);
      vi.advanceTimersByTime(60_000);
    });
    expect(form.textContent).not.toContain('Verified until');
    expect(form.textContent).toContain('Step-up required before commit');
    expect(form.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/iu);
  });
});

describe('review approval and 409 reconciliation', () => {
  it('[P2-S09-AC-1046] never derives an approved review or an activation form from the decision counts', () => {
    // The counts are met locally, but the server state is still open.
    const doc = renderDocument(
      reviewPageProps(
        reviewResource({
          state: 'open',
          requiredDecisionCount: 1,
          recordedDecisionCount: 1,
          distinctApprovalCount: 1,
          decisions: [approveDecision(APPROVE_A_ID)],
          permittedNextActions: [],
        }),
        { variant: 'ownerFull', access: 'full' },
      ),
    );
    const text = doc.body.textContent ?? '';
    expect(text).not.toMatch(/review is approved/iu);
    expect(text).not.toContain('Approval evidence');
    expect(commandForm(doc, 'CMS-03A-04')).toBeNull();
    const version = renderDocument(
      versionPageProps({
        initialDetail: successDetail(
          draftDetail(
            activationPreparation({
              dryRunRef: dryRun('completed', 'passed'),
              jobRef: { id: JOB_ID, state: 'succeeded' },
              reviewRef: { id: REVIEW_ID_FOR_REF, state: 'open' },
              permittedNextActions: ['activate'],
            }),
          ),
        ),
        initialReview: {
          status: 'success',
          data: reviewResource({
            state: 'open',
            requiredDecisionCount: 1,
            recordedDecisionCount: 1,
            distinctApprovalCount: 1,
            decisions: [approveDecision(APPROVE_A_ID)],
          }),
          version: '3',
          stale: false,
        },
      }),
    );
    expect(commandForm(version, 'CMS-03A-04')).toBeNull();
  });

  it.each([
    'duplicate decision',
    'self decision',
    'out-of-policy decision',
    'stale review version',
    'idempotency conflict',
  ])(
    '[P2-S09-AC-1046] a 409 for a %s opens the conflict recovery and is never retried automatically',
    async (reason) => {
      window.history.replaceState({}, '', REVIEW_PATH);
      document.body.innerHTML = renderDocument(
        reviewPageProps(reviewResource(), {
          variant: 'schemaReviewAssigned',
          access: 'read-only',
        }),
      ).body.innerHTML;
      const form = requireForm(document, 'CMS-03A-12');
      form.querySelector<HTMLInputElement>(
        'input[name="decision"][value="approve"]',
      )!.checked = true;
      const fetchStub = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 'CONFLICT',
              details: { expectedVersion: '3', currentVersion: '4' },
              message: reason,
              requestId: REQUEST_ID,
            }),
            { status: 409, headers: { 'content-type': 'application/json' } },
          ),
      );
      vi.stubGlobal('fetch', fetchStub);
      const navigate = vi.fn();
      const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
        navigate,
      });
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
      await vi.waitFor(() =>
        expect(form.querySelector('[data-cms-sync-conflict]')).not.toBeNull(),
      );
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(fetchStub).toHaveBeenCalledTimes(1);
      expect(form.querySelector('[data-cms-command-retry]')).toBeNull();
      expect(form.textContent).not.toContain(reason);
      // Reconciling means reading the current review before any retry.
      const review = [...form.querySelectorAll('button')].find((button) =>
        /review current version/iu.test(button.textContent ?? ''),
      );
      review?.click();
      expect(navigate).toHaveBeenCalledWith(REVIEW_PATH);
      cleanup();
    },
  );
});
