import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CmsFieldDescriptor } from './cms-field-descriptor';
import {
  registerCmsFieldValidation,
  resetCmsFieldValidationForTest,
  validateLoadedCmsFieldValue,
} from './cms-field-validation';

const descriptor = {
  fieldId: 'f-1',
  key: 'title',
  label: 'Title',
  kind: 'short_text',
  required: true,
  constraints: { min: null, max: null },
} as unknown as CmsFieldDescriptor;

beforeEach(resetCmsFieldValidationForTest);

describe('validateLoadedCmsFieldValue', () => {
  it('answers null while the validators are not loaded, so the caller falls back to the server message', () => {
    expect(validateLoadedCmsFieldValue(descriptor, null)).toBeNull();
  });

  it('answers what the registered validators answer, with the descriptor and the value', () => {
    const calls: unknown[][] = [];
    registerCmsFieldValidation((...input) => {
      calls.push(input);
      return [{ code: 'required', message: 'This field is required.' }];
    });
    expect(validateLoadedCmsFieldValue(descriptor, null)).toEqual([
      { code: 'required', message: 'This field is required.' },
    ]);
    expect(calls).toEqual([[descriptor, null]]);
  });

  it('is registered by evaluating the value validators, and by nothing else', async () => {
    expect(validateLoadedCmsFieldValue(descriptor, 'x')).toBeNull();
    // A fresh evaluation of the module registers (the module cache is reset so the evaluation happens again).
    vi.resetModules();
    const validation = await import('./cms-field-validation');
    await import('./cms-field-value');
    expect(validation.validateLoadedCmsFieldValue(descriptor, null)).toEqual([
      { code: 'required', message: 'This field is required.' },
    ]);
  });
});
