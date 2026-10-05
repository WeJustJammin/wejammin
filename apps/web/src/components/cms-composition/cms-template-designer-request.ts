import {
  TemplateDesignerContextSchema,
  TemplateVersionDetailSchema,
  TemplateVersionRequestSchema,
  type TemplateDesignerContext,
  type TemplateVersionDetail,
  type TemplateVersionRequest,
} from '@wejammin/contracts';

const PROTECTED_REGIONS = [
  'header',
  'now',
  'record',
  'detail',
  'provenance',
] as const;

export interface CmsTemplateDraftFields {
  readonly templateKey: string;
  readonly compatibleTypeIds: readonly string[];
  readonly locale: string;
  readonly audience: string;
  readonly extraRegions: string;
  readonly slots: ReadonlyArray<{
    readonly key: string;
    readonly required: boolean;
    readonly maxCount: string;
    readonly allowedBlockRefs: readonly string[];
  }>;
  readonly bindings: ReadonlyArray<{
    readonly key: string;
    readonly projection: string;
    readonly required: boolean;
  }>;
}

export type CmsTemplateDraftBuildResult =
  | { readonly ok: true; readonly value: TemplateVersionRequest }
  | { readonly ok: false; readonly message: string };

/** The protected latest-version read is the only edit preimage. */
export const templateDetailToDraftFields = (
  detail: TemplateVersionDetail,
): CmsTemplateDraftFields => ({
  templateKey: detail.templateKey,
  compatibleTypeIds: [...detail.compatibleTypeIds],
  locale: detail.locale,
  audience: detail.audience,
  extraRegions: detail.reservedRegions
    .slice(PROTECTED_REGIONS.length)
    .join(', '),
  slots: detail.slots.map((slot) => ({
    key: slot.key,
    required: slot.required,
    maxCount: String(slot.maxCount),
    allowedBlockRefs: slot.allowedBlocks.map(
      (block) => `${block.blockKey}@${block.blockVersion}`,
    ),
  })),
  bindings: Object.entries(detail.bindings).map(([key, binding]) => ({
    key,
    projection: binding.projection,
    required: binding.required,
  })),
});

/** Client-side preparation only. The Worker rechecks every choice and authority. */
export const buildCmsTemplateDraftRequest = (
  fields: CmsTemplateDraftFields,
  selectorContext: TemplateDesignerContext,
): CmsTemplateDraftBuildResult => {
  const checkedContext =
    TemplateDesignerContextSchema.safeParse(selectorContext);
  if (!checkedContext.success)
    return { ok: false, message: 'Template choices are unavailable. Reload.' };

  const allowedTypeIds = new Set(
    checkedContext.data.contentTypes.map((type) => type.id),
  );
  if (
    fields.compatibleTypeIds.length === 0 ||
    fields.compatibleTypeIds.some((id) => !allowedTypeIds.has(id))
  )
    return {
      ok: false,
      message: 'Choose at least one available active content type.',
    };

  const blockByRef = new Map(
    checkedContext.data.registeredBlocks.map((block) => [
      `${block.blockKey}@${block.blockVersion}`,
      block,
    ]),
  );
  if (
    fields.slots.some((slot) =>
      slot.allowedBlockRefs.some((ref) => !blockByRef.has(ref)),
    )
  )
    return {
      ok: false,
      message: 'One or more block choices are no longer available. Reload.',
    };

  const extraRegions = fields.extraRegions.trim()
    ? fields.extraRegions.split(',').map((region) => region.trim())
    : [];
  if (extraRegions.some((region) => region.length === 0))
    return { ok: false, message: 'Remove empty reserved region names.' };
  const reservedRegions = [...PROTECTED_REGIONS, ...extraRegions];
  const bindingNames = fields.bindings.map((binding) => binding.key);
  if (new Set(bindingNames).size !== bindingNames.length)
    return { ok: false, message: 'Binding names must be unique.' };

  const bindings = Object.fromEntries(
    fields.bindings.map((binding) => [
      binding.key,
      { projection: binding.projection, required: binding.required },
    ]),
  );
  const candidate = {
    templateKey: fields.templateKey.trim(),
    compatibleTypeIds: [...fields.compatibleTypeIds],
    slots: fields.slots.map((slot) => ({
      key: slot.key.trim(),
      required: slot.required,
      maxCount: /^\d{1,3}$/u.test(slot.maxCount)
        ? Number(slot.maxCount)
        : Number.NaN,
      allowedBlocks: slot.allowedBlockRefs.map((ref) => blockByRef.get(ref)),
    })),
    reservedRegions,
    bindings,
    locale: fields.locale.trim(),
    audience: fields.audience.trim(),
    expectedVersion: null,
  };
  const checked = TemplateVersionRequestSchema.safeParse(candidate);
  if (!checked.success)
    return {
      ok: false,
      message: 'Check the template key, regions, slots, bindings, and locale.',
    };
  return { ok: true, value: checked.data };
};

/** Edit CAS: never change the immutable key or invent a parent version. */
export const buildCmsTemplateSuccessorRequest = (
  fields: CmsTemplateDraftFields,
  selectorContext: TemplateDesignerContext,
  detail: TemplateVersionDetail,
): CmsTemplateDraftBuildResult => {
  const checkedDetail = TemplateVersionDetailSchema.safeParse(detail);
  if (
    !checkedDetail.success ||
    checkedDetail.data.version !== String(checkedDetail.data.templateVersion)
  )
    return { ok: false, message: 'Template version is unavailable. Reload.' };
  if (fields.templateKey.trim() !== checkedDetail.data.templateKey)
    return { ok: false, message: 'The template key cannot be changed.' };
  const prepared = buildCmsTemplateDraftRequest(fields, selectorContext);
  if (!prepared.ok) return prepared;
  const successor = TemplateVersionRequestSchema.safeParse({
    ...prepared.value,
    expectedVersion: checkedDetail.data.version,
  });
  if (!successor.success)
    return { ok: false, message: 'Template version is unavailable. Reload.' };
  return { ok: true, value: successor.data };
};
