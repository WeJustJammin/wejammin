import * as React from 'react';

import type { CmsFieldBase, CmsFieldDescriptor } from './cms-field-descriptor';
import { cmsFieldIds } from './cms-field-ids';

const COPY: Readonly<Record<string, string>> = {
  taxonomy:
    'Taxonomy terms cannot be set yet: the taxonomy source is not available.',
  media: 'Media cannot be set yet: the media source is not available.',
  unsupported: 'This field cannot be edited here.',
};

/** The typed unavailable state of a kind that has no producer yet. */
export default function CmsUnavailableField({
  descriptor,
  notice,
}: {
  readonly descriptor: CmsFieldBase & {
    readonly kind: CmsFieldDescriptor['kind'];
  };
  /** Overrides the kind copy (for example "links come after create"). */
  readonly notice?: string | undefined;
}): React.ReactElement {
  const ids = cmsFieldIds(descriptor.fieldId);
  return (
    <fieldset
      id={ids.group}
      data-cms-editorial-field={descriptor.fieldId}
      data-cms-editorial-field-key={descriptor.key}
      data-cms-editorial-field-unavailable={descriptor.kind}
    >
      <legend id={ids.label}>{descriptor.label}</legend>
      <p id={ids.hint}>{notice ?? COPY[descriptor.kind] ?? COPY.unsupported}</p>
    </fieldset>
  );
}
