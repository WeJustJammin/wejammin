import { vi } from 'vitest';

import { mountElement } from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsLocaleVariantForm, {
  type CmsLocaleVariantFormProps,
} from './CmsLocaleVariantForm';
import type { LocaleSourceRefreshResult } from './locale-source-refresh';
import type { LocaleSubmitResult } from './locale-variant-submit';
import {
  CHAIN,
  PAGE_PATH,
  entryFacts,
  fieldInits,
  variantInit,
} from './locale-variant.test-support';

export const savedResult = (
  extra: Partial<Extract<LocaleSubmitResult, { kind: 'saved' }>['saved']> = {},
): LocaleSubmitResult => ({
  kind: 'saved',
  saved: {
    version: '5',
    state: 'draft',
    staleFieldIds: [],
    savedFieldIds: [],
    ...extra,
  },
});

/** A submit stub that answers `result` and records every request it was given. */
export const submitStub = (
  result:
    LocaleSubmitResult | ((call: number) => LocaleSubmitResult) = savedResult(),
) => {
  let calls = 0;
  return vi.fn(async (...args: [unknown, string, string]) => {
    void args;
    const call = calls++;
    return typeof result === 'function' ? result(call) : result;
  });
};

export const refreshStub = (result: LocaleSourceRefreshResult) =>
  vi.fn(async () => result);

export const formProps = (
  extra: Partial<CmsLocaleVariantFormProps> = {},
): CmsLocaleVariantFormProps => ({
  entry: entryFacts(),
  fallbackChain: CHAIN,
  fields: fieldInits(),
  unavailableFields: [],
  resolutions: [],
  variant: variantInit(),
  csrfToken: 'csrf-token',
  returnTo: PAGE_PATH,
  ...extra,
});

export const mount = (extra: Partial<CmsLocaleVariantFormProps> = {}) =>
  mountElement(<CmsLocaleVariantForm {...formProps(extra)} />);

export const text = (container: HTMLElement): string =>
  container.textContent ?? '';

/** The request the n-th call of a submit stub received. */
export const sentRequest = (
  stub: ReturnType<typeof submitStub>,
  call = 0,
): Record<string, unknown> =>
  stub.mock.calls[call]?.[0] as Record<string, unknown>;
