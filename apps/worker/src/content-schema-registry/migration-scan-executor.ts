/**
 * Executes the plan's registered transform over one validated source page and
 * produces per-row evidence. Pure per row; a row failure becomes evidence and
 * never stops the scan.
 */
import { canonicalHash } from './migration-transform-jcs';
import type {
  RowEvidenceEntry,
  SourcePage,
  SourceRow,
  TransformRegistryEntry,
} from './migration-transform-types';

const ERROR_CODE = /^[A-Z][A-Z0-9_]{0,63}$/u;
const ROW_FAILED = 'TRANSFORM_ROW_FAILED';
const OUTPUT_INVALID = 'TRANSFORM_OUTPUT_INVALID';

const thrownCode = (error: unknown): string => {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && ERROR_CODE.test(code)) return code;
  }
  return ROW_FAILED;
};

const evidenceFor = (
  row: SourceRow,
  outputHash: string | null,
  errorCode: string | null,
): RowEvidenceEntry => ({
  sourceTable: row.sourceTable,
  sourceRowId: row.sourceRowId,
  sourceHash: row.sourceHash,
  outputHash,
  errorCode,
});

const scanRow = async (
  row: SourceRow,
  entry: TransformRegistryEntry | null,
  page: SourcePage,
): Promise<RowEvidenceEntry> => {
  if (entry === null) return evidenceFor(row, row.sourceHash, null);
  let output: unknown;
  try {
    output = entry.apply(row.document, { targetField: page.targetField });
  } catch (error) {
    return evidenceFor(row, null, thrownCode(error));
  }
  if (entry.carriesSourceHash === true)
    return evidenceFor(row, row.sourceHash, null);
  try {
    return evidenceFor(row, await canonicalHash(output), null);
  } catch {
    return evidenceFor(row, null, OUTPUT_INVALID);
  }
};

/** Evidence in source order; `entry` null means an additive plan with no transform. */
export const scanSourcePage = async (
  page: SourcePage,
  entry: TransformRegistryEntry | null,
): Promise<readonly RowEvidenceEntry[]> => {
  const evidence: RowEvidenceEntry[] = [];
  for (const row of page.rows) evidence.push(await scanRow(row, entry, page));
  return evidence;
};
