/**
 * The canonical result of a committed command, handed to the page it navigates
 * to. Create, conflict resolution and restore all end on the entry's editor
 * page; FE03 "Completion" (:1219) asks that page to state the result and expose
 * the exact next action, but the 201 body is only in hand BEFORE the navigation.
 * The producer leaves this one-shot, tab-scoped record and the editor consumes
 * it on its next load. It holds identifiers the caller can already read
 * (revision ids, the migration chain id), versions and counts: never a value, an
 * owner, an assignee or a capability.
 *
 * The record is read back with a zod-free guard (`isResultSummary` in
 * `cms-editorial-result-take.ts`), not a schema (AC-106). This file holds the type only; the
 * producers load `cms-editorial-result-save.ts` when a command commits and the editor loads
 * `cms-editorial-result-take.ts` when a result is waiting, so neither carries the other's code.
 */
export interface CmsEditorialResultSummary {
  readonly kind: 'created' | 'resolved' | 'restored';
  readonly entryId: string;
  readonly revisionNumber: string;
  /** The committed entry version: the next `If-Match`. */
  readonly entryVersion: string;
  readonly state: string;
  /** `[current draft, source]` for a restore; empty for a created entry. */
  readonly parentRevisionIds: readonly string[];
  readonly migrationChainId: string | null;
  readonly edgeCount: number | null;
}
