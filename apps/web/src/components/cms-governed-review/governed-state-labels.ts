import type {
  CmsDefinitionVersionState,
  GovernedReviewState,
} from '@wejammin/contracts';

/**
 * The lifecycle copy the definition panels (pattern, taxonomy, template pages) need beside a
 * designer. It is apart from `governed-review-labels.ts` so a panel does not ship the whole copy
 * table of the review view (FE03 initial-route budget). Type-only contract imports keep this
 * module zod-free (FE03 AC261).
 */
export const GOVERNED_REVIEW_STATE_LABEL: Readonly<
  Record<GovernedReviewState, string>
> = {
  open: 'Open',
  approved: 'Approved',
  rejected: 'Rejected',
  invalidated: 'Invalidated',
};

/** The lifecycle of the subject version; a scheduled activation is never "active". */
export const GOVERNED_SUBJECT_STATE_LABEL: Readonly<
  Record<CmsDefinitionVersionState, string>
> = {
  draft: 'Draft',
  review: 'In review',
  approved: 'Approved',
  scheduled: 'Scheduled, not active',
  active: 'Active',
  superseded: 'Superseded',
  retired: 'Retired',
  blocked: 'Blocked',
};

/** What a definition panel says about a lifecycle state whose next step is made elsewhere. */
export const GOVERNED_PANEL_NOTE: Readonly<
  Partial<Record<CmsDefinitionVersionState, string>>
> = {
  // FE03 879: the exact sentence for a version the caller cannot yet activate.
  review: "Needs an independent reviewer's approval",
  approved: 'Open its review to activate or schedule it.',
  blocked:
    'Its activation failed. Open its review to activate it again while the review is still approved.',
  active: 'Open its review to retire it.',
};

/** The lifecycle states whose next step is made on the review itself. */
export const GOVERNED_PANEL_REVIEW_LINK_STATES: ReadonlySet<CmsDefinitionVersionState> =
  new Set(['review', 'approved', 'blocked', 'active']);
