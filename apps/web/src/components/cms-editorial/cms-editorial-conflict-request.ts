import { validateCmsFieldValue } from '../cms-editorial-fields/cms-field-value';
import type { CmsFieldDescriptor } from '../cms-editorial-fields/cms-field-descriptor';
import type { CmsEditorialConflictResolveRequest } from './cms-editorial-conflict-resolve';
import type {
  CmsEditorialConflictResolveInit,
  CmsEditorialConflictState,
} from './cms-editorial-conflict-state';

/**
 * Pure helpers of the resolution form's submit (BE03b CMS-03B-02): which paths still lack a
 * usable choice, and the exact request the choices make. No winner is inferred: a path is sent
 * only with the author's explicit choice, and a named choice never carries a value.
 */

/** The paths whose choice is missing, has an input error, or is an explicit value that is invalid. */
export const unresolvedConflictFieldIds = (
  state: CmsEditorialConflictState,
  descriptors: ReadonlyMap<string, CmsFieldDescriptor>,
): string[] =>
  state.paths
    .filter((path) => {
      const entry = state.choices[path.fieldId];
      if (entry === undefined || entry.choice === null) return true;
      if (state.inputErrors[path.fieldId] !== undefined) return true;
      if (entry.choice !== 'explicit') return false;
      const descriptor = descriptors.get(path.fieldId);
      return (
        descriptor === undefined ||
        validateCmsFieldValue(descriptor, entry.explicit).length > 0
      );
    })
    .map((path) => path.fieldId);

/** The resolve request for every divergent path, from the current choices. */
export const conflictResolveRequest = (
  init: Pick<CmsEditorialConflictResolveInit, 'entryId' | 'conflictId'>,
  state: CmsEditorialConflictState,
): CmsEditorialConflictResolveRequest => ({
  entryId: init.entryId,
  conflictId: init.conflictId,
  baseRevision: state.baseRevision,
  expectedVersion: state.entryVersion,
  choices: state.paths.map(({ fieldId }) => {
    const entry = state.choices[fieldId];
    return entry?.choice === 'explicit'
      ? {
          path: `/fields/${fieldId}`,
          choice: 'explicit' as const,
          value: entry.explicit,
        }
      : { path: `/fields/${fieldId}`, choice: entry?.choice ?? 'base' };
  }),
});

/** A 429 on the resolve command itself (the choices are kept). */
export const attemptsWaitingMessage = (seconds: number | null): string =>
  seconds === null
    ? 'Too many attempts. Try again shortly; your choices are kept.'
    : `Too many attempts. Try again in ${seconds} seconds; your choices are kept.`;
