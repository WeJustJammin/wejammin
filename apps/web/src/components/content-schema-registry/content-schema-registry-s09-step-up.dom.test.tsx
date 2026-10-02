// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryLockManager } from '../../lib/test-support/memory-lock-manager';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';
import {
  REQUEST_ID,
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  reviewResource,
} from './content-schema-review-dec108.test-support';
import {
  renderDocument,
  requireForm,
  reviewPageProps,
} from './content-schema-review-dec108-render.test-support';

/**
 * FE03/FE00 401 `STEP_UP_REQUIRED` recovery for the schema-review commands
 * (CMS-03A-12 and CMS-03A-14), composed from the REAL server-rendered forms and
 * the REAL enhancement runtime: the typed `{ recoveryAction, allowedMethods }`
 * details are parsed, only `totp` counts, an empty list or a malformed shape is
 * a degraded state (never a redirect or a 403 gate), the scoped draft survives
 * the detour without codes or identifiers, and the form is restored for explicit
 * re-confirmation without any automatic submit.
 */

const REVIEW_PATH = `/app/cms-content-modeling/schema-reviews/${REVIEW_ID}`;
const locks = createMemoryLockManager();

const stepUpBody = (details: unknown): string =>
  JSON.stringify({
    code: 'STEP_UP_REQUIRED',
    details,
    message: 'Recent verification is required.',
    requestId: REQUEST_ID,
  });

const respond = (status: number, body: string): Response =>
  new Response(body, {
    status,
    headers: { 'content-type': 'application/json' },
  });

const mountDecisionForm = (): HTMLFormElement => {
  window.history.replaceState({}, '', `${REVIEW_PATH}?tab=evidence`);
  document.body.innerHTML = renderDocument(
    reviewPageProps(reviewResource(), {
      variant: 'schemaReviewAssigned',
      access: 'read-only',
    }),
  ).body.innerHTML;
  return requireForm(document, 'CMS-03A-12');
};

const mountAssignmentForm = (): HTMLFormElement => {
  window.history.replaceState({}, '', REVIEW_PATH);
  document.body.innerHTML = renderDocument(
    reviewPageProps(
      reviewResource({ permittedNextActions: ['assign_reviewer'] }),
      { variant: 'ownerFull', access: 'full' },
    ),
  ).body.innerHTML;
  return requireForm(document, 'CMS-03A-14');
};

const choose = (form: HTMLFormElement, value: string): void => {
  const radio = form.querySelector<HTMLInputElement>(
    `input[name="decision"][value="${value}"]`,
  );
  if (radio === null) throw new Error(`no ${value} radio`);
  radio.checked = true;
};

const submit = (form: HTMLFormElement): void => {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

const stored = (): string => {
  const entries: [string, string | null][] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key !== null) entries.push([key, window.sessionStorage.getItem(key)]);
  }
  return JSON.stringify(entries);
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

