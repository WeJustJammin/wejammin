import * as React from 'react';
import type { TemplateDesignerContext } from '@wejammin/contracts';

interface Props {
  readonly contentTypes: TemplateDesignerContext['contentTypes'];
  readonly templateKey: string;
  readonly setTemplateKey: (value: string) => void;
  readonly templateKeyReadOnly?: boolean;
  readonly compatibleTypeIds: readonly string[];
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
          aria-describedby="cms-template-key-help"
        />
        <small id="cms-template-key-help">
          Lowercase letters, numbers, and hyphens; immutable after creation.
        </small>
      </div>
      <fieldset>
        <legend>Compatible active content types</legend>
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
