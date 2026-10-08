import * as React from 'react';

import {
  isCmsUnavailableDescriptor,
  type CmsFieldDescriptor,
} from '../cms-editorial-fields/cms-field-descriptor';
import { CMS_EDITORIAL_PROVENANCE_LABEL } from './cms-editorial-provenance-copy';
import type {
  CmsEditorialEditorState,
  CmsEditorialEntryEditorInit,
} from './cms-editorial-entry-editor-state';

export interface CmsEditorialDraftFactsProps {
  readonly init: Pick<
    CmsEditorialEntryEditorInit,
    'lifecycle' | 'state' | 'locale' | 'validationState'
  >;
  readonly state: Pick<
    CmsEditorialEditorState,
    'baseRevision' | 'expectedVersion' | 'provenance'
  >;
  readonly descriptors: readonly CmsFieldDescriptor[];
}

/**
 * The canonical facts of the draft the editor holds (FE03 success state: "state,
 * version, provenance"): lifecycle, revision state, locale, validation, the
 * revision number and the ENTRY version (the next `If-Match`), and per field
 * where its stored value came from, in words. The revision and version follow
 * every verified save; the provenance follows the server's draft (or, for the
 * fields a verified save just wrote, the provenance that save records).
 * Relations carry no provenance of their own and are not listed.
 */
export default function CmsEditorialDraftFacts({
  init,
  state,
  descriptors,
}: CmsEditorialDraftFactsProps): React.ReactElement {
  const listed = descriptors.filter(
    (descriptor) =>
      descriptor.kind !== 'relation' && !isCmsUnavailableDescriptor(descriptor),
  );
  return (
    <section
      data-cms-editorial-facts=""
      aria-labelledby="cms-editorial-facts-heading"
    >
      <h2 id="cms-editorial-facts-heading">Draft facts</h2>
      <dl>
        <dt>Lifecycle</dt>
        <dd>{init.lifecycle}</dd>
        <dt>Revision state</dt>
        <dd>{init.state}</dd>
        <dt>Locale</dt>
        <dd>{init.locale}</dd>
        <dt>Validation</dt>
        <dd>{init.validationState}</dd>
        <dt>Revision</dt>
        <dd data-fact="revision">{state.baseRevision}</dd>
        <dt>Entry version</dt>
        <dd data-fact="entry-version">{state.expectedVersion}</dd>
      </dl>
      {listed.length === 0 ? null : (
        <>
          <h3>Field provenance</h3>
          <ul data-cms-editorial-provenance="">
            {listed.map((descriptor) => (
              <li
                key={descriptor.fieldId}
                data-field={descriptor.fieldId}
                data-field-label={descriptor.label}
              >
                {descriptor.label}:{' '}
                <span data-provenance="">
                  {
                    CMS_EDITORIAL_PROVENANCE_LABEL[
                      state.provenance[descriptor.fieldId] ?? 'missing'
                    ]
                  }
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
