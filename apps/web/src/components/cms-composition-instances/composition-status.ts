/** The one result region of the composition page: pending, an outcome, or a refusal with what was kept. */
export type CompositionStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pending'; readonly message: string }
  | {
      readonly kind: 'success';
      readonly heading: string;
      readonly lines: readonly string[];
      readonly nonce: number;
    }
  | {
      readonly kind: 'error';
      readonly heading: string;
      readonly message: string;
      /** Extra lines (partial progress of a multi-request command). */
      readonly lines: readonly string[];
      /** A 403: rendered as the CapabilityGate (FE03 1048), never as a step-up route. */
      readonly gate: boolean;
      readonly nonce: number;
    };

export const IDLE: CompositionStatus = { kind: 'idle' };

let counter = 0;
const nextNonce = (): number => {
  counter += 1;
  return counter;
};

export const pending = (message: string): CompositionStatus => ({
  kind: 'pending',
  message,
});

export const success = (
  heading: string,
  lines: readonly string[] = [],
): CompositionStatus => ({
  kind: 'success',
  heading,
  lines,
  nonce: nextNonce(),
});

export const failure = (
  heading: string,
  message: string,
  lines: readonly string[] = [],
  gate = false,
): CompositionStatus => ({
  kind: 'error',
  heading,
  message,
  lines,
  gate,
  nonce: nextNonce(),
});

/**
 * The same refusal with a new sentence (the outcome of "Check again"). The result heading takes focus only when
 * `refocus` is true, so a control that is still needed keeps it.
 */
export const restated = (
  current: CompositionStatus,
  message: string,
  refocus: boolean,
): CompositionStatus =>
  current.kind === 'error'
    ? { ...current, message, nonce: refocus ? nextNonce() : current.nonce }
    : current;
