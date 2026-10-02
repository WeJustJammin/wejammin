import * as React from 'react';

import type { EditableBinding } from './cms-template-designer-form-types';

interface Props {
  readonly bindings: readonly EditableBinding[];
  readonly setBindings: React.Dispatch<React.SetStateAction<EditableBinding[]>>;
}

export default function CmsTemplateBindings({
  bindings,
  setBindings,
}: Props): React.ReactElement {
  const update = (uiId: string, patch: Partial<EditableBinding>): void => {
    setBindings((current) =>
      current.map((binding) =>
        binding.uiId === uiId ? { ...binding, ...patch } : binding,
      ),
    );
  };
  const remove = (uiId: string): void => {
    setBindings((current) =>
      current.filter((binding) => binding.uiId !== uiId),
    );
  };
  const add = (): void => {
    setBindings((current) => [
      ...current,
      {
        uiId: crypto.randomUUID(),
        key: '',
        projection: '',
        required: false,
      },
    ]);
  };
  return (
    <fieldset>
      <legend>Projection bindings</legend>
      {bindings.map((binding, index) => (
        <fieldset key={binding.uiId} className="cms-template-designer-repeat">
          <legend>Binding {index + 1}</legend>
          <label htmlFor={`cms-template-binding-key-${binding.uiId}`}>
            Binding key
          </label>
          <input
            id={`cms-template-binding-key-${binding.uiId}`}
            value={binding.key}
            maxLength={128}
            onChange={(event) =>
              update(binding.uiId, { key: event.currentTarget.value })
            }
          />
          <label htmlFor={`cms-template-binding-projection-${binding.uiId}`}>
            Approved projection key
          </label>
          <input
            id={`cms-template-binding-projection-${binding.uiId}`}
            value={binding.projection}
            maxLength={128}
            onChange={(event) =>
              update(binding.uiId, { projection: event.currentTarget.value })
            }
          />
          <label className="cms-template-designer-choice">
            <input
              type="checkbox"
              checked={binding.required}
              onChange={(event) =>
                update(binding.uiId, { required: event.currentTarget.checked })
              }
            />
            Required binding
          </label>
          <button type="button" onClick={() => remove(binding.uiId)}>
            Remove binding {index + 1}
          </button>
        </fieldset>
      ))}
      <button type="button" disabled={bindings.length >= 32} onClick={add}>
        Add binding
      </button>
    </fieldset>
  );
}
