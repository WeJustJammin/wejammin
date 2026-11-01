import { z } from 'zod';

/**
 * The lifecycle of a TemplateVersion, PatternVersion or TaxonomyVersion
 * (Subject state machine, DEC-137). `draft` advances to `review` at submission;
 * `approved` activates or schedules; `superseded` and `retired` are terminal.
 */
export const CMS_DEFINITION_VERSION_STATES = [
  'draft',
  'review',
  'approved',
  'scheduled',
  'active',
  'superseded',
  'retired',
  'blocked',
] as const;

export const CmsDefinitionVersionStateSchema = z.enum(
  CMS_DEFINITION_VERSION_STATES,
);

export type CmsDefinitionVersionState = z.infer<
  typeof CmsDefinitionVersionStateSchema
>;
