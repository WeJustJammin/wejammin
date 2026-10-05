import type { CmsTemplateDraftFields } from './cms-template-designer-request';

export type EditableSlot = CmsTemplateDraftFields['slots'][number] & {
  readonly uiId: string;
};

export type EditableBinding = CmsTemplateDraftFields['bindings'][number] & {
  readonly uiId: string;
};
