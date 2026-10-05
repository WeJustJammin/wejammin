import * as React from 'react';

import { LOCALE_CONFIG_LIMITS } from '@wejammin/contracts/client';

import {
  availableIntermediates,
  localeControlId,
} from './content-schema-registry-locale-config';
import type { LocaleDraftController } from './use-locale-config-draft';

const Entry = ({
  controller,
  target,
  tag,
  position,
  count,
  pending,
}: {
  readonly controller: LocaleDraftController;
  readonly target: string;
  readonly tag: string;
  readonly position: number;
  readonly count: number;
  readonly pending: boolean;
}): React.ReactElement => (
  <li>
    <span>{tag}</span>{' '}
    <button
      type="button"
      disabled={pending || position === 0}
      onClick={() => controller.shiftIntermediate(target, tag, -1)}
    >
      {`Move ${tag} earlier in the fallback order for ${target}`}
    </button>
    <button
      type="button"
      disabled={pending || position === count - 1}
      onClick={() => controller.shiftIntermediate(target, tag, 1)}
    >
      {`Move ${tag} later in the fallback order for ${target}`}
    </button>
    <button
      type="button"
      id={`${localeControlId(controller.formId, { control: 'chain', target })}-remove-${position}`}
      disabled={pending}
      onClick={() => controller.dropIntermediate(target, tag)}
    >
      {`Remove ${tag} from the fallback order for ${target}`}
    </button>
  </li>
);

const AddEntry = ({
  controller,
  target,
  pending,
}: {
  readonly controller: LocaleDraftController;
  readonly target: string;
  readonly pending: boolean;
}): React.ReactElement | null => {
  const [choice, setChoice] = React.useState('');
  const options = availableIntermediates(controller.draft, target);
  const id = `${localeControlId(controller.formId, { control: 'chain', target })}-add`;
  if (options.length === 0) return null;
  // The submitted chain is the intermediates plus the fixed final default, so
  // the 1-16 bound allows at most `maxChainLength - 1` intermediate entries.
  const atIntermediateLimit =
    (controller.draft.intermediates[target] ?? []).length >=
    LOCALE_CONFIG_LIMITS.maxChainLength - 1;
  return (
    <div className="content-schema-registry-locale-add">
      <label htmlFor={id}>Add a fallback language</label>
      <select
        id={id}
        value={options.includes(choice) ? choice : ''}
        disabled={pending}
        onChange={(event) => setChoice(event.target.value)}
      >
        <option value="">Select a language</option>
        {options.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending || choice === '' || atIntermediateLimit}
        onClick={() => {
          controller.insertIntermediate(target, choice);
          setChoice('');
        }}
      >
        {`Add to the fallback order for ${target}`}
      </button>
    </div>
  );
};

/** FE03 "Fallback order per language": one fieldset per non-default language. */
export default function ContentSchemaRegistryLocaleChains({
  controller,
  pending,
}: {
  readonly controller: LocaleDraftController;
  readonly pending: boolean;
}): React.ReactElement | null {
  const { draft } = controller;
  const targets = draft.supportedLocales.filter(
    (tag) => tag !== draft.defaultLocale,
  );
  if (draft.defaultLocale === '' || targets.length === 0) return null;
  return (
    <>
      {targets.map((target) => {
        const entries = draft.intermediates[target] ?? [];
        const id = localeControlId(controller.formId, {
          control: 'chain',
          target,
        });
        return (
          <fieldset
            key={target}
            id={id}
            tabIndex={-1}
            data-locale-chain={target}
            className="content-schema-registry-locale-chain"
          >
            <legend>{`Fallback order for ${target}`}</legend>
            <ol>
              {entries.map((tag, position) => (
                <Entry
                  key={tag}
                  controller={controller}
                  target={target}
                  tag={tag}
                  position={position}
                  count={entries.length}
                  pending={pending}
                />
              ))}
              <li>{`${draft.defaultLocale} (always last)`}</li>
            </ol>
            <AddEntry
              controller={controller}
              target={target}
              pending={pending}
            />
          </fieldset>
        );
      })}
    </>
  );
}
