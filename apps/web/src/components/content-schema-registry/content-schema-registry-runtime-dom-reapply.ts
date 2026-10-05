import type { ContentSchemaRegistryMutationResult } from './content-schema-registry-runtime';

/**
 * FE03 conflict recovery: the version a form holds and, for a locale draft,
 * the explicit move onto the server's current version ("Reapply when
 * permitted").
 */

export const localVersion = (form: HTMLFormElement): string =>
  (
    form.elements.namedItem('if-match') as HTMLInputElement | null
  )?.value.replace(/^"|"$/gu, '') || 'unknown';

const fieldNamed = (
  form: HTMLFormElement,
  name: string,
): HTMLInputElement | null => {
  const element = form.elements.namedItem(name);
  return element instanceof HTMLInputElement ? element : null;
};

const VERSION_PATTERN = /^[1-9][0-9]{0,18}$/u;

/** True when the server disclosed a current version newer than the form's. */
export const reapplyTarget = (
  form: HTMLFormElement,
  result: Pick<ContentSchemaRegistryMutationResult, 'serverVersion'>,
): boolean =>
  result.serverVersion !== null &&
  VERSION_PATTERN.test(result.serverVersion) &&
  fieldNamed(form, 'if-match') !== null &&
  result.serverVersion !== localVersion(form);

/**
 * Move the form onto the server's current version for an explicit Reapply. The
 * draft fields are untouched; the request body and precondition change, so it
 * is a different request and gets its own Idempotency-Key.
 */
export const rebaseForm = (form: HTMLFormElement, version: string): void => {
  const ifMatch = fieldNamed(form, 'if-match');
  if (ifMatch !== null) ifMatch.value = `"${version}"`;
  const expected = fieldNamed(form, 'expectedVersion');
  if (expected !== null) expected.value = version;
  const key = fieldNamed(form, 'idempotency-key');
  if (key !== null) {
    const fresh = `cms-reapply-${globalThis.crypto.randomUUID()}`;
    key.dataset.pinnedKey = fresh;
    key.value = fresh;
  }
};
