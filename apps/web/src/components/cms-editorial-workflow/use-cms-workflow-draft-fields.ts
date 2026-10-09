import * as React from 'react';

export interface DraftFields {
  /** The shown value: what the person typed, else the restored draft, else the default. */
  readonly value: (name: string) => string;
  readonly set: (name: string, value: string) => void;
  /** Forget everything typed and restored: the next values are the defaults. */
  readonly reset: () => void;
}

/**
 * Text fields over an optional restored step-up draft. A restored value is an
 * overlay read at render time, never copied into state by an effect, so the
 * form shows the restored entries as soon as the controller holds them and
 * anything the person types afterwards wins. `reset` returns to the defaults.
 */
export const useDraftFields = (
  restored: Readonly<Record<string, string>> | null,
  defaults: Readonly<Record<string, string>> = {},
): DraftFields => {
  const [typed, setTyped] = React.useState<Readonly<Record<string, string>>>(
    {},
  );
  return {
    value: (name) => typed[name] ?? restored?.[name] ?? defaults[name] ?? '',
    set: (name, value) =>
      setTyped((previous) => ({ ...previous, [name]: value })),
    reset: () => setTyped({}),
  };
};
