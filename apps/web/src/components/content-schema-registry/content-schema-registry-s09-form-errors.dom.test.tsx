// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryLockManager } from '../../lib/test-support/memory-lock-manager';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import {
  activationPreparation,
  passedDryRunPreparation,
  startDryRunPreparation,
} from './content-schema-registry-activation-preparation.test-support';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';
import {
  REQUEST_ID,
  REVIEW_ID,
  draftDetail,
  reviewResource,
} from './content-schema-review-dec108.test-support';
import {
  renderDocument,
  requireForm,
  reviewPageProps,
  successDetail,
  versionPageProps,
  type Dec108WorkbenchProps,
} from './content-schema-review-dec108-render.test-support';

/**
 * FE03 DEC-108 command forms (CMS-03A-09, -10, -11, -12, -14), composed as the
 * browser composes them: the REAL server-rendered native form markup is put in
 * the document, the REAL progressive-enhancement runtime submits it, and only
 * the network is scripted. Every status class the form criteria enumerate must
 * reach its error copy without leaking upstream text and with the input kept.
 */

const UPSTREAM_TEXT = 'UPSTREAM-DETAIL-MUST-NEVER-RENDER';
const locks = createMemoryLockManager();

interface FormCase {
  readonly title: string;
  readonly operationId: string;
  readonly props: () => Dec108WorkbenchProps;
  readonly path: string;
  readonly keptField: string;
}

const versionProps = (preparation: Parameters<typeof draftDetail>[0]) => () =>
  versionPageProps({
    initialDetail: successDetail(draftDetail(preparation)),
  });
const VERSION_PATH = '/app/cms-content-modeling/type/versions/version';
const REVIEW_PATH = `/app/cms-content-modeling/schema-reviews/${REVIEW_ID}`;

const CASES: readonly FormCase[] = [
  {
    title: '[P2-S09-AC-979] create successor (CMS-03A-09)',
    operationId: 'CMS-03A-09',
    props: versionProps(
      activationPreparation({ permittedNextActions: ['create_successor'] }),
    ),
    path: VERSION_PATH,
    keptField: 'expectedVersion',
  },
  {
    title: '[P2-S09-AC-980] start dry-run (CMS-03A-10)',
    operationId: 'CMS-03A-10',
    props: versionProps(startDryRunPreparation),
    path: VERSION_PATH,
    keptField: 'expectedVersion',
  },
  {
    title: '[P2-S09-AC-981] submit review (CMS-03A-11)',
    operationId: 'CMS-03A-11',
    props: versionProps(passedDryRunPreparation),
    path: VERSION_PATH,
    keptField: 'dryRunId',
  },
  {
    title: '[P2-S09-AC-982] record decision (CMS-03A-12)',
    operationId: 'CMS-03A-12',
    props: () =>
      reviewPageProps(reviewResource(), {
        variant: 'schemaReviewAssigned',
        access: 'read-only',
      }),
    path: REVIEW_PATH,
    keptField: 'expectedVersion',
  },
  {
    title: '[P2-S09-AC-983] assign reviewer (CMS-03A-14)',
    operationId: 'CMS-03A-14',
    props: () =>
      reviewPageProps(
        reviewResource({ permittedNextActions: ['assign_reviewer'] }),
        { variant: 'ownerFull', access: 'full' },
      ),
    path: REVIEW_PATH,
    keptField: 'expectedVersion',
  },
];

const body = (code: string, details: unknown = {}): string =>
  JSON.stringify({
    code,
    details,
    message: UPSTREAM_TEXT,
    requestId: REQUEST_ID,
  });
