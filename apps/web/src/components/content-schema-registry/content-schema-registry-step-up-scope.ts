/**
 * Scope of a registry form's tab-scoped step-up draft (DEC-111). Kept apart
 * from the draft code so the island can ask whether a draft is waiting
 * without loading the restore logic.
 */
export const stepUpDraftScopePrefix = (pathname: string): string =>
  `cms:${pathname}:`;

export const stepUpDraftScope = (
  pathname: string,
  operationId: string,
): string => `${stepUpDraftScopePrefix(pathname)}${operationId}`;
