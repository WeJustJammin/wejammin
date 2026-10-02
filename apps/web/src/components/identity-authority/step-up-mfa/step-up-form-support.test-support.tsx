import * as React from 'react';
import { vi } from 'vitest';

import { StepUpChallengeForm } from './StepUpChallengeForm';
import type { StepUpChannelPort } from './step-up-channel';
import {
  FACTOR_A,
  apiDeps,
  mount,
  type Mounted,
} from './step-up-mfa.test-support';
import type { StepUpFactorChoice, StepUpPhase } from './step-up-phase';

export const RETURN_TO = '/app/cms-content-modeling?tab=versions';
export const ONE: readonly StepUpFactorChoice[] = [
  { id: FACTOR_A, friendlyName: 'Phone a' },
];

export type ChannelStub = StepUpChannelPort & {
  readonly posts: () => number;
  readonly emit: () => void;
};

export const channelStub = (): ChannelStub => {
  const listeners = new Set<() => void>();
  let posted = 0;
  return {
    post: () => {
      posted += 1;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    posts: () => posted,
    emit: () => listeners.forEach((listener) => listener()),
  };
};

export type FormHarness = Readonly<{
  mounted: Mounted;
  navigate: ReturnType<typeof vi.fn<(href: string) => void>>;
  channel: ChannelStub;
}>;

export const mountForm = (
  fetchImpl: typeof fetch,
  options: Readonly<{
    factors?: readonly StepUpFactorChoice[];
    initialPhase?: StepUpPhase;
    returnTo?: string;
  }> = {},
): FormHarness => {
  const navigate = vi.fn<(href: string) => void>();
  const channel = channelStub();
  const mounted = mount(
    <StepUpChallengeForm
      variant="authPage"
      returnTo={options.returnTo ?? RETURN_TO}
      factors={options.factors ?? ONE}
      initialPhase={options.initialPhase ?? 'creating-challenge'}
      api={apiDeps(fetchImpl)}
      navigate={navigate}
      channel={channel}
    />,
  );
  return { mounted, navigate, channel };
};

export const codeInput = (container: HTMLElement): HTMLInputElement => {
  const input = container.querySelector<HTMLInputElement>('input[name="code"]');
  if (input === null) throw new Error('missing one-time code field');
  return input;
};

export const submitForm = (container: HTMLElement): void => {
  const form = container.querySelector('form');
  if (form === null) throw new Error('missing form');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};
