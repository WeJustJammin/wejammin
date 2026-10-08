/**
 * The DOM ids one field editor owns. The stable field id is the only input, so
 * an error summary can link to `field-<id>` (the control) from anywhere.
 */
export interface CmsFieldIds {
  readonly group: string;
  readonly control: string;
  readonly label: string;
  readonly help: string;
  readonly hint: string;
  readonly errors: string;
}

export const cmsFieldIds = (fieldId: string): CmsFieldIds => ({
  group: `field-${fieldId}-group`,
  control: `field-${fieldId}`,
  label: `field-${fieldId}-label`,
  help: `field-${fieldId}-help`,
  hint: `field-${fieldId}-hint`,
  errors: `field-${fieldId}-errors`,
});
