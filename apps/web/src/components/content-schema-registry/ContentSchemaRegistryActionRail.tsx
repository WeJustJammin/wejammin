import * as React from 'react';

import { OPERATION_LABELS } from './ContentSchemaRegistryActionBar';
import type { NextAction } from './content-schema-registry-version-actions';
import type { ContentSchemaRegistryOperationId } from './content-schema-registry-types';

/** The BE03a operation each server next action names. */
const ACTION_OPERATIONS: Readonly<
  Record<NextAction, ContentSchemaRegistryOperationId>
> = {
  create_successor: 'CMS-03A-09',
  start_dry_run: 'CMS-03A-10',
  submit_review: 'CMS-03A-11',
  assign_reviewer: 'CMS-03A-14',
  record_decision: 'CMS-03A-12',
  activate: 'CMS-03A-04',
};

const actionLabel = (action: NextAction): string => {
  const label = OPERATION_LABELS[ACTION_OPERATIONS[action]];
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
};

export interface ContentSchemaRegistryActionRailProps {
  readonly actingContextLabel?: string | undefined;
  readonly version: string;
  /** Exactly the server's `permittedNextActions`; the rail adds no authority. */
  readonly permittedNextActions: readonly NextAction[];
}

/** Detail-owned FE03 action rail: cites context and version, lists permitted actions. */
export default function ContentSchemaRegistryActionRail({
  actingContextLabel,
  version,
  permittedNextActions,
}: ContentSchemaRegistryActionRailProps): React.ReactElement {
  return (
    <aside
      className="content-schema-registry-action-rail"
      aria-label="Version actions"
    >
      <h4>Version actions</h4>
      <p className="content-schema-registry-help">
        Context: <strong>{actingContextLabel ?? 'not available'}</strong>
      </p>
      <p className="content-schema-registry-help">
        Version cited: <code>{version}</code>
      </p>
      {permittedNextActions.length === 0 ? (
        <p className="content-schema-registry-help">
          The server permits no next action for this version.
        </p>
      ) : (
        <>
          <p className="content-schema-registry-help">
            Server-permitted next actions:
          </p>
          <ul>
            {permittedNextActions.map((action) => (
              <li key={action}>{actionLabel(action)}</li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
