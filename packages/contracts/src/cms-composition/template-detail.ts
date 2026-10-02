import { z } from 'zod';

import { CmsTemplateKeySchema } from './template.ts';
import {
  TemplateVersionRequestSchema,
  TemplateVersionResourceSchema,
} from './template.ts';

export const TemplateLatestApiRequestSchema = z.strictObject({
  templateKey: CmsTemplateKeySchema,
});

/** Editable, owner-scoped snapshot; never includes private authority fields. */
export const TemplateVersionDetailSchema = z.strictObject({
  ...TemplateVersionResourceSchema.shape,
  compatibleTypeIds: TemplateVersionRequestSchema.shape.compatibleTypeIds,
  reservedRegions: TemplateVersionRequestSchema.shape.reservedRegions,
  slots: TemplateVersionRequestSchema.shape.slots,
  bindings: TemplateVersionRequestSchema.shape.bindings,
  locale: TemplateVersionRequestSchema.shape.locale,
  audience: TemplateVersionRequestSchema.shape.audience,
});

export type TemplateVersionDetail = z.infer<typeof TemplateVersionDetailSchema>;
