import * as React from 'react';
import CapabilityGate from '../infrastructure/CapabilityGate';
import OfflineStatus from './OfflineStatus';
import PlatformConfigurationAsync from './platform-configuration-async';
import SettingsFlagsRuntimeActionPanel from './SettingsFlagsRuntimeActionPanel';
import SettingsFlagsRuntimeConflictRecovery from './SettingsFlagsRuntimeConflictRecovery';
import SettingsFlagsRuntimeContractNotice from './SettingsFlagsRuntimeContractNotice';
import SettingsFlagsRuntimeHeader from './SettingsFlagsRuntimeHeader';
import SettingsFlagsRuntimeRecords from './SettingsFlagsRuntimeRecords';
import {
  filteredRecords,
  nextSortState,
  selectedRecord,
  sortRecords,
  type SortState,
} from './settings-flags-runtime-record-utils';
export type { SettingsFlagsRuntimeWorkbenchViewProps } from './settings-flags-runtime-view-types';
import type { SettingsFlagsRuntimeWorkbenchViewProps } from './settings-flags-runtime-view-types';

const PROPOSE_CHANGE_FORM_ID = 'platform-configuration-propose-change-form';

export function SettingsFlagsRuntimeWorkbenchView({
  contractFields,
  variant,
  access,
  initial,
  breakpoint,
  selectedId,
  selectionUrl,
  filter,
  idempotencyKey,
  mutationBusy,
  statusMessage,
  onFilterSubmit,
  onFilterReset,
  onMutationSubmit,
  onRetry,
  onSelection,
  sort: controlledSort,
  onSort: onControlledSort,
  actorId,
  actingPartyId,
  expectedVersion,
  csrfToken,
  requestId,
}: SettingsFlagsRuntimeWorkbenchViewProps): React.ReactElement {
  const [localSort, setLocalSort] = React.useState<SortState | null>(null);
  const sort =
    onControlledSort === undefined ? localSort : (controlledSort ?? null);
  const onSort = (key: string): void => {
    if (onControlledSort === undefined)
      setLocalSort((current) => nextSortState(current, key));
    else onControlledSort(key);
  };
  const totalRecords = initial.data?.length ?? 0;
  const records = sortRecords(
    filteredRecords(initial.data ?? [], filter),
    sort,
  );
  const record = selectedRecord(records, selectedId);
  const showData = access !== 'not-rendered';
  const isFull = access === 'full';
  React.useEffect(() => {
    if (
      initial.error?.code !== 'VALIDATION_FAILED' &&
      initial.error?.code !== 'VALUE_INVALID'
    )
      return;
    const form = document.getElementById(PROPOSE_CHANGE_FORM_ID);
    form
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus({ preventScroll: true });
  }, [initial]);
  return (
    <section
      id="settings-flags-runtime"
      data-workbench="settings-flags-runtime"
      data-variant={variant}
      data-state={initial.status}
      data-access={access}
      data-breakpoint={breakpoint}
      data-composition={
        breakpoint === 'mobile'
          ? 'stacked'
          : breakpoint === 'tablet'
            ? 'inspector'
            : 'list-detail-action-rail'
      }
      data-selection-url={selectionUrl}
      data-contract-source={contractFields.source}
      data-no-horizontal-scroll="true"
      data-target-size="min-inline-size: 44px"
      data-reduced-motion="prefers-reduced-motion; transition: none"
      {...(actorId === null ? {} : { 'data-actor-present': 'true' })}
      {...(actingPartyId === null
        ? {}
        : { 'data-acting-context-present': 'true' })}
      aria-label={showData ? 'Settings and flags runtime workbench' : undefined}
    >
      {access === 'not-rendered' ? (
        <p className="platform-configuration-help">
          This configuration projection is not disclosed in the current context.
        </p>
      ) : (
        <>
          <a
            className="platform-configuration-workbench-skip"
            href="#settings-flags-runtime-main"
          >
            Skip to settings and flags
          </a>
          <SettingsFlagsRuntimeHeader
            actorId={actorId}
            actingPartyId={actingPartyId}
          />
          <div id="settings-flags-runtime-main" tabIndex={-1}>
            <PlatformConfigurationAsync
              state={initial}
              requestId={requestId}
              onRetry={onRetry}
            />
            {access !== 'full' ? (
              <CapabilityGate
                surface="platform-configuration"
                variant={access}
                reasonCode={
                  initial.error?.code ??
                  (access === 'disabled'
                    ? 'PREREQUISITE_UNAVAILABLE'
                    : 'READ_ONLY_CONTEXT')
                }
                recoveryHref="/app/platform-configuration-admin"
                disclosure={
                  access === 'disabled'
                    ? 'Protected commands remain disabled until the server verifies the required capability and step-up.'
                    : undefined
                }
              />
            ) : null}
            {statusMessage.length > 0 ? (
              <p
                className="platform-configuration-live"
                role="status"
                aria-live="polite"
              >
                {statusMessage}
              </p>
            ) : null}
            <SettingsFlagsRuntimeRecords
              breakpoint={breakpoint}
              records={records}
              totalRecords={totalRecords}
              selectedId={selectedId}
              filter={filter}
              selectionUrl={selectionUrl}
              sort={sort}
              onSort={onSort}
              onFilterSubmit={onFilterSubmit}
              onFilterReset={onFilterReset}
              onSelection={onSelection}
            />
            <SettingsFlagsRuntimeActionPanel
              initial={initial}
              record={record}
              isFull={isFull}
              mutationBusy={mutationBusy}
              expectedVersion={expectedVersion}
              csrfToken={csrfToken}
              idempotencyKey={idempotencyKey}
              onMutationSubmit={onMutationSubmit}
              onRetry={onRetry}
            />
            <SettingsFlagsRuntimeConflictRecovery
              initial={initial}
              expectedVersion={expectedVersion}
              filter={filter}
              onRetry={onRetry}
            />
            <OfflineStatus
              connectivity="online"
              intents={0}
              serverVersion={initial.version ?? null}
              localVersion={expectedVersion}
              requestId={requestId}
              onRetry={onRetry}
            />
            <p className="platform-configuration-help">
              Contract: {contractFields.source}. RecordHeader, ProvenanceFact,
              ActionBar, StateLabel, and security-only fields remain
              server-authorized.
            </p>
            <SettingsFlagsRuntimeContractNotice />
          </div>
        </>
      )}
    </section>
  );
}

export default SettingsFlagsRuntimeWorkbenchView;
