// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiErrorSchema } from '@wejammin/contracts';

import { forwardProfileOwnershipRequest } from '../../server/profile-ownership-platform-api';
import { CommandForm, TextField } from './ProfileOwnershipCommandForms';

/**
 * AC1127 / FE00 error-per-class, 401 STEP_UP_REQUIRED row: "Persist the scoped
 * draft, then navigate to /step-up?returnTo=<current relative path>... After
 * step-up the form restores and the human re-confirms. Focus the confirm
 * control on return; announce 'Verification complete. Review and confirm to
 * continue.'" (DEC-111: tab-scoped, cleared on return or re-confirmation, never
 * auto-replayed.) These tests drive the real CommandForm through the real
 * same-origin façade with the Worker's own refusal body.
 */

const CLAIM_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d8';
const OTHER_CLAIM_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d9';
const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const PAGE = '/app/profiles/verification';
const SEARCH = '?claim=1';
const CONVERT = (id: string): string => `/api/v1/party-claims/${id}/convert`;
const RESTORED = 'Verification complete. Review and confirm to continue.';
const CHANGED = 'The ownership state changed. Refresh and retry.';

const refusal = (code: string, status: number) =>
  Response.json(
    ApiErrorSchema.parse({
      code,
      message: 'refused',
      requestId: REQUEST_ID,
      details: {},
    }),
    { status, headers: { 'cache-control': 'no-store' } },
  );

type Seen = { headers: Headers; body: string }[];

const cleanup: (() => void)[] = [];
let assign: ReturnType<typeof vi.fn>;
let seen: Seen;
let upstream: () => Response;
let storageAtNavigation: string[];

beforeEach(() => {
  window.sessionStorage.clear();
  seen = [];
  storageAtNavigation = [];
  upstream = () => refusal('STEP_UP_REQUIRED', 401);
  assign = vi.fn(() => {
    storageAtNavigation = Object.keys(window.sessionStorage).map(
      (key) => `${key}=${window.sessionStorage.getItem(key)}`,
    );
  });
  vi.stubGlobal('location', { pathname: PAGE, search: SEARCH, assign });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(
        new URL(String(input), 'https://wejammin.test'),
        init,
      );
      return forwardProfileOwnershipRequest(
        request,
        {
          fetch: vi.fn(async (forwarded: Request) => {
            seen.push({
              headers: forwarded.headers,
              body: await forwarded.clone().text(),
            });
            return upstream();
          }),
        },
        new URL(request.url).pathname,
        'POST',
      );
    }),
  );
});

afterEach(() => {
  for (const undo of cleanup.splice(0)) undo();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

const mount = (
  options: Readonly<{ claimId?: string; expectedVersion?: string }> = {},
) => {
  const statuses: string[] = [];
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <CommandForm
        operation="PRF-API-08"
        action={CONVERT(options.claimId ?? CLAIM_ID)}
        label="Convert claim"
        expectedVersion={options.expectedVersion ?? '"4"'}
        csrfToken="csrf-token-value"
        onStatus={(message) => statuses.push(message)}
      >
        <TextField id="reason-code" name="reasonCode" label="Reason code" />
      </CommandForm>,
    ),
  );
  cleanup.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  return {
    statuses,
    container,
    reason: container.querySelector<HTMLInputElement>(
      'input[name=reasonCode]',
    )!,
    button: container.querySelector<HTMLButtonElement>('button[type=submit]')!,
  };
};

