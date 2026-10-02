import type {
  MfaFactorsResource,
  StepUpChallenge,
  StepUpResult,
  TotpEnrollmentStart,
} from '@wejammin/contracts';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactElement } from 'react';
import { vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

export const REQUEST_ID = '0195b6f0-0000-7000-8000-000000000001';
export const FACTOR_A = '0195b6f0-0000-7000-8000-00000000000a';
export const FACTOR_B = '0195b6f0-0000-7000-8000-00000000000b';
export const CHALLENGE_ID = '0195b6f0-0000-7000-8000-00000000000c';
export const CSRF = 'csrf-token-0123456789abcdef';
export const NOW_ISO = '2026-10-02T12:00:00Z';
export const FRESH_UNTIL = '2026-10-02T12:10:00Z';

export const factor = (
  id: string,
  state: 'pending' | 'verified' | 'reconciling' = 'verified',
  friendlyName = `Phone ${id.slice(-1)}`,
): MfaFactorsResource['factors'][number] => ({
  id,
  method: 'totp',
  friendlyName,
  state,
  verifiedAt: state === 'verified' ? '2026-09-01T10:00:00Z' : null,
  lastUsedAt: state === 'verified' ? '2026-09-30T10:00:00Z' : null,
  pendingExpiresAt: state === 'pending' ? '2026-10-02T12:10:00Z' : null,
});

export const factorsResource = (
  factors: MfaFactorsResource['factors'],
  version = '4',
  fresh = false,
): MfaFactorsResource => ({
  factors,
  allowedMethods: ['totp'],
  stepUp: { fresh, freshUntil: fresh ? FRESH_UNTIL : null },
  version,
});

export const challenge = (factorId = FACTOR_A): StepUpChallenge => ({
  challengeId: CHALLENGE_ID,
  method: 'totp',
  factorId,
  friendlyName: 'Phone a',
  expiresAt: '2026-10-02T12:05:00Z',
});

export const stepUpResult: StepUpResult = {
  verified: true,
  method: 'totp',
  stepUpAt: NOW_ISO,
  freshUntil: FRESH_UNTIL,
};

export const SECRET_KEY = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
export const OTPAUTH_URI = `otpauth://totp/WeJammin:person?secret=${SECRET_KEY}&issuer=WeJammin`;

export const enrollment = (version = '5'): TotpEnrollmentStart => ({
  factorId: FACTOR_B,
  method: 'totp',
  friendlyName: 'Laptop',
  otpauthUri: OTPAUTH_URI,
  manualEntryKey: SECRET_KEY,
  expiresAt: '2026-10-02T12:10:00Z',
  version,
});

export const json = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

export const apiError = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response =>
  json(
    status,
    { code, message: 'Safe message.', details, requestId: REQUEST_ID },
    headers,
  );

export const conflict = (reasonCode: string, recoveryAction = 'refetch') =>
  apiError(409, 'CONFLICT', {
    conflict: 'INVALID_TRANSITION',
    reasonCode,
    recoveryAction,
  });

export const violation = (code: string) =>
  apiError(422, 'VALIDATION_FAILED', { violations: [{ field: 'code', code }] });

export type RecordedCall = Readonly<{
  url: string;
  method: string;
  headers: Headers;
  body: unknown;
}>;

export type FetchStub = ReturnType<typeof stubFetch>;

/** Queues responses (or thrown errors) and records every request. */
export const stubFetch = (
  ...queue: readonly (Response | Error | ((call: RecordedCall) => Response))[]
) => {
  const calls: RecordedCall[] = [];
  const remaining = [...queue];
  const fetchStub = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const body =
      typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    const call: RecordedCall = {
      url: typeof input === 'string' ? input : input.toString(),
      method: init?.method ?? 'GET',
      headers,
      body,
    };
    calls.push(call);
    const next = remaining.shift();
    if (next === undefined) return Promise.reject(new Error('unexpected fetch'));
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(typeof next === 'function' ? next(call) : next);
  });
  return Object.assign(fetchStub as unknown as typeof fetch, { calls });
};

export const apiDeps = (
  fetchImpl: typeof fetch,
  idempotencyKey = 'mfa-idempotency-0001',
) => ({
  fetch: fetchImpl,
  csrfToken: (): string | null => CSRF,
  idempotencyKey: (): string => idempotencyKey,
});

export type Mounted = Readonly<{
  container: HTMLElement;
  root: Root;
  unmount: () => void;
}>;

export const mount = (element: ReactElement): Mounted => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return {
    container,
    root,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

/** Lets pending promises and effects settle inside act. */
export const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

export const setValue = (
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void => {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

export const click = (element: Element): void => {
  act(() => {
    (element as HTMLElement).click();
  });
};

export const byText = (
  container: ParentNode,
  selector: string,
  text: string | RegExp,
): HTMLElement | undefined =>
  Array.from(container.querySelectorAll<HTMLElement>(selector)).find((node) =>
    typeof text === 'string'
      ? node.textContent?.trim() === text
      : text.test(node.textContent ?? ''),
  );

export const requireElement = <T extends Element>(
  container: ParentNode,
  selector: string,
): T => {
  const found = container.querySelector<T>(selector);
  if (found === null) throw new Error(`missing element ${selector}`);
  return found;
};
