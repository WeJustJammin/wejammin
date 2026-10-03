/**
 * Exact client-visible refusal messages of the template-binding rules. Kept in
 * a zod-free module so the browser registry island can render the same text
 * the server returns without shipping zod; `requests-human.ts` re-exports it.
 */
export const TEMPLATE_BINDING_MESSAGES = {
  pair: 'defaultTemplateVersionId and templateBindings must be both null or both present',
  unique: 'templateBindings must be unique',
  incompatible: 'template version is not compatible with this content type',
} as const;
