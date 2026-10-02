import ContentSchemaRegistryDetail from './ContentSchemaRegistryDetail';
import ContentSchemaRegistryFilterBar, {
  contentSchemaRegistryFilterSummary,
} from './ContentSchemaRegistryFilterBar';
import ContentSchemaRegistryList from './ContentSchemaRegistryList';
import ContentSchemaRegistryStatus from './ContentSchemaRegistryStatus';
import ContentSchemaRegistryActivationPreparation from './ContentSchemaRegistryActivationPreparation';
import ContentSchemaRegistryCreateForm from './ContentSchemaRegistryCreateForm';
import ContentSchemaRegistryReviewMode from './ContentSchemaRegistryReviewMode';
import ContentSchemaRegistryReviewPanel from './ContentSchemaRegistryReviewPanel';
import ContentSchemaRegistryVersionCommands from './ContentSchemaRegistryVersionCommands';
import ContentSchemaRegistryWorkbenchBanners from './ContentSchemaRegistryWorkbenchBanners';
import { ContentSchemaRegistryCapabilityGate } from './ContentSchemaRegistryCapabilityGate';
import { contentSchemaRegistryWorkbenchGate } from './ContentSchemaRegistryWorkbenchGate';
import type { ContentSchemaRegistryWorkbenchProps } from './content-schema-registry-types';

export default function ContentSchemaRegistryWorkbench({
  initialList,
  initialDetail,
  variant,
  access,
  query,
  contractFields,
  supportReference,
  canonicalUrl,
  listUrl,
  retryUrl,
  csrfToken,
  onCanonicalRefetch,
  actingContextLabel,
  stepUpState,
  stepUpFreshUntil,
  reviewId = null,
  initialReview = null,
  contextEpoch = 0,
  loading = false,
  offline = false,
  message = null,
}: ContentSchemaRegistryWorkbenchProps) {
  const gate = contentSchemaRegistryWorkbenchGate({
    access,
    variant,
    initialList,
    initialDetail,
    initialReview,
    supportReference,
    retryUrl,
    canonicalUrl,
  });
  if (gate !== null) return gate;

  const reviewMode = reviewId !== null;
  const hasListState =
    !reviewMode &&
    (initialDetail === null ||
      initialList.status !== 'empty' ||
      initialList.reason !== 'no-records');
  const activeFilterSummary = contentSchemaRegistryFilterSummary(query);
  const resultCount =
    initialList.status === 'success'
      ? initialList.data.items.length
      : undefined;
  const detailAction = retryUrl.split('?')[0] ?? retryUrl;
  const idempotencyKey = (operationId: string): string =>
    `cms-schema-${operationId.toLowerCase()}-${supportReference}`;
  // Event payloads never become registry state; the server refetch does.
  const canonicalRefetchBinding =
    onCanonicalRefetch === undefined ? 'unbound' : 'bound';
  const ready = initialDetail?.status === 'success' ? initialDetail : null;
  const detail = ready?.data ?? null;
  // FE03 dry-run `degraded`: the last verified detail keeps its preparation
  // visible with its time, while no command consumes it.
  const degradedDetail =
    initialDetail?.status === 'degraded' && initialDetail.data !== null
      ? initialDetail
      : null;
  const prepared = detail ?? degradedDetail?.data ?? null;

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
      <ContentSchemaRegistryWorkbenchBanners
        loading={loading}
        offline={offline}
        message={message}
      />
      {variant === 'schemaReviewAssigned' ? null : (
        <ContentSchemaRegistryCapabilityGate
          variant={access}
          reasonCode={variant}
        />
      )}
      {!reviewMode && (access === 'read-only' || access === 'full') ? (
        <ContentSchemaRegistryFilterBar
          query={query}
          canonicalUrl={canonicalUrl}
        />
      ) : null}
      {hasListState ? (
        <ContentSchemaRegistryStatus
          state={initialList}
          regionLabel="Registry list"
          supportReference={supportReference}
          canonicalUrl={retryUrl}
          resetUrl={canonicalUrl}
          {...(resultCount === undefined ? {} : { resultCount })}
          activeFilterSummary={activeFilterSummary}
        />
      ) : null}
      {reviewMode ? (
        <ContentSchemaRegistryReviewMode
          reviewId={reviewId}
          state={initialReview}
          variant={variant}
          access={access}
          retryUrl={retryUrl}
          supportReference={supportReference}
          csrfToken={csrfToken}
          idempotencyKey={idempotencyKey}
          stepUpState={stepUpState ?? 'required'}
          stepUpFreshUntil={stepUpFreshUntil}
          actingContextLabel={actingContextLabel}
        />
      ) : (
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
            supportReference={supportReference}
          />
          {prepared === null ? null : (
            <div className="content-schema-registry-version-side">
              <ContentSchemaRegistryActivationPreparation
                preparation={prepared.activationPreparation}
                review={initialReview}
                {...(degradedDetail === null
                  ? {}
                  : {
                      degraded: {
                        lastVerifiedAt: degradedDetail.lastVerifiedAt,
                      },
                    })}
                onCanonicalRefetch={() => {
                  void onCanonicalRefetch('detail-read');
                }}
              />
              <ContentSchemaRegistryReviewPanel
                state={initialReview}
                retryUrl={retryUrl}
                supportReference={supportReference}
              />
            </div>
          )}
          {access === 'full' && detail !== null ? (
            <ContentSchemaRegistryVersionCommands
              detail={detail}
              review={initialReview}
              action={detailAction}
              csrfToken={csrfToken}
              idempotencyKey={idempotencyKey}
              expectedVersion={ready?.version ?? '1'}
              actingContextLabel={actingContextLabel}
              stepUpState={stepUpState}
              stepUpFreshUntil={stepUpFreshUntil}
              contextEpoch={contextEpoch}
            />
          ) : null}
        </div>
      )}
      <span
        className="visually-hidden"
        data-canonical-refetch={canonicalRefetchBinding}
      />
    </section>
  );
}
