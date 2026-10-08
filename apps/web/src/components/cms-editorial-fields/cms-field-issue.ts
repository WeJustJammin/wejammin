/**
 * One thing wrong with one field value. `code` is the stable machine reason
 * (the same vocabulary the editors map to copy); `propertyKey` names the object
 * property and `index` the list item or relation target the issue belongs to.
 */
export interface CmsFieldIssue {
  readonly code: string;
  readonly message: string;
  readonly propertyKey?: string;
  readonly index?: number;
}

export const cmsIssue = (
  code: string,
  message: string,
  where: { readonly propertyKey?: string; readonly index?: number } = {},
): CmsFieldIssue => ({ code, message, ...where });
