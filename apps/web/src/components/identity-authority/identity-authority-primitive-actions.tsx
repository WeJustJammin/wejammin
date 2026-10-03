import ActionBar from '../infrastructure/ActionBar';
import CapabilityGate from '../infrastructure/CapabilityGate';
import ConfirmationStep from '../infrastructure/ConfirmationStep';
import FilterBar from '../infrastructure/FilterBar';
import OfflineStatus from '../infrastructure/OfflineStatus';
import SyncConflict from '../infrastructure/SyncConflict';

import type {
  IdentityActionBarProps,
  IdentityCapabilityGateProps,
  IdentityConfirmationStepProps,
  IdentityFilterBarProps,
  IdentityOfflineStatusProps,
} from './identity-authority-primitive-types';

const noop = (): void => undefined;

export function IdentityActionBar({
  value,
}: {
  readonly value: IdentityActionBarProps;
}) {
  const pending = value.state.toLowerCase() === 'pending';
  return (
    <section
      className="identity-action-bar"
      aria-labelledby="identity-actions-heading"
    >
      <h2 id="identity-actions-heading">Identity actions</h2>
      <div className="identity-action-controls">
        <button type="button" disabled={pending} onClick={noop}>
          {value.primary}
        </button>
        <button type="button" onClick={noop}>
          {value.secondary}
        </button>
        <button type="button" disabled={pending} onClick={noop}>
          {value.destructive}
        </button>
      </div>
      <p
        className="identity-live-state"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        State: {value.state}. No stale, failed, or conflict response. Operation
        and request ID: <code>{value.operationId}</code>. Expected version:{' '}
        <code>{value.expectedVersion}</code>.
      </p>
      <ActionBar
        access="full"
        expectedVersion={value.expectedVersion}
        onReviewArchive={noop}
        onRetry={noop}
        isPending={pending}
        commandAvailable
      />
    </section>
  );
}

export function IdentityFilterBar({
  value,
}: {
  readonly value: IdentityFilterBarProps;
}) {
  return (
    <section
      className="identity-filter-region"
      aria-labelledby="identity-filter-heading"
    >
      <h2 id="identity-filter-heading">Identity filters</h2>
      <p data-schema={value.schema}>Schema: {value.schema}</p>
      {value.validationError === undefined ? null : (
        <form action="" method="get" aria-describedby="identity-filter-error">
          <label htmlFor="identity-filter-query">Identity query</label>
          <input
            id="identity-filter-query"
            name="q"
            defaultValue={value.values.q}
            aria-invalid="true"
            aria-describedby="identity-filter-error"
          />
          <p id="identity-filter-error" role="alert" aria-live="polite">
            {value.validationError} Request ID:{' '}
            {value.requestId ?? 'unavailable'}.
          </p>
          <a href="#identity-filter-error">Review first invalid field</a>
          <button type="submit">Apply</button>
        </form>
      )}
      <FilterBar
        query={{
          ...(value.values.q === undefined ? {} : { q: value.values.q }),
          sort: 'label_asc',
        }}
        resultCount={value.resultCount}
        activeFilters={Object.entries(value.values).map(
          ([key, entry]) => `${key}: ${entry}`,
        )}
        onQueryChange={noop}
        onSortChange={noop}
        onApply={noop}
        onReset={noop}
      />
      <a className="identity-filter-reset" href={value.resetHref}>
        Reset
      </a>
    </section>
  );
}

export function IdentityConfirmationStep({
  value,
}: {
  readonly value: IdentityConfirmationStepProps;
}) {
  return (
    <section
      className="identity-confirmation-region"
      aria-labelledby="identity-confirmation-heading"
    >
      <h2 id="identity-confirmation-heading">Review identity change</h2>
      <p>Consequence: {value.consequence}</p>
      <p>
        Affected scope: <code>{value.affectedScope}</code>
      </p>
      <p>
        Expected version: <code>{value.expectedVersion}</code>
      </p>
      <p>Step-up: {value.stepUpState}</p>
      <p>
        Idempotency key: <code>{value.idempotencyKey}</code>
      </p>
      <ConfirmationStep
        consequence={value.consequence}
        scope={value.affectedScope}
        expectedVersion={value.expectedVersion}
        actingContext="server-selected acting context"
        stepUpVerified={value.stepUpState === 'verified'}
        onConfirm={noop}
        onCancel={noop}
      />
    </section>
  );
}

export function IdentityOfflineConflict({
  value,
}: {
  readonly value: IdentityOfflineStatusProps;
}) {
  if (value.connectivity === 'online') return null;
  const retainedInput = Object.fromEntries(
    value.intents.map((intent) => [intent.id, intent.reason]),
  );
  return (
    <section
      className="identity-offline-region"
      aria-labelledby="identity-offline-heading"
    >
      <OfflineStatus
        connectivity="offline"
        requestId="identity-authority"
        lastKnownGoodAt={null}
        onRetry={noop}
      />
      <h2 id="identity-offline-heading">Pending identity intents</h2>
      <p>
        Server version: <code>{value.serverVersion}</code>. Local version:{' '}
        <code>{value.localVersion}</code>.
      </p>
      <ul>
        {value.intents.map((intent) => (
          <li key={intent.id}>
            <code>{intent.id}</code>: {intent.state} ({intent.reason})
          </li>
        ))}
      </ul>
      <SyncConflict
        currentVersion={value.serverVersion}
        retainedInput={retainedInput}
        onReview={noop}
        onReapply={noop}
        onDiscard={noop}
      />
    </section>
  );
}

export function IdentityCapabilityDisclosure({
  value,
}: {
  readonly value: IdentityCapabilityGateProps;
}) {
  return (
    <CapabilityGate
      variant={value.variant}
      disclosure={value.disclosure}
      recoveryHref={value.recoveryHref}
    />
  );
}