describe('typed step-up details', () => {
  const run = async (details: unknown) => {
    const form = mountDecisionForm();
    choose(form, 'approve');
    const navigate = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respond(401, stepUpBody(details))),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate,
    });
    submit(form);
    await vi.waitFor(() =>
      expect(
        navigate.mock.calls.length > 0 ||
          document.querySelector('[data-cms-command-status]') !== null,
      ).toBe(true),
    );
    cleanup();
    return { form, navigate };
  };

  it('[P2-S09-AC-1029] [P2-S09-AC-1028] navigates to /step-up for the typed { recoveryAction, allowedMethods } details', async () => {
    const { navigate } = await run({
      recoveryAction: 'step_up',
      allowedMethods: ['totp'],
    });
    expect(navigate).toHaveBeenCalledWith(
      `/step-up?returnTo=${encodeURIComponent(`${REVIEW_PATH}?tab=evidence`)}`,
    );
  });

  it.each([
    [
      'an unknown recovery action',
      { recoveryAction: 'reauthenticate', allowedMethods: ['totp'] },
    ],
    ['a missing method list', { recoveryAction: 'step_up' }],
    [
      'a non-array method list',
      { recoveryAction: 'step_up', allowedMethods: 'totp' },
    ],
    [
      'an extra member',
      { recoveryAction: 'step_up', allowedMethods: ['totp'], extra: 1 },
    ],
    ['empty details', {}],
  ] as const)(
    '[P2-S09-AC-1028] treats %s as a malformed degraded response, not a recovery',
    async (_label, details) => {
      const { form, navigate } = await run(details);
      expect(navigate).not.toHaveBeenCalled();
      const status = form.querySelector('[data-cms-command-status]');
      expect(status?.textContent).toMatch(/could not be read/iu);
      expect(status?.textContent).not.toMatch(/sign in/iu);
      expect(form.querySelector('[data-cms-capability-gate]')).toBeNull();
      expect(stored()).not.toMatch(/draft/iu);
    },
  );

  it.each([
    ['an empty list', []],
    ['only unsupported methods', ['sms', 'email']],
  ] as const)(
    '[P2-S09-AC-1030] renders "No verification method is available" with the request ID for %s',
    async (_label, allowedMethods) => {
      const { form, navigate } = await run({
        recoveryAction: 'step_up',
        allowedMethods,
      });
      expect(navigate).not.toHaveBeenCalled();
      const status = form.querySelector('[data-cms-command-status]');
      expect(status?.getAttribute('role')).toBe('alert');
      expect(status?.textContent).toContain(
        'No verification method is available',
      );
      expect(status?.textContent).toContain(REQUEST_ID);
      expect(form.querySelector('[data-cms-capability-gate]')).toBeNull();
    },
  );

  it('[P2-S09-AC-1030] ignores methods other than totp and still routes to step-up', async () => {
    const { navigate } = await run({
      recoveryAction: 'step_up',
      allowedMethods: ['sms', 'totp'],
    });
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('[P2-S09-AC-1027] keeps a plain 401 UNAUTHENTICATED as reauthentication and never as step-up or a gate', async () => {
    const form = mountDecisionForm();
    const navigate = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respond(
          401,
          JSON.stringify({
            code: 'UNAUTHENTICATED',
            details: { recoveryAction: 'reauthenticate' },
            message: 'Sign in.',
            requestId: REQUEST_ID,
          }),
        ),
      ),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate,
    });
    submit(form);
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(navigate.mock.calls[0]?.[0]).toMatch(/^\/auth\/sign-in\?returnTo=/u);
    expect(form.querySelector('[data-cms-capability-gate]')).toBeNull();
    cleanup();
  });
});

