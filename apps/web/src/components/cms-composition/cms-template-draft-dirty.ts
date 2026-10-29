import type { CmsTemplateDraftFields } from './cms-template-designer-request';

/** The comparable form of the fields; an editable row's `uiId` never counts. */
const normalized = (fields: CmsTemplateDraftFields): string =>
  JSON.stringify({
    templateKey: fields.templateKey,
    compatibleTypeIds: [...fields.compatibleTypeIds].sort(),
    locale: fields.locale,
    audience: fields.audience,
    extraRegions: fields.extraRegions,
    slots: fields.slots.map((slot) => ({
      key: slot.key,
      required: slot.required,
      maxCount: slot.maxCount,
      allowedBlockRefs: slot.allowedBlockRefs,
    })),
    bindings: fields.bindings.map((binding) => ({
      key: binding.key,
      projection: binding.projection,
      required: binding.required,
    })),
  });

/**
 * FE03 "Unsaved changes": the designer holds unsent work exactly when its fields differ from
 * the preimage the server last confirmed (an empty form for a new key, the parent version for a
 * successor). Content-type choice is a set, so its order never counts.
 */
export const cmsTemplateDraftDirty = (
  current: CmsTemplateDraftFields,
  original: CmsTemplateDraftFields,
): boolean => normalized(current) !== normalized(original);
