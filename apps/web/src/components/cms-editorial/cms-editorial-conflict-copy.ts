/** Fixed copy of the resolution form: nothing here comes from a response. */
export const COPY = {
  incomplete: 'Choose which version to keep for every field below.',
  submitting: 'Resolving the conflict.',
  resolved: 'Conflict resolved. Opening the entry.',
  unknown:
    'The resolution could not be confirmed. Retrying sends the same request, so it cannot resolve twice.',
  closed:
    'This conflict is no longer open. Return to the entry to continue; nothing was overwritten.',
  changed:
    'The conflict changed while you were choosing. Your choices for unchanged fields are kept; review the fields marked below.',
  reloadFailed:
    'The conflict could not be reloaded. Your choices are kept; try again.',
  expired: 'Your session expired. Sign in again to resolve this conflict.',
  forbidden:
    'You cannot resolve this conflict. Your choices stay in this page.',
  csrf: 'Your session is missing its CSRF token. Reload the page before resolving.',
  degraded:
    'Resolving is unavailable right now. Nothing was changed; try again shortly.',
} as const;

/** `/choices/<n>/…` violation pointers name the n-th submitted choice. */
export const refusedFromViolations = (
  details: readonly string[],
  fieldIds: readonly string[],
): readonly string[] =>
  details.flatMap((path) => {
    const index = /^\/choices\/(\d+)(?:\/|$)/u.exec(path)?.[1];
    const fieldId = index === undefined ? undefined : fieldIds[Number(index)];
    return fieldId === undefined ? [] : [fieldId];
  });