const respond = (
  status: number,
  payload: string,
  headers: Record<string, string> = {},
): Response =>
  new Response(payload, {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const mount = (testCase: FormCase): HTMLFormElement => {
  window.history.replaceState({}, '', `${testCase.path}?limit=25`);
  const document_ = renderDocument(testCase.props());
  document.body.innerHTML = document_.body.innerHTML;
  const form = requireForm(document, testCase.operationId);
  // The server-rendered form posts to its own page route.
  form.setAttribute('action', testCase.path);
  return form;
};

const submit = async (
  form: HTMLFormElement,
  done: () => boolean,
): Promise<void> => {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(done()).toBe(true));
};

beforeEach(() => {
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

describe.each(CASES)('$title status classes', (testCase) => {
  const run = async (
    response: () => Response,
    done: (navigate: ReturnType<typeof vi.fn>) => boolean,
  ) => {
    const form = mount(testCase);
    const navigate = vi.fn();
    const fetchStub = vi.fn(async () => response());
    vi.stubGlobal('fetch', fetchStub);
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate,
    });
    await submit(form, () => done(navigate));
    const kept = form.querySelector<HTMLInputElement>(
      `[name="${testCase.keptField}"]`,
    );
    cleanup();
    return { form, navigate, kept, fetchStub };
  };

  it('400 and 422 render a linked validation summary and keep the input', async () => {
    for (const status of [400, 422]) {
      const { form, kept } = await run(
        () =>
          respond(
            status,
            body('VALIDATION_FAILED', {
              violations: [{ path: `/${testCase.keptField}` }],
            }),
          ),
        () => document.querySelector('[data-cms-validation-summary]') !== null,
      );
      expect(
        form.querySelector('[data-cms-validation-summary]'),
      ).not.toBeNull();
      expect(kept?.value).not.toBe('');
      expect(document.body.textContent).not.toContain(UPSTREAM_TEXT);
      document.body.replaceChildren();
    }
  });

  it('401 sends a plain session to sign-in and a step-up recovery to /step-up', async () => {
    const plain = await run(
      () =>
        respond(
          401,
          body('UNAUTHENTICATED', { recoveryAction: 'reauthenticate' }),
        ),
      (navigate) => navigate.mock.calls.length > 0,
    );
    expect(plain.navigate).toHaveBeenCalledWith(
      `/auth/sign-in?returnTo=${encodeURIComponent(`${testCase.path}?limit=25`)}`,
    );
    document.body.replaceChildren();
    const stepUp = await run(
      () =>
        respond(
          401,
          body('STEP_UP_REQUIRED', {
            recoveryAction: 'step_up',
            allowedMethods: ['totp'],
          }),
        ),
      (navigate) => navigate.mock.calls.length > 0,
    );
    expect(stepUp.navigate).toHaveBeenCalledWith(
      `/step-up?returnTo=${encodeURIComponent(`${testCase.path}?limit=25`)}`,
    );
    expect(document.body.textContent).not.toContain(UPSTREAM_TEXT);
  });

  it('403 renders the capability gate and 404 the not-found line', async () => {
    const forbidden = await run(
      () => respond(403, body('FORBIDDEN')),
      () => document.querySelector('[data-cms-capability-gate]') !== null,
    );
    expect(
      forbidden.form.querySelector('[data-cms-capability-gate]'),
    ).not.toBeNull();
    document.body.replaceChildren();
    const missing = await run(
      () => respond(404, body('NOT_FOUND')),
      () => document.querySelector('[data-cms-command-status]') !== null,
    );
    expect(missing.form.textContent).toContain('was not found');
    expect(document.body.textContent).not.toContain(UPSTREAM_TEXT);
  });

  it('409 opens the sync-conflict recovery with the server and local versions', async () => {
    const { form } = await run(
      () =>
        respond(
          409,
          body('CONFLICT', { expectedVersion: '4', currentVersion: '5' }),
        ),
      () => document.querySelector('[data-cms-sync-conflict]') !== null,
    );
    expect(form.textContent).toContain('Server version: 5');
    expect(document.body.textContent).not.toContain(UPSTREAM_TEXT);
  });

  it('429 renders the Retry-After countdown copy', async () => {
    const { form } = await run(
      () => respond(429, body('RATE_LIMITED'), { 'retry-after': '30' }),
      () => document.body.textContent?.includes('Retry in 30 seconds') ?? false,
    );
    expect(form.textContent).toContain('Too many requests');
    expect(document.body.textContent).not.toContain(UPSTREAM_TEXT);
  });

  it.each([415, 500, 502, 503, 504])(
    '%i never claims success and offers a retry that does not leak upstream text',
    async (status) => {
      const { form, fetchStub } = await run(
        () => respond(status, body('DEPENDENCY_UNAVAILABLE')),
        () => document.querySelector('[data-cms-command-retry]') !== null,
      );
      expect(form.textContent).toContain('still being reconciled');
      expect(form.textContent).not.toMatch(/accepted/iu);
      expect(document.body.textContent).not.toContain(UPSTREAM_TEXT);
      // Only 503 and 504 are replayed once under the same idempotency key.
      expect(fetchStub).toHaveBeenCalledTimes(
        status === 503 || status === 504 ? 2 : 1,
      );
    },
  );
});
