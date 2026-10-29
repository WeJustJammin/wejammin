/** The named result heading of a verified template save (FE03 CMS-11 row: "focus stays until named result heading"). */
export const CMS_TEMPLATE_RESULT_HEADING_ID = 'cms-template-result-heading';

/**
 * Moves focus to the result a template command produced: the named result heading of a success, otherwise the
 * summary region of a refusal or validation notice ("focus summary/field").
 */
export const focusCmsTemplateResult = (summary: HTMLElement | null): void => {
  (document.getElementById(CMS_TEMPLATE_RESULT_HEADING_ID) ?? summary)?.focus();
};
