// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiErrorSchema } from '@wejammin/contracts';

import { forwardProfileOwnershipRequest } from '../../server/profile-ownership-platform-api';
import { CommandForm } from './ProfileOwnershipCommandForms';

/**
 * AC1127 (FE00 error-per-class, DEC-111) for profile ownership PRF-API-08. The
 * Worker answers a missing step-up proof with the body its shared auth boundary
 * emits (`ApiErrorSchema`, status 401, code STEP_UP_REQUIRED, empty details).
 * The browser reaches it through the same-origin façade, never directly, so the
 * test runs the real façade and the real command form.
 */

const CLAIM_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d8';
const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const PAGE = '/app/profiles/verification';
const SEARCH = '?claim=1';
const STEP_UP = `/step-up?returnTo=${encodeURIComponent(`${PAGE}${SEARCH}`)}`;

const workerRefusal = (code: string, status: number, message: string) =>
  Response.json(
    ApiErrorSchema.parse({ code, message, requestId: REQUEST_ID, details: {} }),
    { status, headers: { 'cache-control': 'no-store' } },
  );

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  vi.unstubAllGlobals();
});

const mountConvert = (upstream: Response) => {
  const assign = vi.fn();
  vi.stubGlobal('location', {
    pathname: PAGE,
    search: SEARCH,
    assign,
  });
  const binding = { fetch: vi.fn(async () => upstream) };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      forwardProfileOwnershipRequest(
        new Request(new URL(String(input), 'https://wejammin.test'), init),
        binding,
        `/api/v1/party-claims/${CLAIM_ID}/convert`,
        'POST',
      ),
    ),
  );
  const statuses: string[] = [];
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <CommandForm
        operation="PRF-API-08"
        action={`/api/v1/party-claims/${CLAIM_ID}/convert`}
        label="Convert claim"
        expectedVersion='"4"'
        csrfToken="csrf-token-value"
        onStatus={(message) => statuses.push(message)}
      >
        <input name="reasonCode" defaultValue="verified_owner" />
      </CommandForm>,
    ),
  );
  unmount = () => {
    act(() => root.unmount());
    container.remove();
  };
  return { assign, statuses, container };
};

const submitConvert = async (container: HTMLElement): Promise<void> => {
  const form = container.querySelector('form');
  if (form === null) throw new Error('convert form missing');
  await act(async () => {
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
  });
};

describe('[P2-S09-AC-1127] profile ownership 401 STEP_UP_REQUIRED', () => {
  it('[P2-S09-AC-1127] PRF-API-08 401 STEP_UP_REQUIRED navigates to /step-up?returnTo= with the current page and never renders sign-in copy', async () => {
    const { assign, statuses, container } = mountConvert(
      workerRefusal(
        'STEP_UP_REQUIRED',
        401,
        'Recent verification is required.',
      ),
    );
    await submitConvert(container);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith(STEP_UP);
    expect(statuses.join('|')).not.toMatch(/sign in/iu);
    expect(statuses.at(-1)).toBe(
      'Recent verification is required. Continuing to verification.',
    );
  });

  it('[P2-S09-AC-1127] PRF-API-08 401 UNAUTHENTICATED still asks the person to sign in and does not open /step-up', async () => {
    const { assign, statuses, container } = mountConvert(
      workerRefusal(
        'UNAUTHENTICATED',
        401,
        'The authentication session is invalid.',
      ),
    );
    await submitConvert(container);
    expect(assign).not.toHaveBeenCalled();
    expect(statuses.at(-1)).toBe('Sign in again to continue.');
  });

  it('[P2-S09-AC-1127] PRF-API-08 403 FORBIDDEN stays the capability message and does not open /step-up', async () => {
    const { assign, statuses, container } = mountConvert(
      workerRefusal('FORBIDDEN', 403, 'The action is not allowed.'),
    );
    await submitConvert(container);
    expect(assign).not.toHaveBeenCalled();
    expect(statuses.at(-1)).toBe(
      'This capability is not available in this context.',
    );
  });
});

// The helper keeps the React import used by the JSX runtime in this file.
void React;
