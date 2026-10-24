import type { IssueField } from './taxonomy-designer-request';
import type {
  TaxonomyCreatedFacts,
  TaxonomySubmitResult,
} from './taxonomy-designer-submit';

/** A problem the summary links to a control. */
export interface TaxonomySummaryItem {
  readonly message: string;
  readonly field: IssueField;
}

export type TaxonomyFormStatus =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'invalid';
      readonly items: readonly TaxonomySummaryItem[];
    }
  | { readonly kind: 'pending' }
  /** An unknown outcome the server's latest version showed did not commit. */
  | { readonly kind: 'unsaved' }
  | { readonly kind: 'created'; readonly resource: TaxonomyCreatedFacts }
  | {
      readonly kind: 'result';
      readonly result: Exclude<TaxonomySubmitResult, { kind: 'created' }>;
    };
