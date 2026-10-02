import * as React from 'react';

import type { SealedDryRunEvidence } from './content-schema-registry-dry-run-evidence';

/** Sealed report counts and hashes as definition-list rows (server values only). */
export default function ContentSchemaRegistryDryRunEvidence({
  evidence,
}: {
  readonly evidence: SealedDryRunEvidence;
}): React.ReactElement {
  const rows: readonly (readonly [string, React.ReactNode])[] = [
    ['Source rows', evidence.sourceCount],
    ['Target rows', evidence.targetCount],
    ['Row errors', evidence.rowErrorCount],
    ['Source hash', <code key="source">{evidence.sourceHash}</code>],
    ['Target hash', <code key="target">{evidence.targetHash}</code>],
    ['Report hash', <code key="report">{evidence.reportHash}</code>],
  ];
  return (
    <>
      {rows.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </React.Fragment>
      ))}
    </>
  );
}
