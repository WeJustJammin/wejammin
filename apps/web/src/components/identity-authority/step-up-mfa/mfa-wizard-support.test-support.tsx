import * as React from 'react';
import { vi } from 'vitest';

import { MfaEnrollmentWizard } from './MfaEnrollmentWizard';
import { channelStub, type ChannelStub } from './step-up-form-support.test-support';
import {
  FACTOR_A,
  apiDeps,
  byText,
  click,
  factor,
  mount,
  setValue,
  type Mounted,
} from './step-up-mfa.test-support';
import type { MfaFactorSummary, StepUpState } from './step-up-phase';

export const CURRENT = { pathname: '/settings/security/mfa', search: '' } as const;

export type WizardHarness = Readonly<{
  mounted: Mounted;
  navigate: ReturnType<typeof vi.fn<(href: string) => void>>;
  reload: ReturnType<typeof vi.fn<() => void>>;
  channel: ChannelStub;
}>;

export const mountWizard = (
  fetchImpl: typeof fetch,
  options: Readonly<{
    factors?: readonly MfaFactorSummary[];
    returnTo?: string | null;
    stepUp?: StepUpState;
    expectedVersion?: string;
  }> = {},
): WizardHarness => {
  const navigate = vi.fn<(href: string) => void>();
  const reload = vi.fn<() => void>();
  const channel = channelStub();
  const mounted = mount(
    <MfaEnrollmentWizard
      variant="authPage"
      returnTo={options.returnTo === undefined ? '/app/x' : options.returnTo}
      factors={options.factors ?? [factor(FACTOR_A)]}
      allowedMethods={['totp']}
      stepUp={options.stepUp ?? { fresh: false, freshUntil: null }}
      expectedVersion={options.expectedVersion ?? '4'}
      api={apiDeps(fetchImpl)}
      navigate={navigate}
      reload={reload}
      channel={channel}
      currentLocation={CURRENT}
    />,
  );
  return { mounted, navigate, reload, channel };
};

export const button = (container: ParentNode, name: string | RegExp): HTMLElement => {
  const found = byText(container, 'button', name);
  if (found === undefined) throw new Error(`missing button ${String(name)}`);
  return found;
};

export const pressButton = (container: ParentNode, name: string | RegExp): void =>
  click(button(container, name));

export const nameInput = (container: ParentNode): HTMLInputElement => {
  const input = container.querySelector<HTMLInputElement>('input[name="friendlyName"]');
  if (input === null) throw new Error('missing name field');
  return input;
};

export const fillAndSubmitName = (container: ParentNode, value: string): void => {
  setValue(nameInput(container), value);
  const form = nameInput(container).closest('form');
  form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

export const statusText = (container: ParentNode): string =>
  Array.from(container.querySelectorAll('[role="status"]'))
    .map((node) => node.textContent ?? '')
    .join('|');

export const alertText = (container: ParentNode): string =>
  Array.from(container.querySelectorAll('[role="alert"]'))
    .map((node) => node.textContent ?? '')
    .join('|');
