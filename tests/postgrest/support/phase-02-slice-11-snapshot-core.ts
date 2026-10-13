/**
 * PURE snapshot decoder core (lane S11-4R same-wave corrective scope). This module
 * has NO database or stack import, so a control that imports it cannot trigger the
 * `stack.ts` module-load side effects (`statusEnv()`/`docker inspect`). The
 * DB-bearing `snapshotDigest` builder lives in `phase-02-slice-11-effect.ts`, which
 * re-exports everything here; the decoder is the SAME object in both paths, so the
 * controls exercise the real decoder, never a duplicate.
 */

/**
 * The durable-effect tables a Slice 11 command could write. The snapshot hashes
 * EVERY row of EVERY table (no filter at all): an incorrectly targeted side
 * effect, a mis-named audit/outbox action or an unexpected aggregate id cannot
 * escape, because the row set is not narrowed to the entry under test.
 */
export const EFFECT_TABLES = [
  'platform_private.cms_editorial_reviews',
  'platform_private.cms_editorial_decisions',
  'platform_private.cms_editorial_review_assignments',
  'platform_private.cms_editorial_review_dependencies',
  'platform_private.cms_publication_schedules',
  'platform_private.cms_publication_versions',
  'platform_private.cms_preview_tokens',
  'platform_private.cms_publication_settings_snapshots',
  'platform_private.cms_command_accessibility_evidence',
  'platform_private.idempotency_records',
  'platform_private.outbox_events',
  'audit_private.audit_events',
  'platform_private.cms_content_entries',
  'platform_private.cms_entry_revisions',
] as const;

export type EffectSnapshot = Readonly<Record<string, string>>;

/**
 * The row-text SQL expression per table (aliased `t`); the default hashes the
 * WHOLE row. A caller overrides one table to project a controlled mutation, and
 * the value-blind mutant (in the builder) drops the row text entirely. Both go
 * through this ONE builder and the ONE decoder, so weakening the boundary is
 * observable.
 */
export type RowTextOverrides = Readonly<Record<string, string>>;

/**
 * A snapshot-builder option: `valueBlind` makes the fingerprint depend only on
 * the row COUNT, removing full-row value hashing. It is the controlled mutant
 * that must fail the projection assertion; the default (`false`) hashes rows.
 */
export type SnapshotOptions = Readonly<{ valueBlind?: boolean }>;

const SHA256_HEX = /^[0-9a-f]{64}$/u;

/**
 * Decode one snapshot payload into `<count>:<sha>` per table, failing closed on
 * anything that is not the exact closed set of `EFFECT_TABLES`, each with a
 * nonnegative integer `count` and a 64-lowercase-hex `sha`. TypeScript casts are
 * not runtime proof: an omitted group, a stringified value (`count`/`sha`
 * undefined) or a malformed digest throws instead of comparing equal. Every
 * rejection message is FIXED: an unexpected group/member name is never echoed
 * (it could itself be a marker or identifier).
 */
export const decodeSnapshot = (raw: string): EffectSnapshot => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('effect snapshot is not JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new Error('effect snapshot is not an object');
  const record = parsed as Record<string, unknown>;
  const expectedKeys = [...EFFECT_TABLES].sort();
  const actualKeys = Object.keys(record).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    !actualKeys.every((key, index) => key === expectedKeys[index])
  )
    throw new Error('effect snapshot groups differ from the closed set');
  const out: Record<string, string> = {};
  for (const table of EFFECT_TABLES) {
    const value = record[table];
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      throw new Error('effect snapshot group is not an object');
    // The group object is CLOSED: exactly `count` and `sha`.
    const groupKeys = Object.keys(value).sort();
    if (
      groupKeys.length !== 2 ||
      groupKeys[0] !== 'count' ||
      groupKeys[1] !== 'sha'
    )
      throw new Error('effect snapshot group members differ from {count,sha}');
    const { count, sha } = value as { count?: unknown; sha?: unknown };
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0)
      throw new Error('effect snapshot group has no integer count');
    if (typeof sha !== 'string' || !SHA256_HEX.test(sha))
      throw new Error('effect snapshot group has no sha256 digest');
    out[table] = `${count}:${sha}`;
  }
  return out;
};
