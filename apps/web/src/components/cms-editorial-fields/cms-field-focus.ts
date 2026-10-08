/**
 * Moves focus to the first control of a field: the control itself when it has
 * the stable `field-<id>` id, otherwise the first native control inside the
 * field's group (a list, object or relation has no single control). Used by
 * every error summary so a link lands the keyboard on the problem.
 */
export const focusCmsField = (
  fieldId: string,
  root: Pick<Document, 'getElementById'> = document,
): boolean => {
  const direct = root.getElementById(`field-${fieldId}`);
  const target =
    direct ??
    root
      .getElementById(`field-${fieldId}-group`)
      ?.querySelector<HTMLElement>('input, select, textarea, button');
  if (target === null || target === undefined) return false;
  target.focus({ preventScroll: false });
  return true;
};