const type = (input: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const submit = async (container: HTMLElement): Promise<void> => {
  const form = container.querySelector('form');
  await act(async () => {
    form?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
};

const keyOf = (index: number): string | null =>
  seen[index]?.headers.get('idempotency-key') ?? null;

const stepUpKeys = (): string[] =>
  Object.keys(window.sessionStorage).filter((key) =>
    key.startsWith('wj-step-up-draft:'),
  );

describe('[P2-S09-AC-1127] profile ownership step-up draft (FE00 DEC-111)', () => {
  it('[P2-S09-AC-1127] persists the scoped draft before it navigates to /step-up', async () => {
    const page = mount();
    type(page.reason, 'verified_owner');
    await submit(page.container);
    expect(assign).toHaveBeenCalledTimes(1);
    // The draft was already in this tab's storage at the moment of navigation.
    expect(storageAtNavigation).toHaveLength(1);
    const [entry] = storageAtNavigation;
    expect(entry).toContain('wj-step-up-draft:');
    expect(entry).toContain(PAGE);
    const stored = JSON.parse(String(entry).split('=').slice(1).join('='));
    expect(stored).toEqual({
      values: { reasonCode: 'verified_owner' },
      idempotencyKey: keyOf(0),
      expectedVersion: '"4"',
    });
  });

  it('[P2-S09-AC-1127] restores the draft on return, focuses the confirm control, announces it and replays nothing', async () => {
    const first = mount();
    type(first.reason, 'verified_owner');
    await submit(first.container);
    expect(stepUpKeys()).toHaveLength(1);
    cleanup.pop()?.();
    seen.length = 0;
    // The person returns from /step-up: the page renders the form afresh.
    const returned = mount();
    expect(returned.reason.value).toBe('verified_owner');
    expect(returned.statuses.at(-1)).toBe(RESTORED);
    expect(document.activeElement).toBe(returned.button);
    // Consumed on return, and never auto-replayed.
    expect(stepUpKeys()).toHaveLength(0);
    expect(seen).toHaveLength(0);
  });

  it('[P2-S09-AC-1127] re-confirmation reuses the interrupted Idempotency-Key exactly once', async () => {
    const first = mount();
    type(first.reason, 'verified_owner');
    await submit(first.container);
    const original = keyOf(0);
    cleanup.pop()?.();
    seen.length = 0;
    upstream = () => refusal('FORBIDDEN', 403);
    const returned = mount();
    await submit(returned.container);
    expect(keyOf(0)).toBe(original);
    await submit(returned.container);
    expect(keyOf(1)).not.toBe(original);
    expect(keyOf(1)).toMatch(/^s05-prf-api-08-/u);
  });

  it('[P2-S09-AC-1127] a second step-up shortfall persists the same key again', async () => {
    const first = mount();
    type(first.reason, 'verified_owner');
    await submit(first.container);
    const original = keyOf(0);
    cleanup.pop()?.();
    seen.length = 0;
    const returned = mount();
    await submit(returned.container);
    expect(keyOf(0)).toBe(original);
    expect(stepUpKeys()).toHaveLength(1);
    expect(assign).toHaveBeenCalledTimes(2);
  });

  it('[P2-S09-AC-1127] a version that moved while verifying keeps the values, discards the old key and says the state changed', async () => {
    const first = mount();
    type(first.reason, 'verified_owner');
    await submit(first.container);
    const original = keyOf(0);
    cleanup.pop()?.();
    seen.length = 0;
    upstream = () => refusal('FORBIDDEN', 403);
    const returned = mount({ expectedVersion: '"5"' });
    expect(returned.reason.value).toBe('verified_owner');
    expect(returned.statuses.at(-1)).toBe(CHANGED);
    await submit(returned.container);
    expect(keyOf(0)).not.toBe(original);
    expect(seen[0]?.headers.get('if-match')).toBe('"5"');
  });

  it('[P2-S09-AC-1127] does not restore into another claim form, and never persists a secret or identifying field', async () => {
    const first = mount();
    type(first.reason, 'verified_owner');
    await submit(first.container);
    cleanup.pop()?.();
    const other = mount({ claimId: OTHER_CLAIM_ID });
    expect(other.reason.value).toBe('');
    expect(other.statuses).not.toContain(RESTORED);
    expect(stepUpKeys()).toHaveLength(1);
    const raw = window.sessionStorage.getItem(stepUpKeys()[0] as string);
    expect(raw).not.toMatch(/csrf|token|partyId|personId|proofCode/iu);
  });

  it('[P2-S09-AC-1127] a form that is not allowed a draft still navigates and stores nothing', async () => {
    const statuses: string[] = [];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <CommandForm
          operation="PRF-API-07"
          action={`/api/v1/party-claims/${CLAIM_ID}/proofs`}
          label="Complete proof"
          expectedVersion='"4"'
          csrfToken="csrf-token-value"
          onStatus={(message) => statuses.push(message)}
        >
          <TextField id="code" name="code" label="One-time proof code" />
        </CommandForm>,
      ),
    );
    cleanup.push(() => {
      act(() => root.unmount());
      container.remove();
    });
    const input = container.querySelector<HTMLInputElement>('input')!;
    type(input, '123456');
    await submit(container);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(stepUpKeys()).toHaveLength(0);
  });

  it('[P2-S09-AC-1127] clears a stale draft once any other outcome settles the form', async () => {
    const first = mount();
    type(first.reason, 'verified_owner');
    await submit(first.container);
    expect(stepUpKeys()).toHaveLength(1);
    // The person stays on the page and submits again; the server now answers.
    upstream = () => refusal('FORBIDDEN', 403);
    await submit(first.container);
    expect(stepUpKeys()).toHaveLength(0);
  });

  it('[P2-S09-AC-1127] blocked storage never stops the navigation to /step-up', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const page = mount();
    type(page.reason, 'verified_owner');
    await submit(page.container);
    expect(assign).toHaveBeenCalledTimes(1);
  });
});
