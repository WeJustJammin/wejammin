import type { SchemaActivationPreparation } from './content-schema-registry-types';

/** The immutable sealed report evidence the server projected, all six members. */
export interface SealedDryRunEvidence {
  readonly result: 'passed' | 'failed';
  readonly sourceCount: number;
  readonly targetCount: number;
  readonly rowErrorCount: number;
  readonly sourceHash: string;
  readonly targetHash: string;
  readonly reportHash: string;
}

/**
 * Counts and hashes are read only from a completed dry run that carries the
 * whole sealed report; an unsealed or bare reference yields `null`, so nothing
 * is ever derived or defaulted on the client.
 */
export const sealedEvidenceOf = (
  preparation: SchemaActivationPreparation,
): SealedDryRunEvidence | null => {
  const ref = preparation.dryRunRef;
  if (ref === null || ref.state !== 'completed' || ref.result === null)
    return null;
  const { sourceCount, targetCount, rowErrorCount } = ref;
  const { sourceHash, targetHash, reportHash } = ref;
  if (
    sourceCount == null ||
    targetCount == null ||
    rowErrorCount == null ||
    sourceHash == null ||
    targetHash == null ||
    reportHash == null
  )
    return null;
  return {
    result: ref.result,
    sourceCount,
    targetCount,
    rowErrorCount,
    sourceHash,
    targetHash,
    reportHash,
  };
};

const plural = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

/** The polite live-region sentence for a sealed report, counts then hashes. */
export const sealedEvidenceSentence = (
  evidence: SealedDryRunEvidence,
): string => {
  const head =
    evidence.result === 'passed'
      ? 'The sealed dry run passed'
      : 'The sealed dry run failed';
  return `${head}: ${plural(evidence.sourceCount, 'source row')}, ${plural(evidence.targetCount, 'target row')}, ${plural(evidence.rowErrorCount, 'row error')}. Source hash ${evidence.sourceHash}, target hash ${evidence.targetHash}, report hash ${evidence.reportHash}.`;
};
