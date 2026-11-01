/*
 * BE05c "Rules of version 1" (D25, DEC-134): the code-owned rule catalog of the
 * `cms.a11y.structural` checker. A finding is identified by its ruleId and
 * carries this static catalog text, never author text, alt text, link text, a
 * URL or an asset name.
 *
 * Only the Phase 2 surface is defined. The media rules (alt.missing,
 * media.accessibility_not_approved, media.captions_missing) are inert until
 * Slice 14, because no media reference can exist before then (a media value
 * fails closed at write), so they deliberately have no entry here.
 */

export type AccessibilitySeverity = 'blocking' | 'warning';

type CatalogEntry = Readonly<{
  severity: AccessibilitySeverity;
  message: string;
}>;

/** BE05c FINDINGS_STORED_MAX: findings stored per run; the counts stay true totals. */
export const ACCESSIBILITY_FINDINGS_STORED_MAX = 500;

export const ACCESSIBILITY_RULE_CATALOG = {
  'structure.rich_text_invalid': {
    severity: 'blocking',
    message:
      'A rich text value does not match the rich_text.v1 document format.',
  },
  'structure.block_unregistered': {
    severity: 'blocking',
    message: 'A block is withdrawn or is not in the block registry.',
  },
  'heading.empty': {
    severity: 'blocking',
    message: 'A heading has no text.',
  },
  'heading.first_level': {
    severity: 'blocking',
    message: 'The first heading is not a level 2 heading.',
  },
  'heading.level_skipped': {
    severity: 'blocking',
    message:
      'A heading is more than one level deeper than the heading before it.',
  },
  'link.text_empty': {
    severity: 'blocking',
    message: 'A link has no text.',
  },
  'link.text_generic': {
    severity: 'blocking',
    message: 'A link uses generic text that does not describe its destination.',
  },
  'link.text_is_url': {
    severity: 'warning',
    message: 'A link shows its web address or email address as its text.',
  },
  'link.text_unchecked_language': {
    severity: 'warning',
    message:
      'Generic link text was not checked because this language has no phrase list.',
  },
  'landmark.name_missing': {
    severity: 'blocking',
    message:
      'A landmark block needs an accessible name of 1 to 160 characters.',
  },
  'landmark.name_duplicate': {
    severity: 'warning',
    message: 'Two landmark blocks of the same type share an accessible name.',
  },
} as const satisfies Record<string, CatalogEntry>;

export type AccessibilityRuleId = keyof typeof ACCESSIBILITY_RULE_CATALOG;

/** The rule ids in catalog (evaluation-group) order. */
export const ACCESSIBILITY_RULE_IDS = Object.keys(
  ACCESSIBILITY_RULE_CATALOG,
) as readonly AccessibilityRuleId[];

export const catalogEntry = (ruleId: AccessibilityRuleId): CatalogEntry =>
  ACCESSIBILITY_RULE_CATALOG[ruleId];
