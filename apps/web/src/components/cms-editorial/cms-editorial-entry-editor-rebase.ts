import type { JsonValue } from '@wejammin/contracts';

import { sameCmsEditorialValue } from './cms-editorial-entry-editor-state';

type Values = Readonly<Record<string, JsonValue | null>>;

/**
 * How long to wait before each consecutive automatic rebase after a stale-base
 * 409. The first rebase goes out at once (the common case is one benign race);
 * the next two back off 1 s and 2 s. A fourth consecutive stale base spends the
 * budget and ends in an explicit, author-resumable state (Codex review
 * s10-ts-2, M2).
 */
export const CMS_EDITORIAL_REBASE_BACKOFF_MS: readonly number[] = [
  0, 1_000, 2_000,
];

/**
 * The unsent fields that another session ALSO changed: the base the author
 * edited from differs from the canonical draft, and so does the author's own
 * value. Rebasing or adopting over such a field would silently pick a winner,
 * so the caller must stop for an explicit decision (FE03: no last-write-wins).
 * A field only the author changed, or only the other session changed, or that
 * both changed to the same value, is not divergent.
 */
export const divergentCmsEditorialFieldIds = (
  unsent: readonly string[],
  base: Values,
  local: Values,
  canonical: Values,
): readonly string[] =>
  unsent.filter(
    (fieldId) =>
      !sameCmsEditorialValue(base[fieldId], canonical[fieldId]) &&
      !sameCmsEditorialValue(local[fieldId], canonical[fieldId]),
  );
