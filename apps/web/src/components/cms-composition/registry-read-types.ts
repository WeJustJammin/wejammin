import type { TemplateDesignerContext } from '@wejammin/contracts';

/*
 * Types only (nothing here reaches the bundle). The sentences of a read are made by the on-demand chunk, so the
 * initial route carries no copy of them.
 */

/** What the island shows about its read of the designer context after a registry-digest 409. */
export type RegistryReadState =
  | { readonly kind: 'none' }
  | { readonly kind: 'checking' }
  /** The read succeeded: the lines name the block selectors that changed, or that none did. */
  | { readonly kind: 'read'; readonly lines: readonly string[] }
  | {
      readonly kind: 'failed';
      readonly message: string;
      readonly rateLimited: boolean;
    };

/** The answer of one read: the state to show, the context to adopt (only when it was read) and a 429's wait. */
export interface RegistryReadOutcome {
  readonly state: Exclude<RegistryReadState, { kind: 'none' | 'checking' }>;
  readonly context: TemplateDesignerContext | null;
  readonly waitSeconds?: number;
}
