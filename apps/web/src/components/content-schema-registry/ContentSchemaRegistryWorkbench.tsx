import ContentSchemaRegistryDetail from './ContentSchemaRegistryDetail';
import ContentSchemaRegistryFilterBar, {
  contentSchemaRegistryFilterSummary,
} from './ContentSchemaRegistryFilterBar';
import ContentSchemaRegistryList from './ContentSchemaRegistryList';
import ContentSchemaRegistryInitialFailureBoundary from './ContentSchemaRegistryInitialFailureBoundary';
import ContentSchemaRegistryStatus from './ContentSchemaRegistryStatus';
import ContentSchemaRegistryActivationForm from './ContentSchemaRegistryActivationForm';
import ContentSchemaRegistryCreateForm from './ContentSchemaRegistryCreateForm';
import ContentSchemaRegistryFieldForm from './ContentSchemaRegistryFieldForm';
import ContentSchemaRegistryRelationForm from './ContentSchemaRegistryRelationForm';
import { ContentSchemaRegistryCapabilityGate } from './ContentSchemaRegistryCapabilityGate';
import type { ContentSchemaRegistryWorkbenchProps } from './content-schema-registry-types';

export default function ContentSchemaRegistryWorkbench({
  initialList,
  initialDetail,
  variant,
  access,
  query,
  contractFields,
  requestId,
  canonicalUrl,
  listUrl,
  retryUrl,
  csrfToken,
  onCanonicalRefetch,
  actingContextLabel,
  actingPartyId,
  stepUpState,
  stepUpFreshUntil,
  loading = false,
  offline = false,
  message = null,
}: ContentSchemaRegistryWorkbenchProps) {
  if (access === 'not-rendered') {
    return (
      <ContentSchemaRegistryCapabilityGate
        variant="not-rendered"
        reasonCode="FORBIDDEN"
      />
    );
  }

  const initialFailure =
    initialList.status === 'error' || initialList.status === 'degraded'
      ? initialList
      : initialDetail?.status === 'error' ||
          initialDetail?.status === 'degraded'
        ? initialDetail
        : null;
  if (access === 'disabled' && initialFailure !== null) {
    return (
      <ContentSchemaRegistryInitialFailureBoundary
        failure={initialFailure}
        access="disabled"
        variant={variant}
        requestId={requestId}
        retryUrl={retryUrl}
      />
    );
  }

  const disabledReason =
    initialList.status === 'disabled'
      ? initialList.reason
      : 'A server capability prerequisite is not satisfied.';
  if (access === 'disabled') {
    return (
      <ContentSchemaRegistryCapabilityGate
        variant="disabled"
        reasonCode="SCHEMA_REGISTRY_UNAVAILABLE"
        disclosure={disabledReason}
        recoveryHref={canonicalUrl}
      />
    );
  }

  const hasListState =
    initialDetail === null ||
    initialList.status !== 'empty' ||
    initialList.reason !== 'no-records';
  const activeFilterSummary = contentSchemaRegistryFilterSummary(query);
  const resultCount =
    initialList.status === 'success'
      ? initialList.data.items.length
      : undefined;
  const detailAction = retryUrl.split('?')[0] ?? retryUrl;
  const expectedVersion =
    initialDetail?.status === 'success' ? initialDetail.version : null;
  const ifMatch = expectedVersion === null ? null : `"${expectedVersion}"`;
  const idempotencyKey = (operationId: string): string =>
    `cms-schema-${operationId.toLowerCase()}-${requestId}`;
  // The function proves that the server route owns canonical refetch. The
  // browser enhancement receives only the safe URL and asks the server for a
  // fresh projection; event payloads never become registry state.
  const canonicalRefetchBinding =
    onCanonicalRefetch === undefined ? 'unbound' : 'bound';

  return (
    <section
      className="content-schema-registry"
      data-workbench="content-schema-registry"
      data-access={access}
      data-variant={variant}
      data-contract-source={contractFields.source}
      data-invalidation="canonical-refetch-only"
      data-canonical-refetch-url={retryUrl}
      data-canonical-refetch-binding={canonicalRefetchBinding}
      data-role-policy="server-authoritative"
      aria-labelledby="content-schema-registry-heading"
      aria-busy={loading ? 'true' : undefined}
    >
      <header className="content-schema-registry-header">
        <p className="content-schema-registry-eyebrow">
          Protected read surface
        </p>
        <h2 id="content-schema-registry-heading">Content schema registry</h2>
        <p>
          Review server-verified content types, versions, relationships, and
          disclosure-safe block references.
        </p>
      </header>
      {offline ? (
        <section
          className="content-schema-registry-offline-status"
          data-cms-offline-status="true"
          role="status"
          aria-live="polite"
        >
          <h3>Registry is offline</h3>
          <p>
            Canonical registry reads are unavailable. No registry intent was
            retained offline.
          </p>
        </section>
      ) : null}
      {loading ? (
        <div
          className="content-schema-registry-loading-skeleton"
          data-cms-loading-skeleton="true"
          aria-hidden="true"
        />
      ) : null}
      {message === null ? null : (
        <p
          className="visually-hidden"
          data-cms-canonical-status="true"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {message}
        </p>
      )}
      <ContentSchemaRegistryCapabilityGate
        variant={access}
        reasonCode={variant}
      />
      {access === 'read-only' || access === 'full' ? (
        <ContentSchemaRegistryFilterBar
          query={query}
          canonicalUrl={canonicalUrl}
        />
      ) : null}
      {hasListState ? (
        <ContentSchemaRegistryStatus
          state={initialList}
          regionLabel="Registry list"
          requestId={requestId}
          canonicalUrl={retryUrl}
          resetUrl={canonicalUrl}
          {...(resultCount === undefined ? {} : { resultCount })}
          activeFilterSummary={activeFilterSummary}
        />
      ) : null}
      <div className="content-schema-registry-grid">
        <div>
          {hasListState && initialList.status === 'success' ? (
            <ContentSchemaRegistryList
              page={initialList.data}
              canonicalUrl={canonicalUrl}
              listUrl={listUrl}
            />
          ) : null}
          {access === 'full' && initialDetail === null ? (
            <ContentSchemaRegistryCreateForm
              action={canonicalUrl}
              csrfToken={csrfToken}
              idempotencyKey={idempotencyKey('CMS-03A-01')}
            />
          ) : null}
        </div>
        <ContentSchemaRegistryDetail
          state={initialDetail}
          backUrl={listUrl}
          retryUrl={retryUrl}
          requestId={requestId}
        />
        {access === 'full' && initialDetail?.status === 'success' ? (
          <div className="content-schema-registry-command-stack">
            <ContentSchemaRegistryFieldForm
              action={detailAction}
              contentTypeId={initialDetail.data.resource.contentTypeId}
              versionId={initialDetail.data.resource.id}
              csrfToken={csrfToken}
              idempotencyKey={idempotencyKey('CMS-03A-02')}
              ifMatch={ifMatch ?? '"1"'}
            />
            <ContentSchemaRegistryRelationForm
              action={detailAction}
              contentTypeId={initialDetail.data.resource.contentTypeId}
              versionId={initialDetail.data.resource.id}
              csrfToken={csrfToken}
              idempotencyKey={idempotencyKey('CMS-03A-03')}
              ifMatch={ifMatch ?? '"1"'}
            />
            <ContentSchemaRegistryActivationForm
              action={detailAction}
              contentTypeId={initialDetail.data.resource.contentTypeId}
              versionId={initialDetail.data.resource.id}
              csrfToken={csrfToken}
              idempotencyKey={idempotencyKey('CMS-03A-04')}
              ifMatch={ifMatch ?? '"1"'}
              expectedVersion={expectedVersion ?? '1'}
              actingPartyId={actingPartyId}
              {...(actingContextLabel === undefined
                ? {}
                : { actingContextLabel })}
              {...(stepUpState === undefined ? {} : { stepUpState })}
              {...(stepUpFreshUntil === undefined ? {} : { stepUpFreshUntil })}
            />
          </div>
        ) : null}
      </div>
      <span
        className="visually-hidden"
        data-canonical-refetch={canonicalRefetchBinding}
      />
    </section>
  );
}
