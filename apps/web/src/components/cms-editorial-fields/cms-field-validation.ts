import type { JsonValue } from '@wejammin/contracts';

import type { CmsFieldDescriptor } from './cms-field-descriptor';
import type { CmsFieldIssue } from './cms-field-issue';

type Validate = (
  descriptor: CmsFieldDescriptor,
  value: JsonValue | null,
) => readonly CmsFieldIssue[];

let registered: Validate | null = null;

/**
 * Called by `cms-field-value.ts` when it is evaluated. The value validators are not part of the cold load of the entry
 * editor: a save (which loads them with its own chunk) is what brings them in, and a refused save is the only thing that
 * asks the editor to show a field's local issues.
 */
export const registerCmsFieldValidation = (validate: Validate): void => {
  registered = validate;
};

/**
 * The local issues of a field value when the validators are loaded, else `null`: the caller then falls back to the
 * message the server gave, which every refusal carries. Never throws and never starts a load.
 */
export const validateLoadedCmsFieldValue = (
  descriptor: CmsFieldDescriptor,
  value: JsonValue | null,
): readonly CmsFieldIssue[] | null =>
  registered === null ? null : registered(descriptor, value);

/** Tests only: forget the registration, so a test can look at the not-loaded case. */
export const resetCmsFieldValidationForTest = (): void => {
  registered = null;
};
