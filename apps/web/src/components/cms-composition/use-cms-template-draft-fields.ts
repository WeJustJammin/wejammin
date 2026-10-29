import { useState } from 'react';
import type { TemplateDesignerContext } from '@wejammin/contracts';

import type {
  EditableBinding,
  EditableSlot,
} from './cms-template-designer-form-types';
import { cmsTemplateDraftDirty } from './cms-template-draft-dirty';

/** The create designer's editable values, their unsent-work test and the explicit reset. */
export const useCmsTemplateDraftFields = (
  context: Pick<TemplateDesignerContext, 'contentTypes'>,
) => {
  const sourceLocale = context.contentTypes[0]?.sourceLocale ?? '';
  const [templateKey, setTemplateKey] = useState('');
  const [compatibleTypeIds, setCompatibleTypeIds] = useState<string[]>([]);
  const [locale, setLocale] = useState(sourceLocale);
  const [audience, setAudience] = useState('');
  const [extraRegions, setExtraRegions] = useState('');
  const [slots, setSlots] = useState<EditableSlot[]>([]);
  const [bindings, setBindings] = useState<EditableBinding[]>([]);
  const fields = {
    templateKey,
    compatibleTypeIds,
    locale,
    audience,
    extraRegions,
    slots,
    bindings,
  };
  return {
    ...fields,
    fields,
    setTemplateKey,
    setCompatibleTypeIds,
    setLocale,
    setAudience,
    setExtraRegions,
    setSlots,
    setBindings,
    /** True while the form holds input that differs from a new, empty draft. */
    dirty: cmsTemplateDraftDirty(fields, {
      templateKey: '',
      compatibleTypeIds: [],
      locale: sourceLocale,
      audience: '',
      extraRegions: '',
      slots: [],
      bindings: [],
    }),
    reset: (): void => {
      setTemplateKey('');
      setCompatibleTypeIds([]);
      setLocale(sourceLocale);
      setAudience('');
      setExtraRegions('');
      setSlots([]);
      setBindings([]);
    },
  };
};
