import * as React from 'react';
import { act } from 'react';
import { vi } from 'vitest';

import {
  apiDeps,
  byText,
  click,
  flush,
  mount,
  setValue,
  type Mounted,
} from '../../identity-authority/step-up-mfa/step-up-mfa.test-support';
import { AdminMfaFactorResetForm } from './AdminMfaFactorResetForm';
import type { AdminMfaFactorResetFormProps } from './AdminMfaFactorResetForm';

export const PERSON = '0195b6f0-0000-7000-8000-0000000000aa';
export const RESET_ID = '0195b6f0-0000-7000-8000-0000000000bb';
export const REASON = 'Lost phone and recovery access';
export const LOCATION = {
  pathname: '/app/platform-configuration-admin',
  search: '?tab=mfa-reset',
} as const;
export const FRESH = {
  fresh: true,
  freshUntil: '2026-10-02T12:10:00Z',
} as const;

export const resetBody = (
  state: 'completed' | 'reconciling' = 'completed',
) => ({
  resetId: RESET_ID,
  targetPersonId: PERSON,
  state,
  removedFactorCount: 2,
  mfaVersion: '7',
  outboxEventId: RESET_ID,
});

export type MemoryStorage = Pick<
  Storage,
  'getItem' | 'removeItem' | 'setItem'
> & {
  readonly dump: () => string;
};

export const memoryStorage = (): MemoryStorage => {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    dump: () => JSON.stringify([...data.entries()]),
  };
};

export type ResetHarness = Readonly<{
  mounted: Mounted;
  navigate: ReturnType<typeof vi.fn<(href: string) => void>>;
  refetch: ReturnType<typeof vi.fn<(reason: 'mutation') => Promise<void>>>;
  storage: MemoryStorage;
}>;

export const mountReset = (
  fetchImpl: typeof fetch,
  options: Partial<Pick<AdminMfaFactorResetFormProps, 'variant' | 'stepUp'>> & {
    storage?: MemoryStorage;
    idempotencyKey?: string;
  } = {},
): ResetHarness => {
  const navigate = vi.fn<(href: string) => void>();
  const refetch = vi.fn<(reason: 'mutation') => Promise<void>>(() =>
    Promise.resolve(),
  );
  const storage = options.storage ?? memoryStorage();
  const mounted = mount(
    <AdminMfaFactorResetForm
      variant={options.variant ?? 'adminStepUp'}
      stepUp={options.stepUp ?? FRESH}
      onCanonicalRefetch={refetch}
      api={apiDeps(fetchImpl, options.idempotencyKey ?? 'reset-key-0001')}
      navigate={navigate}
      currentLocation={LOCATION}
      storage={storage}
    />,
  );
  return { mounted, navigate, refetch, storage };
};

export const personInput = (c: HTMLElement): HTMLInputElement => {
  const el = c.querySelector<HTMLInputElement>('input[name="targetPersonId"]');
  if (el === null) throw new Error('missing person field');
  return el;
};

export const reasonInput = (c: HTMLElement): HTMLTextAreaElement => {
  const el = c.querySelector<HTMLTextAreaElement>('textarea[name="reason"]');
  if (el === null) throw new Error('missing reason field');
  return el;
};

export const fill = (
  c: HTMLElement,
  person = PERSON,
  reason = REASON,
): void => {
  setValue(personInput(c), person);
  setValue(reasonInput(c), reason);
};

export const press = (c: HTMLElement, name: string | RegExp): void => {
  const found = byText(c, 'button', name);
  if (found === undefined) throw new Error(`missing button ${String(name)}`);
  click(found);
};

export const submit = (c: HTMLElement): void => {
  act(() => {
    c.querySelector('form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  });
};

export const openConfirmation = async (c: HTMLElement): Promise<void> => {
  fill(c);
  submit(c);
  await flush();
};

export const statusText = (c: HTMLElement): string =>
  Array.from(c.querySelectorAll('[role="status"]'))
    .map((n) => n.textContent ?? '')
    .join('|');

export const alertText = (c: HTMLElement): string =>
  Array.from(c.querySelectorAll('[role="alert"]'))
    .map((n) => n.textContent ?? '')
    .join('|');
