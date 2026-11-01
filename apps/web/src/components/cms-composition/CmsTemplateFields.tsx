import * as React from 'react';
import type { TemplateDesignerContext } from '@wejammin/contracts';

interface Props {
  /** The refusal the key field owns (FE03 1048: a 422 reason renders at its field), or null. */
  readonly keyError?: string | null;
  readonly contentTypes: TemplateDesignerContext['contentTypes'];
  readonly templateKey: string;
  readonly setTemplateKey: (value: string) => void;
  readonly templateKeyReadOnly?: boolean;
  readonly compatibleTypeIds: readonly string[];
  /** Content types the edited version names that are no longer active; listed so they can be cleared. */
  readonly unavailableTypeIds?: readonly string[];
  readonly setCompatibleTypeIds: React.Dispatch<React.SetStateAction<string[]>>;
  readonly locale: string;
  readonly setLocale: (value: string) => void;
  readonly audience: string;
  readonly setAudience: (value: string) => void;
  readonly extraRegions: string;
  readonly setExtraRegions: (value: string) => void;
}

/** Primitive definition fields; no authority is inferred from a selection. */
export default function CmsTemplateFields({
  contentTypes,
  templateKey,
  setTemplateKey,
  templateKeyReadOnly = false,
  compatibleTypeIds,
  unavailableTypeIds = [],
  keyError = null,
  setCompatibleTypeIds,
  locale,
  setLocale,
  audience,
  setAudience,
  extraRegions,
  setExtraRegions,
}: Props): React.ReactElement {
  return (
    <>
      <div className="cms-template-designer-field">
        <label htmlFor="cms-template-key">Template key</label>
        <input
          id="cms-template-key"
          value={templateKey}
          onChange={(event) => setTemplateKey(event.currentTarget.value)}
          readOnly={templateKeyReadOnly}
          maxLength={64}
          required
          pattern="[a-z][a-z0-9-]{1,63}"
          aria-invalid={keyError === null ? undefined : true}
          aria-describedby={`cms-template-key-help${keyError === null ? '' : ' cms-template-key-error'}`}
        />
        {keyError === null ? null : (
          <p
            id="cms-template-key-error"
            className="cms-template-designer-error"
          >
            {keyError}
          </p>
        )}
        <small id="cms-template-key-help">
          Lowercase letters, numbers, and hyphens; immutable after creation.
        </small>
      </div>
      <fieldset>
        <legend>Compatible active content types</legend>
        {unavailableTypeIds.length > 0 ? (
          <p id="cms-template-types-stale">
            Marked "no longer available": the version you are editing names a
            content type that is no longer active. Clear it to save.
          </p>
        ) : null}
        {contentTypes.map((type) => (
          <label key={type.id} className="cms-template-designer-choice">
            <input
              type="checkbox"
              checked={compatibleTypeIds.includes(type.id)}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setCompatibleTypeIds((current) =>
                  checked
                    ? [...current, type.id]
                    : current.filter((id) => id !== type.id),
                );
              }}
            />
            {type.typeKey} · version {type.activeVersion}
          </label>
        ))}
        {unavailableTypeIds.map((id) => (
          <label key={id} className="cms-template-designer-choice">
            <input
              type="checkbox"
              checked={compatibleTypeIds.includes(id)}
              aria-describedby="cms-template-types-stale"
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setCompatibleTypeIds((current) =>
                  checked
                    ? [...current, id]
                    : current.filter((entry) => entry !== id),
                );
              }}
            />
            Content type {id.slice(0, 8)} · no longer available
          </label>
        ))}
      </fieldset>
      <div className="cms-template-designer-field">
        <label htmlFor="cms-template-locale">Locale</label>
        <input
          id="cms-template-locale"
          value={locale}
          onChange={(event) => setLocale(event.currentTarget.value)}
          maxLength={64}
          required
        />
      </div>
      <div className="cms-template-designer-field">
        <label htmlFor="cms-template-audience">Audience</label>
        <input
          id="cms-template-audience"
          value={audience}
          onChange={(event) => setAudience(event.currentTarget.value)}
          maxLength={64}
          required
        />
      </div>
      <fieldset>
        <legend>Reserved regions</legend>
        <p>
          The first five regions are fixed: header, now, record, detail,
          provenance.
        </p>
        <label htmlFor="cms-template-extra-regions">
          Additional regions, comma separated
        </label>
        <input
          id="cms-template-extra-regions"
          value={extraRegions}
          onChange={(event) => setExtraRegions(event.currentTarget.value)}
          aria-describedby="cms-template-extra-regions-help"
        />
        <small id="cms-template-extra-regions-help">
          Use distinct lowercase region keys.
        </small>
      </fieldset>
    </>
  );
}
