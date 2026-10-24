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
): CompositionStatus => ({
  kind: 'error',
  heading,
  message,
  lines,
  nonce: nextNonce(),
});
