import * as React from 'react';

export interface PatternVersionFactsProps {
  readonly version: string;
  /** The lifecycle of the version when it is known (a saved read), else absent. */
  readonly lifecycle?: string;
  readonly nodeCount: number;
  readonly blockRegistryDigest: string;
}

const LIFECYCLE_LABEL: Readonly<Record<string, string>> = {
  draft: 'Draft',
  review: 'In review',
  approved: 'Approved',
  scheduled: 'Scheduled, not active',
  active: 'Active',
  superseded: 'Superseded',
  retired: 'Retired',
  blocked: 'Blocked',
};

/** The facts the server computed for a saved version: its count and its registry digest. */
export default function CmsPatternVersionFacts({
  version,
  lifecycle,
  nodeCount,
  blockRegistryDigest,
}: PatternVersionFactsProps): React.ReactElement {
  return (
    <dl className="cms-pattern-facts">
      <div>
        <dt>Version</dt>
        <dd>{version}</dd>
      </div>
      {lifecycle === undefined ? null : (
        <div>
          <dt>Lifecycle</dt>
          <dd>{LIFECYCLE_LABEL[lifecycle] ?? lifecycle}</dd>
        </div>
      )}
      <div>
        <dt>Nodes after expansion</dt>
        <dd>{nodeCount}</dd>
      </div>
      <div>
        <dt>Block registry digest</dt>
        <dd>
          <code>{blockRegistryDigest}</code>
        </dd>
      </div>
    </dl>
  );
}
