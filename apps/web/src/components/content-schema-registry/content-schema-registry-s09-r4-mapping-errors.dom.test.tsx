// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { contentSchemaRegistryRoutePolicies } from '@wejammin/contracts';

import { executeContentSchemaRegistryMutation } from './content-schema-registry-runtime';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';
import { safeOutcomeMessage } from './content-schema-registry-runtime-dom-feedback';
import { CONTENT_SCHEMA_REGISTRY_SAFE_ERROR_MESSAGES } from './content-schema-registry-types';
import {
  CASES,
  closeMounted,
} from './content-schema-registry-s09-r4-mapping-forms.test-support';

/**
 * FE03 "Error class ownership" for the browser command operations: every
 * generated error row of CMS-03A-01 to CMS-03A-04 and CMS-03A-09 to CMS-03A-14
 * reaches exactly one UI error class, the real runtime renders that class from
 * a closed vocabulary, and no server text is shown.
 */

afterEach(() => {
  closeMounted();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

const COMMANDS = [
  'CMS-03A-01',
  'CMS-03A-02',
  'CMS-03A-03',
  'CMS-03A-04',
  'CMS-03A-09',
  'CMS-03A-10',
  'CMS-03A-11',
  'CMS-03A-12',
  'CMS-03A-14',
];

type Outcome =
  | 'validation'
  | 'unauthenticated'
  | 'step-up-required'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'rate-limited'
  | 'degraded';

/** The UI error class of each generated error code. */
const CLASS_OF: Readonly<Record<string, Outcome>> = {
  INVALID_REQUEST: 'validation',
  VALIDATION_FAILED: 'validation',
  UNAUTHENTICATED: 'unauthenticated',
  STEP_UP_REQUIRED: 'step-up-required',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not-found',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rate-limited',
  UNSUPPORTED_MEDIA_TYPE: 'degraded',
  BAD_GATEWAY: 'degraded',
  DEPENDENCY_UNAVAILABLE: 'degraded',
  GATEWAY_TIMEOUT: 'degraded',
  INTERNAL_ERROR: 'degraded',
};

const PRIVATE = 'SERVER-PRIVATE-DETAIL-0a1b2c';

const errorResponse = (code: string, status: number): Response =>
  new Response(
    JSON.stringify({
      code,
      message: PRIVATE,
      details:
        code === 'STEP_UP_REQUIRED'
          ? { recoveryAction: 'step_up', allowedMethods: ['totp'] }
          : {},
      requestId: '6a3173d9-f113-4aa4-91c3-3fbc137ea258',
    }),
    {
      status,
      headers: {
        'content-type': 'application/json',
        ...(status === 429 ? { 'retry-after': '7' } : {}),
      },
    },
  );

const rows = COMMANDS.flatMap((operationId) => {
  const policy = contentSchemaRegistryRoutePolicies.find(
    (route) => route.operationId === operationId,
  );
  return Object.entries(policy?.errors ?? {}).map(
    ([code, status]) => [operationId, code, status as number] as const,
  );
});

const formData = (): FormData => {
  const data = new FormData();
  data.set('idempotency-key', 'cms-error-mapping-key');
  return data;
};

describe('every generated error row has one UI class', () => {
  it('[P2-S09-AC-259] [P2-S09-AC-264] the table covers every generated error code of the browser commands', () => {
    const codes = new Set(rows.map(([, code]) => code));
    expect([...codes].sort()).toStrictEqual(Object.keys(CLASS_OF).sort());
    expect(new Set(rows.map(([id]) => id))).toStrictEqual(new Set(COMMANDS));
  });

  it.each(rows)(
    '[P2-S09-AC-259] [P2-S09-AC-264] %s %s (%i) maps to its UI error class through the real runtime',
    async (operationId, code, status) => {
      const result = await executeContentSchemaRegistryMutation({
        action: '/app/cms-content-modeling',
        operationId,
        formData: formData(),
        fetcher: async () => errorResponse(code, status),
        sleep: async () => undefined,
      });
      expect(result.outcome).toBe(CLASS_OF[code]);
      expect(result.status).toBe(status);
      const message = safeOutcomeMessage(
        result.outcome,
        result.retryAfterSeconds,
      );
      expect(message).not.toContain(PRIVATE);
      if (code === 'RATE_LIMITED') expect(result.retryAfterSeconds).toBe(7);
    },
  );
});

describe('rendered error classes on a real form', () => {
  const draft = CASES.find((c) => c.id === 'CMS-03A-02')!;

  const submitWith = async (answer: Response, advance = false) => {
    const form = draft.form();
    document.body.innerHTML = '';
    document.body.appendChild(form.cloneNode(true));
    const mounted = document.querySelector<HTMLFormElement>(
      'form[data-operation-id="CMS-03A-02"]',
    )!;
    (mounted.elements.namedItem('key') as HTMLInputElement).value = 'title';
    window.history.replaceState(
      {},
      '',
      '/app/cms-content-modeling/t/versions/v',
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => answer),
    );
    const navigate = vi.fn();
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate,
    });
    mounted.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    if (advance) await vi.advanceTimersByTimeAsync(5);
    else
      await vi.waitFor(() =>
        expect(mounted.getAttribute('aria-busy')).toBe('false'),
      );
    return { form: mounted, navigate, cleanup };
  };

  it.each([
    ['VALIDATION_FAILED', 422, '[data-cms-validation-summary]'],
    ['FORBIDDEN', 403, '[data-cms-capability-gate]'],
    ['CONFLICT', 409, '[data-cms-sync-conflict]'],
  ] as const)(
    '[P2-S09-AC-259] [P2-S09-AC-264] %s renders its component and none of the server text',
    async (code, status, selector) => {
      const { form, cleanup } = await submitWith(errorResponse(code, status));
      expect(form.querySelector(selector)).not.toBeNull();
      expect(form.textContent).not.toContain(PRIVATE);
      cleanup();
    },
  );

  it.each([
    ['NOT_FOUND', 404, 'The requested schema record was not found.'],
    ['INTERNAL_ERROR', 500, 'The schema change is still being reconciled.'],
    ['BAD_GATEWAY', 502, 'The schema change is still being reconciled.'],
  ] as const)(
    '[P2-S09-AC-259] [P2-S09-AC-264] %s announces the closed message',
    async (code, status, text) => {
      const { form, cleanup } = await submitWith(errorResponse(code, status));
      expect(
        form.querySelector('[data-cms-command-status]')?.textContent,
      ).toContain(text);
      expect(form.textContent).not.toContain(PRIVATE);
      cleanup();
    },
  );

  it('[P2-S09-AC-259] [P2-S09-AC-264] UNAUTHENTICATED announces the expiry and routes to sign-in with a safe return', async () => {
    const { form, navigate, cleanup } = await submitWith(
      errorResponse('UNAUTHENTICATED', 401),
    );
    expect(
      form.querySelector('[data-cms-command-status]')?.textContent,
    ).toContain('Your session expired. Sign in again.');
    expect(navigate.mock.calls[0]?.[0]).toMatch(/^\/auth\/sign-in\?returnTo=/u);
    cleanup();
  });

  it('[P2-S09-AC-259] [P2-S09-AC-264] STEP_UP_REQUIRED routes to /step-up with the current page as the return target', async () => {
    const { navigate, cleanup } = await submitWith(
      errorResponse('STEP_UP_REQUIRED', 401),
    );
    expect(navigate.mock.calls[0]?.[0]).toBe(
      `/step-up?returnTo=${encodeURIComponent('/app/cms-content-modeling/t/versions/v')}`,
    );
    cleanup();
  });

  it('[P2-S09-AC-264] RATE_LIMITED shows an inline countdown from Retry-After and keeps the typed input', async () => {
    vi.useFakeTimers();
    const { form, cleanup } = await submitWith(
      errorResponse('RATE_LIMITED', 429),
      true,
    );
    const status = (): string =>
      form.querySelector('[data-cms-command-status]')?.textContent ?? '';
    expect(status()).toBe('Too many requests. Retry in 7 seconds.');
    await vi.advanceTimersByTimeAsync(1000);
    expect(status()).toBe('Too many requests. Retry in 6 seconds.');
    await vi.advanceTimersByTimeAsync(6000);
    expect(status()).toBe('Too many requests. You can try again now.');
    expect((form.elements.namedItem('key') as HTMLInputElement).value).toBe(
      'title',
    );
    cleanup();
  });

  it('[P2-S09-AC-259] the closed list/detail error vocabulary has no server-text slot', () => {
    for (const message of Object.values(
      CONTENT_SCHEMA_REGISTRY_SAFE_ERROR_MESSAGES,
    ))
      expect(message).not.toContain(PRIVATE);
    expect(Object.keys(CONTENT_SCHEMA_REGISTRY_SAFE_ERROR_MESSAGES)).toEqual(
      expect.arrayContaining([
        'INVALID_REQUEST',
        'UNAUTHENTICATED',
        'FORBIDDEN',
        'NOT_FOUND',
        'RATE_LIMITED',
      ]),
    );
  });
});
