import * as React from 'react';
import type { TemplateDesignerContext } from '@wejammin/contracts';

import type { EditableSlot } from './cms-template-designer-form-types';

interface Props {
  readonly registeredBlocks: TemplateDesignerContext['registeredBlocks'];
  readonly slots: readonly EditableSlot[];
  readonly setSlots: React.Dispatch<React.SetStateAction<EditableSlot[]>>;
}

/** Bounded slot manifest controls; every block still faces Worker revalidation. */
export default function CmsTemplateSlots({
  registeredBlocks,
  slots,
  setSlots,
}: Props): React.ReactElement {
  const update = (uiId: string, patch: Partial<EditableSlot>): void => {
    setSlots((current) =>
      current.map((slot) =>
        slot.uiId === uiId ? { ...slot, ...patch } : slot,
      ),
    );
  };
  const remove = (uiId: string): void => {
    setSlots((current) => current.filter((slot) => slot.uiId !== uiId));
  };
  const add = (): void => {
    setSlots((current) => [
      ...current,
      {
        uiId: crypto.randomUUID(),
        key: '',
        required: false,
        maxCount: '1',
        allowedBlockRefs: [],
      },
    ]);
  };
  return (
    <fieldset>
      <legend>Slots</legend>
      <p>
        Supported blocks:{' '}
        {registeredBlocks.length === 0
          ? 'none available'
          : registeredBlocks
              .map((block) => `${block.blockKey}@${block.blockVersion}`)
              .join(', ')}
        .
      </p>
      {slots.map((slot, index) => (
        <fieldset key={slot.uiId} className="cms-template-designer-repeat">
          <legend>Slot {index + 1}</legend>
          <label htmlFor={`cms-template-slot-key-${slot.uiId}`}>Slot key</label>
          <input
            id={`cms-template-slot-key-${slot.uiId}`}
            value={slot.key}
            maxLength={64}
            onChange={(event) =>
              update(slot.uiId, { key: event.currentTarget.value })
            }
          />
          <label htmlFor={`cms-template-slot-count-${slot.uiId}`}>
            Maximum blocks
          </label>
          <input
            id={`cms-template-slot-count-${slot.uiId}`}
            type="number"
            min={1}
            max={128}
            value={slot.maxCount}
            onChange={(event) =>
              update(slot.uiId, { maxCount: event.currentTarget.value })
            }
          />
          <label className="cms-template-designer-choice">
            <input
              type="checkbox"
              checked={slot.required}
              onChange={(event) =>
                update(slot.uiId, { required: event.currentTarget.checked })
              }
            />
            Required slot
          </label>
          <label htmlFor={`cms-template-slot-blocks-${slot.uiId}`}>
            Allowed supported blocks
          </label>
          <select
            id={`cms-template-slot-blocks-${slot.uiId}`}
            multiple
            size={Math.min(Math.max(registeredBlocks.length, 2), 6)}
            value={[...slot.allowedBlockRefs]}
            onChange={(event) =>
              update(slot.uiId, {
                allowedBlockRefs: Array.from(
                  event.currentTarget.selectedOptions,
                  (option) => option.value,
                ),
              })
            }
          >
            {registeredBlocks.map((block) => {
              const ref = `${block.blockKey}@${block.blockVersion}`;
              return (
                <option key={ref} value={ref}>
                  {ref}
                </option>
              );
            })}
          </select>
          <button type="button" onClick={() => remove(slot.uiId)}>
            Remove slot {index + 1}
          </button>
        </fieldset>
      ))}
      <button type="button" disabled={slots.length >= 64} onClick={add}>
        Add slot
      </button>
    </fieldset>
  );
}
