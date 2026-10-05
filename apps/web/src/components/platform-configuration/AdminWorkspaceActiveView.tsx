import * as React from 'react';

import {
  renderAudit,
  renderGrantForm,
  renderVersionConflict,
} from './AdminWorkspaceActionViews';
import AdminWorkspaceInbox from './AdminWorkspaceInbox';
import AdminWorkspaceStatus from './AdminWorkspaceStatus';
import CapabilityGate from '../infrastructure/CapabilityGate';
import type { AdminWorkspaceActiveProps } from './admin-workspace-types';
import {
  invokeRefetch,
  operationId,
  safeRecords,
} from './admin-workspace-view-utils';

export const renderAdminWorkspaceActive = (
  props: AdminWorkspaceActiveProps,
): React.ReactElement => {
  if (props.access === 'not-rendered')
    return (
      <section
        data-workbench="admin-workspace-operations"
        data-access="not-rendered"
        data-state="hidden"
      />
    );

  const requestId = props.requestId ?? props.initial.requestId ?? 'unavailable';
  const records = safeRecords(props.initial);
  const tab = props.query?.tab ?? '';
  const operationIds = new Set(records.map(operationId));
  const showCapabilities =
    tab === 'capabilities' || operationIds.has('CFG-05B-04');
  const showAudit =
    tab === 'audit' || tab === 'capabilities' || operationIds.has('CFG-05B-05');
  const showInbox =
    ((!showCapabilities && !showAudit) ||
      tab === 'inbox' ||
      operationIds.has('CFG-05B-01')) &&
    tab !== 'capabilities' &&
    tab !== 'audit';
  const status = props.initial.status.toLowerCase();
  const capabilityRecoveryHref = `${props.canonicalUrl ?? '/app/platform-configuration-admin'}?tab=capabilities`;

  return (
    <section
      aria-labelledby="admin-workspace-operations-heading"
      data-workbench="admin-workspace-operations"
      data-access={props.access}
      data-state={status}
      data-variant={props.variant}
      data-contract-source={props.contractFields.source}
      data-composition="list-detail-action-rail"
    >
      <h2 id="admin-workspace-operations-heading">
        Admin workspace operations
      </h2>
      <p className="platform-configuration-eyebrow">
        Server-authorized workspace
      </p>
      <AdminWorkspaceStatus
        state={props.initial}
        requestId={requestId}
        onRetry={() => invokeRefetch(props, 'reconnect')}
      />
      {showInbox ? (
        <AdminWorkspaceInbox props={props} records={records} />
      ) : null}
      {status === 'conflict' ? renderVersionConflict(props) : null}
      {showCapabilities ? (
        props.access === 'full' ? (
          renderGrantForm(props)
        ) : (
          <CapabilityGate
            surface="platform-configuration"
            variant={props.access}
            reasonCode={
              props.initial.error?.code ??
              (props.access === 'disabled'
                ? 'PREREQUISITE_UNAVAILABLE'
                : 'READ_ONLY_CONTEXT')
            }
            recoveryHref={capabilityRecoveryHref}
            disclosure="Capability management is read-only until the server verifies the required capability prerequisite and step-up."
          />
        )
      ) : null}
      {showAudit ? renderAudit(records) : null}
      <p
        className="platform-configuration-request-id"
        role="status"
        aria-live="polite"
      >
        Request ID: <code>{requestId}</code>
      </p>
    </section>
  );
};

export default renderAdminWorkspaceActive;
