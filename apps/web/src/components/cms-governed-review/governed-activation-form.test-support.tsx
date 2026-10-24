import { loadPinnedTimeAuthority } from '@wejammin/contracts/time-authority';
import * as React from 'react';
import { vi } from 'vitest';

import { MemoryStorage } from '../../lib/test-support/memory-storage';
import {
  buttonNamed,
  click,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  LATER,
  governedApiError,
  governedDecisionFixture,
  governedDetailFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedActivationForm from './CmsGovernedActivationForm';
import {
  governedEnvironment,
  queuedFetcher,
} from './governed-review-form-test-support';
import { REVIEW_LOCATION } from './governed-review-transport.test-support';

/** A review the owner may activate or schedule: approved, subject `approved`, version 2. */
export const approvedReview = (
  overrides: Readonly<Record<string, unknown>> = {},
) =>
  governedDetailFixture({
    state: 'approved',
    decidedAt: LATER,
    recordedDecisionCount: 1,
    decisions: [governedDecisionFixture()],
    distinctApprovalCount: 1,
    subjectState: 'approved',
    permittedNextActions: ['activate', 'schedule'],
    ...overrides,
  });

/** A review whose subject is active: the owner may retire it. */
export const activeReview = (
  overrides: Readonly<Record<string, unknown>> = {},
) =>
  approvedReview({
    activatedAt: LATER,
    subjectState: 'active',
    permittedNextActions: ['retire'],
    ...overrides,
  });

export const NOW = Date.parse('2026-10-15T12:00:00Z');
export const authority = await loadPinnedTimeAuthority();

export const accepted = (
  status: 200 | 202,
  resource: unknown,
  etag: string,
): Response =>
  jsonResponse(status, resource, { etag, location: REVIEW_LOCATION });

export const apiFailure = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
): Response =>
  jsonResponse(status, governedApiError(code, 'A fixed message.', details));

export const stepUp = (methods: string[] = ['totp']): Response =>
  apiFailure(401, 'STEP_UP_REQUIRED', {
    recoveryAction: 'step_up',
    allowedMethods: methods,
  });

export const mountActivation = (
  responses: readonly Response[],
  extra: Partial<React.ComponentProps<typeof CmsGovernedActivationForm>> = {},
  storage = new MemoryStorage(),
  navigate = vi.fn(),
) => {
  const fetcher = queuedFetcher(responses);
  const refetch = vi.fn(async () => true);
  const onDone = vi.fn();
  const loadAuthority = vi.fn(async () => authority);
  const mounted = mountElement(
    <CmsGovernedActivationForm
      review={approvedReview()}
      disabledReason={null}
      refetch={refetch}
      onDone={onDone}
      now={() => NOW}
      defaultTimezone=""
      loadAuthority={loadAuthority}
      environment={governedEnvironment(fetcher, storage, navigate)}
      {...extra}
    />,
  );
  return {
    ...mounted,
    fetcher,
    refetch,
    onDone,
    storage,
    navigate,
    loadAuthority,
  };
};

export const radio = (container: HTMLElement, label: string) => {
  for (const input of Array.from(
    container.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
  ))
    if (input.closest('label')?.textContent?.trim() === label) return input;
  throw new Error(`No radio ${label}`);
};

export const choosing = async (container: HTMLElement, label: string) =>
  click(radio(container, label));

export const statusLine = (container: HTMLElement): string =>
  container.querySelector('[data-cms-workflow-status]')?.textContent ?? '';

export const continueButton = (container: HTMLElement) =>
  buttonNamed(container, 'Continue');
