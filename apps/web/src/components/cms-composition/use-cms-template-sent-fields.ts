import { useRef } from 'react';

import type { CmsTemplateDraftFields } from './cms-template-designer-request';
import { cmsTemplateDraftDirty } from './cms-template-draft-dirty';

const NOTHING_SENT: CmsTemplateDraftFields = {
  templateKey: '',
  compatibleTypeIds: [],
  locale: '',
  audience: '',
  extraRegions: '',
  slots: [],
  bindings: [],
};

/**
 * The fields of the latest submit. FE03 1048 keeps the form editable while a command is pending, so
 * a value typed during the save is neither sent nor saved: once the server confirms (`created`) the
 * form is unsent exactly when it differs from what was sent, not blanket-clean.
 */
export const useCmsTemplateSentFields = () => {
  const sent = useRef<CmsTemplateDraftFields>(NOTHING_SENT);
  return {
    /** Remember the fields a submit is about to send. */
    remember: (fields: CmsTemplateDraftFields): void => {
      sent.current = fields;
    },
    /**
     * Unsent work: before a confirmed save, the difference from the confirmed preimage (`dirtyBefore`);
     * after it, the difference from what the confirmed save carried.
     */
    unsent: (
      fields: CmsTemplateDraftFields,
      created: boolean,
      dirtyBefore: boolean,
    ): { readonly dirty: boolean; readonly late: boolean } => {
      const late = created && cmsTemplateDraftDirty(fields, sent.current);
      return { dirty: created ? late : dirtyBefore, late };
    },
  };
};
