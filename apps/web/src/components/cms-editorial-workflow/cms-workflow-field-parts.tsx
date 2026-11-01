import * as React from 'react';

import { takePreHydrationValue } from './cms-lazy-intent';

/**
 * The native controls of the Slice 11 command forms: a persistent visible label,
 * an optional hint and error tied to the control by `aria-describedby`, and
 * `aria-invalid` from either a local message or a server refusal naming the
 * control. Nothing here depends on colour; the error is a sentence.
 */
export interface FieldBase {
  readonly id: string;
  readonly label: string;
  readonly hint?: string | undefined;
  /** A local validation sentence shown beside the control. */
  readonly error?: string | null | undefined;
  /** The control is named by a server refusal (the alert carries the sentence). */
  readonly invalid?: boolean | undefined;
}

export const describedBy = (
  id: string,
  hint: string | undefined,
  error: string | null | undefined,
  extra: readonly string[] = [],
): string | undefined => {
  const ids = [
    ...(hint === undefined ? [] : [`${id}-hint`]),
    ...(error === undefined || error === null ? [] : [`${id}-error`]),
    ...extra,
  ];
  return ids.length === 0 ? undefined : ids.join(' ');
};

export const Notes = ({
  id,
  hint,
  error,
}: Pick<FieldBase, 'id' | 'hint' | 'error'>): React.ReactElement => (
  <>
    {hint === undefined ? null : <p id={`${id}-hint`}>{hint}</p>}
    {error === undefined || error === null ? null : (
      <p id={`${id}-error`} className="cms-field-errors">
        {error}
      </p>
    )}
  </>
);

export const invalidOf = (field: FieldBase): true | undefined =>
  field.invalid === true || (field.error !== undefined && field.error !== null)
    ? true
    : undefined;

/**
 * Starts a control's state from what the person entered before the form hydrated
 * (`cms-lazy-intent.ts`): React keeps that value in the DOM but never reports it. Mount only; a
 * form that did not load on intent has nothing recorded, so this does nothing.
 */
export const useSeedFromPreHydration = (
  key: string,
  current: string,
  onChange: (value: string) => void,
): void => {
  React.useLayoutEffect(() => {
    const entered = takePreHydrationValue(key);
    if (entered !== undefined && entered !== current) onChange(entered);
    // Mount only: later renders must never overwrite what the person types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
