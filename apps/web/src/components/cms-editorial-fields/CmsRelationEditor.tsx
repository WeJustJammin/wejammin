import type { JsonValue } from '@wejammin/contracts';
import * as React from 'react';

import CmsFieldFrame from './CmsFieldFrame';
import type { CmsRelationDescriptor } from './cms-field-descriptor';
import { cmsFieldIds } from './cms-field-ids';
import type { CmsFieldIssue } from './cms-field-issue';
import { isJsonRecord } from './cms-field-value-structured';

export interface CmsRelationEditorProps {
  readonly descriptor: CmsRelationDescriptor;
  readonly value: JsonValue | null;
  readonly issues: readonly CmsFieldIssue[];
  readonly disabled?: boolean | undefined;
  readonly onChange: (value: JsonValue | null) => void;
  readonly onBlur?: (() => void) | undefined;
}

interface Target {
  readonly targetId: string;
  readonly expectedTargetVersion: string | null;
}

const RELATION_TARGETS_MAX = 512;

const targetsOf = (value: JsonValue | null): readonly Target[] => {
  if (!isJsonRecord(value) || !Array.isArray(value.targets)) return [];
  return value.targets.map((target) => {
    const record = isJsonRecord(target) ? target : {};
    return {
      targetId: typeof record.targetId === 'string' ? record.targetId : '',
      expectedTargetVersion:
        typeof record.expectedTargetVersion === 'string'
          ? record.expectedTargetVersion
          : null,
    };
  });
};

/**
 * A relation field, within the BE03b contract: an ordered list of
 * `{ targetId, expectedTargetVersion | null }` bounded by the immutable
 * relation definition. There is no candidate directory in the contract, so a
 * target is named by its entry id (and optionally pinned to a version); the
 * server resolves, authorizes and conceals it, so a write is never an
 * existence oracle. A domain-record relation has no producer yet and shows its
 * typed unavailable state.
 */
export default function CmsRelationEditor({
  descriptor,
  value,
  issues,
  disabled,
  onChange,
  onBlur,
}: CmsRelationEditorProps): React.ReactElement {
  const ids = cmsFieldIds(descriptor.fieldId);
  const targets = targetsOf(value);
  const max = Math.min(descriptor.max, RELATION_TARGETS_MAX);
  const set = (next: readonly Target[]): void =>
    onChange({ targets: next as unknown as JsonValue[] });
  const move = (from: number, to: number): void => {
    const next = [...targets];
    const [moved] = next.splice(from, 1);
    if (moved !== undefined) next.splice(to, 0, moved);
    set(next);
  };
  return (
    <CmsFieldFrame
      field={descriptor}
      mode="legend"
      hint={`Link ${descriptor.min === 0 ? 'up to' : `${descriptor.min} to`} ${max} entries.`}
      issues={issues.filter((issue) => issue.index === undefined)}
    >
      {() =>
        descriptor.targetKind === 'domain' ? (
          <p>
            Domain records cannot be linked yet: their projection is not
            available.
          </p>
        ) : (
          <>
            <ol>
              {targets.map((target, index) => {
                const name = `${descriptor.label} target ${index + 1}`;
                const own = issues.filter((issue) => issue.index === index);
                const errorId = `${ids.control}-target-${index}-errors`;
                return (
                  <li key={index}>
                    <input
                      type="text"
                      aria-label={`${name} entry id`}
                      aria-invalid={own.length > 0 ? 'true' : undefined}
                      aria-describedby={own.length > 0 ? errorId : undefined}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={disabled}
                      value={target.targetId}
                      onBlur={onBlur}
                      onChange={(event) =>
                        set(
                          targets.map((current, at) =>
                            at === index
                              ? {
                                  ...current,
                                  targetId: event.currentTarget.value,
                                }
                              : current,
                          ),
                        )
                      }
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label={`${name} pinned version`}
                      autoComplete="off"
                      disabled={disabled}
                      value={target.expectedTargetVersion ?? ''}
                      onBlur={onBlur}
                      onChange={(event) =>
                        set(
                          targets.map((current, at) =>
                            at === index
                              ? {
                                  ...current,
                                  expectedTargetVersion:
                                    event.currentTarget.value === ''
                                      ? null
                                      : event.currentTarget.value,
                                }
                              : current,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      aria-label={`Move ${name} up`}
                      disabled={disabled === true || index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${name} down`}
                      disabled={
                        disabled === true || index === targets.length - 1
                      }
                      onClick={() => move(index, index + 1)}
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      disabled={disabled}
                      onClick={() =>
                        set(targets.filter((_, at) => at !== index))
                      }
                    >
                      Remove
                    </button>
                    {own.length > 0 ? (
                      <ul id={errorId} className="cms-field-errors">
                        {own.map((issue, at) => (
                          <li key={`${issue.code}-${at}`}>{issue.message}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            <button
              type="button"
              aria-label={`Add ${descriptor.label} target`}
              disabled={disabled === true || targets.length >= max}
              onClick={() =>
                set([...targets, { targetId: '', expectedTargetVersion: null }])
              }
            >
              Add link
            </button>
          </>
        )
      }
    </CmsFieldFrame>
  );
}