describe('scoped draft across the step-up detour', () => {
  const detour = async (form: HTMLFormElement) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respond(
          401,
          stepUpBody({ recoveryAction: 'step_up', allowedMethods: ['totp'] }),
        ),
      ),
    );
    const navigate = vi.fn();
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate,
    });
    submit(form);
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    cleanup();
  };

  it('[P2-S09-AC-1139] [P2-S09-AC-1069] [P2-S09-AC-1031] persists the tab-scoped draft with the original idempotency key and expected version, and no code, secret or identifier', async () => {
    const form = mountDecisionForm();
    choose(form, 'reject');
    const key = form.querySelector<HTMLInputElement>(
      '[name="idempotency-key"]',
    )?.value;
    await detour(form);
    const raw = stored();
    expect(raw).toContain('reject');
    expect(raw).toContain(key ?? 'missing-key');
    expect(raw).toMatch(/expectedVersion\\*":\\*"3/u);
    expect(raw).not.toMatch(/csrf/iu);
    expect(raw).not.toMatch(/"(?:code|otp|totp|password|token)"/iu);
    expect(raw).not.toContain(REVIEWER_PERSON_ID);
  });

  it('[P2-S09-AC-1031] never persists the reviewer person ID of an assignment', async () => {
    const form = mountAssignmentForm();
    form.querySelector<HTMLInputElement>('[name="reviewerPersonId"]')!.value =
      REVIEWER_PERSON_ID;
    form.querySelector<HTMLInputElement>('[name="expiresAt"]')!.value =
      '2026-10-05T12:00:00.000Z';
    await detour(form);
    expect(stored()).toContain('2026-10-05T12:00:00.000Z');
    expect(stored()).not.toContain(REVIEWER_PERSON_ID);
  });

  it('[P2-S09-AC-1139] [P2-S09-AC-1032] restores the draft after step-up, reuses the original key, announces it and waits for explicit confirmation', async () => {
    const first = mountDecisionForm();
    choose(first, 'reject');
    const key = first.querySelector<HTMLInputElement>(
      '[name="idempotency-key"]',
    )?.value;
    await detour(first);
    // The person returns: the page is rendered anew with a fresh key.
    const form = mountDecisionForm();
    const fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate: vi.fn(),
    });
    expect(
      form.querySelector<HTMLInputElement>('input[name="decision"]:checked')
        ?.value,
    ).toBe('reject');
    expect(
      form.querySelector<HTMLInputElement>('[name="idempotency-key"]')?.value,
    ).toBe(key);
    expect(form.textContent).toContain(
      'Verification complete. Review and confirm to continue.',
    );
    expect(document.activeElement).toBe(
      form.querySelector('button[type="submit"]'),
    );
    expect(fetchStub).not.toHaveBeenCalled();
    cleanup();
  });

  it('[P2-S09-AC-1032] consumes the draft once so a later visit restores nothing', async () => {
    const first = mountDecisionForm();
    choose(first, 'reject');
    await detour(first);
    mountDecisionForm();
    installContentSchemaRegistryCommandEnhancement(document, {
      navigate: vi.fn(),
    })();
    const again = mountDecisionForm();
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate: vi.fn(),
    });
    expect(again.querySelector('input[name="decision"]:checked')).toBeNull();
    expect(again.textContent).not.toContain('Verification complete');
    cleanup();
  });

  it('[P2-S09-AC-1032] opens the sync conflict when the expected version changed during step-up', async () => {
    const first = mountDecisionForm();
    choose(first, 'approve');
    await detour(first);
    window.history.replaceState({}, '', REVIEW_PATH);
    document.body.innerHTML = renderDocument(
      reviewPageProps(reviewResource({ version: '4' }), {
        variant: 'schemaReviewAssigned',
        access: 'read-only',
      }),
    ).body.innerHTML;
    const form = requireForm(document, 'CMS-03A-12');
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate: vi.fn(),
    });
    const conflict = form.querySelector('[data-cms-sync-conflict]');
    expect(conflict).not.toBeNull();
    expect(conflict?.textContent).toContain('Server version: 4');
    expect(conflict?.textContent).toContain('Local version: 3');
    cleanup();
  });
});

describe('returnTo computed from the current relative location', () => {
  const stepUpTarget = async (url: string): Promise<string> => {
    const form = mountDecisionForm();
    window.history.replaceState({}, '', url);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respond(
          401,
          stepUpBody({ recoveryAction: 'step_up', allowedMethods: ['totp'] }),
        ),
      ),
    );
    const navigate = vi.fn<(target: string) => void>();
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate,
    });
    submit(form);
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    cleanup();
    return navigate.mock.calls[0]?.[0] ?? '';
  };

  it('[P2-S09-AC-1069] sends the path plus query when it fits in 512 characters', async () => {
    expect(await stepUpTarget(`${REVIEW_PATH}?tab=evidence`)).toBe(
      `/step-up?returnTo=${encodeURIComponent(`${REVIEW_PATH}?tab=evidence`)}`,
    );
  });

  it('[P2-S09-AC-1069] sends the path alone when the path plus query exceeds 512 characters', async () => {
    const target = await stepUpTarget(`${REVIEW_PATH}?note=${'a'.repeat(520)}`);
    expect(target).toBe(`/step-up?returnTo=${encodeURIComponent(REVIEW_PATH)}`);
  });

  it('[P2-S09-AC-1069] falls back to /app when even the path is not a usable return target', async () => {
    const target = await stepUpTarget(`/${'b'.repeat(600)}`);
    expect(target).toBe('/step-up?returnTo=%2Fapp');
  });
});
