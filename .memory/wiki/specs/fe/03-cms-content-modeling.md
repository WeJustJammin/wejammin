# CMS content modeling and authoring: Frontend Specification

> **Classification**: Feature specification
> **BE Source**: [03a-content-schema-registry.md](../be/03a-content-schema-registry.md), [03b-editorial-workflow-publication.md](../be/03b-editorial-workflow-publication.md), [03c-composition-taxonomy-localization.md](../be/03c-composition-taxonomy-localization.md)
> **IA Source**: [03-cms-content-modeling.md](../ia/03-cms-content-modeling.md), [deep-dives/03-cms-content-modeling.md](../ia/deep-dives/03-cms-content-modeling.md)
> **Surface**: Responsive Astro hybrid web/PWA with bounded React islands
> **Status**: Amended — current after the authorized Slice 09 IA-first contract reconciliation, the owner-approved DEC-108 CMS activation-producer amendment (successor, dry-run, frozen CMS review, bounded assignment and independent-decision commands CMS-03A-09..14; private review tables; safe no-matching-identifier island projection), the DEC-119 owner CMS capability grant console (owner-only grant, renew, revoke and list, CMS-03A-15..18), and the Slice 10 editorial cascade (DEC-133 typed `object` editor, DEC-112 `rich_text.v1` constrained native editor and typed renderer, D2 protected conflict-detail preimages, D3 server-derived draft identity, D5 three-domain comparison with the 512-change refusal, D6 restore preparation and chain confirmation, and the unconditional recent-MFA requirement on every editorial decision, schedule and publication).

## Referenced Material Inventory

- **Primary IA**: [03-cms-content-modeling.md](../ia/03-cms-content-modeling.md) in full.
- **IA deep dive**: [deep-dives/03-cms-content-modeling.md](../ia/deep-dives/03-cms-content-modeling.md) in full for the protected registry query boundary, release-only block operations, and cross-shard evidence.
- **BE sources**: [03a-content-schema-registry.md](../be/03a-content-schema-registry.md), [03b-editorial-workflow-publication.md](../be/03b-editorial-workflow-publication.md), [03c-composition-taxonomy-localization.md](../be/03c-composition-taxonomy-localization.md).
- **Cross-cutting FE source**: [00-infrastructure.md](00-infrastructure.md).
- **Design sources**: [design-system.md](../design-system.md), root `PRODUCT.md`, root `DESIGN.md`, and `.agents/skills/brand-guidelines/SKILL.md`.
- **Contract conventions**: BE00 `ApiError`, opaque cursor pagination, ETag/`If-Match` for mutations, idempotency for mutations, rate-limit headers, canonical refetch after Realtime hints, and disclosure-safe authorization. The CMS-03A-06 list and CMS-03A-07 detail reads are protected `no-store` requests with no body, `Idempotency-Key`, `If-Match`, optimistic mutation, audit, or outbox effect. CMS-03A-05 and CMS-03A-08 use the release-worker-only signed envelope and never become browser commands. The editorial safe reads CMS-03B-11, CMS-03B-12, CMS-03B-13 and CMS-03B-14 are protected `no-store` reads with no body, `Idempotency-Key`, `If-Match`, optimistic mutation, audit, or outbox effect; the server alone derives the actor, assignment, ownership, capability and schema identity, and the browser never supplies one.

## Source Map

| FE section                | Authoritative source                                                                                             | Consumed material                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Classification and scope  | `03-cms-content-modeling.md`; BE index                                                                           | Shard boundary and completed BE split group                                                        |
| Component inventory       | BE response/request contracts; IA interactions                                                                   | Typed props, protected list/detail reads, commands, state machines, access variants                |
| Routes and navigation     | IA user flows; design-system navigation paradigm                                                                 | Entry, deep-link, back, stack, compact-tab, and governed menu behavior                             |
| State management          | BE resource versions/events; BE00                                                                                | Server authority, URL state, local drafts, optimistic rollback, and read-only registry degradation |
| Interaction specification | IA Interactions and Edge Cases; [IA deep dive](../ia/deep-dives/03-cms-content-modeling.md); BE route registries | Triggers, guards, protected list/detail reads, human commands, errors, retry, and persistence      |
| Responsive behavior       | IA responsive/accessibility rules; design-system grid                                                            | Mobile, tablet, and desktop structural behavior                                                    |
| Accessibility             | IA Accessibility and interaction rows; WCAG 2.2 AA baseline                                                      | Keyboard, focus, names, live regions, reflow, target size, reduced motion                          |
| Data mapping              | Every BE source listed above, including BE03a CMS-03A-01..18 and BE03b/CMS-03B-01..14 plus BE03c/CMS-03C-01..05  | Operation, schema, response field, error, access, and component ownership                          |
| Testing obligations       | IA acceptance criteria; BE contract/security/recovery tests                                                      | Component, integration, E2E, a11y, and degraded-network assertions                                 |

## Design Requirements

- **Direction**: Product-first restrained utility under The Working Record. The next task and canonical record state precede secondary controls.
- **Typography**: Source Sans 3 for work UI; Source Serif 4 only for public display headings; IBM Plex Mono for identifiers, versions, timestamps, and provenance metadata.
- **Color**: Paper and Surface backgrounds with Graphite text. Jam Magenta is limited to active selection or one high-value action and never proves provenance. Semantic colors communicate literal states with text and icon.
- **Motion**: 150–220 ms feedback using `cubic-bezier(0.16, 1, 0.3, 1)` on opacity, color, border, or small transforms. Reduced motion collapses spatial effects to instant or opacity-only at at most 100 ms.
- **Anti-patterns**: No hero metrics, identical or nested card grids, nightclub styling, glassmorphism, gradient text, colored side stripes, decorative waveforms, gamified completion, or decorative verification.
- **Trust language**: asserted, counterparty-confirmed, verified, disputed, pending, unavailable, blocked, stale, and failed are distinct text-first states.

## Design System Compliance

- **Page archetypes**: List → Detail Workbench; Record Detail / Activity; Guided Form / Transaction; System / Degraded.
- **Navigation**: Consume `<PageShell>`, `<AppSidebar>` or `<AdminSidebar>`, `<TopBar>`, `<CompactTabBar>`, `<Breadcrumbs>`, and `<ActingContextSwitcher>`. Authorization and required routes remain code-owned.
- **Composition**: Consume `<Workbench>`, `<ActionBar>`, `<DataTable>`, `<FilterBar>`, `<Pagination>`, `<RecordHeader>`, `<ProvenanceFact>`, `<StateLabel>`, `<Timeline>`, `<CapabilityGate>`, `<OfflineStatus>`, and `<SyncConflict>` where applicable.
- **Loading**: Route HTML renders server-first. Known sections use layout-stable `<LoadingSkeleton>` after 250 ms; bounded mutations use `<InlineProgress>` with a stable label. Unknown absence is never skeletonized.
- **Errors**: Field and row failures are inline; route-wide dishonesty uses System / Degraded; component faults use `<ErrorBoundary>` with correlation ID. Money, rights, publication, security, or data-loss failures are never toast-only.
- **Empty**: `<EmptyState>` distinguishes no records, filter mismatch, forbidden disclosure, offline, unavailable, and failed. Copy gives one truthful next action.
- **Schema registry boundary**: `ContentSchemaRegistryWorkbench` has one protected list read, one protected detail read, and one protected schema-review detail read. Its browser command surface is limited to CMS-03A-01 through CMS-03A-04 and CMS-03A-09 through CMS-03A-14 (successor, dry-run, submit-review, record-decision and assignment); CMS-03A-05/CMS-03A-08/CMS-10 are represented only by the safe `BlockDefinitionRegistryRecord` from an authorized detail projection and have no human form, release-header parser, upload, or browser mutation. Review/assignment commands are available only to their bounded capabilities; the schema-review reads deliver only a safe projection and never a private matching identifier.
- **Capability grant boundary**: the separate `CmsCapabilityGrantConsole` owns the owner-only DEC-119 commands CMS-03A-15 (grant), CMS-03A-16 (renew) and CMS-03A-17 (revoke) and the protected list CMS-03A-18; it is never part of the registry workbench, renders only for the receipt-derived owner, and its server projections never contain a grantor, actor, party or private binding identifier.

## Component Inventory

### Shared types

```ts
type UiError = {
  code: string;
  message: string;
  requestId: string;
  details: Record<string, unknown> | null;
};
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading'; startedAt: string }
  | { status: 'error'; error: UiError; retryable: boolean }
  | { status: 'empty'; reason: 'no-records' | 'filter-miss' | 'not-disclosed' }
  | { status: 'success'; data: T; version: string; stale: false }
  | {
      status: 'optimistic-pending';
      data: T;
      operationId: string;
      version: string;
    }
  | { status: 'optimistic-rollback'; data: T; error: UiError; version: string }
  | { status: 'disabled'; reason: string }
  | {
      status: 'degraded';
      data: T | null;
      requestId: string;
      lastVerifiedAt: string | null;
    };

type AccessVariant =
  'full' | 'read-only' | 'partial-hidden' | 'disabled' | 'not-rendered';
type DomainVariant =
  | 'publicPage'
  | 'appPage'
  | 'adminPage'
  | 'authPage'
  | 'degradedPage'
  | 'publicRead'
  | 'entitledRead'
  | 'ownerFull'
  | 'guardianMandate'
  | 'juniorRestricted'
  | 'businessMandate'
  | 'staffCaseScoped'
  | 'adminStepUp'
  | 'forbiddenHidden'
  | 'disabledPrerequisite';

// Bounded review-only presentation variant for an assigned cms.schema_review
// human. It is distinct from ownerFull and entitledRead: it renders only the
// exact protected review detail and safe evidence summary plus the decision
// action when the server's permittedNextActions allow it. It never implies
// registry-wide cms.schema_registry.read, and it exposes no successor, dry-run,
// submit-review, activation, entry or publication control.
type ContentSchemaRegistryReviewVariant = 'schemaReviewAssigned';
type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/**
 * Safe, display-only server context evidence for the protected CMS island. It
 * carries a human-readable acting-context label and the expiring step-up/MFA
 * disclosure and nothing else. It contains no actor, person, party or private
 * binding identifier — raw or hashed — and no matching/correlation token. The
 * stable actor/person/party/binding projection stays entirely server-side, and
 * the protected POST remains authoritative.
 */
type ContentSchemaRegistryContextEvidence = {
  actingContextLabel?: string;
  stepUpState?: 'required' | 'pending' | 'verified';
  stepUpFreshUntil?: string;
};
```

### `CmsContentModelingRoute` (Astro server route)

```ts
interface CmsContentModelingRouteProps {
  children?: never;
  variant: DomainVariant;
  contextEvidence: ContentSchemaRegistryContextEvidence | null;
  capabilitySnapshot: readonly string[];
  canonicalUrl: string;
  initialQuery:
    | ContentSchemaRegistryListQuery
    | RevisionHistoryQuery
    | EntryListQuery
    | null;
  requestId: string;
}
```

- Server-verifies session, acting context, route visibility, and initial data before HTML composition. Props are validated, minimal, serializable, and disclosure-safe.
- Renders useful semantic HTML before hydration. React is used only for bounded filtering, commands, realtime invalidation, media controls, or rich editing.
- **A11y inline contract**: skip link targets `<main tabindex="-1">`; one `h1`; landmarks have unique names; route changes focus the `h1`; title includes record and state; 200% zoom and 320 CSS px reflow preserve reading/action order.

### `ContentSchemaRegistryWorkbench` (bounded React island)

**BE owner**: `03a-content-schema-registry.md`

```ts
interface ContentSchemaRegistryWorkbenchProps {
  contractFields: ContentSchemaRegistryWorkbenchContractFields;
  children?: never;
  variant: DomainVariant & ContentSchemaRegistryVariant;
  initialList: AsyncState<ContentSchemaRegistryListPage>;
  initialDetail: AsyncState<ContentSchemaRegistryDetail> | null;
  /** Stable non-matching server context evidence; never a raw binding/actor/party UUID. */
  contextEvidence: ContentSchemaRegistryContextEvidence;
  access: AccessVariant;
  query: ContentSchemaRegistryListQuery;
  contentTypeId: string | null;
  versionId: string | null;
  cursor: string | null;
  expectedVersion: string | null;
  onCanonicalRefetch: (
    reason: 'list-read' | 'detail-read' | 'mutation' | 'reconnect',
  ) => Promise<void>;
}

type ContentSchemaRegistryVariant =
  | 'entitledRead'
  | 'ownerFull'
  | 'guardianMandate'
  | 'juniorRestricted'
  | 'businessMandate'
  | 'staffCaseScoped'
  | 'adminStepUp'
  | 'forbiddenHidden'
  | 'disabledPrerequisite';

const ContentSchemaRegistryOperationIds = [
  'CMS-03A-01',
  'CMS-03A-02',
  'CMS-03A-03',
  'CMS-03A-04',
  'CMS-03A-05',
  'CMS-03A-06',
  'CMS-03A-07',
  'CMS-03A-08',
  'CMS-03A-09',
  'CMS-03A-10',
  'CMS-03A-11',
  'CMS-03A-12',
  'CMS-03A-13',
  'CMS-03A-14',
] as const;

// Generated from the strict BE03a Zod contracts; these are not hand-written DTOs.
type ContentSchemaRegistryRecord = GeneratedContentSchemaRegistryRecord;
type ContentSchemaRegistryListQuery = GeneratedContentSchemaRegistryListQuery;
type ContentSchemaRegistryListPage = GeneratedContentSchemaRegistryListPage;
type ContentSchemaRegistryDetail = GeneratedContentSchemaRegistryDetail;
type ContentTypeDraftRequest = GeneratedContentTypeDraftRequest;
type FieldSchemaChangeRequest = GeneratedFieldSchemaChangeRequest;
type RelationBindingRequest = GeneratedRelationBindingRequest;
type SchemaActivationRequest = GeneratedSchemaActivationRequest;
type BlockRegistrationRequest = GeneratedBlockRegistrationRequest;
type BlockLifecycleAdvanceRequest = GeneratedBlockLifecycleAdvanceRequest;
type ReleaseEnvelopeHeaders = GeneratedReleaseEnvelopeHeaders;
type SchemaActivationResource = GeneratedSchemaActivationResource;
type BlockDefinitionVersionResource = GeneratedBlockDefinitionVersionResource;
type BlockDefinitionRegistryRecord = GeneratedBlockDefinitionRegistryRecord;
type BlockLifecycleEventResource = GeneratedBlockLifecycleEventResource;

// DEC-108 activation-producer contracts, generated from the strict BE03a Zod schemas.
type SchemaSuccessorRequest = GeneratedSchemaSuccessorRequest;
type SchemaDryRunRequest = GeneratedSchemaDryRunRequest;
type SchemaReviewSubmissionRequest = GeneratedSchemaReviewSubmissionRequest;
type SchemaReviewDecisionRequest = GeneratedSchemaReviewDecisionRequest;
type SchemaReviewAssignmentRequest = GeneratedSchemaReviewAssignmentRequest;
type SchemaDryRunResource = GeneratedSchemaDryRunResource;
type SchemaReviewResource = GeneratedSchemaReviewResource;
type SchemaReviewDecisionResource = GeneratedSchemaReviewDecisionResource;
type SchemaReviewAssignmentResource = GeneratedSchemaReviewAssignmentResource;
type SchemaActivationPreparation = GeneratedSchemaActivationPreparation;

type ReleaseWorkerLifecycleOperation = {
  operationId: 'CMS-03A-08';
  method: 'POST';
  path: '/api/v1/cms/blocks/versions/{blockDefinitionVersionId}/lifecycle';
  request: BlockLifecycleAdvanceRequest;
  response: BlockLifecycleEventResource;
  status: 201;
  browserPolicy: 'release-worker-non-browser-telemetry';
};

// Generated from the strict BE03b Zod contracts; these are not hand-written DTOs.
type EntryRevisionRequest = GeneratedEntryRevisionRequest;
type ConflictResolutionRequest = GeneratedConflictResolutionRequest;
type RevisionHistoryQuery = GeneratedRevisionHistoryQuery;
type RevisionRestoreRequest = GeneratedRevisionRestoreRequest;
type ReviewSubmissionRequest = GeneratedReviewSubmissionRequest;
type EditorialDecisionRequest = GeneratedEditorialDecisionRequest;
type PublicationScheduleRequest = GeneratedPublicationScheduleRequest;
type PreviewRequest = GeneratedPreviewRequest;
type PublicationRequest = GeneratedPublicationRequest;
type EntryRevisionResource = GeneratedEntryRevisionResource;
type EditorialReviewResource = GeneratedEditorialReviewResource;
type PublicationScheduleResource = GeneratedPublicationScheduleResource;
type PreviewTokenResource = GeneratedPreviewTokenResource;
type PublicationResource = GeneratedPublicationResource;
type RevisionHistoryPage = GeneratedRevisionHistoryPage;
type SchemaArtifactEvidence = GeneratedSchemaArtifactEvidence;
type ValidatorEvidence = GeneratedValidatorEvidence;
type WorkflowPolicyEvidence = GeneratedWorkflowPolicyEvidence;
type VersionSet = GeneratedVersionSet;
type DependencyManifest = GeneratedDependencyManifest;

// Generated from the strict BE03c Zod contracts; these are not hand-written DTOs.
type TemplateVersionRequest = GeneratedTemplateVersionRequest;
type PatternInstanceRequest = GeneratedPatternInstanceRequest;
type TaxonomyTermActionRequest = GeneratedTaxonomyTermActionRequest;
type LocaleVariantRequest = GeneratedLocaleVariantRequest;
type RelatedContentRuleRequest = GeneratedRelatedContentRuleRequest;
type TemplateVersionResource = GeneratedTemplateVersionResource;
type CompositionInstanceResource = GeneratedCompositionInstanceResource;
type TaxonomyTermResource = GeneratedTaxonomyTermResource;
type LocaleVariantResource = GeneratedLocaleVariantResource;
type RelatedContentResource = GeneratedRelatedContentResource;
```

- Astro owns route data and static structure. The island owns only selection, typed filters, pending commands, conflict resolution, and invalidation.
- `ContentSchemaRegistryRecord` is the generated discriminated union on `resourceKind` from BE03a. `initialList` is the generated `ContentSchemaRegistryListPage`; `initialDetail` is the generated `ContentSchemaRegistryDetail` and is loaded only for the exact `contentTypeId` + `versionId` pair. Runtime validation rejects unknown variants or response fields.
- The workbench renders protected registry metadata only. Its two read scopes are `cms.schema_registry.read` or `cms.schema_designer` read scope; the server decides which rows/details are disclosed. It exposes browser commands for CMS-03A-01 through CMS-03A-04 and the DEC-108 activation-producer commands CMS-03A-09 (successor), CMS-03A-10 (dry-run), CMS-03A-11 (submit review), CMS-03A-12 (record decision) and CMS-03A-14 (assignment). CMS-03A-13 is a protected read of the authorized review and renders a `SchemaReviewResource` with `permittedNextActions`; it carries no private matching identifier. The successor, dry-run and submit-review forms require `cms.schema_designer`; the decision form requires an assigned `cms.schema_review` capability; the assignment form requires owner-only `cms.schema_review.assign`. CMS-03A-05/CMS-03A-08/CMS-10 are signed release-worker operations with only a safe `BlockDefinitionRegistryRecord` projection in the browser and no mutation facade.
- `BlockDefinitionVersionResource` is the full CMS-03A-05 release-worker response and is never parsed, stored, or rendered by browser code. Browser state may contain only `BlockDefinitionRegistryRecord`: `resourceKind`, `id`, `version`, `blockKey`, `blockVersion`, `propsSchemaRef`, `propsSchemaHash`, `rendererRef`, `releaseDigest`, and `lifecycle`.
- `BlockLifecycleEventResource` is the full CMS-03A-08 release-worker response. The lifecycle event, release nonce receipt, and release verification evidence are never parsed, stored, or rendered by browser code.
- Browser state never parses or exposes `ReleaseEnvelopeHeaders`, raw release body,
  `propsSchemaSnapshot`, `propsSnapshotHash`, `propsSnapshotAttestation` (including
  `algorithm`, attestation `keyId`, or attestation `signature`), `releaseKeyId`,
  `releaseRawBodyHash`, `releaseSignatureHash`, `releaseNonceHash`, or
  `releaseVerifiedAt`.
- List state and detail state are separate. The list owns the opaque query-bound `cursor`; the detail owns both immutable path IDs. Neither read uses `Idempotency-Key`, `If-Match`, a request body, optimistic mutation, mutation audit, or outbox effect.
- **A11y inline contract**: `<Workbench>` list/detail regions are named; selection is URL-addressable; rows use native links/buttons; Arrow keys are added only inside a declared composite; focus never moves on Realtime refetch; status changes use a polite atomic live region.
- **Responsive contract**: desktop shows list and detail; tablet preserves list with an inline inspector; mobile uses list then detail stack with a persistent Back action and no hidden command rail.
- **Error boundary**: isolates this domain section, sends scrubbed error plus request ID to provider-native diagnostics, preserves neighboring server HTML, and exposes Retry. A render error is never empty data.

### `CmsCapabilityGrantConsole` (bounded React island)

**BE owner**: `03a-content-schema-registry.md` (DEC-119, CMS-03A-15 through CMS-03A-18)

```ts
interface CmsCapabilityGrantConsoleProps {
  contractFields: CmsCapabilityGrantConsoleContractFields;
  children?: never;
  // Owner-only surface; every other persona never receives this island.
  variant: 'ownerFull' | 'forbiddenHidden' | 'disabledPrerequisite';
  initialList: AsyncState<CmsCapabilityGrantListPage>;
  /** Display-only label plus expiring step-up disclosure; no identifier of any kind. */
  contextEvidence: ContentSchemaRegistryContextEvidence;
  access: AccessVariant;
  /** URL state. The subjectPersonId filter is island-local and never enters the URL. */
  query: Omit<CmsCapabilityGrantListQuery, 'subjectPersonId'>;
  /** Server-computed UTC calendar bounds for validThrough; input bounds only, the server stays authoritative. */
  termWindow: { minDate: string; maxDate: string };
  cursor: string | null;
  onCanonicalRefetch: (
    reason: 'list-read' | 'mutation' | 'reconnect',
  ) => Promise<void>;
}

const CmsCapabilityGrantOperationIds = [
  'CMS-03A-15',
  'CMS-03A-16',
  'CMS-03A-17',
  'CMS-03A-18',
] as const;

// Generated from the strict BE03a Zod contracts; these are not hand-written DTOs.
type GrantableCmsCapability = GeneratedGrantableCmsCapability;
type CapabilityGrantRequest = GeneratedCapabilityGrantRequest;
type CapabilityGrantRenewalRequest = GeneratedCapabilityGrantRenewalRequest;
type CapabilityGrantRevocationRequest =
  GeneratedCapabilityGrantRevocationRequest;
type CmsCapabilityGrantResource = GeneratedCmsCapabilityGrantResource;
type CmsCapabilityGrantListQuery = GeneratedCmsCapabilityGrantListQuery;
type CmsCapabilityGrantListPage = GeneratedCmsCapabilityGrantListPage;
```

- The console has four surfaces: the grant list (CMS-03A-18), a grant form (CMS-03A-15), a per-row renew form (CMS-03A-16) and a per-row revoke confirmation (CMS-03A-17). `listState: AsyncState<CmsCapabilityGrantListPage>` is server-authoritative and `no-store`; there is no optimistic list state, and every command refetches the canonical list after a verified response.
- The capability control is a native `select` over the generated `GrantableCmsCapability` set in four labelled groups, never free text: Design (`cms.schema_registry.read` View schema registry, `cms.schema_designer` Design schemas, `cms.template_designer` Design templates, `cms.taxonomy_curator` Curate taxonomies), Authoring (`cms.author` Author entries, `cms.editor` Edit and return entries, `cms.publisher` Publish entries), Delivery and media (`cms.navigation_editor` Edit navigation and routes, `cms.media_contributor` Contribute media, `cms.media_curator` Curate media) and Review (`cms.reviewer` Review entries, `cms.reviewer.policy`, `cms.reviewer.legal`, `cms.reviewer.security` and `cms.reviewer.financial` as the matching disclosure specialist reviewer). Each option shows its plain label and its key in monospace; the key is never the only text.
- Person identifiers appear only inside this owner-only protected island (the table cell and the form field). They never enter the URL, `localStorage`, `IndexedDB`, `BroadcastChannel`, analytics, telemetry, logs, Realtime bodies or any announcement text, and the grantor, actor, party and binding identifiers do not exist in the projection.
- The `validThrough` control is a native `input type="date"` bounded by `termWindow.minDate`/`maxDate` (the current UTC date through the current UTC date plus 89 days, so a term spans at most 90 UTC days; DEC-120) with helper copy `The grant ends at the end of this date (UTC) and lasts at most 90 days. You can renew it or revoke it at any time.` A server 422 carrying `grant_term_spans_at_most_ninety_utc_days` renders the field error `Choose an end date no more than 90 days from today (UTC).` A grant is shown as `Valid through YYYY-MM-DD (UTC)` with the derived `endsAt` instant as secondary text.
- **A11y inline contract**: the table has a caption and sortable header buttons; each row action has a specific accessible name (`Renew {capability label} grant ending {date}`, `Revoke {capability label} grant ending {date}`) described by the row's person cell; state is text plus icon (`Active`, `Lapsed`, `Revoked`), never color alone; confirmations are inline with heading focus; refetch never moves focus; results use a polite atomic live region.
- **Responsive contract**: desktop shows the table with the grant form beside it; tablet keeps the table with row-detail expansion and the form below; mobile shows a priority list (capability, state, valid-through) with expandable facts and a single-column form, with no hidden command rail and 44 by 44 px targets.
- **Error boundary**: isolates this section, sends a scrubbed error plus request ID to provider-native diagnostics, preserves neighboring server HTML and exposes Retry; a render error is never empty data.

### `EditorialWorkflowPublicationWorkbench` (bounded React island)

**BE owner**: `03b-editorial-workflow-publication.md`

```ts
interface EditorialWorkflowPublicationWorkbenchProps {
  contractFields: EditorialWorkflowPublicationWorkbenchContractFields;
  children?: never;
  variant: DomainVariant;
  initial: AsyncState<
    | EntryRevisionResource
    | EditorialReviewResource
    | PublicationScheduleResource
    | PreviewTokenResource
    | PublicationResource
    | RevisionHistoryPage
    | EntryCreateResource
    | EntryDraftDetailResource
    | EntryListPage
    | ConflictDetailResource
    | AuthoringContextResource
  >;
  /** Safe display-only server context evidence; never a raw actor/party/binding identifier. */
  contextEvidence: ContentSchemaRegistryContextEvidence;
  access: AccessVariant;
  query: RevisionHistoryQuery | null;
  selectedId: string | null;
  expectedVersion: string | null;
  onCanonicalRefetch: (
    reason: 'navigation' | 'realtime-hint' | 'mutation' | 'reconnect',
  ) => Promise<void>;
}

type EditorialWorkflowPublicationResource =
  | EntryRevisionResource
  | EditorialReviewResource
  | PublicationScheduleResource
  | PreviewTokenResource
  | PublicationResource
  | RevisionHistoryPage
  | EntryCreateResource
  | EntryDraftDetailResource
  | EntryListPage
  | ConflictDetailResource
  | AuthoringContextResource;

type EditorialWorkflowPublicationOperation =
  | {
      operationId: 'CMS-03B-01';
      method: 'POST';
      path: '/api/v1/cms/entries/{entryId}/revisions';
      request: EntryRevisionRequest;
      response: EntryRevisionResource;
      status: 201;
      browserPolicy: 'human-form';
    }
  | {
      operationId: 'CMS-03B-02';
      method: 'POST';
      path: '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve';
      request: ConflictResolutionRequest;
      response: EntryRevisionResource;
      status: 201;
      browserPolicy: 'human-form';
    }
  | {
      operationId: 'CMS-03B-03';
      method: 'GET';
      path: '/api/v1/cms/entries/{entryId}/revisions';
      query: RevisionHistoryQuery;
      response: RevisionHistoryPage;
      status: 200;
      browserPolicy: 'protected-read-only';
    }
  | {
      operationId: 'CMS-03B-04';
      method: 'POST';
      path: '/api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore';
      request: RevisionRestoreRequest;
      response: EntryRevisionResource;
      status: 201;
      browserPolicy: 'human-form';
    }
  | {
      operationId: 'CMS-03B-05';
      method: 'POST';
      path: '/api/v1/cms/entries/{entryId}/reviews';
      request: ReviewSubmissionRequest;
      response: EditorialReviewResource;
      status: 201;
      browserPolicy: 'human-form';
    }
  | {
      operationId: 'CMS-03B-06';
      method: 'POST';
      path: '/api/v1/cms/reviews/{reviewId}/decision';
      request: EditorialDecisionRequest;
      response: EditorialReviewResource;
      status: 200;
      browserPolicy: 'human-form';
    }
  | {
      operationId: 'CMS-03B-07';
      method: 'POST';
      path: '/api/v1/cms/publication-schedules';
      request: PublicationScheduleRequest;
      response: PublicationScheduleResource;
      status: 202;
      browserPolicy: 'human-form';
    }
  | {
      operationId: 'CMS-03B-08';
      method: 'POST';
      path: '/api/v1/cms/previews';
      request: PreviewRequest;
      response: PreviewTokenResource;
      status: 201;
      browserPolicy: 'human-form';
    }
  | {
      operationId: 'CMS-03B-09';
      method: 'POST';
      path: '/api/v1/cms/publications';
      request: PublicationRequest;
      response: PublicationResource;
      status: 202;
      browserPolicy: 'human-form';
    }
  | {
      operationId: 'CMS-03B-10';
      method: 'POST';
      path: '/api/v1/cms/entries';
      request: EntryCreateRequest;
      response: EntryCreateResource;
      status: 201;
      browserPolicy: 'human-form';
    }
  | {
      operationId: 'CMS-03B-11';
      method: 'GET';
      path: '/api/v1/cms/entries/{entryId}';
      query: EntryDraftDetailQuery;
      response: EntryDraftDetailResource;
      status: 200;
      browserPolicy: 'protected-read-only';
    }
  | {
      operationId: 'CMS-03B-12';
      method: 'GET';
      path: '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}';
      query: ConflictDetailQuery;
      response: ConflictDetailResource;
      status: 200;
      browserPolicy: 'protected-read-only';
    }
  | {
      operationId: 'CMS-03B-13';
      method: 'GET';
      path: '/api/v1/cms/entries';
      query: EntryListQuery;
      response: EntryListPage;
      status: 200;
      browserPolicy: 'protected-read-only';
    }
  | {
      operationId: 'CMS-03B-14';
      method: 'GET';
      path: '/api/v1/cms/entries/authoring-context';
      query: AuthoringContextQuery;
      response: AuthoringContextResource;
      status: 200;
      browserPolicy: 'protected-read-only';
    };
```

- Astro owns route data and static structure. The island owns only selection, typed filters, pending commands, conflict resolution, and invalidation.
- `EditorialWorkflowPublicationResource` is the generated union of the exact 03b response schemas. CMS-03B-03 is a read-only `RevisionHistoryPage`; CMS-03B-11 is a read-only `EntryDraftDetailResource`; CMS-03B-12 is a read-only `ConflictDetailResource`; CMS-03B-13 is a read-only `EntryListPage`; and CMS-03B-14 is a read-only `AuthoringContextResource`. The other operations render their named resource only after strict validation. Runtime validation rejects unknown variants or response fields.
- CMS-03B-01, CMS-03B-02, CMS-03B-04, CMS-03B-05, CMS-03B-06, CMS-03B-07, CMS-03B-08, CMS-03B-09, and CMS-03B-10 are human forms with operation-specific request/resource contracts. CMS-03B-03, CMS-03B-11, CMS-03B-12, CMS-03B-13 and CMS-03B-14 are protected no-store GETs with no mutation headers or effects.
- `CMS-03B-10` is a human form that requires an `Idempotency-Key` and no update-only `If-Match`; `CMS-03B-11`, `CMS-03B-12`, `CMS-03B-13` and `CMS-03B-14` are protected read-only `GET`s that carry no body, `Idempotency-Key`, or `If-Match`, return `Cache-Control: no-store` with a strong authenticated `ETag`, and have no mutation effect.
- **A11y inline contract**: `<Workbench>` list/detail regions are named; selection is URL-addressable; rows use native links/buttons; Arrow keys are added only inside a declared composite; focus never moves on Realtime refetch; status changes use a polite atomic live region.
- **Responsive contract**: desktop shows list and detail; tablet preserves list with an inline inspector; mobile uses list then detail stack with a persistent Back action and no hidden command rail.
- **Error boundary**: isolates this domain section, sends scrubbed error plus request ID to provider-native diagnostics, preserves neighboring server HTML, and exposes Retry. A render error is never empty data.

#### Slice 10 editorial authoring surfaces (DEC-133, DEC-112, D2/D3/D5/D6, G3)

**BE owner**: `03b-editorial-workflow-publication.md`. These local components extend the same `EditorialWorkflowPublicationWorkbench` island and its route; they add no product, permission, security or data-placement decision, and every access fact is server-derived.

The Slice 11 request contracts locked in the Slice 10 contract phase (G3) are the ones these forms already consume: review submission (`CMS-03B-05`), decision (`CMS-03B-06`), schedule (`CMS-03B-07`), preview (`CMS-03B-08`) and publication (`CMS-03B-09`). The forms import the same generated Zod request schemas, so client-side strictness and unknown-key rejection cannot drift from the frozen contracts; the semantic state transitions (hash equality, stale version set, two-person policy) remain server-owned and are proven by their own operation tests, not by the browser.

| Component | BE operation(s) | Props and state contract | Accessibility and responsive contract |
| --------- | --------------- | ------------------------ | ------------------------------------- |
| `CmsEditorialEntryList` | `CMS-03B-13` protected list read | `EntryListPage` rows are `RevisionSummary` items only, with a signed keyset `nextCursor`; `AsyncState` is idle, loading, empty/no-records or filter-miss, auth/read-scope/validation/rate/dependency error, success, degraded — never optimistic | Native list links; Back first on mobile; row identity, lifecycle, current draft `revisionNumber`, `state` and `updatedAt` are text; result count announced politely; the cursor is URL state and never serializes a protected value |
| `CmsEditorialAuthoringContext` | `CMS-03B-14` preparation read | Feeds the create form only: `creatableTypes` (each with `contentTypeId`, `contentTypeVersionId`, `sourceLocale`, `defaultLocale`, `supportedLocales`, `schemaArtifact`, `validatorRefs`, `workflowPolicy`, `activationEvidence`) and, with the query, the author-safe `fields` projection; `AsyncState` as above | The user never types JSON, a schema, a policy or an evidence blob (DEC-108 G8): the form prefills the frozen request members from this projection and posts them back unmodified; it grants no `cms.schema_registry.read`. Missing/denied/degraded context disables submission with the sign-in, capability, rate-wait or retry state |
| `CmsEditorialEntryDraft` | `CMS-03B-01`, `CMS-03B-10`, `CMS-03B-11` | Integrated editor over `EntryCreateRequest`/`EntryRevisionRequest` and `EntryDraftDetailResource`; `baseRevision` is the server-derived `revisionNumber` and `expectedVersion` is `entry.version` (D3); the composite GET `ETag` is a representation validator and never the numeric `If-Match`; `openConflict` renders the durable open-conflict banner and link to the conflict route | Per-field labels and linked error summary; autosave is advisory (3 s idle, 30 s hard maximum) and never steals focus; unsent values are retained and focus restored on refusal; multi-tab refetch opens `<SyncConflict>`, never a last-write-wins claim |
| `CmsObjectFieldEditor` | `CMS-03B-01/10/11` value authoring (DEC-133 / O1 Option A) | Renders exactly the declared depth-1 `properties[]` (≤32): a persistent label per stable property key with a native control for a `scalar`, a closed `select` for an `enum` (options from the declared `enumValues`), and the rich-text editor for a `rich_text` property; required properties are marked and validated; the value is submitted as the strict property-keyed object | One field group per property with a group label; 44×44 px targets on mobile; a missing required key, an unknown key or a kind mismatch maps to the linked 422 summary; never renders a raw JSON editor |
| `CmsRichTextEditor` | `CMS-03B-01/10/11` value authoring (DEC-112) | Constrained native editor: a block list of native controls (a type `select`; level / list / depth selects; one `textarea` per block) plus inline marks and links authored with the documented constrained markup subset (`**bold**`, `_italic_`, `\`code\``, `[text](href)`) parsed deterministically to canonical spans, with a live preview through `CmsRichTextRenderer`. Non-canonical input is refused client-side and mapped to the server 422 `rich_text_not_canonical`; only the canonical `rich_text.v1` AST is submitted | Block reordering by explicit controls (never pointer-only drag); each control labelled and keyboard reachable; a polite preview region; reduced motion collapses preview transitions to ≤100 ms; unknown or unsafe link schemes (`javascript:`, `data:`, protocol-relative) are rejected inline before submit |
| `CmsRichTextRenderer` | Consumes the `rich_text.v1` AST on CMS-03B-11/12 and history | Typed, SSR-capable elements only: `<p>`, `<h2>`–`<h4>`, grouped `<ul>/<ol><li>`, `<blockquote>`, `<strong>/<em>/<code>`, and `<a rel="noopener noreferrer">` for https links; no `dangerouslySetInnerHTML`; trusted because it accepts only the server-validated canonical AST | Correct heading order (2→3→4 without skips) and non-empty link text are structural obligations; the renderer adds no interactive control |
| `CmsEditorialConflictDetail` | `CMS-03B-12` protected read, then `CMS-03B-02` resolve | Three-way preimages `base`/`theirs`/`yours` rendered from the bounded, schema-typed `paths[]`; `paths` is empty outside state `open`; the read carries no `Idempotency-Key` or `If-Match` and no ownership identifier; on 409 the draft detail is refetched and open choices for unchanged paths are retained | A per-path radio group with three labelled preimages (base / their version / your version) plus an explicit value control; a linked error summary focuses the first invalid choice; a hidden or absent entry/conflict is disclosure-safe 404 |
| `CmsEditorialRevisionCompare` | `CMS-03B-03` | Renders the semantic change list grouped by the D5 `domain` (`field`, then `block`, then `relation`) using only side hashes; a relation change shows the keyed `targetToken` and never a target identity; more than 512 combined changes renders the typed `comparison_too_large` refusal and an unresolvable recorded version renders `comparison_unavailable`, never a truncated list | Ordered lists with domain group headings; counts announced politely; no target identity in any text, URL or telemetry |
| `CmsEditorialRestoreForm` | `CMS-03B-04` | Confirmation form for `RevisionRestoreRequest` using the D6 `compare.restore` carrier: it shows `edgeCount` and the availability, disables commit with copy when availability is `chain_unavailable` or `transform_missing`, and submits the read-derived `migrationChainId` unchanged; the server re-derives the chain and requires equality (409 `migration_chain_mismatch`) | Inline `ConfirmationStep` naming that a new draft is created and the source is unchanged; heading focus; Escape cancels before commit; a refusal preserves the source and draft |

All nine surfaces are server-authoritative and `no-store`; the rich-text preview, the object-property group and the conflict preimages never enter a public/private cache, analytics event, Realtime body, URL, or log, and the entries list, draft identity, conflict detail, authoring context and restore chain are always re-derived by the server.

### `CompositionTaxonomyLocalizationWorkbench` (bounded React island)

**BE owner**: `03c-composition-taxonomy-localization.md`

```ts
interface CompositionTaxonomyLocalizationWorkbenchProps {
  contractFields: CompositionTaxonomyLocalizationWorkbenchContractFields;
  children?: never;
  variant: DomainVariant;
  initial: AsyncState<
    | TemplateVersionResource
    | CompositionInstanceResource
    | TaxonomyTermResource
    | LocaleVariantResource
    | RelatedContentResource
  >;
  /** Safe display-only server context evidence; never a raw actor/party/binding identifier. */
  contextEvidence: ContentSchemaRegistryContextEvidence;
  access: AccessVariant;
  query: null;
  selectedId: string | null;
  expectedVersion: string | null;
  onCanonicalRefetch: (
    reason: 'navigation' | 'realtime-hint' | 'mutation' | 'reconnect',
  ) => Promise<void>;
}

type CompositionTaxonomyLocalizationResource =
  | TemplateVersionResource
  | CompositionInstanceResource
  | TaxonomyTermResource
  | LocaleVariantResource
  | RelatedContentResource;

type CompositionTaxonomyLocalizationOperation =
  | {
      operationId: 'CMS-03C-01';
      method: 'POST';
      path: '/api/v1/cms/templates/versions';
      request: TemplateVersionRequest;
      response: TemplateVersionResource;
      status: 201;
      browserPolicy: 'human-form';
    }
  | {
      operationId: 'CMS-03C-02';
      method: 'POST';
      path: '/api/v1/cms/compositions/pattern-instances';
      request: PatternInstanceRequest;
      response: CompositionInstanceResource;
      status: 201;
      browserPolicy: 'human-form';
    }
  | {
      operationId: 'CMS-03C-03';
      method: 'POST';
      path: '/api/v1/cms/taxonomies/{taxonomyId}/terms/actions';
      request: TaxonomyTermActionRequest;
      response: TaxonomyTermResource;
      status: 200;
      browserPolicy: 'human-form';
    }
  | {
      operationId: 'CMS-03C-04';
      method: 'POST';
      path: '/api/v1/cms/entries/{entryId}/locales/{locale}/variants';
      request: LocaleVariantRequest;
      response: LocaleVariantResource;
      status: 201;
      browserPolicy: 'human-form-deferred-phase-2';
    }
  | {
      operationId: 'CMS-03C-05';
      method: 'POST';
      path: '/api/v1/cms/entries/{entryId}/related-content';
      request: RelatedContentRuleRequest;
      response: RelatedContentResource;
      status: 201;
      browserPolicy: 'human-form-deferred-phase-2';
    };
```

- Astro owns route data and static structure. The island owns only selection, typed filters, pending commands, conflict resolution, and invalidation.
- `CompositionTaxonomyLocalizationResource` is the generated union of the five exact 03c response schemas; `query: null` is intentional because 03c has no query operation. Runtime validation rejects unknown variants or response fields.
- CMS-03C-01, CMS-03C-02, and CMS-03C-03 have exact Phase 2 human-form contracts. CMS-03C-04 and CMS-03C-05 retain exact request/response/browser contracts but are disabled with `human-form-deferred-phase-2` until their runtime slice is authorized; no placeholder endpoint or generic DTO is allowed.
- **A11y inline contract**: `<Workbench>` list/detail regions are named; selection is URL-addressable; rows use native links/buttons; Arrow keys are added only inside a declared composite; focus never moves on Realtime refetch; status changes use a polite atomic live region.
- **Responsive contract**: desktop shows list and detail; tablet preserves list with an inline inspector; mobile uses list then detail stack with a persistent Back action and no hidden command rail.
- **Error boundary**: isolates this domain section, sends scrubbed error plus request ID to provider-native diagnostics, preserves neighboring server HTML, and exposes Retry. A render error is never empty data.

### Global feedback and command components

| Component                            | Props contract                                                                 | Interactive and accessibility contract                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<ActionBar>`                        | `{ primary, secondary, destructive, state, expectedVersion, operationId }`     | Native buttons; stable pending label; named destructive consequence; focus returns to trigger; Enter submits only the owning form.                                                                          |
| `<CapabilityGate>`                   | `{ variant, reasonCode, recoveryHref, disclosure }`                            | `not-rendered` emits no protected label; disabled has reason/recovery; a 401 `STEP_UP_REQUIRED` never renders a gate and instead navigates to `/step-up?returnTo=` (DEC-111); server remains authoritative. |
| `<FilterBar>`                        | `{ schema, values, resultCount, resetHref }`                                   | Persistent labels; URL commits on Apply; Escape clears only the open combobox; result count is politely announced.                                                                                          |
| `<DataTable>`                        | `{ columns, rows, sort, selection, density }`                                  | Semantic table wide; priority list mobile; header buttons expose sort; stable keys; bulk actions name count/scope.                                                                                          |
| `<ConfirmationStep>`                 | `{ consequence, affectedScope, expectedVersion, stepUpState, idempotencyKey }` | Inline first; heading focus; Escape cancels before commit; duplicate activation returns same operation.                                                                                                     |
| `<OfflineStatus>` / `<SyncConflict>` | `{ connectivity, intents, serverVersion, localVersion }`                       | Text plus icon; refused intents remain; conflict actions name outcomes; no automatic overwrite.                                                                                                             |

## State Management

| State class         | Source of truth                | Entry trigger                                  | Render and copy                                                                                                                                                                                                                                         | Exit/persistence                                                               |
| ------------------- | ------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| idle                | URL and server HTML            | Route composed with no client work             | No artificial busy state                                                                                                                                                                                                                                | User interaction or invalidation                                               |
| loading             | In-flight request descriptor   | Navigation/refetch exceeds 250 ms              | Skeleton for known layout; “Loading current records” inline                                                                                                                                                                                             | Success, typed error, or cancellation; safe prior content remains when allowed |
| error per class     | BE00 `ApiError`                | Parsed non-success                             | Validation inline; 401 `UNAUTHENTICATED` reauthenticate with safe sign-in return; 401 `STEP_UP_REQUIRED` route to `/step-up?returnTo=` using the typed `allowedMethods`; 403 capability; 404 disclosure-safe; 409 conflict; 429 countdown; 5xx degraded | Explicit recovery; valid input retained                                        |
| empty               | Canonical success              | Zero records or filtered results               | Distinguish no records from filter miss; one legitimate action                                                                                                                                                                                          | Create/import/invite or Reset filters                                          |
| success             | Server resource and ETag       | Validated operation-specific success response  | Canonical facts, state, version, provenance, allowed actions                                                                                                                                                                                            | Invalidation or command                                                        |
| optimistic-pending  | Local overlay by operation ID  | Reversible command accepted locally            | Pending text/icon; affected controls disabled                                                                                                                                                                                                           | Confirmed refetch or rollback                                                  |
| optimistic-rollback | Canonical preimage plus error  | Command refused/ambiguous after reconciliation | Restore preimage; announce refusal; retain input                                                                                                                                                                                                        | Edit/retry/dismiss                                                             |
| disabled            | Capability/config contract     | Known unavailable action                       | Visible reason and prerequisite; no handler                                                                                                                                                                                                             | Capability/config refetch                                                      |
| degraded            | Last-known-good plus freshness | Dependency/network failure                     | Exact scope, stale timestamp, request ID, Retry/Status                                                                                                                                                                                                  | Canonical refetch                                                              |

- **Server state**: Astro/Hono resources, ETags, cursor pages, job status, and canonical authorization.
- **URL state**: query, sort, filters, cursor, selected record, tab, and return target. It is bookmarkable and Back/Forward safe.
- **Island-local state**: draft fields, disclosure toggles, transient focus, and bounded optimistic overlay. No global client store.
- **Realtime**: entity/event hints only. Deduplicate, preserve focus, refetch canonical data, and apply only currently authorized responses.
- **Multi-tab**: `BroadcastChannel` signals invalidation only. Each tab refetches; no tab writes another tab's canonical cache.
- **Unsaved changes**: retain scoped draft, show inline leave confirmation, use `beforeunload` only while dirty, and clear only after success or explicit discard.
- **Offline**: only non-registry commands may store non-canonical intents where BE permits. Reconnect revalidates identity, authority, input, and version; refused intents remain visible.

### Protected registry state contract

- `ContentSchemaRegistryWorkbench` owns separate `listState: AsyncState<ContentSchemaRegistryListPage>` and `detailState: AsyncState<ContentSchemaRegistryDetail> | null`. A list read carries the typed query and opaque cursor; a detail read carries both `contentTypeId` and `versionId` and cannot infer either from a label or list position.
- Registry list/detail reads are server-authoritative and `no-store`. They never enter a public cache, private/offline cache, `localStorage`, `IndexedDB`, `BroadcastChannel` payload, URL payload, analytics event, or Realtime body. Offline renders `System / Degraded` or a truthful empty state and refetches after reconnect.
- The registry has no optimistic list/detail state. `expectedVersion`, idempotency, and mutation rollback apply only to the human command forms CMS-03A-01 through CMS-03A-04 and CMS-03A-09 through CMS-03A-12 plus CMS-03A-14; CMS-03A-06, CMS-03A-07 and CMS-03A-13 issue no mutation headers/effects.
- The schema-review detail read (CMS-03A-13) and the registry reads are server-authoritative and `no-store`. A review detail carries only the immutable `reviewId`; its safe projection never includes a submitter, reviewer, grantor or private binding identifier, and it never enters a public cache, private/offline cache, analytics event, or Realtime body. The assignment create/revoke (CMS-03A-14) echoes no reviewer/grantor identifier; the owner-supplied `reviewerPersonId` is an authorized request reference only.
- The protected island receives only safe display `contextEvidence`: an optional human-readable `actingContextLabel` plus the expiring `stepUpState` and `stepUpFreshUntil` disclosure. It carries no actor, person, party or private binding identifier (raw, hashed, or truncated), no matching/correlation token, and no ownership identifier; all of these are resolved and matched server-side and never cross into island props, URL state, telemetry, or logs. Acting-context changes and stale-window resets are driven by the trusted shared acting-context invalidation event plus a local epoch/cancellation and a server refetch/remount, not by any browser context identifier. The protected POST remains authoritative.
- CMS-03A-05/CMS-03A-08/CMS-10 block metadata may be rendered only when returned by an authorized protected list/detail projection as `BlockDefinitionRegistryRecord`. The browser cannot submit, replay, advance, withdraw, or otherwise mutate a block registration/lifecycle; full `BlockDefinitionVersionResource`, `BlockLifecycleEventResource`, and release verification evidence stay on the worker boundary.
- Both protected read scopes are accepted for the registry list and detail reads (CMS-03A-06 and CMS-03A-07): `cms.schema_registry.read` or `cms.schema_designer` read scope. The schema-review read (CMS-03A-13) is authorized by the submitter/schema-designer scope or an assigned review-only scope, never by `cms.schema_registry.read`. Scope choice is server-derived and never encoded in query, path, or client props as authority.
- Protected registry reads contain no Idempotency-Key header and no If-Match header, and there is no public cache, public route, search index, or sitemap source for registry rows or artifacts.

### DEC-108 review, dry-run and activation-preparation states

`reviewState: AsyncState<SchemaReviewResource>` is the CMS-03A-13 read and is separate from the list and detail states. `dryRunState` is derived, not fetched on its own: it is the `activationPreparation.dryRunRef` of the CMS-03A-07 detail, advanced only by the BE00 job poll named in the network contract. Neither state is ever optimistic; both are `no-store`.

| `AsyncState` status | `reviewState` (CMS-03A-13)                                                                                                    | `dryRunState` (`dryRunRef` + `jobRef`)                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `idle`              | No `reviewRef` on the preparation yet; the review panel is not rendered                                                       | `dryRunRef` is `null`; the start-dry-run form is shown only when `permittedNextActions` includes `start_dry_run`                                             |
| `loading`           | Review read in flight; skeleton with a polite live region                                                                     | Dry-run `state` is `queued` or `running`; the job poll is in flight and announces queued then running without moving focus                                   |
| `success`           | `200 SchemaReviewResource` with `state` `open`, `approved`, `rejected` or `invalidated`, rendered per the review state table  | `dryRunRef.state` is `completed` and `result` is `passed` or `failed`; only then are the sealed counts and hashes read from the six sealed members of `dryRunRef` |
| `empty`             | `not-disclosed` for a concealed or absent review (404); the panel states only that the review is not available                | `no-records` when the candidate has never had a dry run                                                                                                      |
| `error`             | Typed `ApiError` with request ID; `retryable` is true only for 429 and 502/503/504                                            | `dryRunRef.state` is `failed` with a safe `failureCode` and no counts or hashes (an unsealed infrastructure failure); a failed job poll is a retryable error |
| `degraded`          | Last verified review kept with `lastVerifiedAt` while the read is unavailable; decision and activation controls are disabled  | Last verified `dryRunRef` kept with `lastVerifiedAt`; submit-review stays disabled                                                                           |
| `disabled`          | Reason names the missing prerequisite (no assignment, expired assignment, or a state other than `open` for the decision form) | Reason names the missing prerequisite (no `start_dry_run` in `permittedNextActions`)                                                                         |

Review state rendering: `open` shows the required and recorded decision counts and the decision form to an assigned reviewer; `approved` shows `approvalEvidenceHash` and `decidedAt`; `rejected` states that the candidate returned to an editable draft; `invalidated` states that a new frozen submission is required. `approvalEvidenceHash` and `decidedAt` render only when `state` is `approved`. A job state of `succeeded` alone never renders a passed result: `result` comes only from the sealed report, and a job state of `failed` or `cancelled` without a sealed report renders the unsealed failure copy and keeps submit-review disabled.

`activationPreparation` data mapping (CMS-03A-07 detail):

| Member                                         | Source type                                                                                                     | Rendered as                                                                                                                                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dryRunRef`                                    | `{ id, state, result, jobId, failureCode?, sourceCount?, targetCount?, rowErrorCount?, sourceHash?, targetHash?, reportHash? }` or `null` (the six trailing members are sealed-only, present together for a `completed` report and otherwise absent) | Dry-run status panel per the table above; `id` prefills `dryRunId` of CMS-03A-11 and CMS-03A-04; `jobId` is the BE00 job to poll; a non-null `failureCode` (only when `state` is `failed`) selects the safe failure copy; the sealed members render as Source rows, Target rows, Row errors, Source hash, Target hash and Report hash, and a polite atomic live region announces "The sealed dry run passed|failed: N source rows, N target rows, N row errors" with the three hashes only after the report seals (a queued or terminal job without a sealed report announces no evidence), and focus never moves |
| `jobRef`                                       | `{ id, state }` with the BE00 `JobStateSchema` or `null`                                                        | Polite job status line (`queued`, `running`, `succeeded`, `failed`, `cancelled`); never a result                                                                                                                         |
| `reviewRef`                                    | `{ id, state }` or `null`                                                                                       | Link target for the CMS-03A-13 read; `id` is the `reviewId` the browser holds                                                                                                                                            |
| `templateCompatibility`                        | the safe resolver projection, optional                                                                          | Read-only compatibility summary for the exact candidate type and version; absent means no compatible projection is available and the UI states nothing about compatibility                                               |
| `permittedNextActions`                         | array of `create_successor`, `start_dry_run`, `submit_review`, `assign_reviewer`, `record_decision`, `activate` | The only readiness expression: each control renders only when its action is present                                                                                                                                      |
| `approvalIds` (CMS-03A-04 field, not a member) | `decisions` of the approved review read through `reviewRef`                                                     | Prefilled, read-only list of the approve-decision IDs of that one approved review; the user never types or edits JSON or IDs                                                                                             |

Reviewer selection (CMS-03A-14 create): no protected person-lookup read operation exists that the owner may call, so the form has one native text input for the reviewer's person ID. It validates a UUID on blur (inline error `Enter the reviewer's person ID as a UUID.`) and on submit with the `SchemaReviewAssignmentRequest` Zod schema, and its helper copy reads `Enter the person ID exactly as the reviewer gave it to you. The reviewer must be an existing person; the assignment gives read and decide access to this one review for at most seven days.` A 409 for an unknown, ineligible, submitter or broad-scope target renders one non-disclosing refusal and never says whether the person exists. The value is never echoed back, stored in a URL, telemetry event or log, or shown after submit.

### DEC-119 CMS capability grant console states

`CmsCapabilityGrantConsole` owns `listState` plus one command state per form (`grantState`, `renewState`, `revokeState`). None is optimistic, and the list is never held in a private or offline cache.

| `AsyncState` status | `listState` (CMS-03A-18)                                                                                                                                 | Command state (CMS-03A-15, CMS-03A-16, CMS-03A-17)                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idle`              | Server HTML rendered the first page; no client work                                                                                                      | Form closed or untouched; the commit action is enabled only for a locally valid form                                                                                         |
| `loading`           | Skeleton after 250 ms with a polite `Loading current grants` region                                                                                      | Commit disabled with a stable pending label (`Granting`, `Renewing`, `Revoking`), inline progress after 250 ms, duplicate activation ignored                                 |
| `success`           | `200 CmsCapabilityGrantListPage`; rows rendered with derived `state`                                                                                     | `201` or `200 CmsCapabilityGrantResource`; result heading receives focus, the list is refetched, and the announcement names the capability label and valid-through date only |
| `empty`             | `no-records` when the organization has no grant rows, `filter-miss` when filters exclude every row; one action (`Grant a capability` or `Reset filters`) | Not applicable                                                                                                                                                               |
| `error`             | Typed `ApiError` with request ID; `retryable` only for 429 and 502/503/504                                                                               | Typed `ApiError`; valid input retained; 409, 404, 403 and 422 render the exact copy below                                                                                    |
| `degraded`          | Last verified page kept with `lastVerifiedAt`; every command disabled with the reason                                                                    | Unknown mutation outcome renders pending and reconciles through a list refetch before any retry; success is never guessed                                                    |
| `disabled`          | `disabledPrerequisite` with the reason (no step-up yet, or dependency unavailable)                                                                       | Reason names the missing prerequisite; no handler                                                                                                                            |

Command error copy (the server never discloses more than the status):

| Status and code         | Copy and action                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401 `STEP_UP_REQUIRED`  | `Verify your identity to change CMS access.` shows the expiring step-up disclosure and a `Verify identity` action that navigates to the shared DEC-111 step-up page `/step-up?returnTo=<this route's relative path>` (allowlisted relative `returnTo`) using the typed `allowedMethods`; field values stay in island memory only, and if the step-up navigates away the form returns empty with `Your entries were not saved.` (no person identifier is persisted to restore it) |
| 401 `UNAUTHENTICATED`   | Safe sign-in redirect; protected data removed                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 403 `FORBIDDEN`         | Gate with `Only the organization owner can manage CMS access.`; no further disclosure.                                                                                                                                                                                                                                                                                                                                                                                           |
| 404 `NOT_FOUND`         | One non-disclosing refusal: `That person could not be found as a member of your organization.` for the grant form, and `This grant is no longer available.` for renew and revoke with a list refetch                                                                                                                                                                                                                                                                             |
| 409 `CONFLICT`          | Grant: when `details.recoveryAction` is `renew` (CMS-03A-15 found an existing active grant aggregate), `This person already holds this capability. Renew the existing grant instead.` with a link that filters the list to the capability, where the renew command is; any other grant 409 shows `This grant changed. Review the current term and try again.` and refetches the list. Renew and revoke: `This grant changed. Review the current term and try again.` with the refetched row beside the preserved input; a revoked grant offers `Grant again`                                                                                                                                                                |
| 422 `VALIDATION_FAILED` | Linked summary and field errors per the form table; preserved input                                                                                                                                                                                                                                                                                                                                                                                                              |
| 429 `RATE_LIMITED`      | Inline countdown from `Retry-After`; input kept                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 502/503/504             | Scoped degraded state with request ID and Retry after a list refetch; never a guessed success                                                                                                                                                                                                                                                                                                                                                                                    |

Form fields (every field has a persistent label, help and error ID; validation runs on blur where safe and on submit, and the server stays authoritative):

| Form                         | Field         | Control and rule                                                                                                                                                                                                                          | Error copy                                                   |
| ---------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Grant (CMS-03A-15)           | Person ID     | native `input type="text"`, required, UUID, `autocomplete="off"`, `spellcheck="false"`, monospace; helper `Enter the person ID exactly as the person gave it to you. The person must already be a confirmed member of your organization.` | `Enter the person's ID as a UUID.`                           |
| Grant                        | Capability    | native `select`, required, closed generated set in four groups                                                                                                                                                                            | `Choose a capability from the list.`                         |
| Grant and Renew (CMS-03A-16) | Valid through | native `input type="date"`, required, real date between `termWindow.minDate` and `termWindow.maxDate`                                                                                                                                     | `Choose an end date from {minDate} through {maxDate} (UTC).` |
| Grant, Renew and Revoke      | Reason        | native `textarea`, optional, 1 to 256 characters, live remaining-count text                                                                                                                                                               | `Keep the reason to 256 characters.`                         |
| Revoke (CMS-03A-17)          | Confirmation  | inline `ConfirmationStep` naming the consequence `Revoke {capability label} now. It takes effect immediately and cannot be undone; grant it again to restore it.`                                                                         | not applicable                                               |

### Slice 10 editorial authoring states

These states extend the `EditorialWorkflowPublicationWorkbench`; each is server-authoritative and `no-store`, and none is optimistic. `openConflictRef` is derived from `EntryDraftDetailResource.openConflict`, and the conflict base/theirs/yours preimages are never cached, stored or logged.

| `AsyncState` status | `entryListState` (CMS-03B-13) | `authoringContextState` (CMS-03B-14) | `conflictDetailState` (CMS-03B-12) | `compareState` (CMS-03B-03) and `restoreState` (CMS-03B-04) |
| ------------------- | ------------------------------- | ------------------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| `idle`            | Server HTML rendered the first page; no client work | The create page has no prefilled type yet; the editor is not rendered | No `openConflictRef` on the draft detail; the conflict panel is not rendered | No `compareRevisionId`; the restore form is not rendered |
| `loading`         | Skeleton after 250 ms with a polite "Loading your entries" region; the cursor read keeps prior rows | Polite "Loading authoring options" region; the create action stays disabled | Skeleton after 250 ms; the conflict form stays disabled | Compare skeleton after 250 ms; a restore availability probe never moves focus |
| `success`         | `200 EntryListPage`; rows are `RevisionSummary` items with the signed `nextCursor` | `200 AuthoringContextResource`; the create form prefills the frozen request members and, with the query, the field definitions | `200 ConflictDetailResource` with `paths` populated only while `state` is `open`; each side is schema-typed against its own `schemaVersionId` | `200 RevisionHistoryPage` with the domain-grouped comparison; `compare.restore` gives `migrationChainId`, `edgeCount` and `availability` |
| `empty`           | `no-records` when the caller has no assigned entries, `filter-miss` when filters exclude every row; one action (create or reset filters) | `no-records` when the caller has no creatable active type; the create form states the prerequisite | `not-disclosed` for a concealed/absent conflict; for a resolved/superseded conflict the panel shows metadata only with `paths: []` | `no-records` when the entry has no earlier revision to compare or restore |
| `error`           | Typed `ApiError` with request ID; `retryable` only for 429 and 502/503/504 | Typed `ApiError`; the sign-in, capability, rate-wait or retry state disables submission | Typed `ApiError`; 403 for a visible entry without read scope, 404 concealment otherwise | `comparison_too_large` renders the typed refusal; `comparison_unavailable` renders the non-disclosing unavailable state; 409`migration_chain_mismatch`/`migration_chain_incomplete`/`template_incompatible` render the safe restore failure |
| `degraded`        | Last verified page kept with `lastVerifiedAt`; no row is ever cached offline | Last verified context kept with `lastVerifiedAt`; submission stays disabled | Last verified preimages are never kept: the read is re-required, and the conflict form stays disabled | Last verified comparison kept with `lastVerifiedAt`; restore commit stays disabled until the chain is re-derived |
| `disabled`        | Reason names the missing author/editor read scope | Reason names the missing creatable type or author/editor scope | Reason names the missing entry read scope or the null `openConflict` | Reason names an unavailable or incomplete restore chain |

The authoring-context read is a preparation projection, not authority: the browser echoes the frozen `schemaArtifact`, `validatorRefs`, `workflowPolicy` and `activationEvidence` back into CMS-03B-10 and the server recomputes and compares them, returning 409 on drift (DEC-108 G8 precedent). The user never types or edits JSON, a schema, a policy or evidence.

## Page and Route Definitions

| Route                                                                                    | Rendering                                                                                                          | Guard and redirect                                                                                                                                                                                                                                                                                                                                                                     | Deep-link and history                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/app/cms-content-modeling`                                                              | Protected Astro SSR registry list with a bounded `ContentSchemaRegistryWorkbench` island                           | Server verifies Supabase session, expiry, acting context, and `cms.schema_registry.read` or `cms.schema_designer` read scope. Missing/expired session uses the allowlisted 303 sign-in redirect; insufficient capability is 403; concealed scope is an omission or disclosure-safe 404. No public registry projection exists.                                                          | `ContentSchemaRegistryListQuery` owns bounded filters, sort, direction, and opaque cursor in URL state; invalid values normalize with `replaceState`; Back restores list selection/scroll without serializing protected records                                                                            |
| `/app/cms-content-modeling/:contentTypeId/versions/:versionId`                           | Protected server-first `ContentSchemaRegistryDetail` with bounded islands                                          | Same session/acting-context check and `cms.schema_registry.read` or `cms.schema_designer` read scope; malformed UUID or mismatched type/version is 400/404 per BE03a; visible capability denial is 403; expired session preserves only a safe relative return target                                                                                                                   | Bookmark refetches the exact immutable `contentTypeId` + `versionId`; stale/retired/unreadable detail stays disclosure-safe and never falls back to a public record                                                                                                                                        |
| System/degraded boundary                                                                 | Preserved shell when safe                                                                                          | Unsafe cached content removed for privacy, legal, takedown, or revoked authority                                                                                                                                                                                                                                                                                                       | Retry repeats safe read; mutation status reconciles before retry                                                                                                                                                                                                                                           |
| `/app/cms-content-modeling/entries`                                                      | Protected Astro SSR entry list with a bounded `CmsEditorialEntryList` inside the `EditorialWorkflowPublicationWorkbench` island                                        | Server verifies Supabase session, expiry, acting context, and CMS author/editor read scope; missing/expired session uses the allowlisted 303 sign-in redirect; only the caller's assigned/owned entries are listed, and a signed cursor is bound to the complete query and read scope; concealed scope is omitted.                                                                       | `EntryListQuery` owns `state`, `contentTypeId`, `limit` and the opaque `cursor` in URL state; invalid values normalize with `replaceState`; Back restores list position/scroll without serializing a protected value; the nav entry from `/app/cms-content-modeling` reaches this list                                                                                       |
| `/app/cms-content-modeling/entries/new` and `/app/cms-content-modeling/entries/:entryId` | Protected Astro SSR entry create and draft detail with a bounded `EditorialWorkflowPublicationWorkbench` island    | Server verifies Supabase session, expiry, acting context, and CMS author/editor assignment; missing/expired session uses the allowlisted 303 sign-in redirect; concealed or absent entry is disclosure-safe 404; visible entry without assignment is 403; no direct table route or browser table grant exists.                                                                         | `EntryDraftDetailQuery` owns the optional locale; create carries no record in URL; the create form prefills its frozen request members from CMS-03B-14 and the user types no JSON/schema/policy evidence; Back restores the draft without serializing protected values                                      |
| `/app/cms-content-modeling/entries/:entryId/revisions`                                    | Protected server-first revision history and compare with the bounded `CmsEditorialRevisionCompare` and `CmsEditorialRestoreForm`                                      | Same session/acting-context check plus CMS author/editor/reviewer read scope; malformed `entryId` returns 400, a concealed or absent entry/revision returns disclosure-safe 404, and a visible entry without read scope returns 403.                                                                                  | `RevisionHistoryQuery` owns entry, cursor, limit, state, compare revision and locale in URL state; the D5 comparison groups changes by `domain` and names only side hashes and the keyed relation `targetToken`; Back restores the list position |
| `/app/cms-content-modeling/entries/:entryId/conflicts/:conflictId`                         | Protected server-first three-way conflict detail with a bounded `CmsEditorialConflictDetail`                                                                          | Same session/acting-context check plus CMS author/editor entry read scope; malformed UUIDs return 400, a hidden or absent entry/conflict returns disclosure-safe 404, and a visible entry without read scope returns 403.                                                                                              | `ConflictDetailQuery` accepts no keys; the URL carries only the two immutable IDs; resolving the conflict refetches canonical draft detail and returns to the editor with unchanged-path choices retained |
| `/app/cms-content-modeling/schema-reviews/:reviewId`                                     | Protected server-first `SchemaReviewResource` detail with a bounded `ContentSchemaRegistryWorkbench` review island | Server verifies Supabase session, expiry, acting context, and either submitter/`cms.schema_designer` scope or an assigned `cms.schema_review` review-only scope; malformed UUID returns 400, a concealed or inaccessible review returns disclosure-safe 404, a visible review without the required scope returns 403, and an expired session uses the same safe sign-in redirect.      | URL carries only the immutable `reviewId`; Back restores list selection without serializing any reviewer/private identifier; the assigned reviewer reaches the native decision form here, the schema designer reaches the submit/activation forms from the version detail                                  |
| `/app/cms-content-modeling/capability-grants`                                            | Protected Astro SSR owner console with a bounded `CmsCapabilityGrantConsole` island                                | Server verifies Supabase session, expiry, acting context and that the caller is the receipt-derived owner; missing/expired session uses the allowlisted 303 sign-in redirect; an authenticated non-owner receives the 403 `CapabilityGate` and no navigation entry is rendered for non-owners; step-up is required to commit, never to read. No public or non-owner projection exists. | `CmsCapabilityGrantListQuery` fields other than `subjectPersonId` own filters, sort, direction and opaque cursor in URL state; invalid values normalize with `replaceState`; the person filter is island-local and never serialized; Back restores list position without serializing any person identifier |

## Interaction Specification

| Interaction                                                             | Trigger and focus                                                                                             | Preconditions                                                                                                                                                                                                                                        | Success                                                                                                                                                                                                                                                 | Failure and recovery                                                                                                                                                                                                                                                                                                | Persistence                                                                                                                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CMS-01` / `CMS-03A-01` Create content type draft                       | Native link/button/form; focus stays until navigation or named result heading                                 | Server-derived actor/context/capability, valid `ContentTypeDraftRequest` including the locale configuration (`supportedLocales`, `fallbackChains`; see Locale configuration fields), required ETag/idempotency rules for the mutation                                                                                                                           | Render authoritative `ContentTypeVersionResource`/version and permitted metadata; announce status                                                                                                                                                       | Map exact BE03a `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                                              | URL for navigation/filter; scoped draft before commit; server after success                                                                                                             |
| `CMS-02` / `CMS-03A-02` Change field schema                             | Native link/button/form; focus stays until navigation or named result heading                                 | Server-derived actor/context/capability, valid `FieldSchemaChangeRequest`, expected version and idempotency                                                                                                                                          | Render authoritative `FieldDefinitionVersionResource`; announce status                                                                                                                                                                                  | Map exact BE03a `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                                              | URL for navigation/filter; scoped draft before commit; server after success                                                                                                             |
| `CMS-03` / `CMS-03A-03` Bind domain record                              | Native link/button/form; focus stays until navigation or named result heading                                 | Server-derived actor/context/capability, valid `RelationBindingRequest`, expected version and idempotency                                                                                                                                            | Render authoritative `RelationDefinitionResource`; announce status                                                                                                                                                                                      | Map exact BE03a `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                                              | URL for navigation/filter; scoped draft before commit; server after success                                                                                                             |
| `CMS-04` / `CMS-03A-04` Activate schema version                         | Native link/button/form plus named confirmation step; focus stays until navigation or named result heading    | Server-derived actor/context/capability, valid `SchemaActivationRequest`, expected version, step-up and policy-derived approvals, idempotency                                                                                                        | Render authoritative `SchemaActivationResource`/job status; announce status                                                                                                                                                                             | Map exact BE03a `ApiError`; retain input where safe; focus summary; reconcile unknown mutation/status before retry                                                                                                                                                                                                  | URL for navigation/filter; scoped draft before commit; server after success                                                                                                             |
| `CMS-04a` / `CMS-03A-09` Create successor draft                         | Native link/button/form; focus stays until navigation or named result heading                                 | Server-derived actor/context/capability (`cms.schema_designer`), valid `SchemaSuccessorRequest` (locale fields both null or both present, and the template pair `defaultTemplateVersionId`/`templateBindings` both null or both present; see Locale configuration fields and Successor template choice), readable immutable source version, exact source `If-Match`, `Idempotency-Key`                                                                       | Render authoritative `ContentTypeVersionResource` for the fresh draft; new definition row IDs with preserved stable field identities, remapped local references and incremented version; announce status                                                | 400 malformed path/header/body; 401 missing/expired session; 403 designer capability; 404 concealed source; 409 stale source version/idempotency; 415 non-JSON; 422 successor contract; 429 successor limit; 502/503/504 RPC dependency; 500 scrubbed                                                               | Source preserved; URL for the new draft after success; scoped draft before commit                                                                                                       |
| `CMS-04b` / `CMS-03A-10` Start schema dry-run                           | Native form; focus stays until named result heading                                                           | `cms.schema_designer` on the draft, valid `SchemaDryRunRequest` (`{expectedVersion, transformKey?, transformVersion?}` — pair both-absent or both-present), `If-Match`, `Idempotency-Key`                                                            | Render `202 SchemaDryRunResource` as pending/queued with its job reference; never a transformation result; announce status                                                                                                                              | 400 malformed path/header/body; 401 missing/expired session; 403 designer; 404 concealed draft; 409 stale version/idempotency or changed evidence; 415 non-JSON; 422 transform-pair/classification mismatch; 429 dry-run limit; 502/503/504 RPC dependency; 500 scrubbed                                            | Server derives source/target/compiler/classification; caller supplies no counts/hashes/report; `GET /api/v1/jobs/{jobId}` observes status; no false success                             |
| `CMS-04c` / `CMS-03A-11` Submit schema review                           | Native submit form; focus stays until named result heading                                                    | `cms.schema_designer` on a draft with a passed persisted dry run, valid `SchemaReviewSubmissionRequest` (`{expectedVersion, dryRunId}`), `If-Match`, `Idempotency-Key`                                                                               | Render `201 SchemaReviewResource` (state `open`) with frozen policy/evidence and required decision count; announce review state                                                                                                                         | 400 malformed IDs/header/body; 401 missing/expired session; 403 designer; 404 concealed draft/dry-run; 409 open review/evidence/state/idempotency; 415 non-JSON; 422 submission contract; 429 review-write limit; 502/503/504 RPC dependency; 500 scrubbed                                                          | Draft to `review` atomic; frozen evidence immutable; the submitter never counts as a reviewer                                                                                           |
| `CMS-04d` / `CMS-03A-12` Record schema review decision                  | Native approve/reject form plus step-up; focus stays until result heading                                     | Assigned `cms.schema_review` human on the exact frozen review, valid `SchemaReviewDecisionRequest` (`{expectedVersion, decision:'approve'\|'reject'}`), recent binding-bound MFA, `If-Match`, `Idempotency-Key`                                      | Render `201 SchemaReviewDecisionResource`; announce exact decision/state and updated recorded/required counts                                                                                                                                           | 400 malformed ID/header/body; 401 missing/expired session or `STEP_UP_REQUIRED`; 403 reviewer/assignment; 404 concealed review; 409 duplicate/self/out-of-policy/stale/idempotency; 415 non-JSON; 422 decision bound; 429 decision limit; 502/503/504 RPC dependency; 500 scrubbed                                  | Append-only; self/duplicate refused; rejection returns the candidate to editable draft through the audited transition                                                                   |
| `CMS-04e` / `CMS-03A-13` Protected schema-review detail                 | Native record link/back; focus moves to the heading only on navigation, not Realtime refetch                  | Authenticated actor with exact `reviewId` UUID path; submitter/schema-designer scope or assigned `cms.schema_review` review-only scope; no body or mutation headers                                                                                  | Render validated `SchemaReviewResource` with safe candidate identity, frozen evidence summary, required/recorded counts, decision references and eligible `permittedNextActions`; announce status                                                       | `INVALID_REQUEST` malformed path; `UNAUTHENTICATED` safe sign-in; disclosure-safe `NOT_FOUND` for concealed reviews; `RATE_LIMITED` wait; `DEPENDENCY_UNAVAILABLE` degraded; `INTERNAL_ERROR` scrubbed                                                 | `no-store`; URL carries only the immutable `reviewId`; no mutation, optimistic state, or offline cache                                                                                  |
| `CMS-04f` / `CMS-03A-14` Assign/revoke schema reviewer                  | Native assignment form; focus stays until named result heading                                                | Existing owner with `cms.schema_review.assign`, recent binding-bound MFA, exact review `If-Match`, valid `SchemaReviewAssignmentRequest` (discriminated `action:'create'\|'revoke'`)                                                                 | `201 SchemaReviewAssignmentResource` for create (safe fields only) or `200` for revoke; announce assignment state and expiry                                                                                                                            | 400 malformed ID/header/body; 401 missing/expired session or `STEP_UP_REQUIRED`; 403 owner assignment capability; 404 concealed review; 409 ineligible/submitter/broad-scope/stale/idempotency; 415 non-JSON; 422 assignment contract; 429 assignment limit; 502/503/504 RPC dependency; 500 scrubbed               | Bounded `cms.schema_review` read/decide on one frozen review, within seven days and no later than the grantor authority; creates no identity; audit assignment/revocation atomically    |
| `CMS-04g` / `CMS-03A-15` Grant CMS capability                           | Native grant form; focus stays until named result heading                                                     | Receipt-derived owner, recent binding-bound MFA, valid `CapabilityGrantRequest` (`{subjectPersonId, capability, validThrough, reason?}`), `Idempotency-Key`, no `If-Match`                                                                           | `201 CmsCapabilityGrantResource` for the subject and capability; the list is refetched and the announcement names the capability label and valid-through date                                                                                           | 400 malformed header/body; 401 missing/expired session or `STEP_UP_REQUIRED`; 403 non-owner; 404 absent, ineligible or cross-organization person; 409 active aggregate exists or idempotency; 415 non-JSON; 422 capability, `validThrough` or reason; 429 grant limit; 502/503/504 RPC dependency; 500 scrubbed     | Finite term of at most 90 UTC days (DEC-120); creates no identity or membership; no admin, grant or delegation authority; person ID never echoed beyond the owner-only list             |
| `CMS-04h` / `CMS-03A-16` Renew CMS capability grant                     | Native renew form on the row; focus stays until named result heading                                          | Receipt-derived owner, step-up, valid `CapabilityGrantRenewalRequest` (`{expectedVersion, validThrough, reason?}`), exact grant `If-Match`, `Idempotency-Key`                                                                                        | `200 CmsCapabilityGrantResource` with a restarted term; list refetched                                                                                                                                                                                  | 400 malformed path/header/body; 401 missing/expired session or `STEP_UP_REQUIRED`; 403 non-owner; 404 absent or cross-organization grant; 409 stale version, revoked aggregate or idempotency; 415 non-JSON; 422 `validThrough` or reason; 429 limit; 502/503/504 RPC dependency; 500 scrubbed                      | Term restarts from the current UTC date within the 90-UTC-day ceiling (DEC-120); the owner may renew its own View schema registry and Design schemas access                             |
| `CMS-04i` / `CMS-03A-17` Revoke CMS capability grant                    | Native revoke confirmation on the row; focus stays until named result heading                                 | Receipt-derived owner, step-up, valid `CapabilityGrantRevocationRequest` (`{expectedVersion, reason?}`), exact grant `If-Match`, `Idempotency-Key`                                                                                                   | `200 CmsCapabilityGrantResource` in state `revoked`; list refetched                                                                                                                                                                                     | 400 malformed path/header/body; 401 missing/expired session or `STEP_UP_REQUIRED`; 403 non-owner; 404 absent or cross-organization grant; 409 stale version, already revoked or idempotency; 415 non-JSON; 422 reason; 429 limit; 502/503/504 RPC dependency; 500 scrubbed                                          | Revocation is immediate and audited; consumers stop honoring the grant at their next recheck                                                                                            |
| `CMS-04j` / `CMS-03A-18` Protected CMS capability grant list            | Native route load, filter form and pager; focus moves to the heading only on navigation                       | Receipt-derived owner; strict `CmsCapabilityGrantListQuery`; no body, `Idempotency-Key` or `If-Match`                                                                                                                                                | `200 CmsCapabilityGrantListPage`, `no-store`; rows show person ID, capability label and key, state, valid-from and valid-through, last action and version                                                                                               | `INVALID_REQUEST` malformed query; `UNAUTHENTICATED` safe sign-in; `FORBIDDEN` gate; `VALIDATION_FAILED` filter bounds; `RATE_LIMITED` wait; `DEPENDENCY_UNAVAILABLE` degraded; `INTERNAL_ERROR` scrubbed                                                                                                                     | `no-store`; no mutation, optimistic state or offline cache                                                                                                                              |
| `CMS-05` / `CMS-03B-01` / `CMS-03B-10` / `CMS-03B-11` / `CMS-03B-13` / `CMS-03B-14` Create/edit entry | Entry list, authoring-context preparation, integrated editor and protected draft-detail load; focus stays until navigation or named result heading | Assigned CMS author/editor; `EntryListQuery` for the assigned-entry list and `AuthoringContextQuery` for the creatable types and author-safe field definition; the create form prefills `schemaArtifact`/`validatorRefs`/`workflowPolicy`/`activationEvidence` from CMS-03B-14 and the user types no JSON; `EntryRevisionRequest` for autosave (with `baseRevision` = the server-derived `revisionNumber`) and `EntryCreateRequest` for an initial create under `Idempotency-Key` with no update-only `If-Match`; `EntryDraftDetailQuery` for the protected draft read; no hidden-entry probing | Render `200 EntryListPage`, `200 AuthoringContextResource`, `201 EntryRevisionResource` for a new revision, `201 EntryCreateResource` for the atomic active entry plus first draft revision, or `200 EntryDraftDetailResource` for the authorized draft; announce revision state | 400 malformed path/query/header/body; 401 missing/expired session; 403 assignment/edit, visible-unassigned draft or author/editor scope; 404 hidden entry or concealed type; 409 stale base/version/conflict/idempotency or replayed create; 415 non-JSON; 422 field/schema/value (including a non-canonical `rich_text.v1` value and an invalid `object` property); 429 author-write limit; 502/503/504 schema/RPC dependency; 500 scrubbed | Scoped draft before commit; retain unsent values and restore focus; canonical revision or draft detail after success; the `openConflict` banner survives reload and multiple tabs; never cached offline |
| `CMS-06` / `CMS-03B-12` / `CMS-03B-02` Resolve concurrent edit                         | Protected three-way conflict-detail load then native conflict form; focus stays on explicit choice until result heading                                     | Assigned author/editor with entry read and resolve capability; `ConflictDetailQuery` (no keys) for the bounded, schema-typed base/theirs/yours preimages (empty unless state `open`, no ownership identifier); `ConflictResolutionRequest`, exact entry/conflict IDs, `If-Match`, and idempotency                                                                                                                   | Render `200 ConflictDetailResource` then `201 EntryRevisionResource` with both parent revisions preserved                                                                                                                                                                                 | 400 malformed IDs/header/body; 401 missing/expired session; 403 entry read/resolve capability; 404 hidden entry/conflict; 409 moved base/invalid choice/idempotency; 415 non-JSON; 422 choice/value schema; 429 conflict-write limit; 502/503/504 RPC dependency; 500 scrubbed                                                 | A per-path radio group preserves all choices; after a 409 the draft detail is refetched and choices for unchanged paths are retained; canonical two-parent revision after success                                                                                                                       |
| `CMS-07` / `CMS-03B-03` Compare/read history                            | Native link/filter; focus remains in list after refetch                                                       | Entry assignment/read capability, `RevisionHistoryQuery`, signed cursor context, no body/`Idempotency-Key`/`If-Match`                                                                                                                                | Render `200 RevisionHistoryPage` with safe summaries and the field/block/relation comparison grouped by `domain`; side hashes only, with the keyed relation `targetToken` and no target identity                                                                                                                   | 400 malformed path/query/cursor; 401 missing/expired session; 403 read scope; 404 hidden entry/revision; 409 cursor/context mismatch; 415 unsupported media if sent; 422 query bounds or `comparison_too_large`/`comparison_unavailable` refusal; 429 read limit; 502/503/504 read dependency/deadline; 500 scrubbed                                                           | URL owns typed query/cursor; no mutation or offline cache; never a truncated comparison                                                                                                                               |
| `CMS-07` / `CMS-03B-04` Restore revision                                | Native confirmation form; focus stays until named result heading                                              | Edit capability, `RevisionRestoreRequest`, readable immutable source, the D6 `compare.restore` chain carrier (`migrationChainId`, `edgeCount`, availability) derived for `leftRevisionId`, `If-Match`, idempotency                                                                                                                            | Render `201 EntryRevisionResource` for a new draft; source remains unchanged                                                                                                                                                                            | 400 malformed IDs/header/body; 401 missing/expired session; 403 edit capability; 404 hidden entry/revision; 409 stale version/`migration_chain_mismatch`/`migration_chain_incomplete`/`template_incompatible`/idempotency; 415 non-JSON; 422 restore schema; 429 restore limit; 502/503/504 migration/RPC dependency; 500 scrubbed                                               | Confirmation shows the edge count and availability, disables commit with copy when `chain_unavailable`/`transform_missing`, and preserves the source and draft until canonical success                                                       |
| `CMS-08` / `CMS-03B-05` Submit review                                   | Native submit form; focus stays until named result heading                                                    | Submit capability/assignment, `ReviewSubmissionRequest`, frozen hash and dependency manifest, `If-Match`, idempotency                                                                                                                                | Render `201 EditorialReviewResource` with frozen evidence/counts; announce review state                                                                                                                                                                 | 400 malformed IDs/header/body; 401 missing/expired session; 403 submit/assignment; 404 hidden entry/revision; 409 open review/hash/dependency/idempotency; 415 non-JSON; 422 manifest/risk; 429 review-write limit; 502/503/504 preflight/RPC dependency; 500 scrubbed                                              | Scoped draft clears only after canonical review                                                                                                                                         |
| `CMS-08` / `CMS-03B-06` Record decision                                 | Native approve/reject form; focus stays until result heading                                     | Assigned distinct reviewer, `EditorialDecisionRequest` (`{reviewId, decision, reason, expectedVersion}`; the caller supplies no `capability` or `stepUpAt` — both are server-derived, D20), current review, and recent binding-bound MFA on every decision (ordinary and protected, DEC-108 aligned), `If-Match`, idempotency                                                                                                                     | Render `200 EditorialReviewResource`; announce exact decision/state                                                                                                                                                                                     | 400 malformed ID/header/body; 401 missing/expired session or `STEP_UP_REQUIRED` (with `recoveryAction: step_up` and typed `allowedMethods`) for missing/stale MFA on any decision; 403 reviewer/capability; 404 hidden review; 409 stale review/duplicate/self decision/hash/idempotency; 415 non-JSON; 422 decision/reason (a caller `capability`/`stepUpAt` is an unknown key); 429 decision limit; 502/503/504 RPC dependency; 500 scrubbed                                             | Decision evidence is server-owned and append-only; the form routes a missing/stale MFA to `/step-up?returnTo=` and re-confirms rather than rendering a 403 gate |
| `CMS-09` / `CMS-03B-07` Schedule publish/expire                         | Native schedule form; focus stays until named result heading                                                  | CMS publisher, `PublicationScheduleRequest` (including the BE04c `audience` grammar `^[a-z0-9_-]{1,48}$`), approved revision/frozen set, exact IANA/DST fields, recent binding-bound MFA (unconditional step-up), `If-Match`, idempotency                                                                                                                   | Render `202 PublicationScheduleResource` as pending/queued, never publication success                                                                                                                                                                   | 400 malformed IDs/header/body; 401 missing/expired session or `STEP_UP_REQUIRED`; 403 publisher; 404 hidden target; 409 schedule collision/stale version/idempotency; 415 non-JSON; 422 time/tzdb/audience/action; 429 schedule limit; 502/503/504 preflight/RPC dependency; 500 scrubbed                                               | Schedule/job status is canonical; no false success; a missing/stale MFA routes to `/step-up?returnTo=` and never renders a gate |
| `CMS-10` / `CMS-03A-05` Register block version                          | No browser trigger, form, parser, upload, or mutation facade; protected metadata read only                    | Signed release-worker principal, exact `ReleaseEnvelopeHeaders`, and verified manifest are required; no human session or client capability can satisfy this precondition                                                                             | Render only safe `BlockDefinitionRegistryRecord` metadata returned by protected list/detail; never parse full worker response; announce read status                                                                                                     | `401 WEBHOOK_REJECTED` is reserved for invalid release principal/signature; all other release failures retain their exact worker status/code; browser shows unavailable/read-only state and never retries a mutation                                                                                                | Release worker owns idempotent registration; browser stores no registration intent, raw body, snapshot, signature, or verification evidence                                             |
| `CMS-10` / `CMS-03A-08` Advance block lifecycle                         | No browser trigger, form, lifecycle control, parser, upload, or mutation facade; protected metadata read only | Signed release-worker principal with `block_registry:write`, exact `ReleaseEnvelopeHeaders`, existing `blockDefinitionVersionId`, `BlockLifecycleAdvanceRequest`, and verified release digest; human/admin sessions cannot satisfy this precondition | Worker returns `201 BlockLifecycleEventResource`; the block version row remains immutable and the append-only event plus nonce receipt commit atomically; browser may render only a safe `BlockDefinitionRegistryRecord` refetched from protected reads | `401 WEBHOOK_REJECTED` is reserved for invalid release principal/signature; malformed input, replay, scope, lifecycle, rate, dependency, and internal failures retain their exact worker status/code; browser renders no release error or retry                                                                     | Release worker owns the signed monotonic `supported→deprecated→withdrawn` transition; no browser lifecycle intent, event, nonce receipt, release evidence, or optimistic mutation state |
| `CMS-03A-06` Protected registry list                                    | Native filters/links; focus remains in the list and result count after refetch                                | Authenticated actor, acting context, `cms.schema_registry.read` or `cms.schema_designer` read scope, valid `ContentSchemaRegistryListQuery`; no request body or mutation headers                                                                     | Render validated `ContentSchemaRegistryListPage.items` discriminated by `resourceKind`; expose opaque `nextCursor` when present; announce count/status                                                                                                  | `INVALID_REQUEST`/`VALIDATION_FAILED` inline; `UNAUTHENTICATED` safe sign-in; `FORBIDDEN` gate; concealed rows omitted; `RATE_LIMITED` wait; `DEPENDENCY_UNAVAILABLE` degraded; `INTERNAL_ERROR` scrubbed                                              | URL carries only typed query/filter/sort/direction/cursor; no registry row/artifact is cached offline or persisted privately                                                            |
| `CMS-03A-07` Protected registry detail                                  | Native record link/back; focus moves to the detail heading only on navigation, not Realtime refetch           | Authenticated actor, acting context, `cms.schema_registry.read` or `cms.schema_designer` read scope, exact `contentTypeId` + `versionId` UUID path; no body or mutation headers                                                                      | Render validated `ContentSchemaRegistryDetail` with nested fields, relations, artifact identity, bindings, and safe `BlockDefinitionRegistryRecord` metadata                                                                                            | `INVALID_REQUEST` malformed path; `UNAUTHENTICATED` safe sign-in; `FORBIDDEN` gate; disclosure-safe `NOT_FOUND`; `RATE_LIMITED` wait; `DEPENDENCY_UNAVAILABLE` degraded; `INTERNAL_ERROR` scrubbed                                                     | URL carries only both immutable IDs; detail is re-fetched canonically and never cached offline/private                                                                                  |
| `CMS-11` Define template                                                | Native link/button/form; focus stays until navigation or named result heading                                 | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency                                                                                                                                                                  | Render authoritative response/version/provenance/next action; announce status                                                                                                                                                                           | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                                                    | URL for navigation/filter; scoped draft before commit; server after success                                                                                                             |

| `CMS-12` Use reusable pattern | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `CMS-13` / `CMS-03B-08` Preview token | Native preview form; focus stays until named result heading | Preview capability, `PreviewRequest`, readable revision/version set, audience/route/locale binding, idempotency | Render `201 PreviewTokenResource`; token is short-lived, audience-bound, noindex/no-store | 400 malformed body/path/version set; 401 missing/expired session; 403 preview capability; 404 hidden target; 409 stale version set/idempotency; 415 non-JSON; 422 route/audience/version; 429 preview limit; 502/503/504 schema/RPC dependency; 500 scrubbed | Token is never public, persisted offline, or exchanged for publication |
| `CMS-13` / `CMS-03B-09` Publish revision | Native publish confirmation; focus stays until named result heading | CMS publisher plus approved candidate, `PublicationRequest` (including the BE04c `audience` grammar `^[a-z0-9_-]{1,48}$`), exact frozen hash/version set, recent binding-bound MFA (unconditional step-up), `If-Match`, idempotency | Render `202 PublicationResource` pending/projection state; announce only canonical outcome | 400 malformed IDs/header/body; 401 missing/expired session or `STEP_UP_REQUIRED`; 403 publisher/review gate; 404 hidden target; 409 frozen hash/set/version/invalid state/idempotency; 415 non-JSON; 422 publication contract; 429 publish limit; 502/503/504 projection/RPC dependency; 500 scrubbed | Reconcile status before retry; no partial or false publication; a missing/stale MFA routes to `/step-up?returnTo=` and never renders a gate |
| `CMS-14` / `CMS-03C-03` Govern taxonomy term | Native taxonomy action form; focus stays until named result heading | Verified `taxonomy_curator`, `TaxonomyTermActionRequest`, taxonomy/term lock, exact `If-Match`, idempotency | Render `200 TaxonomyTermResource`; announce lifecycle/redirect state | 400 `INVALID_REQUEST`; 401 `UNAUTHENTICATED`; 403 `TAXONOMY_FORBIDDEN`; 404 `TAXONOMY_NOT_FOUND`; 409 `TAXONOMY_VERSION_CONFLICT`; 415 `UNSUPPORTED_MEDIA_TYPE`; 422 `TAXONOMY_VALIDATION_FAILED`; 429 `RATE_LIMITED`; 502/503/504 `DEPENDENCY_UNAVAILABLE`; 500 `INTERNAL_ERROR` | Preserve merge/redirect choices; no hidden taxonomy/term inference |
| `CMS-15` / `CMS-03C-04` Author locale variant | Native locale form; focus stays until named result heading; disabled until runtime slice is authorized | Assigned CMS author/editor, `LocaleVariantRequest`, readable source, localizable fields, BCP 47, a target locale in the active version's `supportedLocales`, a `fallbackChain` equal to the active version's chain (read-only in the form), no-fallback, exact `If-Match`, idempotency; Phase 2 runtime deferred | Contract target is `201 LocaleVariantResource`; deferred state must not claim a network success | 400 `INVALID_REQUEST`; 401 `UNAUTHENTICATED`; 403 `LOCALE_FORBIDDEN`; 404 `LOCALE_SOURCE_NOT_FOUND`; 409 `LOCALE_VERSION_CONFLICT`; 415 `UNSUPPORTED_MEDIA_TYPE`; 422 `LOCALE_VALIDATION_FAILED`; 429 `RATE_LIMITED`; 502/503/504 `DEPENDENCY_UNAVAILABLE`; 500 `INTERNAL_ERROR` | No placeholder endpoint; preserve form locally only under the authorized offline-intent policy |
| `CMS-16` / `CMS-03C-05` Curate related content | Native related-content form; focus stays until named result heading; disabled until runtime slice is authorized | Assigned CMS author/editor, `RelatedContentRuleRequest`, source edit capability, target projection recheck, exact `If-Match`, idempotency; Phase 2 runtime deferred | Contract target is `201 RelatedContentResource`; deferred state must not claim a network success | 400 `INVALID_REQUEST`; 401 `UNAUTHENTICATED`; 403 `RELATED_CONTENT_FORBIDDEN`; 404 `RELATED_CONTENT_NOT_FOUND`; 409 `RELATED_CONTENT_VERSION_CONFLICT`; 415 `UNSUPPORTED_MEDIA_TYPE`; 422 `RELATED_CONTENT_VALIDATION_FAILED`; 429 `RATE_LIMITED`; 502/503/504 `DEPENDENCY_UNAVAILABLE`; 500 `INTERNAL_ERROR` | Exclusions win; targets never grant access; no placeholder endpoint |

CMS-11 loads its picker options from the protected, same-origin `GET
/api/v1/cms/templates/context` support route (`cmsTemplateContextRead` →
`TemplateDesignerContext`) before enabling the template form. This read is
no-store and contains only scoped active content-type and supported block
selectors. It does not extend the general auth-session resource or grant
designer authority in the browser. Missing/denied/degraded context disables
submission with the corresponding sign-in, capability, rate-wait, or retry
state; the POST revalidates authority and compatibility independently. The
on-demand `/app/cms-content-modeling/templates/new` page implements the
create-only `expectedVersion: null` form. It retains unsent values and reuses
one idempotency key for an unchanged uncertain attempt; only a verified
`201` draft resource and matching ETag may be announced as created. Editing
an existing version still requires a protected canonical read and conflict
reconciliation path; this form does not claim that coverage.

For `ContentSchemaRegistryWorkbench`, the browser command forms are CMS-03A-01
through CMS-03A-04 plus the DEC-108 activation producers CMS-03A-09 (successor),
CMS-03A-10 (dry-run), CMS-03A-11 (submit review), CMS-03A-12 (record decision)
and CMS-03A-14 (assignment). CMS-03A-05/CMS-10 is release-worker-only;
CMS-03A-06, CMS-03A-07 and CMS-03A-13 are protected reads. CMS-05 through
CMS-16 above remain owned by the editorial, publication, composition, taxonomy,
locale, and related-content workbenches and do not add commands to the registry
island.
The DEC-119 owner CMS capability grant commands CMS-03A-15 through CMS-03A-17
and the protected grant list CMS-03A-18 belong to the separate
`CmsCapabilityGrantConsole`, not to the registry island; CMS-03A-18 never
mutates on GET, reserves idempotency, accepts `If-Match`, emits mutation
audit/outbox events, or enters a public/private/offline cache.
The browser policy is explicit: CMS-03B-01/02/04/05/06/07/08/09/10 and
CMS-03C-01/02/03 are human forms; CMS-03B-03/11/12/13/14 are protected
read-only GETs; CMS-03C-04/05 are exact disabled/deferred Phase 2 forms.
CMS-03A-06, CMS-03A-07, CMS-03B-03, CMS-03B-11, CMS-03B-12, CMS-03B-13 and
CMS-03B-14 never mutate on GET, reserve idempotency, accept `If-Match`,
emit mutation audit/outbox events, or enter a public/private/offline cache.
The authoring-context read (CMS-03B-14) is a `no-store` preparation read that
never grants `cms.schema_registry.read` and never accepts a caller-chosen
schema; the entry list (CMS-03B-13), conflict detail (CMS-03B-12) and draft
detail (CMS-03B-11) derive their scope, identity and values entirely
server-side.
CMS-03A-05/CMS-10 release failures, including exact `401 WEBHOOK_REJECTED`,
stay with release-worker telemetry and are never browser application errors.

### Network and retry contract

- Read over 250 ms exposes loading; protected commands use the BE deadline and never show false success.
- 429 waits for `Retry-After`, announces remaining wait, and preserves input.
- 502/503/504 retry at most twice after 250 ms and 750 ms only when BE declares safe. Mutations reuse idempotency and reconcile status first.
- Offline/startup failure renders System / Degraded. Last-known-good appears only when policy permits and always includes freshness; protected CMS-03A-06/CMS-03A-07 registry data is never retained as a private or offline fallback.
- `<FileUpload>` aborts after 30 seconds with no transferred byte; any byte resets inactivity; cancellation is explicit; quarantined/unverified bytes never appear ready.

### Step-up recovery (DEC-111)

- **Two distinct 401 classes.** `UNAUTHENTICATED` means the session is missing or expired: remove protected data and redirect to `/auth/sign-in` with a safe `returnTo`. `STEP_UP_REQUIRED` means the session is valid but lacks a fresh `aal2` proof: it is never rendered as a 403 gate and never collapsed to reauthentication. Its `details` are `{ recoveryAction: 'step_up', allowedMethods: string[] }` and are parsed with the typed CMS step-up schema; any other shape is treated as a malformed response (degraded), not as a recovery.
- **Route and return.** The originating form navigates to `/step-up?returnTo=<current relative path plus query>`, the DEC-111 step-up page specified in `01-identity-authority.md` (`StepUpRoute`, BE01a AUTH-API-20 and AUTH-API-21). The `/app/cms-content-modeling` routes of this specification are in the code-owned `returnTo` allowlist; a value that fails the relative first-party rule falls back to `/app`. `allowedMethods` entries other than `totp` are ignored, and an empty list renders `No verification method is available` as a degraded state with the request ID.
- **Which commands.** Every protected command in this specification that requires recent MFA (CMS-03A-04 activation by the activator, CMS-03A-12 and CMS-03B-06 decisions, CMS-03A-14 assignment, CMS-03A-15 through CMS-03A-17 grants, and the CMS-03B-07/CMS-03B-09 commands where protected) uses this recovery; the 401 reserved no idempotency record and created no domain state, so the draft may reuse its original `Idempotency-Key`.
- **Draft handling.** Forms persist and restore their scoped draft as `01-identity-authority.md` defines for protected forms and wait for explicit re-confirmation: nothing is auto-submitted, and the expected version is refetched on return (a change opens `<SyncConflict>`). The owner grant console is the documented exception: it never persists the person ID, so its form returns empty with `Your entries were not saved.`

### CMS-03A-05 / CMS-03A-08 / CMS-10 release envelope boundary

`ReleaseEnvelopeHeaders` is a worker-only transport contract. Before JSON parsing,
the release worker requires this exact envelope:

| Wire header                    | Internal field | Exact value contract                         | Browser ownership           |
| ------------------------------ | -------------- | -------------------------------------------- | --------------------------- |
| `X-WeJammin-Release-Key-Id`    | `keyId`        | release trust-registry key ID                | never read, sent, or stored |
| `X-WeJammin-Release-Issued-At` | `issuedAt`     | offset ISO datetime                          | never read, sent, or stored |
| `X-WeJammin-Release-Nonce`     | `nonce`        | UUID                                         | never read, sent, or stored |
| `X-WeJammin-Release-Signature` | `signature`    | padded base64 Ed25519 signature for 64 bytes | never read, sent, or stored |

The signed bytes are the exact UTF-8 string
`WEJAMMIN-${operationId}-RELEASE-V1\n${keyId}\n${issuedAt}\n${nonce}\n${sha256(rawBody)}`,
where `operationId` is exactly `CMS-03A-05` for registration or `CMS-03A-08`
for lifecycle advance, and `sha256(rawBody)` is lowercase 64-hex over untouched
request bytes. The worker verifies the trusted non-revoked key, five-minute skew,
ten-minute nonce replay window, and release digest before parsing the named
request (`BlockRegistrationRequest` or `BlockLifecycleAdvanceRequest`).
`WEBHOOK_REJECTED` is release-worker telemetry/application ownership only for
the exact `401` invalid release-principal/signature rejection. Malformed
path/header/body, replay/nonce, wrong scope, stale lifecycle/version, invalid
transition, unsupported media, dependency, rate, and internal failures retain
their operation-specific worker status and code. `WEBHOOK_REJECTED` is not a
browser error code, UI state, retry action, or response body. The browser may
receive only the safe `BlockDefinitionRegistryRecord` projection from protected
CMS-03A-06/CMS-03A-07 reads; it never parses or exposes the full
`BlockDefinitionVersionResource` or `BlockLifecycleEventResource`, raw body,
props snapshot, snapshot signature, release signature, or verification evidence.

### Form contract

| Concern           | Required behavior                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fields            | Generate controls from named Zod request schema. Every field has persistent label, type, required/optional state, help, autocomplete/inputmode, and canonical serialization. Unknown keys are not submitted. |
| Validation timing | Syntax and safe local constraints on blur; cross-field on review/submit; server remains authoritative. No pre-visit error.                                                                                   |
| Error copy        | `VALIDATION_FAILED`: “Check the highlighted fields.” Field copy states rule and correction. `INVALID_REQUEST`: “This request could not be read. Review the form and try again.”                              |
| Submission        | Disable only commit action, preserve width/label, expose pending text, send expected version/idempotency, and ignore duplicate activation.                                                                   |
| Conflict          | Show current server version beside preserved draft. Actions: Review changes, Reapply when permitted, or Discard. Never overwrite automatically.                                                              |
| Completion        | Focus result heading, update URL/version, clear committed draft, and expose exact next action. Important outcomes also enter durable history/notification.                                                   |

### Locale configuration fields (OD-4)

BE03a owns the rules and the exact `message` strings; this section owns the
controls. The configuration is entered only in the CMS-03A-01 create form and,
as an optional replacement, in the CMS-03A-09 successor form. A draft's
detail view shows it read-only because no draft command edits it.

| Control | Contract | Behavior and per-field validation |
| ------- | -------- | --------------------------------- |
| Supported languages (tag list) | `supportedLocales`, 1–32 unique canonical-case BCP 47 tags | Text input with persistent label "Add a language tag", help "For example en, fr-CA, zh-Hans-CN", `autocomplete="off"`, `autocapitalize="none"`, `spellcheck="false"`, and an **Add** button; Enter in the input activates Add and never submits the form. Tags render as a native `<ul>`; each item has a **Remove** button named "Remove {tag} from supported languages". A counter "{n} of 32" is linked by `aria-describedby`; Add is disabled with the text "Maximum 32 languages" at 32. On blur or Add: a tag that is not canonical case shows the exact BE03a message `locale tag must be a canonical-case BCP 47 tag` with a **Use {canonical}** button that replaces the draft text only when activated (no silent correction); a repeat shows `supportedLocales must be unique`; an empty list on review shows `supportedLocales must contain 1 to 32 locales`. |
| Source language | `sourceLocale` | Native `<select>` listing only the current supported tags, persistent label, required. A source not in the list cannot be selected; an unselected value on review shows `supportedLocales must include sourceLocale`. |
| Default language | `defaultLocale` | Native `<select>` over the supported tags, persistent label, required, help "The language every fallback order ends at". An unselected value shows `supportedLocales must include defaultLocale`. Changing it re-renders every fallback group below and keeps each group's intermediate entries that remain valid. |
| Fallback order per language | `fallbackChains[target]`, one `<fieldset>` for each supported tag other than the default | `<legend>` "Fallback order for {target}". An ordered `<ol>` of intermediate entries (0–15) followed by a fixed, non-removable final item "{defaultLocale} (always last)"; the submitted chain is the intermediates plus the default, so the 1–16 bound, the end-at-default rule and the no-self rule hold by construction. **Add a fallback language** is a native `<select>` of supported tags that are not the target, not the default and not already in the list, plus an Add button. Each intermediate has **Move earlier**, **Move later** and **Remove** buttons named with the tag and target ("Move fr-CA earlier in the fallback order for fr"); reordering never depends on drag. A group with no intermediates is valid. |
| Cycle check | whole map | On review, a cycle shows `fallback chains must not form a cycle` in the summary, names the languages involved, and focuses the first fallback group that participates. |
| Successor replacement choice (CMS-03A-09) | `supportedLocales`, `fallbackChains` both null or both present | Radio group "Languages in the new version": **Keep the current languages and fallback orders** (default; submits both null) or **Change languages and fallback orders** (reveals the controls above, prefilled from the source). Switching back to Keep discards the edits after a native confirm that names the count of changed items. |

Removing a language that other groups use as an intermediate removes it from
those groups in the same action and announces "Removed {tag} from the fallback
order for {a}, {b}" through the polite live region. Before submit, a **Review
changes** step lists, against the source version for a successor or against the
empty set for a new type, each added language, each removed language, and each
retained language whose order changed. It states "Removing a language or
changing a retained fallback order is treated as a breaking change and needs a
migration plan at dry run"; classification itself is server-derived and never
computed in the browser.

| State | Rendering |
| ----- | --------- |
| Pristine | Controls prefilled (successor) or empty with one empty-state sentence "Add at least one language"; no error is shown before the first blur or submit. |
| Invalid (client) | Linked error summary lists each message with its field path; focus moves to the summary on submit and to the first invalid control on summary-link activation. |
| Pending | Only the commit action is disabled with text "Saving…"; all locale controls become read-only with `aria-disabled`; duplicate activation is ignored. |
| Server 422 | Every `details.issues[]` entry is mapped by `path` to its control (`['fallbackChains', target, index]` to the item at that index, `['supportedLocales']` to the tag list) and shown with the exact `message`; unmapped paths go to the summary only; input is preserved. |
| Server 409 | "This version changed while you were editing. Review the current version, then reapply your languages." with Review changes, Reapply when permitted, and Discard; the preserved draft is never overwritten. |
| Committed | Result heading receives focus; detail shows the configuration read-only as the list of languages and, per target, "{target}: {a} → {b} → {default}". |
| Forbidden or hidden | No controls; the designer capability gate matches the surrounding form. |

### Successor template choice (CMS-03A-09, DEC-123)

A type is created without a template, so the CMS-03A-09 successor form is
where a template is first chosen. BE03a owns the pair rule, the bounds and the
exact `message` strings; this section owns the controls.

| Control | Contract | Behavior and per-field validation |
| ------- | -------- | --------------------------------- |
| Successor template choice (CMS-03A-09) | `defaultTemplateVersionId`, `templateBindings` both null or both present | Radio group "Template for the new version": **Keep the current template and template list** (default; submits both null) or **Choose the template and template list** (reveals the two fields below, prefilled from the source default template and bindings, or empty for a type that has none). Switching back to Keep discards the edits. The radio is transport only and never a request member. |
| Default template version ID | `defaultTemplateVersionId` | Native text input with persistent label "Default template version ID", help "The template new entries start from.", `autocomplete="off"`, `spellcheck="false"`, required while choosing. Empty shows `Enter the default template version ID.`; a value that is not a lowercase UUID shows `Enter the default template version ID as a lowercase UUID, for example 018f0c45-73fe-4dc2-9c09-68f7ecf132da.` |
| Template version IDs, one per line | `templateBindings` | Native `<textarea>` (4 rows) with persistent label "Template version IDs, one per line", help "The templates bound to the new version, at most 32; leave blank to bind none."; it has no `name`, the lines are serialized into the hidden `templateBindings` member as `[{ templateVersionId }]` in line order, and blank lines are ignored. A line that is not a lowercase UUID shows `Line {n}: enter a lowercase template version ID.`; a repeated line shows `Line {n}: this template version is already listed on line {m}.`; more than 32 lines shows `List at most 32 template versions.` |

Validation is shown after the first blur or submit. A submit with any issue is
not posted: the issues render in order beside their fields, the fields carry
`aria-invalid` and `aria-describedby`, and focus moves to the first invalid
field. The server decides compatibility: a refusal arrives as 422 with the
BE03a messages `template version is not compatible with this content type`
(pointer `/defaultTemplateVersionId` or `/templateBindings/{index}/templateVersionId`),
`templateBindings must be unique` or the pair message, and the refusal summary
links each one to the field that owns its pointer; an absent or concealed
template is a 404 and a withdrawn one a 409, both rendered through the generic
command-error and conflict states. Input is preserved on every refusal.

Accessibility: lists and fieldsets are native; every button has a unique
accessible name containing the tag and, for chains, the target; focus after
Remove moves to the next item, or to the Add input when none remains; position
changes announce "{tag} is now {k} of {n} in the fallback order for {target}";
order is conveyed by ordinal text and `<ol>` semantics, never by color or
position alone; targets are at least 24 CSS px and 44 preferred; the review
step and all messages are reachable by keyboard with no trap and no
hover-only content.

Locale variant form (CMS-03C-04, runtime still deferred in Phase 2): the
fallback order is shown read-only as "{target}: {a} → {b} → {default}" from the
protected version detail and is submitted unchanged as the equality
expectation. On 409 `FALLBACK_CHAIN_MISMATCH` the form shows "The fallback
order for {locale} changed. Reload the current order and review your
translation before saving.", refetches, replaces the displayed order with
`details.activeFallbackChain`, and keeps the author's field values.

## Conditional Rendering Matrix

### Phase 2 AC265 launch overlay (approved 2026-09-09)

The matrix below describes capability-selected variants across the product
roadmap; it does not activate deferred authority. For Phase 2 registry release
evidence, `guardianMandate`, `juniorRestricted`, and `businessMandate` require
exercised denial with no protected disclosure or mutation. Minor/guardian
accounts must not be provisioned to bypass the adult-only launch boundary;
use eligible adult test sessions to exercise rejected context requests.
Mandate labels never create grants. Positive `entitledRead`, `ownerFull`,
`staffCaseScoped`, and `adminStepUp` checks require real, independently verified
server authority, including case scope or recent MFA where applicable. Missing
authority blocks those checks; it cannot be relabeled as a passing denial.
`forbiddenHidden` requires denial/non-disclosure; `disabledPrerequisite` requires
disabled controls and no mutation. All nine cases and all ten AC265 scenarios
remain mandatory. Retain actual hosted IdP/RLS, step-up, and teardown evidence;
skips and local fixtures do not satisfy the release gate.

The retained accepted report uses `ac265-hosted-e2e-v3` with each role's
explicit `authorized_access`, `denied_no_disclosure`, or
`disabled_no_mutation` assertion. The V2 schema remains a compatibility format
and cannot satisfy the retained release gate. Future positive deferred-role
tests require their owning launch prerequisites.

| Feature/component                                      | Free                            | Paid                                            | Creator                                  | Guardian                             | Junior                                                      | Business                                        | Staff                                    | Admin                                                                                            |
| ------------------------------------------------------ | ------------------------------- | ----------------------------------------------- | ---------------------------------------- | ------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Public/read projection for publication/entry consumers | full public                     | full entitled                                   | full owned/public                        | full mandate-visible                 | full age-allowed own/public                                 | full organization public/mandated               | read-only with explicit case capability  | read-only with explicit capability                                                               |
| Protected schema-registry list/detail projection       | not-rendered                    | protected entitled scope only                   | protected owned scope only               | protected mandate-visible scope only | protected age-allowed scope only                            | protected organization scope only               | read-only with explicit case capability  | read-only with explicit capability and step-up where required                                    |
| Protected command form                                 | not-rendered without capability | full only with server capability, else disabled | full owned/mandated, else not-rendered   | full only within guardian mandate    | partial-hidden for restricted fields, else capability-bound | full only in organization mandate               | full only with operation/case capability | full only with named capability, recent step-up, audited reason                                  |
| Provenance/evidence                                    | public subset                   | entitled subset                                 | owned/participating subset               | mandate-visible subset               | disclosure-safe age-allowed subset                          | organization-mandated subset                    | case-scoped read-only                    | capability-scoped read-only                                                                      |
| Destructive/high-risk                                  | not-rendered                    | disabled unless named capability/step-up        | disabled unless owner capability/step-up | not-rendered unless mandate grants   | not-rendered where age policy forbids                       | disabled unless organization capability/step-up | full only named case capability/step-up  | full only named operation capability/step-up                                                     |
| CMS capability grant console (owner only)              | not-rendered                    | not-rendered                                    | not-rendered                             | not-rendered                         | not-rendered                                                | not-rendered                                    | not-rendered                             | full only for the receipt-derived owner with recent step-up, else disabled with step-up recovery |

Named variants: `publicRead`, `entitledRead`, `ownerFull`, `guardianMandate`, `juniorRestricted`, `businessMandate`, `staffCaseScoped`, `adminStepUp`, `forbiddenHidden`, and `disabledPrerequisite`. Role labels never grant authority client-side.

The DEC-108 review capabilities are bounded and are never persona labels. The
schema designer (`cms.schema_designer`) owns the successor, dry-run and
submit-review forms on the version/draft workbench. An assigned `cms.schema_review`
human is rendered with the separate `schemaReviewAssigned` review-only variant,
which opens only the exact protected review detail and its safe frozen evidence
summary and exposes the native decision form when the server's
`permittedNextActions` allow `record_decision`. It does not grant or imply
registry-wide `cms.schema_registry.read`, `ownerFull`, `entitledRead`, or any
successor, dry-run, submit-review, activation, entry or publication control; each
rendered action is checked against the server's per-review next actions. The
existing owner alone has `cms.schema_review.assign` for the assignment form. None
of these grants administrator, general capability-administration, or delegation
authority, and a role label never renders a protected review or assignment control
client-side.
The DEC-108 acceptance criteria do not change AC265's nine hosted-role evidence.
Any additional reviewer prerelease evidence is an explicit future gate and is not
claimed as current acceptance; no fabricated reviewer session satisfies it.

The DEC-119 CMS capability grant console is owner-only and is never a persona
label. The receipt-derived owner receives `ownerFull`, with commit controls
enabled only while the step-up disclosure is `verified` (otherwise the controls
are disabled with the step-up recovery); every other actor receives
`forbiddenHidden` (no navigation entry and a 403 gate on a direct URL); and a
dependency or prerequisite failure renders `disabledPrerequisite`. A holder of a
granted capability, including `cms.schema_designer`, `cms.reviewer` or a
specialist reviewer, never sees grant controls, and granting a capability
confers no administrator, grant, delegation or purpose authority.

The Slice 10 editorial surfaces add no persona. The integrated editor, the entry
list, the authoring context, the conflict detail and the restore form render only
for an assigned CMS author/editor with the server's read scope; the comparison
and the review-history read render for the assigned author/editor or a reviewer
with read scope. A hidden entry, conflict, revision or content type is a
disclosure-safe 404 and a visible one without scope is a 403 `CapabilityGate`,
never a broadened disclosure. The decision (CMS-03B-06) and the
schedule/publish (CMS-03B-07/09) forms treat a missing/stale MFA as a 401
`STEP_UP_REQUIRED` step-up route and never as a 403 gate; the
`forbiddenHidden` and `disabledPrerequisite` variants carry the exact reason and
recovery, and a partial-hidden relation or an omitted unreadable conflict field
is never placeholdered with data.

## Responsive Behavior

| Breakpoint         | Grid/navigation                                                                       | Workbench/detail                                                                        | Forms/actions                                                             | Tables/media                                                                           |
| ------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Mobile ≤768 px     | 4 columns, 16 px gutter/margins; compact tabs and stack; acting context before writes | List then detail; Back first; inspector inline; no horizontal page scroll at 320 CSS px | One column; labels above; action bar avoids keyboard; 44 by 44 px targets | Priority list preserves every field in expandable facts; media controls wrap logically |
| Tablet 769–1024 px | 8 columns, 20 px gutter, 24 px margins; collapsible sidebar                           | List plus inspector when container permits, else stack; URL selection                   | Two-column only for independent fields; action bar cannot cover errors    | Lower-priority columns move to row details, never disappear                            |
| Desktop ≥1025 px   | 12 columns, 24 px gutter, max 1440 px; sidebar/top bar                                | Stable list/detail split; detail owns heading/action rail                               | Grouped form/review summary; action rail cites context/version            | Compact semantic table, virtualize >100 rows, stable IDs, functional media only        |

- Container queries may switch composition but cannot change semantics, authorization, or consequences.
- 200% zoom and text-spacing overrides retain content/action order. Hover-only disclosure and pointer-only reordering are prohibited.

The Slice 10 authoring surfaces follow the same matrix. On mobile the entry list
stacks above the detail, the conflict preimages render one path per card with the
three labelled preimages stacked, and the object-property groups and rich-text
block rows become one-column forms with 44×44 px targets; on tablet the list
keeps an inline inspector and the comparison keeps its domain groups; on desktop
the list/detail split is stable, the comparison and restore confirmation share
the detail rail, and the rich-text preview sits beside the editor. The
authoring-context projection, the object-property controls, the rich-text block
controls, the conflict radio groups and the restore confirmation are all
keyboard reachable, and no authoring affordance depends on hover or pointer-only
reordering at any breakpoint.

## Accessibility Inventory

| Component/interaction         | WCAG requirement                     | Keyboard/focus                                                                                                                                                   | Screen reader/semantics                                                                                                                      | IA source                                                           |
| ----------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Route shell/navigation        | 1.3.1, 2.4.1–2.4.3, 2.4.7/2.4.11     | Skip link; logical DOM; route focuses `h1`                                                                                                                       | Named landmarks, one main, `aria-current=page`, unique title                                                                                 | `03-cms-content-modeling.md` Accessibility/User Flows               |
| Workbench selection           | 1.3.1, 2.1.1, 2.4.3, 4.1.2           | Native controls; Enter opens; Escape closes bounded inspector; focus returns                                                                                     | Named list/detail; selected state; state/provenance text                                                                                     | `03-cms-content-modeling.md` Interactions/Access Control            |
| Forms/validation              | 1.3.1, 3.3.1–3.3.4, 4.1.3            | Persistent labels; linked summary focuses first invalid field; no trap                                                                                           | `aria-invalid`, `aria-describedby`, error links, polite status                                                                               | `03-cms-content-modeling.md` Acceptance Criteria/Edge Cases         |
| Async/refetch/conflict        | 2.2.1, 2.4.3, 4.1.3                  | Refresh never steals focus; Retry native; conflict begins at heading                                                                                             | Polite atomic update; stale/pending/failed text; request ID                                                                                  | `03-cms-content-modeling.md` Interactions/BE failures               |
| Tables/filters                | 1.3.1, 1.4.10, 2.1.1, 2.5.8          | Header buttons; Apply/Reset; 24 CSS px minimum, 44 preferred                                                                                                     | Caption, headers, sort, count, active-filter summary                                                                                         | `03-cms-content-modeling.md` User Flows/responsive                  |
| Async/refetch/conflict        | 2.2.1, 2.4.3, 4.1.3                  | Refresh never steals focus; Retry native; conflict begins at heading                                                                                             | Polite atomic update; stale/pending/failed text; request ID                                                                                  | `03-cms-content-modeling.md` Interactions/BE failures               |
| Schema dry-run status         | 4.1.3, 2.2.1, 2.2.2                  | Job polling never steals focus; queued/running is announced, not a completed result                                                                              | Polite live region announces queued then the immutable passed or failed report; counts/hashes only from the server                           | `03-cms-content-modeling.md` Interactions/DEC-108 dry-run producer  |
| Review decision form          | 1.3.1, 3.3.1–3.3.4, 4.1.3            | Native approve/reject radios with persistent group label; step-up disclosure re-evaluated on expiry; no trap                                                     | `aria-invalid`/`aria-describedby` as needed; precise decision text; no reviewer identifier rendered                                          | `03-cms-content-modeling.md` Access Control/DEC-108 review decision |
| Review-only detail            | 1.3.1, 2.4.3, 4.1.2                  | Heading focus on navigation only; decision control rendered only when next actions allow it                                                                      | Safe frozen evidence summary, required/recorded counts, decision references; no private matching identifier                                  | `03-cms-content-modeling.md` Interactions/DEC-108 review detail     |
| CMS capability grant list     | 1.3.1, 1.4.10, 2.1.1, 2.5.8, 4.1.3   | Header sort buttons; Apply/Reset; row actions reachable by Tab with specific names; focus stays put on refetch                                                   | Table caption; state as text plus icon; valid-through stated in UTC; result count and active-filter summary announced politely               | `03-cms-content-modeling.md` Access Control/DEC-119 owner grants    |
| Grant, renew and revoke forms | 1.3.1, 3.3.1–3.3.4, 3.3.7, 4.1.3     | Persistent labels; native date input with min/max; linked summary focuses the first invalid field; Escape cancels the inline confirmation before commit; no trap | `aria-invalid`/`aria-describedby`; step-up disclosure re-evaluated on expiry; result heading focus; no person identifier in any announcement | `03-cms-content-modeling.md` Access Control/DEC-119 owner grants    |
| Editorial entry list          | 1.3.1, 1.4.10, 2.1.1, 2.5.8, 4.1.3   | Native links; cursor pager with a specific name; focus stays in the list on refetch                                                                             | List caption; lifecycle/state/updated-at as text; result count announced politely; no protected value in any announcement                     | `03-cms-content-modeling.md` Interactions/CMS-05 reachability        |
| Authoring-context preparation | 1.3.1, 3.3.1–3.3.4, 4.1.3            | Prefilled native controls; the user types no JSON; a disabled create names the missing prerequisite                                                             | Frozen `schemaArtifact`/`validatorRefs`/`workflowPolicy`/`activationEvidence` shown as read-only facts, never as editable JSON              | `03-cms-content-modeling.md` Interactions/CMS-05 authoring context   |
| Object field editor (DEC-133) | 1.3.1, 3.3.1–3.3.4, 4.1.3            | One labelled group per property; a native control per kind; required property marked; linked summary focuses the first invalid property                         | Group labels; enum options from the declared set; `aria-invalid`/`aria-describedby`; missing/unknown key or kind mismatch is a linked 422          | `03b-editorial-workflow-publication.md` DEC-133 object structure     |
| Rich-text editor and renderer | 1.3.1, 1.3.2, 3.3.1–3.3.4, 4.1.3     | Block controls and markup entry are keyboard reachable; reordering by explicit controls, never pointer-only drag; the preview never moves focus                     | Block structure, marks and links are exposed as semantic text; heading order and non-empty link text are structural; no `dangerouslySetInnerHTML`     | `03b-editorial-workflow-publication.md` DEC-112 rich_text.v1 grammar |
| Conflict detail (preimages)   | 1.3.1, 2.4.3, 4.1.2, 3.3.1           | A per-path radio group with three labelled preimages plus an explicit value control; linked summary focuses the first invalid choice                             | Each side group is named base / their version / your version; no ownership identifier; 404 is disclosure-safe                                     | `03-cms-content-modeling.md` Interactions/CMS-06                   |
| Revision compare and restore  | 1.3.1, 2.4.3, 4.1.3                  | Read-only comparison; the restore confirmation is inline with heading focus and Escape cancels before commit; `comparison_too_large`/`unavailable` are announced | Domain group headings (field, block, relation); only side hashes and the keyed relation `targetToken`; the restore shows edge count and availability | `03-cms-content-modeling.md` Interactions/CMS-07                   |
| Motion/media                  | 1.2.x where applicable, 2.2.2, 2.3.3 | Media keyboard controls; pause/stop; no essential timed gesture                                                                                                  | Captions/transcript/metadata; reduced motion; waveform never sole content                                                                    | `03-cms-content-modeling.md` Accessibility                          |

The inventory exceeds the thin-coverage threshold and is woven into component contracts. WCAG 2.2 AA is the release floor, exceeding the requested 2.1 AA gate.

## FE Rubric Closure

This section makes every FE-rubric checkpoint explicit. It narrows implementation choices without changing any upstream product, permission, security, or data contract.

### Complete component contracts

Every local component interface above includes `children?: never` and either a `DomainVariant` or a narrower named protected variant. “Never” is deliberate because Astro slots and canonical global components own composition; these route/workbench boundaries do not accept arbitrary children.

| Component                                  | Props interface                                                                              | Children                                                                | Named variants                                                                                                                                                                                                | BE/IA source                                                                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `CmsContentModelingRoute`                  | `CmsContentModelingRouteProps`                                                               | `never`                                                                 | `publicPage`, `appPage`, `adminPage`, `authPage`, `degradedPage`                                                                                                                                              | `03-cms-content-modeling.md` user flows/accessibility; design-system page archetypes                                                          |
| `ContentSchemaRegistryWorkbench`           | `ContentSchemaRegistryWorkbenchProps`                                                        | `never`                                                                 | `entitledRead`, `ownerFull`, `guardianMandate`, `juniorRestricted`, `businessMandate`, `staffCaseScoped`, `adminStepUp`, `forbiddenHidden`, `disabledPrerequisite` — protected variants only; no `publicRead` | `03a-content-schema-registry.md` request/response fields and protected registry reads; `03-cms-content-modeling.md` interactions/access rules |
| `CmsCapabilityGrantConsole`                | `CmsCapabilityGrantConsoleProps`                                                             | `never`                                                                 | `ownerFull`, `forbiddenHidden`, `disabledPrerequisite` — owner-only; no other persona variant                                                                                                                 | `03a-content-schema-registry.md` CMS-03A-15 through CMS-03A-18; `03-cms-content-modeling.md` DEC-119 owner grants                             |
| `EditorialWorkflowPublicationWorkbench`    | `EditorialWorkflowPublicationWorkbenchProps`                                                 | `never`                                                                 | `publicRead`, `entitledRead`, `ownerFull`, `guardianMandate`, `juniorRestricted`, `businessMandate`, `staffCaseScoped`, `adminStepUp`, `forbiddenHidden`, `disabledPrerequisite`                              | `03b-editorial-workflow-publication.md` request/response fields; `03-cms-content-modeling.md` interactions/access rules                       |
| `CmsEditorialEntryList`                   | `{ items, nextCursor, pageVersion, state, access, onNavigate }`                              | `never`                                                                 | inherits the parent `EditorialWorkflowPublicationWorkbench` variant; no `publicRead`                                                                                                                          | `03b-editorial-workflow-publication.md` CMS-03B-13 `EntryListPage`; `03-cms-content-modeling.md` CMS-05 reachability                          |
| `CmsEditorialAuthoringContext`            | `{ resource: AuthoringContextResource, state, onSelect }`                                    | `never`                                                                 | inherits the parent variant; preparation-only, never authority                                                                                                                                                  | `03b-editorial-workflow-publication.md` CMS-03B-14 `AuthoringContextResource`; `03-cms-content-modeling.md` CMS-05 authoring context            |
| `CmsEditorialEntryDraft`                  | `{ detail: EntryDraftDetailResource, fields, objectFields, onAutosave, onResolveConflict }`  | `never`                                                                 | inherits the parent variant; `baseRevision` is the server-derived `revisionNumber`                                                                                                                           | `03b-editorial-workflow-publication.md` CMS-03B-01/10/11 Draft base and schema identity (D3)                                                  |
| `CmsObjectFieldEditor`                    | `{ properties, value, onChange, required, error }`                                           | `never`                                                                 | inherits the parent variant; exactly the DEC-133 depth-1 `properties[]`                                                                                                                                        | `03b-editorial-workflow-publication.md` DEC-133 object structure                                                                              |
| `CmsRichTextEditor` / `CmsRichTextRenderer` | `{ value: RichTextV1, onChange }` / `{ value: RichTextV1 }`                                | `never`                                                                 | inherits the parent variant; canonical `rich_text.v1` AST only                                                                                                                                                 | `03b-editorial-workflow-publication.md` DEC-112 rich_text.v1 grammar                                                                          |
| `CmsEditorialConflictDetail`              | `{ detail: ConflictDetailResource, choices, onChoose, onResolve }`                           | `never`                                                                 | inherits the parent variant; preimages only while state `open`                                                                                                                                                 | `03b-editorial-workflow-publication.md` CMS-03B-12 Conflict detail privacy (D2)                                                              |
| `CmsEditorialRevisionCompare`             | `{ page: RevisionHistoryPage, compare, onSelectRestore }`                                    | `never`                                                                 | inherits the parent variant; domain-grouped side hashes only                                                                                                                                                    | `03b-editorial-workflow-publication.md` Revision comparison domains (D5) and restore chain (D6)                                              |
| `CmsEditorialRestoreForm`                 | `{ restore, expectedVersion, onConfirm, idempotencyKey }`                                    | `never`                                                                 | inherits the parent variant; disabled when the chain is `chain_unavailable`/`transform_missing`                                                                                                               | `03b-editorial-workflow-publication.md` CMS-03B-04 restore chain (D6)                                                                          |
| `CompositionTaxonomyLocalizationWorkbench` | `CompositionTaxonomyLocalizationWorkbenchProps`                                              | `never`                                                                 | `publicRead`, `entitledRead`, `ownerFull`, `guardianMandate`, `juniorRestricted`, `businessMandate`, `staffCaseScoped`, `adminStepUp`, `forbiddenHidden`, `disabledPrerequisite`                              | `03c-composition-taxonomy-localization.md` request/response fields; `03-cms-content-modeling.md` interactions/access rules                    |
| Global primitives consumed by this spec    | Canonical interfaces from design-system Global Component Inventory; local wrappers forbidden | Canonical slot only where that interface declares it, otherwise `never` | `default`, `hover`, `focus`, `active`, `disabled`, `loading`, `error` plus semantic/access variants named above                                                                                               | `design-system.md` Global Component Inventory and State Language                                                                              |

### IA flow to page/component ownership

| IA flow                                          | Trigger/response owner                                                                                                                                                                                           | Source citation                                                                    | Visual feedback and timing                                                                                                                                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CMS-01` Create content type draft               | `CmsContentModelingRoute` orchestrates; `ContentSchemaRegistryWorkbench`, `EditorialWorkflowPublicationWorkbench`, `CompositionTaxonomyLocalizationWorkbench` renders the relevant BE response and command state | `03-cms-content-modeling.md` Interactions row `CMS-01`                             | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition     |
| `CMS-02` Change field schema                     | `CmsContentModelingRoute` orchestrates; `ContentSchemaRegistryWorkbench`, `EditorialWorkflowPublicationWorkbench`, `CompositionTaxonomyLocalizationWorkbench` renders the relevant BE response and command state | `03-cms-content-modeling.md` Interactions row `CMS-02`                             | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition     |
| `CMS-03` Bind domain record                      | `CmsContentModelingRoute` orchestrates; `ContentSchemaRegistryWorkbench`, `EditorialWorkflowPublicationWorkbench`, `CompositionTaxonomyLocalizationWorkbench` renders the relevant BE response and command state | `03-cms-content-modeling.md` Interactions row `CMS-03`                             | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition     |
| `CMS-04` Activate schema version                 | `CmsContentModelingRoute` orchestrates; `ContentSchemaRegistryWorkbench`, `EditorialWorkflowPublicationWorkbench`, `CompositionTaxonomyLocalizationWorkbench` renders the relevant BE response and command state | `03-cms-content-modeling.md` Interactions row `CMS-04`                             | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition     |
| `CMS-05` Create/edit entry                       | `CmsContentModelingRoute` orchestrates; `ContentSchemaRegistryWorkbench`, `EditorialWorkflowPublicationWorkbench`, `CompositionTaxonomyLocalizationWorkbench` renders the relevant BE response and command state | `03-cms-content-modeling.md` Interactions row `CMS-05`                             | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition     |
| `CMS-06` Resolve concurrent edit                 | `CmsContentModelingRoute` orchestrates; `ContentSchemaRegistryWorkbench`, `EditorialWorkflowPublicationWorkbench`, `CompositionTaxonomyLocalizationWorkbench` renders the relevant BE response and command state | `03-cms-content-modeling.md` Interactions row `CMS-06`                             | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition     |
| `CMS-07` Compare/restore revision                | `CmsContentModelingRoute` orchestrates; `ContentSchemaRegistryWorkbench`, `EditorialWorkflowPublicationWorkbench`, `CompositionTaxonomyLocalizationWorkbench` renders the relevant BE response and command state | `03-cms-content-modeling.md` Interactions row `CMS-07`                             | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition     |
| `CMS-08` Submit/review/approve                   | `CmsContentModelingRoute` orchestrates; `ContentSchemaRegistryWorkbench`, `EditorialWorkflowPublicationWorkbench`, `CompositionTaxonomyLocalizationWorkbench` renders the relevant BE response and command state | `03-cms-content-modeling.md` Interactions row `CMS-08`                             | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition     |
| `CMS-09` Schedule publish/expire                 | `CmsContentModelingRoute` orchestrates; `ContentSchemaRegistryWorkbench`, `EditorialWorkflowPublicationWorkbench`, `CompositionTaxonomyLocalizationWorkbench` renders the relevant BE response and command state | `03-cms-content-modeling.md` Interactions row `CMS-09`                             | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition     |
| `CMS-10` / `CMS-03A-05` Register block version   | `ContentSchemaRegistryWorkbench` renders only capability-safe registered-block metadata from the protected detail projection; the signed release worker owns registration                                        | `03-cms-content-modeling.md` Interaction row `CMS-10`; BE03a CMS-03A-05            | No browser trigger, form, action, idempotency key, or pending mutation state. Metadata status is announced politely after a protected read; release-worker errors remain on the worker boundary.        |
| `CMS-10` / `CMS-03A-08` Advance block lifecycle  | No browser owner; `ContentSchemaRegistryWorkbench` may refetch only the safe block record after a worker event                                                                                                   | `03-cms-content-modeling.md` Interaction row `CMS-10`; BE03a CMS-03A-08            | No browser trigger, form, lifecycle control, action, idempotency key, or pending mutation state. The worker-only event/nonce receipt/evidence remains telemetry and the version row remains immutable.  |
| `CMS-11` Define template                         | `CmsContentModelingRoute` orchestrates; `ContentSchemaRegistryWorkbench`, `EditorialWorkflowPublicationWorkbench`, `CompositionTaxonomyLocalizationWorkbench` renders the relevant BE response and command state | `03-cms-content-modeling.md` Interactions row `CMS-11`                             | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition     |
| `CMS-12` Use reusable pattern                    | `CmsContentModelingRoute` orchestrates; `ContentSchemaRegistryWorkbench`, `EditorialWorkflowPublicationWorkbench`, `CompositionTaxonomyLocalizationWorkbench` renders the relevant BE response and command state | `03-cms-content-modeling.md` Interactions row `CMS-12`                             | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition     |
| `CMS-13` Preview/diff/publish                    | `CmsContentModelingRoute` orchestrates; `ContentSchemaRegistryWorkbench`, `EditorialWorkflowPublicationWorkbench`, `CompositionTaxonomyLocalizationWorkbench` renders the relevant BE response and command state | `03-cms-content-modeling.md` Interactions row `CMS-13`                             | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition     |
| `CMS-14` Govern taxonomy term                    | `CmsContentModelingRoute` orchestrates; `ContentSchemaRegistryWorkbench`, `EditorialWorkflowPublicationWorkbench`, `CompositionTaxonomyLocalizationWorkbench` renders the relevant BE response and command state | `03-cms-content-modeling.md` Interactions row `CMS-14`                             | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition     |
| `CMS-15` Author locale variant                   | `CmsContentModelingRoute` orchestrates; `ContentSchemaRegistryWorkbench`, `EditorialWorkflowPublicationWorkbench`, `CompositionTaxonomyLocalizationWorkbench` renders the relevant BE response and command state | `03-cms-content-modeling.md` Interactions row `CMS-15`                             | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition     |
| `CMS-16` Curate related content                  | `CmsContentModelingRoute` orchestrates; `ContentSchemaRegistryWorkbench`, `EditorialWorkflowPublicationWorkbench`, `CompositionTaxonomyLocalizationWorkbench` renders the relevant BE response and command state | `03-cms-content-modeling.md` Interactions row `CMS-16`                             | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition     |
| `CMS-05` / `CMS-03B-13` Entry list              | `CmsContentModelingRoute` renders the protected `CmsEditorialEntryList`; the server owns authorization, the signed cursor and disclosure | BE03b Route Registry CMS-03B-13 and IA CMS-05 reachability                         | List loading after 250 ms, truthful empty/filter-miss/degraded state and polite result count; no optimistic feedback                                                                                    |
| `CMS-05` / `CMS-03B-14` Authoring context       | `CmsContentModelingRoute` renders the preparation projection into the create form; the server owns the creatable types and field definitions | BE03b Route Registry CMS-03B-14 and IA CMS-05 authoring context                    | The create form prefills the frozen request members with no typed JSON; a missing/denied context disables submission with the sign-in/capability/retry state                                            |
| `CMS-06` / `CMS-03B-12` Conflict detail         | `CmsContentModelingRoute` renders the protected three-way preimages through `CmsEditorialConflictDetail`; the server owns disclosure and schema typing | BE03b Route Registry CMS-03B-12 and IA CMS-06 concealment                          | Per-path radio groups; `paths: []` outside state `open`; a concealed/absent conflict is a disclosure-safe 404; no preimage is cached                                                                    |
| `CMS-03A-06` Protected registry list             | `CmsContentModelingRoute` renders a protected `ContentSchemaRegistryWorkbench` list; server owns authorization and query parsing                                                                                 | BE03a Route Registry CMS-03A-06 and IA deep-dive Protected Registry Query Boundary | List loading after 250 ms, truthful empty/filter-miss/degraded state, and polite result count; no optimistic or mutation feedback                                                                       |
| `CMS-03A-07` Protected registry detail           | `CmsContentModelingRoute` renders the protected detail for exact `contentTypeId` + `versionId`; server owns authorization and path membership                                                                    | BE03a Route Registry CMS-03A-07 and IA deep-dive Protected Registry Query Boundary | Detail heading focus on navigation only; nested fields/relations/artifact/binding status and safe 403/404/degraded feedback; no optimistic or mutation feedback                                         |
| `CMS-03A-09` Create successor draft              | `CmsContentModelingRoute` renders the protected successor form on the schema-designer version detail; server owns authorization, source `If-Match` and idempotency                                               | BE03a Route Registry CMS-03A-09 and IA DEC-108 producer chain                      | Pending state in the same frame, inline progress after 250 ms, result heading focus on the new draft, and truthful 409/idempotency reconciliation; no optimistic version claim                          |
| `CMS-03A-10` Start schema dry-run                | `CmsContentModelingRoute` renders the protected dry-run form on the draft; server derives classification and owns the job                                                                                        | BE03a Route Registry CMS-03A-10 and IA DEC-108 producer chain                      | Honest queued/running status only; the immutable passed report appears only after the real scan; `GET /api/v1/jobs/{jobId}` polls status; never a fabricated or optimistically-passed result            |
| `CMS-03A-11` Submit schema review                | `CmsContentModelingRoute` renders the protected submit-review form on a draft with a passed persisted dry run                                                                                                    | BE03a Route Registry CMS-03A-11 and IA DEC-108 producer chain                      | Pending state, inline progress, atomic draft→review, frozen evidence summary and required decision count announced; no false approval                                                                   |
| `CMS-03A-12` Record schema review decision       | `CmsContentModelingRoute` renders the native approve/reject decision form plus step-up on the protected review detail for an assigned `cms.schema_review` human                                                  | BE03a Route Registry CMS-03A-12 and IA DEC-108 producer chain                      | Step-up disclosure, append-only decision announcement, updated recorded/required counts, and refusal of self/duplicate decisions; no reviewer identifier rendered                                       |
| `CMS-03A-13` Protected schema-review detail      | `CmsContentModelingRoute` renders the protected `SchemaReviewResource` for the exact `reviewId`; server owns authorization and disclosure                                                                        | BE03a Route Registry CMS-03A-13 and IA deep-dive Protected Review Query Boundary   | Detail heading focus on navigation only; safe candidate identity, frozen evidence summary, counts, decision references and permitted next actions; no private matching identifier; no mutation feedback |
| `CMS-03A-14` Assign/revoke schema reviewer       | `CmsContentModelingRoute` renders the owner assignment form on the protected review detail; server owns eligibility, MFA and scope                                                                               | BE03a Route Registry CMS-03A-14 and IA DEC-108 producer chain                      | Pending state, inline progress, assignment state/expiry announcement from the safe projection, and refusal of ineligible/submitter/broad-scope targets; no reviewer/grantor identifier rendered         |
| `CMS-03A-15` Grant CMS capability                | `CmsContentModelingRoute` renders the owner grant form in the `CmsCapabilityGrantConsole`; server owns owner derivation, MFA, eligibility and the term ceiling                                                   | BE03a Route Registry CMS-03A-15 and IA DEC-119 owner grants                        | Pending state, inline progress, result heading focus and a capability-and-date announcement; non-disclosing refusal of absent, ineligible or cross-organization people; no person identifier announced  |
| `CMS-03A-16` Renew CMS capability grant          | The console renders the per-row renew form; server owns CAS, MFA and the restarted term                                                                                                                          | BE03a Route Registry CMS-03A-16 and IA DEC-119 owner grants                        | Pending state, restarted term announced by capability label and date, truthful 409 reconciliation against the refetched row; no optimistic term                                                         |
| `CMS-03A-17` Revoke CMS capability grant         | The console renders the per-row revoke confirmation; server owns CAS and MFA                                                                                                                                     | BE03a Route Registry CMS-03A-17 and IA DEC-119 owner grants                        | Named consequence, pending state, immediate `Revoked` row after refetch, truthful 409 reconciliation                                                                                                    |
| `CMS-03A-18` Protected CMS capability grant list | `CmsContentModelingRoute` renders the owner list; server owns owner derivation and organization scope                                                                                                            | BE03a Route Registry CMS-03A-18 and IA DEC-119 owner grants                        | List loading after 250 ms, truthful empty/filter-miss/degraded state and polite result count; no optimistic or mutation feedback                                                                        |

Every IA interaction row, both protected registry query flows and the Slice 10
editorial list, authoring-context and conflict-detail reads are represented
above. No flow is inferred from a heading or omitted because it shares an
endpoint.

### Server, URL, and client state query registry

| BE operation/query                     | Server-state key                                                                                                                     | URL state                                                                                                              | Island-local state                                                                   | All async render states                                                                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CMS-03A-01` create draft              | `cms-schema-create` mutation result (`ContentTypeVersionResource`)                                                                   | return target and selected `contentTypeId`/`versionId` after commit                                                    | scoped form draft, idempotency key, pending/rollback                                 | idle, loading, validation/auth/capability/conflict/rate/dependency error, optimistic-pending/rollback, success, degraded                                                                              |
| `CMS-03A-02` add/change field          | `cms-schema-field-change` mutation result (`FieldDefinitionVersionResource`)                                                         | exact `contentTypeId`/`versionId`; no field body                                                                       | scoped form draft, expected version, idempotency key, pending/rollback               | idle, loading, validation/auth/capability/conflict/rate/dependency error, optimistic-pending/rollback, success, degraded                                                                              |
| `CMS-03A-03` bind relation             | `cms-schema-relation-bind` mutation result (`RelationDefinitionResource`)                                                            | exact `contentTypeId`/`versionId`; no relation body                                                                    | scoped form draft, expected version, idempotency key, pending/rollback               | idle, loading, validation/auth/capability/conflict/rate/dependency error, optimistic-pending/rollback, success, degraded                                                                              |
| `CMS-03A-04` activate version          | `cms-schema-activation` mutation result (`SchemaActivationResource`/job status)                                                      | exact `contentTypeId`/`versionId`; confirmation tab/return target                                                      | confirmation, expected version, approval evidence, idempotency key, pending/rollback | idle, loading, validation/auth/capability/approval/conflict/rate/dependency error, optimistic-pending/rollback, success, degraded                                                                     |
| `CMS-03A-05` / `CMS-10` register block | protected detail metadata only (`BlockDefinitionRegistryRecord`); release worker is canonical writer                                 | no browser registration URL or intent                                                                                  | none; read-only metadata display only                                                | idle, loading, auth/capability/not-found/rate/dependency error, success, degraded; no browser mutation state                                                                                          |
| `CMS-03A-08` advance block lifecycle   | worker-only `BlockLifecycleEventResource`; release worker is canonical writer and lifecycle event/nonce receipt store                | no browser lifecycle URL or intent; only exact protected read refetch after an authorized event hint                   | none; safe block metadata remains the only browser projection                        | worker telemetry only: `401 WEBHOOK_REJECTED` for invalid release principal/signature; lifecycle conflict, rate, dependency, or internal outcomes retain exact status/code; no browser mutation state |
| `CMS-03A-06` protected registry list   | `cms-schema-registry-list` (`ContentSchemaRegistryListPage`)                                                                         | typed `resourceKind`, `keyPrefix`, `lifecycle`, `state`, `limit`, `cursor`, `sort`, and `direction`; no record payload | list selection, filter disclosure, loading/retry status                              | idle, loading, empty/no-records or filter-miss, auth/capability/validation/rate/dependency error, success, degraded; no optimistic state                                                              |
| `CMS-03A-07` protected registry detail | `cms-schema-registry-detail` (`ContentSchemaRegistryDetail`)                                                                         | exact immutable `contentTypeId` + `versionId`; no query/body                                                           | detail disclosure and Back focus target                                              | idle, loading, auth/capability/not-found/validation/rate/dependency error, success, degraded; no optimistic state                                                                                     |
| `CMS-03B-01` create revision           | `cms-editorial-revision-create` — `POST /api/v1/cms/entries/{entryId}/revisions` → `201 EntryRevisionResource`                       | URL `entryId`; body is `EntryRevisionRequest`, not URL state                                                           | scoped entry draft, pending idempotency, expected version, rollback                  | idle, loading, validation/auth/assignment/conflict/rate/dependency error, optimistic-pending/rollback, success, degraded                                                                              |
| `CMS-03B-02` resolve conflict          | `cms-editorial-conflict-resolve` — `POST /api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve` → `201 EntryRevisionResource` | URL `entryId`/`conflictId`; body is `ConflictResolutionRequest`                                                        | explicit choice set, pending idempotency, expected version, rollback                 | idle, loading, validation/auth/conflict/choice/rate/dependency error, optimistic-pending/rollback, success, degraded                                                                                  |
| `CMS-03B-03` revision history          | `cms-editorial-revision-history` — `GET /api/v1/cms/entries/{entryId}/revisions` → `200 RevisionHistoryPage`                         | `RevisionHistoryQuery` owns entry, cursor, limit, state, compare revision, locale                                      | history selection, compare disclosure, cursor loading/retry                          | idle, loading, empty/filter-miss, validation/auth/read-scope/not-found/rate/dependency error, success, degraded; no optimistic state                                                                  |
| `CMS-03B-04` restore revision          | `cms-editorial-revision-restore` — `POST /api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore` → `201 EntryRevisionResource` | URL `entryId`/`revisionId`; body is `RevisionRestoreRequest`                                                           | restore confirmation, migration chain, expected version, rollback                    | idle, loading, validation/auth/edit/migration/conflict/rate/dependency error, optimistic-pending/rollback, success, degraded                                                                          |
| `CMS-03B-05` submit review             | `cms-editorial-review-submit` — `POST /api/v1/cms/entries/{entryId}/reviews` → `201 EditorialReviewResource`                         | URL `entryId`; body is `ReviewSubmissionRequest` with frozen hash/manifest                                             | review confirmation, frozen dependency evidence, pending/rollback                    | idle, loading, validation/auth/assignment/preflight/conflict/rate/dependency error, optimistic-pending/rollback, success, degraded                                                                    |
| `CMS-03B-06` record decision           | `cms-editorial-review-decision` — `POST /api/v1/cms/reviews/{reviewId}/decision` → `200 EditorialReviewResource`                     | URL `reviewId`; body is `EditorialDecisionRequest`, step-up state is local                                             | decision confirmation, current review, MFA state, rollback                           | idle, loading, validation/auth/reviewer/step-up/conflict/rate/dependency error, optimistic-pending/rollback, success, degraded                                                                        |
| `CMS-03B-07` schedule publication      | `cms-publication-schedule` — `POST /api/v1/cms/publication-schedules` → `202 PublicationScheduleResource`                            | no record in URL; body is `PublicationScheduleRequest`                                                                 | schedule confirmation, job ID/state, pending status; no publication claim            | idle, loading, validation/auth/publisher/time/conflict/rate/dependency error, optimistic-pending/rollback, success, degraded                                                                          |
| `CMS-03B-08` mint preview token        | `cms-preview-token` — `POST /api/v1/cms/previews` → `201 PreviewTokenResource`                                                       | no record in URL; body is `PreviewRequest`                                                                             | preview token disclosure, expiry/revocation state, rollback                          | idle, loading, validation/auth/preview/not-found/conflict/rate/dependency error, optimistic-pending/rollback, success, degraded                                                                       |
| `CMS-03B-09` publish revision          | `cms-publication-create` — `POST /api/v1/cms/publications` → `202 PublicationResource`                                               | no record in URL; body is `PublicationRequest`                                                                         | publication pending/projection state, expected version set, rollback                 | idle, loading, validation/auth/publisher/preflight/conflict/rate/dependency error, optimistic-pending/rollback, success, degraded                                                                     |
| `CMS-03B-10` create entry              | `cms-editorial-entry-create` — `POST /api/v1/cms/entries` → `201 EntryCreateResource`                                                | no record in URL; body is `EntryCreateRequest`                                                                         | scoped entry draft, create idempotency key, pending/rollback                         | idle, loading, validation/auth/capability/conflict/rate/dependency error, optimistic-pending/rollback, success, degraded                                                                              |
| `CMS-03B-11` draft detail              | `cms-editorial-entry-draft-detail` — `GET /api/v1/cms/entries/{entryId}` → `200 EntryDraftDetailResource`                            | URL `entryId`; optional BCP 47 `locale`; no body                                                                       | draft-detail disclosure and Back focus target; server-derived `revisionNumber`, `schemaVersionId` and `openConflict` | idle, loading, validation/auth/read-scope/not-found/rate/dependency error, success, degraded; no optimistic state                                                                                     |
| `CMS-03B-12` conflict detail          | `cms-editorial-conflict-detail` — `GET /api/v1/cms/entries/{entryId}/conflicts/{conflictId}` → `200 ConflictDetailResource`       | URL `entryId`/`conflictId`; `ConflictDetailQuery` accepts no keys; no body                                             | three-way preimage disclosure and Back focus target                                  | idle, loading, empty/not-open-preview-omitted, auth/read-scope/not-found/rate/dependency error, success, degraded; no optimistic state                                                                 |
| `CMS-03B-13` entry list              | `cms-editorial-entry-list` — `GET /api/v1/cms/entries` → `200 EntryListPage`                                                      | typed `state`, `contentTypeId`, `limit`, signed `cursor`; no record payload                                            | list selection, filter disclosure, cursor loading/retry                              | idle, loading, empty/no-records or filter-miss, auth/read-scope/validation/rate/dependency error, success, degraded; no optimistic state                                                               |
| `CMS-03B-14` authoring context       | `cms-editorial-authoring-context` — `GET /api/v1/cms/entries/authoring-context` → `200 AuthoringContextResource`                  | optional `contentTypeVersionId`; no record payload on no-query                                                           | preparation projection for the create form; never authority                          | idle, loading, empty/no-creatable-type, auth/author-scope/not-found/validation/rate/dependency error, success, degraded; no optimistic state                                                           |
| `CMS-03C-01` define template           | `cms-template-version-create` — `POST /api/v1/cms/templates/versions` → `201 TemplateVersionResource`                                | no record in URL; body is `TemplateVersionRequest`                                                                     | template draft, block digest, pending idempotency, rollback                          | idle, loading, validation/auth/designer/conflict/rate/dependency error, optimistic-pending/rollback, success, degraded                                                                                |
| `CMS-03C-02` use pattern               | `cms-composition-instance-create` — `POST /api/v1/cms/compositions/pattern-instances` → `201 CompositionInstanceResource`            | no record in URL; body is `PatternInstanceRequest`                                                                     | linked/detached mode, conflict diff, block digest, rollback                          | idle, loading, validation/auth/assignment/conflict/rate/dependency error, optimistic-pending/rollback, success, degraded                                                                              |
| `CMS-03C-03` govern taxonomy           | `cms-taxonomy-term-action` — `POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions` → `200 TaxonomyTermResource`                   | URL `taxonomyId`; body is `TaxonomyTermActionRequest`                                                                  | taxonomy/term lifecycle, merge survivor redirect, rollback                           | idle, loading, validation/auth/curator/conflict/rate/dependency error, optimistic-pending/rollback, success, degraded                                                                                 |
| `CMS-03C-04` author locale variant     | `cms-locale-variant-create` — `POST /api/v1/cms/entries/{entryId}/locales/{locale}/variants` → `201 LocaleVariantResource`           | URL `entryId`/`locale`; body is `LocaleVariantRequest`; runtime deferred in Phase 2                                    | deferred-disabled state, local form only; no network success claim                   | idle, disabled, loading, validation/auth/locale/conflict/rate/dependency error, optimistic-pending/rollback only after runtime authorization, success, degraded                                       |
| `CMS-03C-05` curate related content    | `cms-related-content-rule-create` — `POST /api/v1/cms/entries/{entryId}/related-content` → `201 RelatedContentResource`              | URL `entryId`; body is `RelatedContentRuleRequest`; runtime deferred in Phase 2                                        | deferred-disabled state, local form only; exclusions remain explicit                 | idle, disabled, loading, validation/auth/related-content/conflict/rate/dependency error, optimistic-pending/rollback only after runtime authorization, success, degraded                              |

No global client store is authorized. A new cross-island state need requires architecture review; until then URL/server state or a colocated island state owns it.

### Route registry with guards and metadata

| URL pattern                                                                              | Auth guard and failure redirect                                                                                                                                                                                                                                                                                                                                         | Page component                                                                                                 | Meta title                                                         | Meta description                                                                               |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `/app/cms-content-modeling`                                                              | Server validates Supabase token, expiry, acting context, and either `cms.schema_registry.read` or `cms.schema_designer` read scope. Missing/expired token redirects 303 to `/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling` after allowlist normalization. Concealed scope omits rows or returns disclosure-safe 404; visible forbidden renders `CapabilityGate`. | `CmsContentModelingRoute` variant `appPage` with protected `ContentSchemaRegistryWorkbench` list               | `CMS content modeling and authoring \| WeJammin`                   | `Review authorized schema-registry records with current state and version.`                    |
| `/app/cms-content-modeling/:contentTypeId/versions/:versionId`                           | Same token/expiry/context check plus either `cms.schema_registry.read` or `cms.schema_designer` read scope; malformed UUID returns 400, mismatched or concealed IDs return disclosure-safe 404, known readable resource without required capability returns 403, expired session uses the same safe sign-in redirect.                                                   | `CmsContentModelingRoute` with protected `ContentSchemaRegistryWorkbench` detail                               | `Schema version \| CMS content modeling and authoring \| WeJammin` | `Review an authorized schema version, definitions, artifact identity, and permitted bindings.` |
| System/degraded boundary                                                                 | Preserves verified shell only; Retry stays on canonical URL; unsafe cached data is removed.                                                                                                                                                                                                                                                                             | `CmsContentModelingRoute` variant `degradedPage`                                                               | `Service status \| WeJammin`                                       | `Review affected scope, last verified time, request ID, and recovery action.`                  |
| `/app/cms-content-modeling/entries/new` and `/app/cms-content-modeling/entries/:entryId` | Same token/expiry/acting-context check plus CMS author/editor assignment; malformed `entryId` returns 400, concealed or absent entry returns disclosure-safe 404, visible entry without assignment returns 403.                                                                                                                                                         | `CmsContentModelingRoute` with protected `EditorialWorkflowPublicationWorkbench` entry create and draft detail | `Create entry \| WeJammin`                                         | `Bootstrap an authorized entry with its first draft or load the current editable draft.`       |
| `/app/cms-content-modeling/entries`                                                      | Same token/expiry/acting-context check plus CMS author/editor read scope; a signed cursor is bound to the complete query and read scope, so only the caller's assigned/owned entries are listed and a concealed row is omitted.                                                                                                                                          | `CmsContentModelingRoute` with protected `CmsEditorialEntryList`                                             | `Entries \| WeJammin`                                             | `Find the entries assigned to you and open the current editable draft.`                       |
| `/app/cms-content-modeling/entries/:entryId/revisions`                                    | Same token/expiry/acting-context check plus CMS author/editor/reviewer read scope; malformed `entryId` returns 400, a concealed or absent entry/revision returns disclosure-safe 404, and a visible entry without read scope returns 403.                                                                                                                                  | `CmsContentModelingRoute` with protected `CmsEditorialRevisionCompare` and `CmsEditorialRestoreForm`        | `Revision history \| WeJammin`                                    | `Compare revisions by field, block and relation, and prepare a non-destructive restore.`      |
| `/app/cms-content-modeling/entries/:entryId/conflicts/:conflictId`                         | Same token/expiry/acting-context check plus CMS author/editor entry read scope; malformed UUIDs return 400, a hidden or absent entry/conflict returns disclosure-safe 404, and a visible entry without read scope returns 403.                                                                                                                                             | `CmsContentModelingRoute` with protected `CmsEditorialConflictDetail`                                       | `Resolve edit conflict \| WeJammin`                               | `Review the three versions of every changed field and choose the value to keep.`              |
| `/app/cms-content-modeling/capability-grants`                                            | Server validates Supabase token, expiry, acting context and that the caller is the receipt-derived owner. Missing/expired token redirects 303 to `/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling%2Fcapability-grants` after allowlist normalization; an authenticated non-owner renders `CapabilityGate` (403); step-up gates commits and never the read.         | `CmsContentModelingRoute` variant `appPage` with protected `CmsCapabilityGrantConsole`                         | `CMS capability grants \| WeJammin`                                | `Grant, renew and revoke time-limited CMS access for people in your organization.`             |

### Protected schema-registry operation metadata

The BE03a operation IDs CMS-03A-01 through CMS-03A-14 are listed in this table for the registry workbench; CMS-03A-15 through CMS-03A-18 belong to the separate `CmsCapabilityGrantConsole` and are listed in the next subsection. The browser surface exposes the
human commands (CMS-03A-01 through CMS-03A-04 and CMS-03A-09 through CMS-03A-12,
plus CMS-03A-14) and the protected reads (CMS-03A-06, CMS-03A-07 and CMS-03A-13);
CMS-03A-05 and CMS-03A-08 are listed for traceability but are not browser routes
or forms. The schema-review detail (CMS-03A-13) and the assignment create/revoke
(CMS-03A-14) are bounded to the exact frozen review and carry no private matching
identifier.

| Operation ID | Method and path                                                                  | Browser surface                                                                                      | Request/headers                                                                                                                | Success response                                                            |
| ------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `CMS-03A-01` | `POST /api/v1/cms/content-types`                                                 | Human schema-designer form                                                                           | `ContentTypeDraftRequest`; JSON, CSRF/origin, `Idempotency-Key`; no `If-Match` for a new type                                  | `201 ContentTypeVersionResource`                                            |
| `CMS-03A-02` | `POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/fields`     | Human schema-designer form                                                                           | `FieldSchemaChangeRequest`; JSON, CSRF/origin, `Idempotency-Key`, exact `If-Match`                                             | `201 FieldDefinitionVersionResource`                                        |
| `CMS-03A-03` | `POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/relations`  | Human schema-designer form                                                                           | `RelationBindingRequest`; JSON, CSRF/origin, `Idempotency-Key`, exact `If-Match`                                               | `201 RelationDefinitionResource`                                            |
| `CMS-03A-04` | `POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/activate`   | Human schema-designer confirmation step                                                              | `SchemaActivationRequest`; JSON, CSRF/origin, step-up, `Idempotency-Key`, exact `If-Match`                                     | `202 SchemaActivationResource`                                              |
| `CMS-03A-05` | `POST /api/v1/cms/blocks/versions`                                               | No browser route/form; signed release worker only                                                    | `BlockRegistrationRequest` after raw signature verification; no browser CSRF or human session                                  | `201 BlockDefinitionVersionResource`                                        |
| `CMS-03A-08` | `POST /api/v1/cms/blocks/versions/{blockDefinitionVersionId}/lifecycle`          | No browser route/form/lifecycle control; signed release worker only with `block_registry:write`      | `BlockLifecycleAdvanceRequest` after the exact raw signature envelope; no browser CSRF or human session                        | `201 BlockLifecycleEventResource`; append-only event, immutable version row |
| `CMS-03A-06` | `GET /api/v1/cms/content-types`                                                  | Protected registry list; `cms.schema_registry.read` or `cms.schema_designer` read scope              | `ContentSchemaRegistryListQuery`; query only, no body, no `Idempotency-Key`, no `If-Match`                                     | `200 ContentSchemaRegistryListPage`, `Cache-Control: no-store`              |
| `CMS-03A-07` | `GET /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}`             | Protected registry detail; `cms.schema_registry.read` or `cms.schema_designer` read scope            | Exact UUID path only; no query/body, no `Idempotency-Key`, no `If-Match`                                                       | `200 ContentSchemaRegistryDetail`, `Cache-Control: no-store`                |
| `CMS-03A-09` | `POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/successors` | Human schema-designer form (create a new draft from an immutable source)                             | `SchemaSuccessorRequest`; JSON, CSRF/origin, `Idempotency-Key`, exact source `If-Match`                                        | `201 ContentTypeVersionResource`                                            |
| `CMS-03A-10` | `POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/dry-runs`   | Human schema-designer form (start a server-derived dry run)                                          | `SchemaDryRunRequest`; JSON, CSRF/origin, `Idempotency-Key`, exact `If-Match`                                                  | `202 SchemaDryRunResource`                                                  |
| `CMS-03A-11` | `POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/reviews`    | Human schema-designer submit-review form (freeze the passed candidate)                               | `SchemaReviewSubmissionRequest`; JSON, CSRF/origin, `Idempotency-Key`, exact `If-Match`                                        | `201 SchemaReviewResource`                                                  |
| `CMS-03A-12` | `POST /api/v1/cms/schema-reviews/{reviewId}/decisions`                           | Human assigned-reviewer decision form (approve/reject with step-up)                                  | `SchemaReviewDecisionRequest`; JSON, CSRF/origin, step-up, `Idempotency-Key`, exact `If-Match`                                 | `201 SchemaReviewDecisionResource`                                          |
| `CMS-03A-13` | `GET /api/v1/cms/schema-reviews/{reviewId}`                                      | Protected review detail (submitter/designer scope or assigned `cms.schema_review` review-only scope) | Exact UUID path only; no query/body, no `Idempotency-Key`, no `If-Match`                                                       | `200 SchemaReviewResource`, `Cache-Control: no-store`                       |
| `CMS-03A-14` | `POST /api/v1/cms/schema-reviews/{reviewId}/assignments`                         | Human owner assignment form (`cms.schema_review.assign`)                                             | `SchemaReviewAssignmentRequest` (discriminated create/revoke); JSON, CSRF/origin, step-up, `Idempotency-Key`, exact `If-Match` | `201 SchemaReviewAssignmentResource` (create) / `200` (revoke)              |

### CMS capability grant operation metadata (DEC-119)

| Operation ID | Method and path                                            | Browser surface                   | Request/headers                                                                                     | Success response                                            |
| ------------ | ---------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `CMS-03A-15` | `POST /api/v1/cms/capability-grants`                       | Owner grant form                  | `CapabilityGrantRequest`; JSON, CSRF/origin, step-up, `Idempotency-Key`, no `If-Match`              | `201 CmsCapabilityGrantResource`                            |
| `CMS-03A-16` | `POST /api/v1/cms/capability-grants/{grantId}/renewals`    | Owner per-row renew form          | `CapabilityGrantRenewalRequest`; JSON, CSRF/origin, step-up, `Idempotency-Key`, exact `If-Match`    | `200 CmsCapabilityGrantResource`                            |
| `CMS-03A-17` | `POST /api/v1/cms/capability-grants/{grantId}/revocations` | Owner per-row revoke confirmation | `CapabilityGrantRevocationRequest`; JSON, CSRF/origin, step-up, `Idempotency-Key`, exact `If-Match` | `200 CmsCapabilityGrantResource`                            |
| `CMS-03A-18` | `GET /api/v1/cms/capability-grants`                        | Owner grant list                  | `CmsCapabilityGrantListQuery`; query only, no body, no `Idempotency-Key`, no `If-Match`             | `200 CmsCapabilityGrantListPage`, `Cache-Control: no-store` |

### Protected registry filter compatibility

`ContentSchemaRegistryListQuery.lifecycle` is a closed filter. The browser sends
only a pair accepted by this matrix; `state` is a separate filter for every
state-only resource and is never interpreted as lifecycle.

| `resourceKind`                                                                                             | Accepted `lifecycle` values                                         | Filter behavior                                                                                        |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `content_type`                                                                                             | `active`, `retired`                                                 | lifecycle-bearing                                                                                      |
| `field_definition_version`                                                                                 | `active`, `deprecated`, `retired`                                   | lifecycle-bearing                                                                                      |
| `block_definition_registry_record`                                                                         | `supported`, `deprecated`, `withdrawn`                              | lifecycle-bearing; rendered record is `BlockDefinitionRegistryRecord`                                  |
| `content_type_version`, `relation_definition`, `schema_artifact`, `template_binding`, `capability_binding` | none                                                                | state-only; a supplied lifecycle is rejected with `VALIDATION_FAILED` before authorization/data access |
| omitted                                                                                                    | only values compatible with the three lifecycle-bearing kinds above | state-only kinds are not matched; incompatible pairs are not treated as unfiltered                     |

The list island validates this closed matrix for immediate feedback, but the
server remains authoritative. A valid `state` filter is sent separately and the
opaque cursor is bound to the complete query, lifecycle/state pair, sort,
direction, and acting read scope.

`block_definition_lifecycle_event` is not a `RegistryResourceKind` and is never
accepted as a browser list/detail query resource. `BlockLifecycleEventResource`
is a release-worker response used only for telemetry and append-only event
verification; it is not a browser state variant.

### Editorial, publication, composition, taxonomy, and locale operation metadata

| Operation ID | Method and path                                                     | Browser request and success                                                                                                                                             | Auth/ownership and disclosure                                                                                                            | Browser policy                                         |
| ------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `CMS-03B-01` | `POST /api/v1/cms/entries/{entryId}/revisions`                      | `EntryRevisionRequest` → `201 EntryRevisionResource`; JSON, CSRF/origin, `Idempotency-Key`, exact strong `If-Match`                                                     | Assigned CMS author/editor; hidden entry 404, visible entry without assignment/edit 403                                                  | human form                                             |
| `CMS-03B-02` | `POST /api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve` | `ConflictResolutionRequest` → `201 EntryRevisionResource`; JSON, CSRF/origin, `Idempotency-Key`, exact strong `If-Match`                                                | Assigned author/editor with resolve capability; hidden entry/conflict 404, visible conflict without edit 403                             | human form                                             |
| `CMS-03B-03` | `GET /api/v1/cms/entries/{entryId}/revisions`                       | `RevisionHistoryQuery` → `200 RevisionHistoryPage`; query only, no body, `Idempotency-Key`, or `If-Match`; `Cache-Control: no-store`                                    | Assignment/read capability; hidden entry/revision 404, visible entry without read scope 403                                              | protected read-only GET; no mutation                   |
| `CMS-03B-04` | `POST /api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore` | `RevisionRestoreRequest` → `201 EntryRevisionResource`; JSON, CSRF/origin, `Idempotency-Key`, exact strong `If-Match`                                                   | Edit capability and readable source revision; hidden entry/revision 404, readable source without edit 403                                | human form                                             |
| `CMS-03B-05` | `POST /api/v1/cms/entries/{entryId}/reviews`                        | `ReviewSubmissionRequest` → `201 EditorialReviewResource`; JSON, CSRF/origin, `Idempotency-Key`, exact strong `If-Match`                                                | Submit capability/assignment; hidden entry/revision 404, visible target without submit 403                                               | human form                                             |
| `CMS-03B-06` | `POST /api/v1/cms/reviews/{reviewId}/decision`                      | `EditorialDecisionRequest` (`{reviewId, decision, reason, expectedVersion}`; the caller supplies no `capability`/`stepUpAt`) → `200 EditorialReviewResource`; JSON, CSRF/origin, recent binding-bound MFA on every decision (ordinary and protected), `Idempotency-Key`, exact strong `If-Match`                       | Assigned reviewer capability; hidden review 404, eligible review without capability 403; a missing/stale MFA is 401 `STEP_UP_REQUIRED` with a step-up route, never a 403 gate                                                  | human form                                             |
| `CMS-03B-07` | `POST /api/v1/cms/publication-schedules`                            | `PublicationScheduleRequest` → `202 PublicationScheduleResource`; JSON, CSRF/origin, step-up, `Idempotency-Key`, exact strong `If-Match`                                | CMS publisher with target visibility; hidden target 404, visible target without publisher 403                                            | human form; acceptance is not publication              |
| `CMS-03B-08` | `POST /api/v1/cms/previews`                                         | `PreviewRequest` → `201 PreviewTokenResource`; JSON, CSRF/origin, `Idempotency-Key`, no public cache                                                                    | Preview capability; hidden target 404, visible target without preview scope 403                                                          | human form; token never public/offline                 |
| `CMS-03B-09` | `POST /api/v1/cms/publications`                                     | `PublicationRequest` (incl. BE04c `audience` `^[a-z0-9_-]{1,48}$`) → `202 PublicationResource`; JSON, CSRF/origin, recent binding-bound MFA (unconditional step-up), `Idempotency-Key`, exact strong `If-Match`                                 | CMS publisher plus frozen approval/dependency set; hidden target 404, visible target without publisher 403; a missing/stale MFA is 401 `STEP_UP_REQUIRED`, never a 403 gate                               | human form; pending/projection state only              |
| `CMS-03B-10` | `POST /api/v1/cms/entries`                                          | `EntryCreateRequest` → `201 EntryCreateResource`; JSON, CSRF/origin, `Idempotency-Key`, no update-only `If-Match`                                                       | CMS author/editor create capability on an active compiled schema; hidden/absent target 404, visible target without create capability 403 | human form; atomic entry plus first draft revision     |
| `CMS-03B-11` | `GET /api/v1/cms/entries/{entryId}`                                 | `EntryDraftDetailQuery` → `200 EntryDraftDetailResource` (incl. server-derived `revisionNumber`, `schemaVersionId`, `openConflict`); query only, no body, `Idempotency-Key`, or `If-Match`; `Cache-Control: no-store`; strong authenticated `ETag` | Assignment/read capability; hidden/absent entry 404, visible entry without read scope 403                                                | protected read-only GET; no mutation                   |
| `CMS-03B-12` | `GET /api/v1/cms/entries/{entryId}/conflicts/{conflictId}`          | `ConflictDetailQuery` (no keys) → `200 ConflictDetailResource`; query only, no body, `Idempotency-Key`, or `If-Match`; `Cache-Control: no-store`; strong authenticated `ETag` | Entry read capability; hidden/absent entry/conflict 404, visible entry without read scope 403; `paths` is `[]` unless the conflict is `open`; no ownership identifier                                              | protected read-only GET; no mutation                   |
| `CMS-03B-13` | `GET /api/v1/cms/entries`                                           | `EntryListQuery` → `200 EntryListPage`; query only, no body, `Idempotency-Key`, or `If-Match`; `Cache-Control: no-store`; authenticated `ETag`                         | CMS author/editor read scope; only the caller's assigned/owned entries are listed, bound to the signed cursor over `(updatedAt DESC, entryId DESC)`                     | protected read-only GET; no mutation                   |
| `CMS-03B-14` | `GET /api/v1/cms/entries/authoring-context`                         | `AuthoringContextQuery` → `200 AuthoringContextResource`; query only, no body, `Idempotency-Key`, or `If-Match`; `Cache-Control: no-store`; authenticated `ETag`         | CMS author/editor scope; with `contentTypeVersionId` returns the author-safe field projection, otherwise the caller's creatable types; never grants `cms.schema_registry.read`; never a caller-chosen schema | protected read-only preparation GET; no mutation        |
| `CMS-03C-01` | `POST /api/v1/cms/templates/versions`                               | `TemplateVersionRequest` → `201 TemplateVersionResource`; JSON, CSRF/origin, `Idempotency-Key`, `If-Match` when editing                                                 | `template_designer` in scope; hidden owner/template 404, readable template without capability 403                                        | human form                                             |
| `CMS-03C-02` | `POST /api/v1/cms/compositions/pattern-instances`                   | `PatternInstanceRequest` → `201 CompositionInstanceResource`; JSON, CSRF/origin, `Idempotency-Key`, exact strong `If-Match`                                             | Assigned author/editor on revision/template draft; hidden target 404, visible target without edit 403                                    | human form                                             |
| `CMS-03C-03` | `POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions`            | `TaxonomyTermActionRequest` → `200 TaxonomyTermResource`; JSON, CSRF/origin, `Idempotency-Key`, exact strong `If-Match`                                                 | `taxonomy_curator` for vocabulary; hidden taxonomy/term 404, known vocabulary without capability 403                                     | human form                                             |
| `CMS-03C-04` | `POST /api/v1/cms/entries/{entryId}/locales/{locale}/variants`      | `LocaleVariantRequest` → `201 LocaleVariantResource`; JSON, CSRF/origin, `Idempotency-Key`, exact strong `If-Match`                                                     | Assigned CMS author/editor for localizable fields; hidden entry/locale 404, visible entry without edit 403                               | exact human-form contract; runtime deferred in Phase 2 |
| `CMS-03C-05` | `POST /api/v1/cms/entries/{entryId}/related-content`                | `RelatedContentRuleRequest` → `201 RelatedContentResource`; JSON, CSRF/origin, `Idempotency-Key`, exact strong `If-Match`                                               | Assigned author/editor with source edit; hidden source/target 404, visible source without edit 403                                       | exact human-form contract; runtime deferred in Phase 2 |

### Per-component responsive contract

| Component                                                                       | Mobile ≤768 px                                                                                                                                                                           | Tablet 769–1024 px                                                                                                                                  | Desktop ≥1025 px                                                                                                                                            |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CmsContentModelingRoute`                                                       | Four-column shell, 16 px gutter/margins, compact tabs, stack navigation, Back before detail, no horizontal page scroll at 320 CSS px                                                     | Eight-column shell, 20 px gutter, 24 px margins, collapsible sidebar, list/inspector when container permits                                         | Twelve-column shell, 24 px gutter, max 1440 px, persistent sidebar/top bar, stable route heading/action region                                              |
| `ContentSchemaRegistryWorkbench`                                                | List then detail stack; priority facts remain; action bar avoids virtual keyboard; controls at least 44 by 44 px                                                                         | List plus inline inspector or stack by container; two-column fields only when independent; lower-priority columns move into row details             | List/detail workbench; compact semantic table; virtualize over 100 rows; detail/action rail shows acting context and version                                |
| Schema-review forms (CMS-03A-09..12, CMS-03A-14) and review detail (CMS-03A-13) | Native single-column forms; labels above; confirmation for step-up decisions; action bar avoids the virtual keyboard; controls at least 44 by 44 px                                      | Two-column only for independent fields; the decision and assignment forms keep the evidence summary visible; prior step-up disclosure stays in view | Grouped form plus review summary; the action rail cites the frozen review version and the server-permitted next actions; safe evidence summary is read-only |
| `CmsCapabilityGrantConsole`                                                     | Priority list of capability, state and valid-through with expandable facts; single-column forms with labels above; confirmation as a separate review step; controls at least 44 by 44 px | Table with row-detail expansion; grant form below the table; two-column only for independent fields                                                 | Table beside the grant form; compact semantic table with sortable headers; renew and revoke open inline on the row                                          |
| `EditorialWorkflowPublicationWorkbench`                                         | List then detail stack; priority facts remain; action bar avoids virtual keyboard; controls at least 44 by 44 px                                                                         | List plus inline inspector or stack by container; two-column fields only when independent; lower-priority columns move into row details             | List/detail workbench; compact semantic table; virtualize over 100 rows; detail/action rail shows acting context and version                                |
| `CompositionTaxonomyLocalizationWorkbench`                                      | List then detail stack; priority facts remain; action bar avoids virtual keyboard; controls at least 44 by 44 px                                                                         | List plus inline inspector or stack by container; two-column fields only when independent; lower-priority columns move into row details             | List/detail workbench; compact semantic table; virtualize over 100 rows; detail/action rail shows acting context and version                                |
| Global `FilterBar`, `DataTable`, `ActionBar`, `ConfirmationStep`                | Apply/Reset and priority-list form; action labels remain text; confirmation becomes separate review step                                                                                 | Wrapped toolbar and row detail expansion; no hidden material field                                                                                  | Full typed filter/table/action composition; same semantics and authorization                                                                                |

### Interaction, accessibility, and image rules

| Interactive element                            | Native role and accessible name                                                            | Keyboard/focus                                                                                               | Feedback                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Navigation/record link                         | `a` with visible purpose; `aria-current` only for current route                            | Tab, Enter; route focuses `h1`; Back restores prior trigger/scroll                                           | Visited/current are not color-only; navigation busy only after 250 ms                         |
| Button/icon button                             | `button`; visible label or specific `aria-label`; decorative icon `aria-hidden=true`       | Tab, Enter, Space; disabled is native when unavailable; focus ring never removed                             | Same-frame pressed/pending; stable label width; result in polite live region                  |
| Form controls                                  | Native `input`/`select`/`textarea` with persistent `label` and help/error IDs              | Logical Tab; first invalid field from linked summary; Enter cannot bypass review; Escape does not erase form | Blur validation where safe, authoritative submit validation, errors within 100 ms of response |
| Table/filter/selection                         | Native table/header buttons and labelled filter form; no ARIA grid without grid behavior   | Tab through controls; Arrow keys only in declared composite; stable selection focus on refetch               | Sort/filter state text and result count announced politely                                    |
| Dialog/drawer/popover when inline is exhausted | Named dialog/region; trigger relationship; consequence in heading                          | Initial heading focus, Tab containment for modal, Escape before commit, return focus                         | Open/close 150–220 ms or instant under reduced motion                                         |
| Media/upload                                   | Native media/file controls with filename, type, progress, cancel, transcript/caption links | Full keyboard operation; no drag-only or waveform-only action                                                | Determinate progress where known; quarantine/failed/ready text                                |

- **Image alt policy**: informative images use concise purpose-specific alt; functional images use the action name; decorative images use empty `alt=""` and no redundant ARIA; complex charts/artwork use short alt plus adjacent long description/data table; user/CMS images require governed alt before publication; avatars use the visible person/organization name only when the image adds identity.
- **Output semantics**: every icon is decorative or named, every status combines text/icon/structure, and every dynamic result uses the least interruptive correct live region. WCAG 2.2 AA is mandatory.

### Performance budgets and loading strategy

| Page/component                              |                            JavaScript budget (gzip) | Lazy loading                                                                                                                                                    | Image/media policy                                                                                                                                              | Runtime targets                                                    |
| ------------------------------------------- | --------------------------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `CmsContentModelingRoute` public variant    | ≤45 KB initial route JS; zero hydration when static | Hydrate only a visible interaction with `client:visible`; no global router                                                                                      | Astro image pipeline emits width/height, AVIF/WebP plus fallback, responsive `srcset`/`sizes`; below-fold images lazy; hero/record identity eager only when LCP | LCP <2.5 s, INP <200 ms, CLS <0.1 at p75                           |
| `CmsContentModelingRoute` app/admin variant |      ≤90 KB initial route JS including shared shell | Each workbench island ≤35 KB initial; editor/media/chart modules split to ≤80 KB lazy chunk and load on explicit entry/visibility; independent fetches parallel | Same optimized image contract; audio/video metadata preload only until explicit play; waveform data lazy and functional                                         | LCP <2.5 s, INP <200 ms, CLS <0.1; interaction feedback same frame |
| `ContentSchemaRegistryWorkbench`            |                               ≤35 KB hydrated entry | Detail/editor/media/export modules dynamic-import on selection; list over 100 virtualizes; no barrel import                                                     | Preserve intrinsic dimensions; thumbnails use bounded variants; originals never download for list rows                                                          | Long task off main thread or chunked; no task >50 ms during input  |
| `CmsCapabilityGrantConsole`                 |                               ≤35 KB hydrated entry | Renew, revoke and confirmation modules dynamic-import on first use; page size is at most 100 so no virtualization is needed                                     | No images or media                                                                                                                                              | No task >50 ms during input                                        |
| `EditorialWorkflowPublicationWorkbench`     |                               ≤35 KB hydrated entry | Detail/editor/media/export modules dynamic-import on selection; list over 100 virtualizes; no barrel import                                                     | Preserve intrinsic dimensions; thumbnails use bounded variants; originals never download for list rows                                                          | Long task off main thread or chunked; no task >50 ms during input  |
| `CompositionTaxonomyLocalizationWorkbench`  |                               ≤35 KB hydrated entry | Detail/editor/media/export modules dynamic-import on selection; list over 100 virtualizes; no barrel import                                                     | Preserve intrinsic dimensions; thumbnails use bounded variants; originals never download for list rows                                                          | Long task off main thread or chunked; no task >50 ms during input  |

Budgets are hard acceptance criteria for `/plan-phase` and implementation. A feature exceeding a budget must split or obtain an originating architecture decision, not silently raise the number.

### Form and auth security rules

| Boundary                      | Exact frontend rule                                                                                                                                                                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token/session                 | Astro verifies the Supabase token server-side on every protected route and write, checks expiry/revocation and server-derived acting context, strips protected props on failure, and uses the allowlisted 303 sign-in redirect above. Client role strings never authorize.       |
| CSRF                          | Cookie-authenticated mutations require same-site `Secure`/`HttpOnly` cookies, strict allowed `Origin`/`Referer` validation, and the architecture-approved CSRF token binding. Bearer-only API calls do not rely on cookies but still enforce CORS/origin policy. No GET mutates. |
| Input validation/sanitization | Controls serialize only named Zod request fields; trim/normalize only where the contract says; reject unknown keys; rich text/URLs/filenames pass allowlist sanitizers server-side. Client checks improve feedback but never replace boundary validation.                        |
| Output encoding               | Render untrusted text through framework text bindings. `dangerouslySetInnerHTML` is prohibited except an approved sanitized typed CMS renderer; URL attributes use allowlisted schemes; CSS/script/expression content is never executed.                                         |
| Secrets/PII                   | Tokens, provider responses, evidence bodies, contact data, media URLs, and drafts never enter URL, analytics, logs, structured diagnostic events, Realtime payloads, or client-persisted global state.                                                                           |
| Upload                        | Server-authorized short-lived intent binds actor, target, type, size, key, and checksum. Client cannot choose canonical object key; unverified/quarantined bytes never render as ready.                                                                                          |
| Redirects                     | `returnTo` is a relative route from a code-owned allowlist, normalized before encoding. External schemes, protocol-relative URLs, control characters, and unauthorized admin destinations fall back to the safe app root.                                                        |

### Form-by-source completeness

| BE source                                                  | Fields/validation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Error display                                                                                                                                                                                                                                                                                                                             | Submission and success                                                                                                                                                                                                                                                                                                                                                    | Security                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `03a-content-schema-registry.md` / `CMS-03A-01`            | Exact generated `ContentTypeDraftRequest`: `typeKey`, `label`, `ownerCapability`, `sourceLocale`, `defaultLocale`, `supportedLocales`, `fallbackChains`, `workflowKey`, `workflowVersion`, `defaultTemplateVersionId`, `fields`, `relations`, `templateBindings`, `capabilityBindings`; the create form has no template input (DEC-123: a new type is created without a template, so the submitted request carries `defaultTemplateVersionId: null` and `templateBindings: []`, and the form says that a template is bound after creation, through a successor version; a posted template value is a 422); strict unknown-key rejection and safe blur/submit checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Linked summary plus exact field/array errors; preserve valid input; no raw upstream copy                                                                                                                                                                                                                                                  | One atomic idempotent commit; stable pending label; parsed `ContentTypeVersionResource` replaces draft; result heading receives focus                                                                                                                                                                                                                                     | CSRF/origin, server-derived actor/acting context, protected registry allowlists, output encoding, secret/PII redaction                                                                                                                                                                                                    |
| `03a-content-schema-registry.md` / `CMS-03A-02`            | Exact generated `FieldSchemaChangeRequest`: path IDs plus `stableFieldId?`, `key`, `kind`, `constraints`, `required`, validator key/version, default mode/value, localization mode, editor config, lifecycle, and required `migrationPlanId` (`UUID \| null`); cross-field default/validator checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Linked summary plus exact field errors; preserve draft and prior definition on refusal                                                                                                                                                                                                                                                    | CAS/idempotent commit with expected version; parsed `FieldDefinitionVersionResource` replaces scoped draft                                                                                                                                                                                                                                                                | Same controls; no executable patterns/expressions/code or arbitrary renderer/registry key                                                                                                                                                                                                                                 |
| `03a-content-schema-registry.md` / `CMS-03A-03`            | Exact generated `RelationBindingRequest`: `fieldId`, `targetKind`, `targetType`, `projectionKey`, `cardinality`, `min` 0–128, `max` 1–128, `ordered`, `onUnavailable`; require `min ≤ max`; `one` requires `max=1` and `min=0 \| 1`; allow only `omit \| block \| placeholder`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Linked summary plus exact relation errors; placeholder is exactly `{status:'unavailable',reason:'unavailable'}` with no target identity/data or existence distinction                                                                                                                                                                     | CAS/idempotent commit; parsed `RelationDefinitionResource` replaces scoped draft                                                                                                                                                                                                                                                                                          | Same controls; target read remains authorization-bound and never grants authority                                                                                                                                                                                                                                         |
| `03a-content-schema-registry.md` / `CMS-03A-09`            | `SchemaSuccessorRequest`: `{ expectedVersion, supportedLocales, fallbackChains, defaultTemplateVersionId, templateBindings }` plus the optional nullable API-only pair `workflowKey`/`workflowVersion` (the AC390 producer path for a workflow change on a successor; the console form has no control for it and submits neither member, so the server keeps the source member) where the two locale fields are both null (clone the source configuration) or both present (replace it) and the two template members follow the same pair rule (DEC-123); exact source `If-Match` and `Idempotency-Key`; the caller never supplies the new version number, row IDs, or stable identities                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 400 malformed path/header/body; 401 missing/expired session; 403 designer capability; 404 concealed source; 409 stale source version/idempotency; 415 non-JSON; 422 successor contract; 429 successor limit; 502/503/504 RPC dependency; 500 scrubbed                                                                                     | `201 ContentTypeVersionResource` for the fresh draft; server clones the immutable source with new definition row IDs, preserved stable field identities/keys and remapped local references; the source remains unchanged                                                                                                                                                  | `cms.schema_designer` on the readable immutable source; CSRF/origin, strict JSON, no caller identity, no destructive overwrite of the source                                                                                                                                                                              |
| `03a-content-schema-registry.md` / `CMS-03A-10`            | `SchemaDryRunRequest`: `{ expectedVersion, transformKey, transformVersion }`; the transform pair is both-absent or both-present and is required iff the server classifies the change conditional/breaking — the caller cannot force a classification, counts, hashes, or a report                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 400 malformed path/header/body; 401 missing/expired session; 403 designer; 404 concealed draft; 409 stale version/idempotency or changed candidate/transform evidence; 415 non-JSON; 422 transform-pair/classification mismatch; 429 dry-run limit; 502/503/504 RPC dependency; 500 scrubbed                                              | `202 SchemaDryRunResource` as pending/queued only, carrying its job reference; the immutable passed report (counts/hashes/classification) is published only after the real bounded scan, and `GET /api/v1/jobs/{jobId}` observes status; the browser never fabricates or displays a passing result                                                                        | `cms.schema_designer` on the draft; server derives source/target/compiler/classification; caller supplies no counts, hashes, or report; no false success; reconcile job status before retry                                                                                                                               |
| `03a-content-schema-registry.md` / `CMS-03A-11`            | `SchemaReviewSubmissionRequest`: `{ expectedVersion, dryRunId }`; the referenced dry run must be a persisted passed report for the exact candidate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 400 malformed IDs/header/body; 401 missing/expired session; 403 designer; 404 concealed draft/dry-run; 409 open review/evidence/state/idempotency; 415 non-JSON; 422 submission contract; 429 review-write limit; 502/503/504 RPC dependency; 500 scrubbed                                                                                | `201 SchemaReviewResource` (state `open`) freezing candidate/policy/evidence and the required decision count; draft transitions to review atomically and the frozen evidence is immutable; the submitter never counts as a reviewer                                                                                                                                       | `cms.schema_designer` on a draft with a passed persisted dry run; CSRF/origin, strict JSON, frozen evidence, no caller authority metadata                                                                                                                                                                                 |
| `03a-content-schema-registry.md` / `CMS-03A-12`            | `SchemaReviewDecisionRequest`: `{ expectedVersion, decision }` where `decision` is `approve` or `reject`; reviewer identity and recent binding-bound MFA are server-derived                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 400 malformed ID/header/body; 401 missing/expired session or `STEP_UP_REQUIRED`; 403 reviewer/assignment; 404 concealed review; 409 duplicate/self/out-of-policy/stale/idempotency; 415 non-JSON; 422 decision bound; 429 decision limit; 502/503/504 RPC dependency; 500 scrubbed                                                        | `201 SchemaReviewDecisionResource` (`reviewId`, `decision`, `capability`, `decidedAt` only) as an append-only record; no reviewer identifier; approval transitions the review only when the frozen policy count is met                                                                                                                                                    | Assigned `cms.schema_review` human on the exact frozen review with recent binding-bound MFA; `If-Match`, idempotency, no caller authority identity                                                                                                                                                                        |
| `03a-content-schema-registry.md` / `CMS-03A-04`            | Exact generated `SchemaActivationRequest`: `expectedVersion`, `dryRunId`, distinct `approvalIds` (the approve-decision IDs of the one approved review, prefilled and never typed), `migrationPlanId`, optional `expectedActivationEvidenceHash`; confirmation and step-up before submit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Summary names missing policy/evidence/hash mismatch without disclosing protected predicates; preserve safe review context                                                                                                                                                                                                                 | Idempotent CAS activation; parsed `SchemaActivationResource`/job status replaces pending state; render server-frozen `activationEvidence` (`key`, `version`, `policyHash`, `riskClass`, `requiredDecisionCount`, `requiredCapabilities`, `approvalEvidenceHash`) read-only; result heading receives focus                                                                 | Same controls plus MFA/approval evidence; expected hash is equality-only; reconcile status before retry; no false success                                                                                                                                                                                                 |
| `03a-content-schema-registry.md` / `CMS-03A-05` / `CMS-10` | No human form, upload, or browser serialization. The signed release worker alone submits `BlockRegistrationRequest` after exact `ReleaseEnvelopeHeaders` verification; browser may render only `BlockDefinitionRegistryRecord` from protected list/detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Not applicable in browser; `401 WEBHOOK_REJECTED` for invalid release principal/signature remains worker telemetry; other release failures retain exact worker status/code; unavailable/read-only state has truthful recovery                                                                                                             | No browser submission or optimistic state; release worker owns registration and immutable lifecycle                                                                                                                                                                                                                                                                       | No release header, raw body, props snapshot, snapshot signature, release signature/hash, verification evidence, script, CSS, expression, or private registration body enters browser state                                                                                                                                |
| `03a-content-schema-registry.md` / `CMS-03A-13`            | Protected schema-review detail: `SchemaReviewResource` (`reviewId`, `state` open/approved/rejected/invalidated, `riskClass` ordinary/protected, `requiredDecisionCount` 1..8, `requiredCapabilities[]`, `recordedDecisionCount`, `dryRunId`, `policyKey`/`policyVersion`/`policyHash`, `contentTypeVersionNo`, a safe frozen artifact/compiler/dependency evidence summary, `decisions[]` (each `{id, decision, capability, decidedAt}`, at most eight), owner-only `assignments[]` (at most eight `{assignmentId, version, state, startsAt, endsAt, reviewerLabel}` safe summaries; empty for non-owners; the label is display text only and the revoke control sends `assignmentId` and `version`), `permittedNextActions[]` of `create_successor`/`start_dry_run`/`submit_review`/`assign_reviewer`/`record_decision`/`activate`, `submittedAt`, optional `decidedAt` and `approvalEvidenceHash` when approved) | `INVALID_REQUEST` malformed path; `UNAUTHENTICATED` safe sign-in; disclosure-safe `NOT_FOUND` for concealed reviews; `RATE_LIMITED` wait; `DEPENDENCY_UNAVAILABLE` degraded; `INTERNAL_ERROR` scrubbed                                                                       | `200 SchemaReviewResource`, `Cache-Control: no-store`; render the safe candidate identity, frozen evidence summary, required/recorded counts, the decision list (its approve-decision `id` values are the activation `approvalIds`) and permitted next actions; the submitter/designer sees the submit/activation path, the assigned reviewer sees the decision form      | No body, no `Idempotency-Key`, no `If-Match`; the projection contains NO submitter/reviewer/grantor/actor/party/private-binding identifier and no raw content; there is no public cache, route, index, or sitemap source for a review                                                                                     |
| `03a-content-schema-registry.md` / `CMS-03A-14`            | `SchemaReviewAssignmentRequest` — discriminated on `action`: `create` (`expectedVersion`, `reviewerPersonId`, `expiresAt`, optional `reason`) or `revoke` (`expectedVersion`, `assignmentId`, optional `reason`); the `reviewerPersonId` is an authorized request reference only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 400 malformed ID/header/body; 401 missing/expired session or `STEP_UP_REQUIRED`; 403 owner `cms.schema_review.assign`; 404 concealed review; 409 ineligible/submitter/broad-scope/stale/idempotency; 415 non-JSON; 422 assignment contract; 429 assignment limit; 502/503/504 RPC dependency; 500 scrubbed                                | `201 SchemaReviewAssignmentResource` for create with ONLY safe fields (`reviewId`, `state` active/revoked, `capability` literal `cms.schema_review`, `actions` exactly `['read','decide']`, `startsAt`, `expiresAt`, optional `reason`) or `200` for revoke; no reviewer/grantor identifier is echoed                                                                     | Existing owner with `cms.schema_review.assign`, recent binding-bound MFA, exact review `If-Match`; the resolved private person/actor/binding UUIDs stay server-side and out of props/telemetry; scope is one frozen review for at most seven days and no later than the grantor authority; assignment creates no identity |
| `03a-content-schema-registry.md` / `CMS-03A-15`            | `CapabilityGrantRequest`: `subjectPersonId` UUID, `capability` from the generated closed set, `validThrough` real UTC date within `termWindow`, optional `reason` 1–256; required `Idempotency-Key`, no `If-Match`; the caller never supplies `validFrom`, owner, grantor or any term longer than the window                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 401 `STEP_UP_REQUIRED` inline step-up disclosure; 403 non-owner; 404 one non-disclosing person refusal; 409 existing grant with a renew link; 415 non-JSON; 422 field errors; 429 countdown; 502/503/504 degraded; 500 scrubbed                                                                                                           | `201 CmsCapabilityGrantResource`; list refetched; result heading focused; announcement names the capability label and valid-through date only                                                                                                                                                                                                                             | Receipt-derived owner with recent binding-bound MFA; CSRF/origin, strict JSON; person ID only in the owner-only island and never in URL, storage, telemetry or logs; grants no admin, grant or delegation authority                                                                                                       |
| `03a-content-schema-registry.md` / `CMS-03A-16`            | `CapabilityGrantRenewalRequest`: `expectedVersion` from the row `version` (sent as `If-Match`), `validThrough` within `termWindow`, optional `reason`; `grantId` from the row, never typed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 401 `STEP_UP_REQUIRED`; 403 non-owner; 404 grant no longer available; 409 `This grant changed. Review the current term and try again.` beside the refetched row, and a revoked grant offers Grant again; 422 date/reason; 429 countdown; 5xx degraded                                                                                     | `200 CmsCapabilityGrantResource`; restarted term; list refetched                                                                                                                                                                                                                                                                                                          | Same controls; exact `If-Match`; reconcile through a list refetch before any retry                                                                                                                                                                                                                                        |
| `03a-content-schema-registry.md` / `CMS-03A-17`            | `CapabilityGrantRevocationRequest`: `expectedVersion` from the row `version` (sent as `If-Match`), optional `reason`; inline confirmation names the immediate, irreversible-without-regrant consequence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 401 `STEP_UP_REQUIRED`; 403 non-owner; 404 grant no longer available; 409 stale or already revoked with the refetched row; 422 reason; 429 countdown; 5xx degraded                                                                                                                                                                        | `200 CmsCapabilityGrantResource` in state `revoked`; list refetched                                                                                                                                                                                                                                                                                                       | Same controls; immediate effect is server-side and never assumed by the browser before the refetch                                                                                                                                                                                                                        |
| `03a-content-schema-registry.md` / `CMS-03A-18`            | `CmsCapabilityGrantListQuery`: island-local `subjectPersonId`, URL `capability`, `state` active/lapsed/revoked, `limit` 1–100 default 25, opaque `cursor` ≤512, `sort` updatedAt/validThrough, `direction`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `INVALID_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN` gate, `VALIDATION_FAILED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE` degraded, `INTERNAL_ERROR`; never `NOT_FOUND`                                                                                                                                                                                 | `200 CmsCapabilityGrantListPage`; rows and nullable `nextCursor`; `no-store`                                                                                                                                                                                                                                                                                              | No body, `Idempotency-Key` or `If-Match`; no cache, offline copy, analytics or Realtime body carries a row                                                                                                                                                                                                                |
| `03a-content-schema-registry.md` / `CMS-03A-08` / `CMS-10` | No human form, upload, lifecycle control, or browser serialization. The signed release worker submits `BlockLifecycleAdvanceRequest` for an existing `blockDefinitionVersionId` only after exact `ReleaseEnvelopeHeaders` verification; `fromLifecycle`/`toLifecycle` must be supported→deprecated or deprecated→withdrawn, with positive `expectedVersion` and lowercase 64-hex `releaseDigest`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Not applicable in browser; `401 WEBHOOK_REJECTED` is release-worker telemetry only for invalid release principal/signature; malformed input, replay/nonce, lifecycle/version, digest, media, dependency, and internal outcomes retain exact worker status/code; browser shows only unavailable/read-only metadata                         | `201 BlockLifecycleEventResource` is worker-only; append-only event and nonce receipt are atomic, the version row is immutable, and browser has no submission, optimistic state, or lifecycle action                                                                                                                                                                      | No release header, raw body, lifecycle event, nonce receipt, release key/hash/signature/verification evidence, or private release principal enters browser state                                                                                                                                                          |
| `03b-editorial-workflow-publication.md` / `CMS-03B-01`     | `EntryRevisionRequest`: `entryId`, `baseRevision`, `changedPaths`, `values`, `locale`, `expectedVersion`; changed paths are 1–128 unique JSON pointers; values are strict stable-field-ID JSON; locale is BCP 47; positive decimal versions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Exact per-op 400/401/403/404/409/415/422/429/502/503/504/500 mapping from BE03b; assignment/schema/value errors are field-linked; preserve unsent values                                                                                                                                                                                  | `201 EntryRevisionResource`; idempotent CAS, canonical refetch, result heading focus                                                                                                                                                                                                                                                                                      | Human assigned author/editor; CSRF/origin, strict JSON/unknown-key rejection, no private values in telemetry                                                                                                                                                                                                              |
| `03b-editorial-workflow-publication.md` / `CMS-03B-02`     | `ConflictResolutionRequest`: `entryId`, `conflictId`, `baseRevision`, `choices`, `expectedVersion`; each choice is `path`, `choice` base/theirs/yours/explicit, optional `value`; explicit requires value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Exact per-op 400/401/403/404/409/415/422/429/502/503/504/500 mapping; moved base and invalid choice preserve both parents                                                                                                                                                                                                                 | `201 EntryRevisionResource`; explicit choices only, idempotent CAS, no inferred merge                                                                                                                                                                                                                                                                                     | Assigned resolver; CSRF/origin, strict values, no hidden conflict inference                                                                                                                                                                                                                                               |
| `03b-editorial-workflow-publication.md` / `CMS-03B-03`     | `RevisionHistoryQuery`: `entryId`, optional nullable opaque `cursor` ≤512, `limit` 1–50 default 25, optional state draft/submitted/approved/rejected/scheduled/published, optional `compareRevisionId`, optional BCP 47 `locale`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Exact per-op 400/401/403/404/409/415/422/429/502/503/504/500 mapping; read errors never mutate or expose private content; the comparison groups changes by `domain` (field/block/relation), renders side hashes and the keyed relation `targetToken` only, and refuses over 512 changes with `comparison_too_large` (unresolvable version `comparison_unavailable`)                                                                                                                                                                                                                  | `200 RevisionHistoryPage` with `items`, `nextCursor`, `pageVersion`, optional compare (`leftRevisionId`, `rightRevisionId`, `changes`, `restore` with `migrationChainId`/`edgeCount`/`chainHash`/`availability`)                                                                                                                                                                                                                                    | Read capability/assignment; GET has no body, `Idempotency-Key`, `If-Match`, audit/outbox, public cache, or offline persistence; no target identity in the token                                                                                                                                                                                            |
| `03b-editorial-workflow-publication.md` / `CMS-03B-04`     | `RevisionRestoreRequest`: `entryId`, `revisionId`, `migrationChainId` (the read-derived D6 chain ID), `expectedVersion`; UUIDs and the re-derived immutable chain must cover source to current schema; the confirmation shows `edgeCount` and disables commit when availability is `chain_unavailable`/`transform_missing`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Exact per-op 400/401/403/404/409/415/422/429/502/503/504/500 mapping; migration/version failure leaves source unchanged; 409 `migration_chain_mismatch`/`migration_chain_incomplete`/`template_incompatible` fabricate nothing                                                                                                                                                                                                                   | `201 EntryRevisionResource`; creates new draft only (with `parentRevisionIds = [currentDraftRevisionId, sourceRevisionId]`), idempotent CAS                                                                                                                                                                                                                                                                                                       | Assigned editor with edit capability; strict JSON, CSRF/origin, no source overwrite                                                                                                                                                                                                                                       |
| `03b-editorial-workflow-publication.md` / `CMS-03B-05`     | `ReviewSubmissionRequest`: `entryId`, `revisionId`, `frozenHash`, `dependencyManifest`; manifest includes schema (`id`, `hash`, `schemaArtifact`, `validatorRefs`, `workflowPolicy`, `activationEvidence`), template, blocks, patterns, terms, localeSources, settings, relations, checker                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Exact per-op 400/401/403/404/409/415/422/429/502/503/504/500 mapping; frozen hash/dependency/risk failures remain in review summary                                                                                                                                                                                                       | `201 EditorialReviewResource`; render server-frozen `workflowPolicy` and `activationEvidence`, counts, hashes                                                                                                                                                                                                                                                             | Assigned submitter; strict manifest, no policy predicates or private content in UI/telemetry                                                                                                                                                                                                                              |
| `03b-editorial-workflow-publication.md` / `CMS-03B-06`     | `EditorialDecisionRequest`: `reviewId`, `decision` approve/reject, `reason` 1–2000 safe chars, `expectedVersion`; reviewer identity, the satisfied slot `capability` and the binding `step_up_at` are server-derived (a caller `capability`/`stepUpAt` is an unknown key)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Exact per-op 400/401/403/404/409/415/422/429/502/503/504/500 mapping; stale/duplicate/self/hash errors preserve review; missing/stale MFA is 401 `STEP_UP_REQUIRED` with `{recoveryAction:'step_up', allowedMethods}` and no state                                                                                                                                                                                                                     | `200 EditorialReviewResource`; append-only decision outcome and policy-derived count                                                                                                                                                                                                                                                                                      | Assigned distinct reviewer; recent binding-bound MFA on every decision (ordinary and protected); no caller authority metadata                                                                                                                                                                                                                                 |
| `03b-editorial-workflow-publication.md` / `CMS-03B-07`     | `PublicationScheduleRequest`: `revisionId`, action publish/unpublish/expire/archive, local datetime, IANA `timezone`, `resolvedUtc`, `tzdbVersion`, disambiguation none/earlier/later, BE04c `audience` `^[a-z0-9_-]{1,48}$`, `expectedVersion`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Exact per-op 400/401/403/404/409/415/422/429/502/503/504/500 mapping; schedule collision/time/DST errors stay pending-free; missing/stale MFA is 401 `STEP_UP_REQUIRED`                                                                                                                                                                                                                | `202 PublicationScheduleResource`; render job/state/actual UTC/deviation, never publication success                                                                                                                                                                                                                                                                       | CMS publisher and recent binding-bound MFA (unconditional); worker rechecks dependency/activation evidence; no private scheduler payload in browser                                                                                                                                                                                                        |
| `03b-editorial-workflow-publication.md` / `CMS-03B-08`     | `PreviewRequest`: `entryId`, `revisionId`, BCP 47 `locale`, safe `audience` 1–64, normalized `route` 1–2048, exact `VersionSet` (`schemaVersionId`, `schemaHash`, `schemaArtifact`, `validatorRefs`, `workflowPolicy`, `activationEvidence`, template/taxonomy/block/pattern/settings/compiler fields)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Exact per-op 400/401/403/404/409/415/422/429/502/503/504/500 mapping; token/version/route errors never mint                                                                                                                                                                                                                               | `201 PreviewTokenResource`; token displayed once with expiry and revocation state; no public cache/index                                                                                                                                                                                                                                                                  | Preview capability; token and version set are user/acting/audience/locale/route bound and never offline                                                                                                                                                                                                                   |
| `03b-editorial-workflow-publication.md` / `CMS-03B-09`     | `PublicationRequest`: `entryId`, `revisionId`, `frozenHash`, `expectedVersionSet`, BE04c `audience` `^[a-z0-9_-]{1,48}$`, `expectedVersion`; expected set equals approved candidate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Exact per-op 400/401/403/404/409/415/422/429/502/503/504/500 mapping; frozen hash/set/state failures produce no partial publication; missing/stale MFA is 401 `STEP_UP_REQUIRED`                                                                                                                                                                                                       | `202 PublicationResource`; render pending/projection state, not success until canonical convergence                                                                                                                                                                                                                                                                       | CMS publisher and approval/dependency gate plus recent binding-bound MFA; preflight and idempotency reconciliation before retry                                                                                                                                                                                                                         |
| `03c-composition-taxonomy-localization.md` / `CMS-03C-01`  | `TemplateVersionRequest`: `templateKey`, `compatibleTypeIds`, `slots` (`key`, `required`, `allowedBlocks` of `blockKey`/`blockVersion`, `maxCount`), `reservedRegions`, `bindings` (`projection`, `required`), `locale`, `audience`, optional `blockRegistryDigest`, nullable `expectedVersion`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Exact codes: `INVALID_REQUEST`, `UNAUTHENTICATED`, `TEMPLATE_FORBIDDEN`, `TEMPLATE_NOT_FOUND`, `TEMPLATE_VERSION_CONFLICT`, `UNSUPPORTED_MEDIA_TYPE`, `TEMPLATE_VALIDATION_FAILED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR`                             | `201 TemplateVersionResource`; server recomputes block digest                                                                                                                                                                                                                                                                                                             | `template_designer`; strict JSON, registry read, no uploaded markup/code                                                                                                                                                                                                                                                  |
| `03c-composition-taxonomy-localization.md` / `CMS-03C-02`  | `PatternInstanceRequest`: `revisionId`, `patternId`, positive `patternVersion`, `linkMode` linked/detached, normalized `slotPath`, strict `overrides`, optional `blockRegistryDigest`, `expectedVersion`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Exact codes: `INVALID_REQUEST`, `UNAUTHENTICATED`, `COMPOSITION_FORBIDDEN`, `COMPOSITION_NOT_FOUND`, `COMPOSITION_VERSION_CONFLICT`, `UNSUPPORTED_MEDIA_TYPE`, `COMPOSITION_VALIDATION_FAILED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR`                 | `201 CompositionInstanceResource`; linked collision is explicit pending diff                                                                                                                                                                                                                                                                                              | Assigned author/editor; acyclic graph and safe block registry only                                                                                                                                                                                                                                                        |
| `03c-composition-taxonomy-localization.md` / `CMS-03C-03`  | `TaxonomyTermActionRequest`: `taxonomyId`, action create/rename/alias/deprecate/merge, `termKey`, nullable `parentId`, nullable `survivorId`, 1–64 NFC `labels` (`locale`, `label`), `aliases`, `expectedVersion`; merge requires survivor and others forbid it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Exact codes: `INVALID_REQUEST`, `UNAUTHENTICATED`, `TAXONOMY_FORBIDDEN`, `TAXONOMY_NOT_FOUND`, `TAXONOMY_VERSION_CONFLICT`, `UNSUPPORTED_MEDIA_TYPE`, `TAXONOMY_VALIDATION_FAILED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR`                             | `200 TaxonomyTermResource`; merge renders permanent survivor redirect                                                                                                                                                                                                                                                                                                     | Verified `taxonomy_curator`; term lock, overlap/cycle checks, no hidden vocabulary inference                                                                                                                                                                                                                              |
| `03c-composition-taxonomy-localization.md` / `CMS-03C-04`  | `LocaleVariantRequest`: `entryId`, BCP 47 `locale`, `sourceRevisionId`, 1–128 `fields` (`fieldId`, `value`), ordered `fallbackChain` ≤16 (an equality expectation filled from the active version's `fallbackChains` entry, never typed by the author; 409 `LOCALE_VERSION_CONFLICT` with `FALLBACK_CHAIN_MISMATCH` returns the active chain), `noFallbackFieldIds` ≤128, `sourceHash`, `expectedVersion`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Exact codes: `INVALID_REQUEST`, `UNAUTHENTICATED`, `LOCALE_FORBIDDEN`, `LOCALE_SOURCE_NOT_FOUND`, `LOCALE_VERSION_CONFLICT`, `UNSUPPORTED_MEDIA_TYPE`, `LOCALE_VALIDATION_FAILED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR`                              | `201 LocaleVariantResource`; exact contract is disabled/deferred in Phase 2 and cannot claim success                                                                                                                                                                                                                                                                      | Assigned author/editor; no-fallback/legal/safety gates; no placeholder endpoint                                                                                                                                                                                                                                           |
| `03c-composition-taxonomy-localization.md` / `CMS-03C-05`  | `RelatedContentRuleRequest`: `entryId`, unique `pins` ≤32, unique `exclusions` ≤64, nullable `derivedRule` (`key`, `version`, `reasonCode`, `maxCandidates`), `expectedVersion`; exclusions override pins                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Exact codes: `INVALID_REQUEST`, `UNAUTHENTICATED`, `RELATED_CONTENT_FORBIDDEN`, `RELATED_CONTENT_NOT_FOUND`, `RELATED_CONTENT_VERSION_CONFLICT`, `UNSUPPORTED_MEDIA_TYPE`, `RELATED_CONTENT_VALIDATION_FAILED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR` | `201 RelatedContentResource`; exact contract is disabled/deferred in Phase 2 and cannot claim success                                                                                                                                                                                                                                                                     | Assigned author/editor; target authorization rechecked, no arbitrary query/expression or placeholder endpoint                                                                                                                                                                                                             |
| `03b-editorial-workflow-publication.md` / `CMS-03B-10`     | `EntryCreateRequest`: `contentTypeId` and `contentTypeVersionId` resolving to the same active compiled schema with non-null activation evidence, BCP 47 `locale`, 1-128 unique stable JSON-Pointer `changedPaths`, strict stable-field-ID `values` (at most 128 keys, depth 8, 256 KiB; an `object` value is the DEC-133 depth-1 property-keyed object and a `rich_text` value is a canonical `rich_text.v1` AST) plus server-frozen `schemaArtifact`, `validatorRefs`, `workflowPolicy`, and `activationEvidence` prefilled from CMS-03B-14; strict unknown-key rejection; no caller owner, assignee, or authority                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Exact per-op 400/401/403/404/409/415/422/429/502/503/504/500 mapping from BE03b; a refused create preserves the form and fabricates no entry; a non-canonical rich-text value is 422 `rich_text_not_canonical` and an invalid object property is 422 `object_property_invalid`                                                                                                                                                                                              | One atomic idempotent commit under a required `Idempotency-Key` with no update-only `If-Match`; parsed `201 EntryCreateResource` (`entry`, `revision`, `revisionNumber`, `lifecycle`, `state`, `locale`, `contentHash`, `validationState`) replaces the draft; result heading receives focus; a replay returns the same entry and first revision with no duplicate effect | CSRF/origin, server-derived actor/owner/assignment, strict JSON, no private values or authority metadata in telemetry; browser direct table grants revoked                                                                                                                                                                |
| `03b-editorial-workflow-publication.md` / `CMS-03B-11`     | `EntryDraftDetailQuery`: `entryId` UUID plus optional BCP 47 `locale`; the GET carries no body, no `Idempotency-Key`, and no `If-Match`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Exact per-op 400/401/403/404/409/415/422/429/502/503/504/500 mapping; a concealed or absent entry is 404 and a visible-but-unassigned entry is 403 with no hidden values, ownership, or authority disclosure                                                                                                                              | `200 EntryDraftDetailResource` (`entry`, `revision`, server-derived `revisionNumber`, `schemaVersionId`, `openConflict`, `lifecycle`, `state`, `locale`, `contentHash`, `validationState`, `fields`, `relations`); read-only with no mutation and no optimistic state                                                                                                                                                                         | Assignment/read capability; `no-store` with a strong authenticated `ETag`; values are server-authorized only; `baseRevision` derives from `revisionNumber` and the composite `ETag` is never the numeric `If-Match`; browser direct table grants revoked                                                                                                                                                                         |
| `03b-editorial-workflow-publication.md` / `CMS-03B-12`     | `ConflictDetailQuery` accepts no keys; the GET carries no body, no `Idempotency-Key`, and no `If-Match`; the resource is addressed entirely by the `entryId`/`conflictId` path                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Exact per-op 400/401/403/404/415/422/429/502/503/504/500 mapping; a concealed or absent entry/conflict is 404 and a visible entry without read scope is 403 with no preimage, ownership, or authority disclosure                                                                                                                              | `200 ConflictDetailResource` with bounded, schema-typed `base`/`theirs`/`yours` `paths[]` (empty unless the conflict is `open`); each side is validated against its own `schemaVersionId`; no `resolvedByPersonId` or ownership identifier                                                                                                                                                                         | Entry read capability; `no-store` with a strong authenticated `ETag`; values are server-authorized only; preimages never cached, logged, or placed in the URL                                                                                                                                                                         |
| `03b-editorial-workflow-publication.md` / `CMS-03B-13`     | `EntryListQuery`: optional `state` (`EntryRevisionState`), optional `contentTypeId` UUID, optional signed `cursor` ≤512, `limit` 1–50 default 25; the GET carries no body, no `Idempotency-Key`, and no `If-Match`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Exact per-op 400/401/403/415/422/429/502/503/504/500 mapping; a cursor bound to a different query or read scope is 409 `cursor/context mismatch`; only the caller's assigned/owned rows are returned                                                                                                                                                                                              | `200 EntryListPage` (`items` of `RevisionSummary`, nullable signed `nextCursor`, `pageVersion`); read-only with no mutation and no optimistic state                                                                                                                                                                         | CMS author/editor read scope; `no-store` with an authenticated `ETag`; the list serializes no owner, assignee, party, or capability identifier                                                                                                                                                                         |
| `03b-editorial-workflow-publication.md` / `CMS-03B-14`     | `AuthoringContextQuery`: optional `contentTypeVersionId` UUID; the GET carries no body, no `Idempotency-Key`, and no `If-Match`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Exact per-op 400/401/403/404/415/422/429/502/503/504/500 mapping; a concealed or absent target schema is a policy-safe 404 and a visible type outside the caller's scope is 403                                                                                                                                                                                              | `200 AuthoringContextResource` (`creatableTypes`, nullable `selectedType`, `fields`); read-only preparation with no mutation and no optimistic state                                                                                                                                                                         | CMS author/editor scope; `no-store` with an authenticated `ETag`; never grants `cms.schema_registry.read`, never accepts a caller-chosen schema, and serializes no ownership identifier                                                                                                                                                                         |

## Data Mapping

Every BE operation and parsed browser-projection field is owned below. Components consume strict generated Zod-inferred browser projections; no hand-written partial DTO may silently omit a browser field. Model/RLS-only ownership metadata is stripped before browser parsing, and a field is displayed, drives explicit state/control, or is non-rendered for a named security reason.

| BE source                                  | Operation                                        | Method/path                                                                                          | Success to component                                                                                                                                                                                                                                             | Error mapping                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `03a-content-schema-registry.md`           | `CMS-03A-01` create content type draft           | `POST /api/v1/cms/content-types`                                                                     | `ContentTypeDraftRequest` → `201 ContentTypeVersionResource`; replace only after strict generated-schema validation and canonical refetch                                                                                                                        | `INVALID_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `UNSUPPORTED_MEDIA_TYPE`, `VALIDATION_FAILED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR` → form summary/field, capability, conflict, wait, degraded, or scrubbed internal state                                                                  |
| `03a-content-schema-registry.md`           | `CMS-03A-02` change field schema                 | `POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/fields`                         | `FieldSchemaChangeRequest` → `201 FieldDefinitionVersionResource`; render exact `contentTypeId`/`versionId` parent and field resource after CAS/refetch                                                                                                          | `INVALID_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `UNSUPPORTED_MEDIA_TYPE`, `VALIDATION_FAILED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR`; immutable key/lifecycle/validator/migration failures remain field-linked                                                                               |
| `03a-content-schema-registry.md`           | `CMS-03A-03` bind domain record                  | `POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/relations`                      | `RelationBindingRequest` → `201 RelationDefinitionResource`; render exact relation bounds, projection and unavailable behavior after allowlist validation                                                                                                        | `INVALID_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `UNSUPPORTED_MEDIA_TYPE`, `VALIDATION_FAILED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR`; projection/cardinality/bounds/duplicate failures never disclose target                                                                                 |
| `03a-content-schema-registry.md`           | `CMS-03A-04` activate schema version             | `POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/activate`                       | `SchemaActivationRequest` → `202 SchemaActivationResource`; render exact activation/migration/job/event plus server-frozen `activationEvidence` after strict validation                                                                                          | `INVALID_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `UNSUPPORTED_MEDIA_TYPE`, `VALIDATION_FAILED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR`; hash/policy/artifact/compatibility failures never show false success                                                                                   |
| `03a-content-schema-registry.md`           | `CMS-03A-05` / `CMS-10` register block version   | `POST /api/v1/cms/blocks/versions` (signed release worker only)                                      | Worker-only `BlockRegistrationRequest` → `201 BlockDefinitionVersionResource`; browser receives only safe `BlockDefinitionRegistryRecord` via protected reads                                                                                                    | Browser does not render release errors. `401 WEBHOOK_REJECTED` is reserved for invalid release principal/signature; all other release failures retain their exact worker status/code in non-browser telemetry; no browser retry                                                                                                                                                                              |
| `03a-content-schema-registry.md`           | `CMS-03A-08` / `CMS-10` advance block lifecycle  | `POST /api/v1/cms/blocks/versions/{blockDefinitionVersionId}/lifecycle` (signed release worker only) | Worker-only `BlockLifecycleAdvanceRequest` → `201 BlockLifecycleEventResource`; existing key/version only, append-only lifecycle event plus nonce receipt, immutable version row; browser receives only safe `BlockDefinitionRegistryRecord` via protected reads | Browser does not render release errors. `401 WEBHOOK_REJECTED` owns only invalid release principal/signature; malformed input, replay/nonce, lifecycle/version, digest, media, dependency, and internal failures retain their exact non-browser worker status/code; no browser retry or mutation                                                                                                             |
| `03a-content-schema-registry.md`           | `CMS-03A-06` protected registry list             | `GET /api/v1/cms/content-types`                                                                      | `ContentSchemaRegistryListQuery` → `200 ContentSchemaRegistryListPage`; render generated `items` union keyed by `resourceKind` and nullable opaque `nextCursor`                                                                                                  | `INVALID_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_FAILED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR`; concealed rows omitted; no 404 or mutation error exposed for row absence                                                                                                                                  |
| `03a-content-schema-registry.md`           | `CMS-03A-07` protected registry detail           | `GET /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}`                                 | Exact UUID path → `200 ContentSchemaRegistryDetail`; render generated version resource, fields, relations, compiled artifact identity, bindings, and safe block records                                                                                          | `INVALID_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR`; no query/body, no private fallback, and no mutation headers                                                                                                                                                       |
| `03a-content-schema-registry.md`           | `CMS-03A-15` grant CMS capability                | `POST /api/v1/cms/capability-grants`                                                                 | `CapabilityGrantRequest` → `201 CmsCapabilityGrantResource`; replace only after strict generated-schema validation and canonical list refetch                                                                                                                    | `INVALID_REQUEST`, `UNAUTHENTICATED`, `STEP_UP_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `UNSUPPORTED_MEDIA_TYPE`, `VALIDATION_FAILED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR` → form summary/field, inline step-up, capability gate, non-disclosing refusal, conflict, wait, degraded, or scrubbed internal state |
| `03a-content-schema-registry.md`           | `CMS-03A-16` renew CMS capability grant          | `POST /api/v1/cms/capability-grants/{grantId}/renewals`                                              | `CapabilityGrantRenewalRequest` → `200 CmsCapabilityGrantResource`; render the restarted term after CAS and list refetch                                                                                                                                         | Same set as `CMS-03A-15`; stale or revoked grants render the refetched row beside preserved input                                                                                                                                                                                                                                                                                                            |
| `03a-content-schema-registry.md`           | `CMS-03A-17` revoke CMS capability grant         | `POST /api/v1/cms/capability-grants/{grantId}/revocations`                                           | `CapabilityGrantRevocationRequest` → `200 CmsCapabilityGrantResource`; render the `revoked` row after CAS and list refetch                                                                                                                                       | Same set as `CMS-03A-15`; stale or already revoked grants render the refetched row                                                                                                                                                                                                                                                                                                                           |
| `03a-content-schema-registry.md`           | `CMS-03A-18` protected CMS capability grant list | `GET /api/v1/cms/capability-grants`                                                                  | `CmsCapabilityGrantListQuery` → `200 CmsCapabilityGrantListPage`; render `items` and nullable opaque `nextCursor`                                                                                                                                                | `INVALID_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_FAILED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR`; no mutation headers and no `NOT_FOUND`                                                                                                                                                                    |
| `03b-editorial-workflow-publication.md`    | `CMS-03B-01` create revision                     | `POST /api/v1/cms/entries/{entryId}/revisions`                                                       | `EntryRevisionRequest` → `201 EntryRevisionResource`; canonical refetch after CAS/idempotency                                                                                                                                                                    | 400 malformed path/header/body; 401 missing/expired session; 403 assignment/edit; 404 hidden entry; 409 stale base/version/conflict/idempotency; 415 non-JSON; 422 field/schema/value; 429 author-write limit; 502/503/504 schema/RPC; 500 scrubbed                                                                                                                                                          |
| `03b-editorial-workflow-publication.md`    | `CMS-03B-02` resolve conflict                    | `POST /api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve`                                  | `ConflictResolutionRequest` → `201 EntryRevisionResource`; explicit choices, both parents preserved                                                                                                                                                              | 400 malformed IDs/header/body; 401 missing/expired session; 403 resolve; 404 hidden conflict; 409 moved base/invalid choice/idempotency; 415 non-JSON; 422 choice/value; 429 conflict-write; 502/503/504 RPC; 500 scrubbed                                                                                                                                                                                   |
| `03b-editorial-workflow-publication.md`    | `CMS-03B-03` revision history                    | `GET /api/v1/cms/entries/{entryId}/revisions`                                                        | `RevisionHistoryQuery` → `200 RevisionHistoryPage`; no body, `Idempotency-Key`, or `If-Match`; no-store                                                                                                                                                          | 400 malformed path/query/cursor; 401 missing/expired session; 403 read scope; 404 hidden entry/revision; 409 cursor/context; 415 unsupported media; 422 query bounds; 429 read limit; 502/503/504 read dependency; 500 scrubbed                                                                                                                                                                              |
| `03b-editorial-workflow-publication.md`    | `CMS-03B-04` restore revision                    | `POST /api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore`                                  | `RevisionRestoreRequest` → `201 EntryRevisionResource`; new draft only                                                                                                                                                                                           | 400 malformed IDs/header/body; 401 missing/expired session; 403 edit; 404 hidden revision; 409 stale version/migration/idempotency; 415 non-JSON; 422 restore; 429 restore limit; 502/503/504 migration/RPC; 500 scrubbed                                                                                                                                                                                    |
| `03b-editorial-workflow-publication.md`    | `CMS-03B-05` submit review                       | `POST /api/v1/cms/entries/{entryId}/reviews`                                                         | `ReviewSubmissionRequest` → `201 EditorialReviewResource`; frozen policy/dependency evidence                                                                                                                                                                     | 400 malformed IDs/header/body; 401 missing/expired session; 403 submit/assignment; 404 hidden entry/revision; 409 open review/hash/dependency/idempotency; 415 non-JSON; 422 manifest/risk; 429 review-write; 502/503/504 preflight/RPC; 500 scrubbed                                                                                                                                                        |
| `03b-editorial-workflow-publication.md`    | `CMS-03B-06` record decision                     | `POST /api/v1/cms/reviews/{reviewId}/decision`                                                       | `EditorialDecisionRequest` → `200 EditorialReviewResource`; append-only decision                                                                                                                                                                                 | 400 malformed ID/header/body; 401 missing/expired or step-up MFA; 403 reviewer/capability; 404 hidden review; 409 stale/duplicate/hash/idempotency; 415 non-JSON; 422 decision/reason; 429 decision limit; 502/503/504 RPC; 500 scrubbed                                                                                                                                                                     |
| `03b-editorial-workflow-publication.md`    | `CMS-03B-07` schedule publication                | `POST /api/v1/cms/publication-schedules`                                                             | `PublicationScheduleRequest` → `202 PublicationScheduleResource`; pending/queued only                                                                                                                                                                            | 400 malformed IDs/header/body; 401 missing/expired or step-up MFA; 403 publisher; 404 hidden target; 409 schedule collision/stale/idempotency; 415 non-JSON; 422 time/tzdb/action; 429 schedule limit; 502/503/504 preflight/RPC; 500 scrubbed                                                                                                                                                               |
| `03b-editorial-workflow-publication.md`    | `CMS-03B-08` mint preview token                  | `POST /api/v1/cms/previews`                                                                          | `PreviewRequest` → `201 PreviewTokenResource`; token is bounded/no-store/noindex                                                                                                                                                                                 | 400 malformed body/path/version set; 401 missing/expired session; 403 preview; 404 hidden target; 409 stale version set/idempotency; 415 non-JSON; 422 route/audience/version; 429 preview limit; 502/503/504 schema/RPC; 500 scrubbed                                                                                                                                                                       |
| `03b-editorial-workflow-publication.md`    | `CMS-03B-09` publish revision                    | `POST /api/v1/cms/publications`                                                                      | `PublicationRequest` → `202 PublicationResource`; pending/projection state only                                                                                                                                                                                  | 400 malformed IDs/header/body; 401 missing/expired or step-up MFA; 403 publisher/review gate; 404 hidden target; 409 frozen hash/set/version/state/idempotency; 415 non-JSON; 422 publication; 429 publish limit; 502/503/504 projection/RPC; 500 scrubbed                                                                                                                                                   |
| `03c-composition-taxonomy-localization.md` | `CMS-03C-01` define template                     | `POST /api/v1/cms/templates/versions`                                                                | `TemplateVersionRequest` → `201 TemplateVersionResource`; server block digest                                                                                                                                                                                    | 400 `INVALID_REQUEST`; 401 `UNAUTHENTICATED`; 403 `TEMPLATE_FORBIDDEN`; 404 `TEMPLATE_NOT_FOUND`; 409 `TEMPLATE_VERSION_CONFLICT`; 415 `UNSUPPORTED_MEDIA_TYPE`; 422 `TEMPLATE_VALIDATION_FAILED`; 429 `RATE_LIMITED`; 502/503/504 `DEPENDENCY_UNAVAILABLE`; 500 `INTERNAL_ERROR`                                                             |
| `03c-composition-taxonomy-localization.md` | `CMS-03C-02` use pattern                         | `POST /api/v1/cms/compositions/pattern-instances`                                                    | `PatternInstanceRequest` → `201 CompositionInstanceResource`; linked/detached conflict state                                                                                                                                                                     | 400 `INVALID_REQUEST`; 401 `UNAUTHENTICATED`; 403 `COMPOSITION_FORBIDDEN`; 404 `COMPOSITION_NOT_FOUND`; 409 `COMPOSITION_VERSION_CONFLICT`; 415 `UNSUPPORTED_MEDIA_TYPE`; 422 `COMPOSITION_VALIDATION_FAILED`; 429 `RATE_LIMITED`; 502/503/504 `DEPENDENCY_UNAVAILABLE`; 500 `INTERNAL_ERROR`                                                 |
| `03c-composition-taxonomy-localization.md` | `CMS-03C-03` govern taxonomy                     | `POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions`                                             | `TaxonomyTermActionRequest` → `200 TaxonomyTermResource`; merge survivor redirect                                                                                                                                                                                | 400 `INVALID_REQUEST`; 401 `UNAUTHENTICATED`; 403 `TAXONOMY_FORBIDDEN`; 404 `TAXONOMY_NOT_FOUND`; 409 `TAXONOMY_VERSION_CONFLICT`; 415 `UNSUPPORTED_MEDIA_TYPE`; 422 `TAXONOMY_VALIDATION_FAILED`; 429 `RATE_LIMITED`; 502/503/504 `DEPENDENCY_UNAVAILABLE`; 500 `INTERNAL_ERROR`                                                             |
| `03c-composition-taxonomy-localization.md` | `CMS-03C-04` author locale variant               | `POST /api/v1/cms/entries/{entryId}/locales/{locale}/variants`                                       | `LocaleVariantRequest` → `201 LocaleVariantResource`; exact contract, runtime deferred in Phase 2                                                                                                                                                                | 400 `INVALID_REQUEST`; 401 `UNAUTHENTICATED`; 403 `LOCALE_FORBIDDEN`; 404 `LOCALE_SOURCE_NOT_FOUND`; 409 `LOCALE_VERSION_CONFLICT`; 415 `UNSUPPORTED_MEDIA_TYPE`; 422 `LOCALE_VALIDATION_FAILED`; 429 `RATE_LIMITED`; 502/503/504 `DEPENDENCY_UNAVAILABLE`; 500 `INTERNAL_ERROR`                                                              |
| `03c-composition-taxonomy-localization.md` | `CMS-03C-05` curate related content              | `POST /api/v1/cms/entries/{entryId}/related-content`                                                 | `RelatedContentRuleRequest` → `201 RelatedContentResource`; exact contract, runtime deferred in Phase 2                                                                                                                                                          | 400 `INVALID_REQUEST`; 401 `UNAUTHENTICATED`; 403 `RELATED_CONTENT_FORBIDDEN`; 404 `RELATED_CONTENT_NOT_FOUND`; 409 `RELATED_CONTENT_VERSION_CONFLICT`; 415 `UNSUPPORTED_MEDIA_TYPE`; 422 `RELATED_CONTENT_VALIDATION_FAILED`; 429 `RATE_LIMITED`; 502/503/504 `DEPENDENCY_UNAVAILABLE`; 500 `INTERNAL_ERROR`                                 |
| `03b-editorial-workflow-publication.md`    | `CMS-03B-10` create entry                        | `POST /api/v1/cms/entries`                                                                           | `EntryCreateRequest` → `201 EntryCreateResource`; atomic active entry plus first draft revision with no prior base revision                                                                                                                                      | 400 malformed body/header; 401 missing/expired session; 403 create capability; 404 concealed target; 409 replayed create/idempotency; 415 non-JSON; 422 content-type/version/locale/paths/values; 429 author-write limit; 502/503/504 schema/RPC dependency; 500 scrubbed                                                                                                                                    |
| `03b-editorial-workflow-publication.md`    | `CMS-03B-11` read draft detail                   | `GET /api/v1/cms/entries/{entryId}`                                                                  | `EntryDraftDetailQuery` → `200 EntryDraftDetailResource`; authorized editable values only, `no-store`, no body                                                                                                                                                   | 400 malformed path/query; 401 missing/expired session; 403 read scope or unassigned; 404 concealed/absent entry; 409 cursor/context mismatch; 415 unsupported media; 422 locale bounds; 429 read limit; 502/503/504 read dependency; 500 scrubbed                                                                                                                                                            |
| `03b-editorial-workflow-publication.md`    | `CMS-03B-12` read conflict detail              | `GET /api/v1/cms/entries/{entryId}/conflicts/{conflictId}`                                          | `ConflictDetailQuery` → `200 ConflictDetailResource`; bounded three-way preimages only while the conflict is `open`, `no-store`, no body                                                                                                                                                   | 400 malformed path; 401 missing/expired session; 403 entry read scope; 404 concealed/absent entry/conflict; 415 unsupported media; 422 path/preimage bounds; 429 read limit; 502/503/504 read dependency; 500 scrubbed                                                                                                                                                            |
| `03b-editorial-workflow-publication.md`    | `CMS-03B-13` list entries                      | `GET /api/v1/cms/entries`                                                                          | `EntryListQuery` → `200 EntryListPage`; only the caller's assigned/owned entries, signed cursor, `no-store`, no body                                                                                                                                                   | 400 malformed query/cursor; 401 missing/expired session; 403 read scope; 409 cursor/context mismatch; 415 unsupported media; 422 query bounds; 429 read limit; 502/503/504 read dependency; 500 scrubbed; concealed rows omitted (no `NOT_FOUND`)                                                                                                                                                            |
| `03b-editorial-workflow-publication.md`    | `CMS-03B-14` authoring context                | `GET /api/v1/cms/entries/authoring-context`                                                         | `AuthoringContextQuery` → `200 AuthoringContextResource`; author-safe creatable types and field-definition projection, `no-store`, no body                                                                                                                                                   | 400 malformed query; 401 missing/expired session; 403 author/editor scope; 404 concealed/absent target schema; 415 unsupported media; 422 response bounds; 429 read limit; 502/503/504 read dependency; 500 scrubbed                                                                                                                                                            |

### Response field ownership

| BE source                                  | Contract schemas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Parsed field set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | UI ownership                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `03a-content-schema-registry.md`           | Browser contracts: `ContentTypeResource`, `ContentTypeVersionResource`, `FieldDefinitionVersionResource`, `RelationDefinitionResource`, `SchemaArtifactResource`, `SchemaActivationResource`, `BlockDefinitionRegistryRecord`, `TemplateBindingResource`, `CapabilityBindingResource`, `ContentSchemaRegistryListPage`, `ContentSchemaRegistryDetail`; worker contracts: `BlockRegistrationRequest`, `BlockDefinitionVersionResource`, `BlockLifecycleAdvanceRequest`, `BlockLifecycleEventResource`                                                                                                                                                     | Browser-safe fields: `resourceKind`, `id`, `version`, `state`, `contentHash`, `createdAt`, `updatedAt`, `typeKey`, `builtIn`, `lifecycle`, `contentTypeId`, `label`, `ownerCapability`, `sourceLocale`, `defaultLocale`, `workflowKey`, `workflowVersion`, `defaultTemplateVersionId`, `schemaArtifactId`, `fieldCount`, `relationCount`, `capabilityBindingCount`, `compatibility`, `dryRunId`, `activationEvidence`, `activatedAt`, `migrationPlanId`, `jobId`, `eventType`, `contentTypeVersionId`, `stableFieldId`, `key`, `kind`, `required`, `validatorKey`, `validatorVersion`, `defaultMode`, `localizationMode`, `fieldId`, `targetKind`, `targetType`, `projectionKey`, `cardinality`, `min`, `max`, `ordered`, `onUnavailable`, `compilerVersion`, `zodContractRef`, `artifactHash`, `compiledAt`, `blockKey`, `blockVersion`, `propsSchemaRef`, `propsSchemaHash`, `rendererRef`, `releaseDigest`, `templateVersionId`, `position`, `capabilityKey`, `capabilityVersion`, `items`, `nextCursor`, `resource`, `fields`, `relations`, `schemaArtifact`, `templateBindings`, `capabilityBindings`, `blockDefinitions`; `activationEvidence` is read-only `{key, version, policyHash, riskClass, requiredDecisionCount, requiredCapabilities, approvalEvidenceHash}`. The complete worker-only A08 event field set is `resourceKind`, `id`, `version`, `blockDefinitionVersionId`, `blockKey`, `blockVersion`, `fromLifecycle`, `toLifecycle`, `lifecycle`, `releaseDigest`, `releaseKeyId`, `releaseNonceHash`, `releaseVerifiedAt`, `eventType`, and `createdAt`; it never crosses into browser state. | The workbench renders list/detail identity, state, lifecycle, definitions, relation policy, artifact identity, server-frozen activation evidence, and safe block records. It never parses or stores `BlockDefinitionVersionResource`, `BlockLifecycleEventResource`, release headers, raw body, props snapshot/signature, release hashes, verification timestamps, ownership IDs, or executable content.                                                                                                                                                                                                                                                         |
| `03a-content-schema-registry.md` (DEC-119) | `CapabilityGrantRequest`, `CapabilityGrantRenewalRequest`, `CapabilityGrantRevocationRequest`, `CmsCapabilityGrantResource`, `CmsCapabilityGrantListQuery`, `CmsCapabilityGrantListPage`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `subjectPersonId`, `capability`, `validThrough`, `reason`, `expectedVersion`, `id`, `version`, `contentHash`, `createdAt`, `updatedAt`, `resourceKind`, `state`, `validFrom`, `endsAt`, `lastAction`, `items`, `nextCursor`, `limit`, `cursor`, `sort`, `direction`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Table and forms display every field except `contentHash` (change detection only) and `resourceKind` (strict discriminator); `expectedVersion` is derived from the row `version` and sent as `If-Match`; `state` renders as `Active`, `Lapsed` or `Revoked` text plus icon; grantor, actor, party and binding identifiers do not exist in the projection                                                                                                                                                                                                                                                                                                          |
| `03b-editorial-workflow-publication.md`    | `EntryRevisionRequest`, `ConflictResolutionRequest`, `RevisionHistoryQuery`, `RevisionRestoreRequest`, `ReviewSubmissionRequest`, `EditorialDecisionRequest`, `PublicationScheduleRequest`, `PreviewRequest`, `PublicationRequest`, `EntryRevisionResource`, `EditorialReviewResource`, `PublicationScheduleResource`, `PreviewTokenResource`, `PublicationResource`, `RevisionHistoryPage`, `SchemaArtifactEvidence`, `ValidatorEvidence`, `WorkflowPolicyEvidence`, `VersionSet`, `DependencyManifest`, `EntryCreateRequest`, `EntryCreateResource`, `EntryDraftDetailQuery`, `EntryDraftDetailResource`, `EntryDraftFieldValue`, `EntryDraftRelation`, `ConflictDetailQuery`, `ConflictDetailResource`, `ConflictDetailPath`, `ConflictDetailSide`, `EntryListQuery`, `EntryListPage`, `AuthoringContextQuery`, `AuthoringContextResource`, `AuthoringContextType`, `AuthoringContextField`, `ObjectStructure`, `ObjectProperty`, `RichTextV1` | `id`, `version`, `state`, `createdAt`, `updatedAt`, `entryId`, `revisionNumber`, `schemaVersionId`, `openConflict`, `templateVersionId`, `taxonomyVersionIds`, `locale`, `contentHash`, `parentRevisionIds`, `validationState`, `conflictId`, `riskClass`, `workflowPolicy`, `activationEvidence`, `frozenHash`, `requiredDecisionCount`, `recordedDecisionCount`, `dependencyHash`, `invalidatedReason`, `action`, `localDateTime`, `timezone`, `resolvedUtc`, `tzdbVersion`, `jobId`, `actualUtc`, `deviationSeconds`, `token` (one-time), `expiresAt`, `audience`, `route`, `versionSet`, `revoked`, `publicationVersionId`, `publicationHash`, `projectionState`, `eventType`, `authorClass`, `items`, `nextCursor`, `pageVersion`, `compare`, `restore`, `migrationChainId`, `edgeCount`, `chainHash`, `availability`, `leftRevisionId`, `rightRevisionId`, `changes`, `domain`, `path`, `kind`, `leftHash`, `rightHash`, `targetToken`, `base`, `theirs`, `yours`, `changedPaths`, `conflictHash`, `resolvedRevisionId`, `provenance`, `paths`, `creatableTypes`, `selectedType`, `contentTypeVersionId`, `schemaArtifact`, `validatorRefs`, `label`, `sourceLocale`, `defaultLocale`, `supportedLocales`, `stableFieldId`, `kind`, `constraints`, `required`, `defaultMode`, `defaultValue`, `localizationMode`, `editorConfig`, `relationDefinition`, `properties`, `format`, `blocks`, `spans`, `marks`, `link`, `level`, `list`, `depth`, `text`, plus request-only control fields owned by named forms, `entry`, `revision`, `lifecycle`, `fields`, `relations`, `value`, `valueHash`, `fieldDefinitionId`, `position`, `expectedTargetVersion`, `unavailable` | Each operation owns its named request and response: revision/review/schedule/publication fields render in the workflow workbench; `activationEvidence`/`workflowPolicy` are server-frozen read-only facts; preview `token` is displayed once and never persisted. The entry list, authoring context, draft identity, conflict preimages and restore chain are all server-derived and read-only. DB-only ownership/person IDs, edit-presence lease fields, private content values, review comments, and authority metadata never enter browser state. The entry-bootstrap and draft-detail boundaries serialize only server-authorized values: owner, assignee, acting party, capability snapshots, and the collision-derived `resolvedRevisionId` stay owner/RLS-only; the D2 conflict preimages stay bounded and are omitted (never placeholdered) when the caller cannot read them; the `object` and `rich_text.v1` values are displayed through the typed components and never as raw JSON or HTML. |
| `03c-composition-taxonomy-localization.md` | `TemplateVersionRequest`, `PatternInstanceRequest`, `TaxonomyTermActionRequest`, `LocaleVariantRequest`, `RelatedContentRuleRequest`, `BlockDefinitionRegistryRecord`, `TemplateVersionResource`, `CompositionInstanceResource`, `TaxonomyTermResource`, `LocaleVariantResource`, `RelatedContentResource`                                                                                                                                                                                                                                                                                                                                               | `id`, `version`, `state`, `contentHash`, `createdAt`, `updatedAt`, `resourceKind`, `templateKey`, `templateVersion`, `compatibleTypeIds`, `reservedRegions`, `blockRegistryDigest`, `revisionId`, `path`, `blockKey`, `blockVersion`, `patternId`, `patternVersion`, `linkMode`, `conflictState`, `lifecycle`, `taxonomyId`, `termId`, `termKey`, `parentId`, `successorId`, `entryId`, `locale`, `sourceRevisionId`, `fallbackChain`, `noFallbackFieldIds`, `sourceEntryId`, `pins`, `exclusions`, `derivedRule`, `eligibleCount`, and nested request fields `slots`, `bindings`, `projection`, `required`, `allowedBlocks`, `maxCount`, `overrides`, `fields`, `fieldId`, `value`, `sourceHash`, `reasonCode`, `maxCandidates`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Template/pattern/taxonomy/locale/related-content workbenches own their exact generated resources. Safe block records are the only block metadata accepted; owner IDs, block snapshots/signatures, release principals, private labels/text, and target identity outside an authorized projection never serialize.                                                                                                                                                                                                                                                                                                                                                 |

The named BE resource models may carry `ownerId` for persistence/RLS, but strict
browser projections strip it before parsing; it is never a Workbench prop or
browser field. The 03c `state` field uses closed resource-specific subsets:
template/pattern/taxonomy versions `draft | review | approved | scheduled | active |
superseded | retired | blocked`; composition `draft | active | pending_diff |
superseded | retired`; locale `untranslated | draft | review | approved | stale`; and
related-content `active | revoked`. `TaxonomyTermResource.lifecycle` remains the
separate `active | deprecated | merged` lifecycle.

The DEC-108 private review records are CMS-owned, not the settings-owned CFG
ledger; the browser sees only the safe projections. `SchemaReviewResource.state`
uses the closed subset `open | approved | rejected | invalidated` and
`riskClass` uses `ordinary | protected`. `SchemaReviewAssignmentResource.state`
uses `active | revoked` and its `actions` are exactly `['read','decide']`.
Private matching identifiers — the submitter, reviewer and grantor person/actor
identities and the private binding id — never appear in any browser union, prop,
URL, telemetry event or log. `SchemaReviewAssignmentRequest.reviewerPersonId` is
an authorized request reference and is never echoed into a resource; the opaque
`reviewId` and `assignmentId` are the only review and assignment identifiers the
browser holds or sends.
The island context evidence is display-only (label plus expiring step-up) and is
never an owner, binding, or matching identifier; the stable actor/person/party/
binding projection stays entirely server-side.

The DEC-119 grant resource `CmsCapabilityGrantResource.state` uses the derived
closed set `active | lapsed | revoked`, where `lapsed` is an expiry the server
derives from `validThrough` and the browser never computes from its own clock.
`subjectPersonId` is returned only to the owner who supplied it and is displayed
only inside the owner-only island; the grantor and private binding identifiers
never reach the browser, and `GrantableCmsCapability` is the generated closed set
with no free-text capability.

For CMS-03A-05 the worker-only non-safe response fields are
`propsSchemaSnapshot`, `propsSnapshotHash`, `propsSnapshotAttestation` (with
`algorithm`, attestation `keyId`, and attestation `signature`),
snapshot `schemaVersion`, `fields`, `name`, and `additionalProperties`, plus
`allowedChildren`, `slotRules`, `maxDepth`, `maxNodes`, `dataSourcePermissions`, `accessibility`,
`nameRequired`, `keyboard`, `focusOrder`, `statusAnnouncement`,
`minSchemaCompiler`, and `maxSchemaCompiler`,
`releaseKeyId`, `releaseRawBodyHash`, `releaseSignatureHash`,
`releaseNonceHash`, and `releaseVerifiedAt`; for CMS-03A-08 the complete event
field set is listed above. `WorkerOnlyReleaseEnvelopeField` is a telemetry and
contract-test inventory only and is never a Workbench prop. None of these
fields is parsed, exposed, persisted, or sent by a browser component.

### Exhaustive BE field and error ownership

The unions below are generated from every browser-visible contract identifier in each
complete BE source, not a representative sample. Request-only identifiers remain
because their owning form consumes them; response identifiers remain because the
workbench renders them or uses them for explicit state/control. Database-only
columns such as `owner_id`, `release_principal_id`, `created_at`, `updated_at`,
lease fields, and private identity IDs are deliberately excluded from browser
unions and are owned by server/RLS or release-worker telemetry. Full release
headers, raw body/snapshot, signatures, and verification evidence are likewise
worker-only. Generated Zod types remain normative; a non-browser field is never
silently serialized merely to satisfy a mechanical field inventory.

The reconciliation also records non-browser identifiers that must remain outside
the unions: `cms_release_nonce_receipts`, `cms_content_types`,
`cms_content_type_versions`, `cms_content_type_template_bindings`,
`cms_content_type_capability_bindings`, `cms_field_definition_versions`,
`cms_relation_definitions`, `cms_schema_migration_plans`, `cms_schema_artifacts`,
`cms_block_definition_versions`, `cms_block_definition_lifecycle_events`,
`schema_artifact_id`, physical block `registered` state, `BlockDefinitionVersion`,
`ownerId`, `EditPresence`, `lease_until`, and `last_seen_at`. Resource states
that are browser-visible are enumerated by `EditorialWorkflowPublicationState`
below; editorial physical-only states include `archived`, `deletion_pending`,
`held`, `expired`, and `recorded`. `ResourceKindLifecycle` and the attestation
`algorithm` (`Ed25519`) are validation/worker identifiers, not browser authority.

The entry-bootstrap and draft-detail additions introduce no browser authority:
`ContentEntry.owner_id`, the server-derived assignment/assignee, the acting
party, and the capability snapshot stay owner/RLS-only and never enter
`EntryCreateRequest`, `EntryCreateResource`, or `EntryDraftDetailResource`,
client props, URL state, or optimistic state; the browser holds no direct
table grant for entries or revisions.

The 03b resources bind exact closed state subsets: `EntryRevisionResource` uses
`draft | submitted | approved | rejected | scheduled | published`;
`EditorialReviewResource` uses `open | approved | rejected | invalidated`;
`PublicationScheduleResource` uses `pending | executing | completed |
failed_retryable | blocked | cancelled`; and `PublicationResource` uses
`active | superseded | revoked | pending`.

```ts
/** Cross-layer browser vocabulary; each source binds a closed subset. */
type EditorialWorkflowPublicationState =
  | 'draft'
  | 'review'
  | 'open'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'invalidated'
  | 'scheduled'
  | 'published'
  | 'pending'
  | 'executing'
  | 'completed'
  | 'failed_retryable'
  | 'blocked'
  | 'cancelled'
  | 'active'
  | 'superseded'
  | 'retired'
  | 'revoked'
  | 'pending_diff'
  | 'untranslated'
  | 'stale';

type CompositionTaxonomyLocalizationState =
  | 'draft'
  | 'review'
  | 'approved'
  | 'scheduled'
  | 'active'
  | 'superseded'
  | 'retired'
  | 'blocked'
  | 'pending_diff'
  | 'untranslated'
  | 'stale'
  | 'revoked';

// `TaxonomyTermResource.lifecycle` is the separate closed
// `active | deprecated | merged` lifecycle, not a state alias.
```

```ts
type ContentSchemaRegistryContractField =
  | 'resourceKind'
  | 'id'
  | 'version'
  | 'state'
  | 'contentHash'
  | 'createdAt'
  | 'updatedAt'
  | 'typeKey'
  | 'builtIn'
  | 'lifecycle'
  | 'contentTypeId'
  | 'versionId'
  | 'schemaVersionId'
  | 'label'
  | 'ownerCapability'
  | 'sourceLocale'
  | 'defaultLocale'
  | 'supportedLocales'
  | 'fallbackChains'
  | 'localeConfigHash'
  | 'workflowKey'
  | 'workflowVersion'
  | 'defaultTemplateVersionId'
  | 'schemaArtifactId'
  | 'fieldCount'
  | 'relationCount'
  | 'capabilityBindingCount'
  | 'compatibility'
  | 'dryRunId'
  | 'expectedActivationEvidenceHash'
  | 'activationEvidence'
  | 'policyHash'
  | 'riskClass'
  | 'requiredDecisionCount'
  | 'requiredCapabilities'
  | 'approvalEvidenceHash'
  | 'contentTypeVersionId'
  | 'stableFieldId'
  | 'key'
  | 'kind'
  | 'constraints'
  | 'minLength'
  | 'maxLength'
  | 'minimum'
  | 'maximum'
  | 'enumValues'
  | 'itemKind'
  | 'required'
  | 'validatorKey'
  | 'validatorVersion'
  | 'defaultMode'
  | 'defaultValue'
  | 'localizationMode'
  | 'editorConfig'
  | 'helpText'
  | 'order'
  | 'migrationPlanId'
  | 'fieldId'
  | 'targetKind'
  | 'targetType'
  | 'projectionKey'
  | 'cardinality'
  | 'min'
  | 'max'
  | 'ordered'
  | 'onUnavailable'
  | 'compilerVersion'
  | 'zodContractRef'
  | 'artifactHash'
  | 'compiledAt'
  | 'blockKey'
  | 'blockVersion'
  | 'propsSchemaRef'
  | 'propsSchemaHash'
  | 'fields'
  | 'rendererRef'
  | 'releaseDigest'
  | 'activatedAt'
  | 'jobId'
  | 'eventType'
  | 'templateVersionId'
  | 'position'
  | 'capabilityKey'
  | 'capabilityVersion'
  | 'items'
  | 'nextCursor'
  | 'resource'
  | 'relations'
  | 'schemaArtifact'
  | 'templateBindings'
  | 'capabilityBindings'
  | 'blockDefinitions'
  | 'keyPrefix'
  | 'cursor'
  | 'sort'
  | 'direction'
  | 'expectedVersion'
  | 'approvalIds'
  | 'code'
  | 'message'
  | 'requestId'
  | 'details'
  | 'recoveryAction'
  | 'reasonCode'
  | 'currentVersion'
  | 'retryAfterSeconds'
  | 'limit'
  | 'resetAt'
  | 'dependencyClass'
  | 'retryable';
interface ContentSchemaRegistryWorkbenchContractFields {
  source: '03a-content-schema-registry.md';
  fields: Readonly<
    Partial<Record<ContentSchemaRegistryContractField, unknown>>
  >;
}

type ContentSchemaRegistryDiscriminant =
  | 'content_type'
  | 'content_type_version'
  | 'field_definition_version'
  | 'relation_definition'
  | 'schema_artifact'
  | 'block_definition_registry_record'
  | 'template_binding'
  | 'capability_binding'
  | 'active'
  | 'retired'
  | 'deprecated'
  | 'supported'
  | 'withdrawn'
  | 'draft'
  | 'review'
  | 'approved'
  | 'scheduled'
  | 'superseded'
  | 'blocked'
  | 'many'
  | 'OpaqueRelationPlaceholder'
  | 'reason';

type OpaqueRelationPlaceholder = {
  status: 'unavailable';
  reason: 'unavailable';
};

/**
 * Worker telemetry/contract-test inventory only. This type is never used by
 * `ContentSchemaRegistryWorkbenchProps` or any browser component prop.
 */
type WorkerOnlyReleaseEnvelopeField =
  | 'ReleaseEnvelopeHeaders'
  | 'keyId'
  | 'issuedAt'
  | 'nonce'
  | 'signature'
  | 'releaseKeyId'
  | 'releaseRawBodyHash'
  | 'releaseSignatureHash'
  | 'releaseNonceHash'
  | 'releaseVerifiedAt'
  | 'BlockLifecycleAdvanceRequest'
  | 'BlockLifecycleEventResource'
  | 'resourceKind'
  | 'id'
  | 'version'
  | 'blockDefinitionVersionId'
  | 'blockKey'
  | 'blockVersion'
  | 'propsSchemaSnapshot'
  | 'propsSnapshotHash'
  | 'propsSnapshotAttestation'
  | 'schemaVersion'
  | 'fields'
  | 'name'
  | 'additionalProperties'
  | 'allowedChildren'
  | 'slotRules'
  | 'maxDepth'
  | 'maxNodes'
  | 'dataSourcePermissions'
  | 'accessibility'
  | 'nameRequired'
  | 'keyboard'
  | 'focusOrder'
  | 'statusAnnouncement'
  | 'minSchemaCompiler'
  | 'maxSchemaCompiler'
  | 'algorithm'
  | 'fromLifecycle'
  | 'toLifecycle'
  | 'lifecycle'
  | 'expectedVersion'
  | 'releaseDigest'
  | 'eventType'
  | 'createdAt';
```

```ts
type CmsCapabilityGrantContractField =
  | 'subjectPersonId'
  | 'capability'
  | 'validThrough'
  | 'reason'
  | 'expectedVersion'
  | 'grantId'
  | 'resourceKind'
  | 'id'
  | 'version'
  | 'contentHash'
  | 'createdAt'
  | 'updatedAt'
  | 'state'
  | 'validFrom'
  | 'endsAt'
  | 'lastAction'
  | 'items'
  | 'nextCursor'
  | 'limit'
  | 'cursor'
  | 'sort'
  | 'direction'
  | 'code'
  | 'message'
  | 'requestId'
  | 'details'
  | 'recoveryAction'
  | 'allowedMethods'
  | 'reasonCode'
  | 'currentVersion'
  | 'retryAfterSeconds'
  | 'resetAt'
  | 'dependencyClass'
  | 'retryable';

interface CmsCapabilityGrantConsoleContractFields {
  source: '03a-content-schema-registry.md';
  fields: Readonly<Partial<Record<CmsCapabilityGrantContractField, unknown>>>;
}
```

```ts
type EditorialWorkflowPublicationContractField =
  | 'id'
  | 'version'
  | 'state'
  | 'createdAt'
  | 'updatedAt'
  | 'locale'
  | 'RelationDefinition'
  | 'targetKind'
  | 'targetType'
  | 'projectionKey'
  | 'cardinality'
  | 'min'
  | 'max'
  | 'ordered'
  | 'onUnavailable'
  | 'omit'
  | 'block'
  | 'placeholder'
  | 'schemaHash'
  | 'schemaArtifact'
  | 'compilerVersion'
  | 'contentTypeVersionId'
  | 'activationEvidence'
  | 'policyHash'
  | 'requiredCapabilities'
  | 'approvalEvidenceHash'
  | 'key'
  | 'requiredDecisionCount'
  | 'SchemaArtifact'
  | 'artifactHash'
  | 'zodContractRef'
  | 'schemaVersionId'
  | 'validatorRefs'
  | 'workflowPolicy'
  | 'templateVersionId'
  | 'templateHash'
  | 'taxonomyVersionIds'
  | 'blockVersionIds'
  | 'patternVersionIds'
  | 'settingsVersion'
  | 'schema'
  | 'hash'
  | 'template'
  | 'blocks'
  | 'patterns'
  | 'terms'
  | 'localeSources'
  | 'settings'
  | 'relations'
  | 'checker'
  | 'entryId'
  | 'baseRevision'
  | 'changedPaths'
  | 'values'
  | 'expectedVersion'
  | 'conflictId'
  | 'choices'
  | 'cursor'
  | 'limit'
  | 'compareRevisionId'
  | 'revisionId'
  | 'migrationChainId'
  | 'frozenHash'
  | 'dependencyManifest'
  | 'reviewId'
  | 'decision'
  | 'reason'
  | 'action'
  | 'localDateTime'
  | 'timezone'
  | 'resolvedUtc'
  | 'tzdbVersion'
  | 'disambiguation'
  | 'audience'
  | 'route'
  | 'versionSet'
  | 'expectedVersionSet'
  | 'revisionNumber'
  | 'contentHash'
  | 'parentRevisionIds'
  | 'validationState'
  | 'riskClass'
  | 'frozenHash'
  | 'recordedDecisionCount'
  | 'dependencyHash'
  | 'invalidatedReason'
  | 'jobId'
  | 'actualUtc'
  | 'deviationSeconds'
  | 'token'
  | 'expiresAt'
  | 'revoked'
  | 'publicationVersionId'
  | 'publicationHash'
  | 'projectionState'
  | 'eventType'
  | 'authorClass'
  | 'items'
  | 'nextCursor'
  | 'pageVersion'
  | 'compare'
  | 'leftRevisionId'
  | 'rightRevisionId'
  | 'changes'
  | 'path'
  | 'kind'
  | 'leftHash'
  | 'rightHash'
  | 'contentTypeId'
  | 'title'
  | 'entry'
  | 'draft'
  | 'lifecycle'
  | 'schemaIdentity'
  | 'fieldProvenance'
  | 'canonicalVersions'
  | 'fields'
  | 'value'
  | 'provenance'
  | 'valueHash'
  | 'fieldId'
  | 'fieldDefinitionId'
  | 'position'
  | 'expectedTargetVersion'
  | 'unavailable'
  | 'openConflict'
  | 'changedPaths'
  | 'conflictHash'
  | 'resolvedRevisionId'
  | 'restore'
  | 'edgeCount'
  | 'chainHash'
  | 'availability'
  | 'domain'
  | 'targetToken'
  | 'base'
  | 'theirs'
  | 'yours'
  | 'paths'
  | 'creatableTypes'
  | 'selectedType'
  | 'stableFieldId'
  | 'constraints'
  | 'defaultMode'
  | 'defaultValue'
  | 'localizationMode'
  | 'editorConfig'
  | 'relationDefinition'
  | 'properties'
  | 'format'
  | 'blocks'
  | 'spans'
  | 'marks'
  | 'link'
  | 'level'
  | 'list'
  | 'depth'
  | 'text';
interface EditorialWorkflowPublicationWorkbenchContractFields {
  source: '03b-editorial-workflow-publication.md';
  fields: Readonly<
    Partial<Record<EditorialWorkflowPublicationContractField, unknown>>
  >;
}
```

```ts
type CompositionTaxonomyLocalizationContractField =
  | 'id'
  | 'version'
  | 'state'
  | 'propsSchemaRef'
  | 'propsSchemaHash'
  | 'releaseDigest'
  | 'blockRegistryDigest'
  | 'BlockDefinitionRegistryRecord'
  | 'blockKey'
  | 'blockVersion'
  | 'rendererRef'
  | 'lifecycle'
  | 'resourceKind'
  | 'templateKey'
  | 'compatibleTypeIds'
  | 'slots'
  | 'key'
  | 'required'
  | 'allowedBlocks'
  | 'maxCount'
  | 'reservedRegions'
  | 'bindings'
  | 'projection'
  | 'locale'
  | 'audience'
  | 'expectedVersion'
  | 'revisionId'
  | 'patternId'
  | 'patternVersion'
  | 'linkMode'
  | 'slotPath'
  | 'overrides'
  | 'entryId'
  | 'sourceRevisionId'
  | 'fields'
  | 'fieldId'
  | 'value'
  | 'fallbackChain'
  | 'noFallbackFieldIds'
  | 'sourceHash'
  | 'contentHash'
  | 'createdAt'
  | 'updatedAt'
  | 'templateVersion'
  | 'path'
  | 'conflictState'
  | 'taxonomyId'
  | 'termId'
  | 'termKey'
  | 'parentId'
  | 'successorId'
  | 'patternKey'
  | 'sourceEntryId'
  | 'pins'
  | 'exclusions'
  | 'derivedRule'
  | 'eligibleCount'
  | 'reasonCode'
  | 'maxCandidates';
interface CompositionTaxonomyLocalizationWorkbenchContractFields {
  source: '03c-composition-taxonomy-localization.md';
  fields: Readonly<
    Partial<Record<CompositionTaxonomyLocalizationContractField, unknown>>
  >;
}
```

| BE source                                                                | Owning component/prop                                                                                                              | Every discovered application error code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | UI state owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `03a-content-schema-registry.md`                                         | `ContentSchemaRegistryWorkbenchContractFields.fields` and `ContentSchemaRegistryWorkbenchProps.contractFields`                     | `CONFLICT`, `DEPENDENCY_UNAVAILABLE`, `FORBIDDEN`, `INTERNAL_ERROR`, `INVALID_REQUEST`, `NOT_FOUND`, `RATE_LIMITED`, `UNAUTHENTICATED`, `UNSUPPORTED_MEDIA_TYPE`, `VALIDATION_FAILED`                                                                                                                                                                                                                                                                                                                                                                                                      | validation/input → linked summary; auth/permission → auth or capability gate; not-found → disclosure-safe route/row; conflict/stale/mismatch/duplicate → sync conflict; rate → retry wait; dependency/timeout/unavailable → degraded; unsupported media → read-only/unavailable state (release worker only); blocked/failed/cancelled/revoked → exact terminal state and legitimate recovery. CMS-03A-06 list never emits `NOT_FOUND` for concealed rows; CMS-03A-07 may emit disclosure-safe `NOT_FOUND`. |
| `03a-content-schema-registry.md` (DEC-119 CMS-03A-15 through CMS-03A-18) | `CmsCapabilityGrantConsoleContractFields.fields` and `CmsCapabilityGrantConsoleProps.contractFields`                               | `CONFLICT`, `DEPENDENCY_UNAVAILABLE`, `FORBIDDEN`, `INTERNAL_ERROR`, `INVALID_REQUEST`, `NOT_FOUND`, `RATE_LIMITED`, `STEP_UP_REQUIRED`, `UNAUTHENTICATED`, `UNSUPPORTED_MEDIA_TYPE`, `VALIDATION_FAILED`                                                                                                                                                                                                                                                                                                                                                                                  | validation/input → linked summary; auth/permission → auth or capability gate; `STEP_UP_REQUIRED` → inline step-up disclosure with the shared step-up action; not-found → disclosure-safe refusal; conflict/stale/duplicate → refetched row beside preserved input; rate → retry wait; dependency/timeout/unavailable → degraded with a list refetch before retry. CMS-03A-18 never emits `NOT_FOUND`.                                                                                                      |
| `03b-editorial-workflow-publication.md`                                  | `EditorialWorkflowPublicationWorkbenchContractFields.fields` and `EditorialWorkflowPublicationWorkbenchProps.contractFields`       | Every 03b operation maps BE00 `INVALID_REQUEST`, `UNAUTHENTICATED`, operation-specific `403` assignment/capability, disclosure-safe `404`, operation-specific `409` (`VERSION_MISMATCH`, conflict, idempotency, stale hash/dependency/state, `migration_chain_mismatch`, `migration_chain_incomplete`, `template_incompatible`), `UNSUPPORTED_MEDIA_TYPE` where body/media is supplied, operation-specific `422` schema/time/manifest/decision failure (incl. `rich_text_not_canonical`, `object_property_invalid`, `comparison_too_large`, `comparison_unavailable`), `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, and `INTERNAL_ERROR`; the 03b reads CMS-03B-03/11/12/13/14 have no mutation errors, `CMS-03B-06`/`CMS-03B-07`/`CMS-03B-09` add the unconditional `STEP_UP_REQUIRED` class, and `CMS-03B-10`/`CMS-03B-11`/`CMS-03B-13`/`CMS-03B-14` add the create, draft read-scope, list and authoring-context classes with the same BE00 code set. | CMS-03B-01/02/04/05/06/07/08/09 map exact operation rows to form summary, capability gate, disclosure-safe route, sync conflict, step-up route, retry wait, or degraded state; CMS-03B-03/11/12/13/14 own their read-only errors; no generic same-errors fallback                                                                                                                                                                                                                                                           |
| `03c-composition-taxonomy-localization.md`                               | `CompositionTaxonomyLocalizationWorkbenchContractFields.fields` and `CompositionTaxonomyLocalizationWorkbenchProps.contractFields` | `CMS-03C-01`: `INVALID_REQUEST`, `UNAUTHENTICATED`, `TEMPLATE_FORBIDDEN`, `TEMPLATE_NOT_FOUND`, `TEMPLATE_VERSION_CONFLICT`, `UNSUPPORTED_MEDIA_TYPE`, `TEMPLATE_VALIDATION_FAILED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `INTERNAL_ERROR`; CMS-03C-02 uses `COMPOSITION_*`; CMS-03C-03 uses `TAXONOMY_*`; CMS-03C-04 uses `LOCALE_*`; CMS-03C-05 uses `RELATED_CONTENT_*` with the shared transport/dependency codes                                                                                                                                                                 | Each exact operation code owns its named form, capability gate, disclosure-safe not-found, sync conflict, retry wait, or degraded state; C04/C05 code paths are contract-tested but disabled/deferred in Phase 2; no generic same-errors fallback                                                                                                                                                                                                                                                          |

CMS-03A-08 has an explicit worker-only error owner. Its BE03a error matrix maps malformed
signature/header/body/path to `400 INVALID_REQUEST`; absent or invalid release
principal/signature to `401 WEBHOOK_REJECTED`; wrong release principal or scope to
`403 FORBIDDEN`; an unknown or unreadable block version to `404 NOT_FOUND`; stale
lifecycle/version, duplicate nonce, or idempotency mismatch to `409 CONFLICT`;
unsupported media to `415 UNSUPPORTED_MEDIA_TYPE`; lifecycle or release-digest
validation to `422 VALIDATION_FAILED`; release-lifecycle quota to `429 RATE_LIMITED`;
registry/RPC/deadline failures to `502`/`503`/`504`; and scrubbed unexpected failures
to `500 INTERNAL_ERROR`. Every `WEBHOOK_REJECTED` outcome is release-worker telemetry
only: it never enters `UiError`, browser state, an HTML/API route response, a form, or
a browser retry control.

No discovered field or error code is allowed to fall through to generic rendering. An unrecognized schema discriminant or code is a contract mismatch: isolate in `ErrorBoundary`, show request ID and Retry/Status, and report scrubbed telemetry.

### Error class ownership

| Class                                           | Required UI                                                                                                                                  | Retry                                                     | Focus/announcement                                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 400 `INVALID_REQUEST` / 422 `VALIDATION_FAILED` | Summary plus field/row errors; preserve valid input                                                                                          | Correction only                                           | Focus linked summary then field; concise alert                                                         |
| 401 `UNAUTHENTICATED`                           | Reauthentication with safe return; protected data removed                                                                                    | After session recovery                                    | Focus auth heading; announce expiry                                                                    |
| 401 `STEP_UP_REQUIRED`                          | Persist the scoped draft, then navigate to `/step-up?returnTo=<current relative path>` with the typed `allowedMethods`; no gate, never a 403 | After step-up the form restores and the human re-confirms | Focus the confirm control on return; announce `Verification complete. Review and confirm to continue.` |
| 403 `FORBIDDEN`                                 | `<CapabilityGate>` with reason/recovery; no broadened disclosure                                                                             | After capability refetch                                  | Focus gate; no protected names                                                                         |
| 404                                             | Disclosure-safe not-found; distinguish deleted only when authorized                                                                          | Navigation                                                | Focus route heading                                                                                    |
| 409 conflict/idempotency/state                  | `<SyncConflict>` with server/current version and preserved draft                                                                             | Reconcile first                                           | Focus conflict; announce no overwrite                                                                  |
| 429 `RATE_LIMITED`                              | Inline countdown from `Retry-After`; input kept                                                                                              | At server time only                                       | Polite coarse updates                                                                                  |
| 502/503/504                                     | Scoped degraded or full System / Degraded by honest renderability                                                                            | Safe BE attempts only; mutation status first              | Request ID/Retry; no raw provider detail                                                               |

For CMS-03A-06, only `INVALID_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`,
`VALIDATION_FAILED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, and `INTERNAL_ERROR`
are rendered for the protected list read; concealed rows are omitted rather than exposed as
`NOT_FOUND`. CMS-03A-07 additionally renders disclosure-safe `NOT_FOUND` for an
unreadable or mismatched type/version. Both reads reject mutation-only headers,
send no body, use `Cache-Control: no-store`, and never create audit/outbox or
optimistic mutation state. CMS-03A-05 release errors stay on the signed worker
boundary and cannot be retried by the browser. `WEBHOOK_REJECTED` is owned by
release-worker telemetry only; it never enters `UiError`, browser state, a route
response, or a retry control. CMS-03B-01/02/04/05/06/07/08/09 and
CMS-03C-01/02/03/04/05 use their operation-specific mappings above; the 03b
reads CMS-03B-03, CMS-03B-11, CMS-03B-12, CMS-03B-13 and CMS-03B-14 remain
read-only with no mutation error path, and each renders only
`INVALID_REQUEST`, `UNAUTHENTICATED`, its operation-specific `FORBIDDEN` read
scope, its disclosure-safe `NOT_FOUND` (except the list, which omits concealed
rows), `VALIDATION_FAILED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE` and
`INTERNAL_ERROR`. The decision (CMS-03B-06) and the schedule/publish
(CMS-03B-07/09) commands additionally render `STEP_UP_REQUIRED` as an inline
step-up disclosure that never collapses to a 403 gate, and the writer
commands render their operation-specific `CONFLICT`.

For the DEC-119 grant console, CMS-03A-18 renders only `INVALID_REQUEST`,
`UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_FAILED`, `RATE_LIMITED`,
`DEPENDENCY_UNAVAILABLE` and `INTERNAL_ERROR`. CMS-03A-15 through
CMS-03A-17 additionally render `STEP_UP_REQUIRED` as the inline step-up
disclosure (never collapsed to a generic 401), disclosure-safe `NOT_FOUND` and
`CONFLICT` with the refetched row.

## Navigation, Degradation, and Concurrency

- **Back/deep link/bookmark**: URL owns query, selection, cursor, and tab. Deep link refetches current authority/version, never serialized client authority.
- **Multi-tab**: version mismatch opens `<SyncConflict>`; another tab only invalidates. No last-write-wins UI claim.
- **Unsaved changes**: scoped draft survives recoverable auth and same-record navigation, but never enters logs, analytics, URL, or Realtime.
- **Authorization change**: revoke protected props/cache, cancel pending presentation, and refetch. Stale UI never authorizes. Registry list/detail data is never put in a public cache, search index, sitemap, or private/offline cache.
- **Realtime reorder/duplication**: hints coalesce; canonical refetch is authoritative; focus/selection/draft remain if allowed.
- **Unknown mutation outcome**: render pending/manual review from operation status. Never show success or blindly resend.
- **Telemetry**: operation, route template, request ID, status, duration, and scrubbed IDs/hashes only. No bodies, evidence, secrets, contact data, or media URLs.
- **DEC-108 dry-run job status**: `202 SchemaDryRunResource` is queued/running only; the immutable passed report (counts, hashes, classification) appears only after the actual bounded scan completes. Status polls `GET /api/v1/jobs/{jobId}` and never fabricates or optimistically displays a passing result; the submit-review action stays disabled until a passed persisted dry run exists.
- **DEC-108 review reconciliation**: a schema review is `open|approved|rejected|invalidated`. Approve renders only when the frozen policy count is met server-side; a `409` (duplicate/self/out-of-policy/stale/idempotency) is reconciled before any retry; a rejection returns the candidate to an editable draft through the audited transition, and candidate/policy/compiler/dependency/authority drift invalidates the review and requires a new frozen submission. A field or relation edit (`CMS-03A-02`, `CMS-03A-03`) on a candidate that is in review is admitted by the server only to invalidate the open review and its decisions and return the candidate to `draft`: the form names that consequence in its confirmation before submit, and on success renders the draft candidate and an `invalidated` review; an `approved` candidate is frozen, the command returns `409 CONFLICT`, and the form shows the frozen-candidate sync conflict with no mutation. A `409` whose detail is `MIGRATION_SOURCE_DRIFT` (on review submission or activation) states that the source data changed after the scan and that the refused action changed nothing, and offers the new dry run when `permittedNextActions` includes `start_dry_run`; that new dry run, not the refusal, invalidates any open or approved review and returns the candidate to `draft`, so the page refetches the detail after it and renders the draft candidate and an `invalidated` review; other migration detail codes render as the generic conflict panel and never show a row, document or field value.
- **DEC-108 context evidence**: acting-context change or step-up expiry resets the local confirmation via the trusted shared acting-context invalidation event plus a local epoch/cancellation and a server refetch/remount. No raw, hashed, or truncated actor/person/party/binding identifier, and no matching/correlation token, is stored in island props, URL state, telemetry, or logs.
- **DEC-108 bounded authorization**: the assigned `cms.schema_review` reviewer uses the `schemaReviewAssigned` review-only variant and renders only actions permitted by the server's per-review next actions; it never implies registry-wide read or designer/successor/activation/entry/publish UI.
- **DEC-108 template compatibility preflight**: any activation preflight renders only the safe, non-mutating `platform_api.cms_resolve_template_compatibility` projection (`{templateVersionId, templateKey, templateVersionNo, state, compatible:true, withdrawn:false, templateDigest, contentTypeId, contentTypeVersionId}`) resolved for the exact candidate `contentTypeId` + `contentTypeVersionId` under the same owner. No `current`/`latest` version is ever inferred. The resolver is DB-internal (no API role executes it): its typed failures (`NOT_FOUND`, `INCOMPATIBLE`, `WITHDRAWN`, `VERSION_MISMATCH`) never reach the browser and are never a soft success, and the projection arrives only as the optional `templateCompatibility` member of `activationPreparation`, so an absent member renders no compatibility state. The browser never calls the resolver directly or mints compatibility state.
- **DEC-119 grant reconciliation**: every grant, renewal and revocation is reconciled against a canonical list refetch; an unknown mutation outcome renders pending and is never guessed as granted or revoked, `lapsed` is derived by the server and never from the browser clock, and a step-up navigation discards person identifiers rather than persisting them.
- **Slice 10 editorial conflict and draft identity (D2/D3)**: after a 409 the editor refetches canonical draft detail and reads `openConflict`; the `openConflict` banner and its link to `/app/cms-content-modeling/entries/:entryId/conflicts/:conflictId` survive reload and multiple tabs, and the conflict detail (`paths`, preimages) is re-required rather than cached. The editor's `baseRevision` is the server-derived `revisionNumber`; the composite GET `ETag` is a representation validator and is never sent as the numeric `If-Match`.
- **Slice 10 comparison and restore (D5/D6)**: the comparison is grouped by `domain` (field, block, relation) with side hashes only and the keyed relation `targetToken`; a comparison over 512 combined changes renders the typed `comparison_too_large` refusal and an unresolvable recorded version renders `comparison_unavailable`, never a truncated list. The restore confirmation renders the chain availability and `edgeCount` from `compare.restore`, disables commit with copy when the chain is `chain_unavailable` or `transform_missing`, and submits the read-derived `migrationChainId` unchanged; the server re-derives the chain and returns 409 `migration_chain_mismatch`/`migration_chain_incomplete`/`template_incompatible` with nothing fabricated.
- **Slice 10 value authoring (DEC-133/DEC-112)**: the `object` editor renders exactly the declared depth-1 properties and the rich-text editor submits only a canonical `rich_text.v1` AST; non-canonical text and unsafe link schemes are refused inline and mapped to the typed 422, and the typed renderer uses no `dangerouslySetInnerHTML`. The rich-text preview, object-property groups and conflict preimages never enter a public/private cache, analytics event, Realtime body, URL, or log.
- **Slice 10 MFA (DEC-108/D20)**: missing or stale MFA on any editorial decision (ordinary or protected) and on the schedule/publication commands is a 401 `STEP_UP_REQUIRED` with `{ recoveryAction: 'step_up', allowedMethods }`; the forms route to `/step-up?returnTo=`, retain their scoped draft, and re-confirm on return, and the caller never supplies `capability` or `stepUpAt`.

## Testing Obligations

| Level                 | Required assertions                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest unit/component | Exhaustive `AsyncState` and access variants; exact error copy/action; blur/submit timing; optimistic confirm/rollback; focus return; reduced motion; no unauthorized props |
| Vitest integration    | Zod schemas accept BE fixtures/reject invalid variants; every operation maps fields/errors; ETag/idempotency/rate headers drive UI; Realtime only invalidates              |
| Playwright E2E        | Critical IA flows by role; keyboard; landmarks/names/live regions; three breakpoints; 200% zoom; offline/reconnect; stale multi-tab; auth expiry; 429/outage               |
| Accessibility         | axe zero serious/critical; contrast/non-color cues; VoiceOver/NVDA smoke; target size; focus; no trap; captions/transcripts where media exists                             |
| Performance           | Server-first HTML; bounded islands; no hydration waterfall; stable skeleton; LCP <2.5 s, CLS <0.1; virtualize >100; route JS budget verified in phase plan                 |

Registry-specific coverage is mandatory: contract/component tests cover
CMS-03A-01, CMS-03A-02, CMS-03A-03, CMS-03A-04, CMS-03A-05/CMS-10,
CMS-03A-06, CMS-03A-07, and CMS-03A-08/CMS-10. The list tests every bounded filter, default,
sort/direction, opaque cursor binding, discriminated `resourceKind`, omission
of concealed rows, `no-store`, and rejection of `Idempotency-Key`/`If-Match`.
The detail tests both UUID path parameters, type/version membership, nested
field/relation/artifact/binding/block metadata, disclosure-safe 403/404,
`no-store`, and rejection of mutation-only headers or a body. CMS-03A-01..04
test their exact human forms, while CMS-03A-05/CMS-10 and CMS-03A-08/CMS-10
have explicit tests that no browser route, form, upload, optimistic state, or
mutation facade exists. CMS-03A-08 additionally tests the exact four release
headers, operation-specific signing domain, supported→deprecated→withdrawn
monotonic guard, immutable block-version row, atomic lifecycle-event/nonce-receipt
append, `201 BlockLifecycleEventResource`, and worker-only `WEBHOOK_REJECTED`
telemetry for the exact `401` release-envelope rejection category; other
rejected categories retain their operation-specific worker status/code.
No registry read fixture, block registration body, or lifecycle-advance event body
may enter public delivery, offline/private storage, analytics, Realtime payloads,
or client logs.

DEC-108 activation-producer coverage is mandatory: contract/component tests cover
CMS-03A-09 through CMS-03A-14. The successor form tests the exact
`SchemaSuccessorRequest` (`{expectedVersion}`), exact source `If-Match`, required
`Idempotency-Key`, preserved stable field identities with new definition row IDs,
and unchanged source. The dry-run form tests the strict both-null-or-both-present
transform pair serialized with no omitted keys, honest queued/running status, and
that a passed report hash/count/classification is rendered only from the server
after the actual scan (never from a fixture or optimistic state). The submit-review
form tests `{expectedVersion, dryRunId}`, the passed-dry-run precondition, and the
atomic draft→review freeze. The decision form tests `{expectedVersion, decision}`,
assigned-`cms.schema_review` authorization, recent binding-bound MFA, refusal of
self/duplicate/out-of-policy decisions, and that no reviewer identifier is rendered.
The review-detail read tests the exact `reviewId` path, safe presentation of the
frozen artifact/compiler/dependency evidence summary and required/recorded counts,
disclosure-safe 404, `no-store`, and rejection of mutation headers or a body. The
assignment form tests the discriminated create/revoke request, owner-only
`cms.schema_review.assign`, the exact `read`+`decide` actions, the seven-day/scoped
expiry, and that no reviewer/grantor identifier is echoed. No schema-review,
decision, assignment or dry-run fixture may serialize a private matching identifier
or enter public delivery, offline/private storage, analytics, Realtime payloads, or
client logs.

DEC-119 owner-grant coverage is mandatory: contract/component tests cover
CMS-03A-15 through CMS-03A-18. The grant form tests the exact
`CapabilityGrantRequest`, the four-group closed capability select (no free text),
UUID validation of the person ID on blur and submit, the native date input bounded
by `termWindow` (today through today plus 89 days; today plus 90 days is not selectable and a forced value renders the `grant_term_spans_at_most_ninety_utc_days` field error), the 256-character reason bound, required `Idempotency-Key` with
no `If-Match`, the inline `STEP_UP_REQUIRED` disclosure and shared step-up
navigation that discards the person ID, the non-disclosing 404 copy, the 409
renew-instead copy, and that the owner can select and grant any grantable capability to itself with no self-grant refusal. The renew and
revoke forms test `{expectedVersion, validThrough, reason?}` and
`{expectedVersion, reason?}` with `If-Match` taken from the row `version`, the
refetched-row 409 reconciliation, Grant again for a revoked grant, and the immediate
`Revoked` row. The list tests every filter, default, sort/direction and opaque
cursor, the island-local person filter that never enters the URL, derived
`Active`/`Lapsed`/`Revoked` text-plus-icon states, `no-store`, and rejection of
mutation headers or a body. Role tests prove the owner-only variants
(`ownerFull`, `forbiddenHidden`, `disabledPrerequisite`), that no other persona or
granted-capability holder receives the island or a navigation entry, and that no
grantor, actor, party or binding identifier or person identifier reaches the URL,
storage, analytics, telemetry, logs, Realtime payloads or announcements. Axe,
keyboard (table sort, row actions, inline confirmation, Escape), 200% zoom and
three-breakpoint checks cover the console.

Editorial 03b coverage is mandatory as well: contract/component tests cover
CMS-03B-01 through CMS-03B-14. CMS-03B-10 tests the exact create form
(`contentTypeId`, `contentTypeVersionId`, BCP 47 `locale`, unique `changedPaths`,
bounded `values`), the CMS-03B-14 prefill of the frozen request members with no
typed JSON, strict unknown-key rejection, the required `Idempotency-Key` with no
update-only `If-Match`, one atomic entry-plus-first-draft commit, idempotent
replay with no duplicate audit/outbox effect, and a refusal that commits neither
row.
CMS-03B-11 tests the exact `EntryDraftDetailQuery`, the server-derived
`revisionNumber`/`schemaVersionId`/`openConflict`, `no-store` plus a strong
authenticated `ETag`, no body/`Idempotency-Key`/`If-Match`, no mutation or
optimistic state, and 404-concealed versus 403-visible-unassigned behavior.
CMS-03B-12 tests the no-key `ConflictDetailQuery`, the bounded base/theirs/yours
preimages populated only while the conflict is `open`, the absence of any
ownership identifier, disclosure-safe 404/403, and that no preimage is cached or
placed in the URL. CMS-03B-13 tests the signed cursor bound to the complete query
and read scope, the `state`/`contentTypeId` filters, cursor/context 409, and the
omission of concealed rows. CMS-03B-14 tests both query modes (creatable types and
the author-safe field projection), that it never grants `cms.schema_registry.read`
and never accepts a caller-chosen schema, and that it serializes no ownership
identifier. The `object` editor tests the exact DEC-133 depth-1 properties
(≤32, unique stable keys, `scalar`/`enum`/`rich_text`, required/constraints) with
a linked 422 for a missing required key, an unknown key or a kind mismatch. The
rich-text editor/renderer tests the canonical `rich_text.v1` round trip, the
`rich_text_not_canonical` refusal, unsafe link scheme rejection, heading order and
non-empty link text, and the absence of `dangerouslySetInnerHTML`. The comparison
tests the three `domain` groups, the keyed relation `targetToken` (no target
identity), and the `comparison_too_large`/`comparison_unavailable` refusals. The
restore form tests the `compare.restore` availability/edge count, the disabled
commit when unavailable, and the 409 reconciliation. The decision, schedule and
publish forms test that a missing/stale MFA routes to `/step-up?returnTo=` with
retained input rather than a 403 gate. No editorial route may serialize owner,
assignee, acting party, capability, authority, or a conflict preimage into
browser state or telemetry, and no test may assume a direct browser table grant.

## Deepening and Ambiguity Gate

|                    Pass | Result                                                                                                                                   |
| ----------------------: | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1 state synchronization | URL, server resource/version, drafts, Realtime, and multi-tab have one authority order.                                                  |
|      2 degraded network | Thresholds, timeouts, rate waits, retries, offline intent, and unknown mutations are deterministic.                                      |
| 3 user-flow persistence | Back, deep link, bookmark, auth return, drafts, and success transitions are named.                                                       |
|      4 responsive/touch | Every archetype has mobile, tablet, desktop composition plus target/keyboard parity.                                                     |
|     5 state enumeration | Idle, loading, per-class error, empty, success, optimistic states, disabled, degraded have triggers/exits.                               |
|        6 role rendering | Fixed matrix has no empty cells; named variants are capability-selected and disclosure-safe.                                             |
|   7 accessibility edges | Keyboard, focus, announcements, contrast, reflow, reduced motion, timing, tables, media, confirmation are explicit.                      |
|       8 two-implementer | Components, props, routes, authority, interactions, errors, breakpoints, access, mappings need no undocumented choice.                   |
|      9 devil's advocate | Forged role/context, stale cache, duplicate activation, reordered hints, offline authority loss, inference, telemetry leaks fail closed. |
|          10 convergence | No new component, state, route, field mapping, permission, or unresolved locked decision emerged.                                        |

**Ambiguity status**: PASS. Upstream IA and BE remain authoritative; this spec selects only allowed frontend implementation details. No product, permission, security, or data-placement decision is redefined.

## Open Questions

None. New product or architecture choices must re-open their originating locked stage and propagate forward.

## Changelog

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Workflow              | Sections affected                                                                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-29 | Initial complete FE specification, source mapping, mandatory deepening, and convergence review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `/write-fe-spec`      | All                                                                                                                                                                                                                                 |
| 2026-09-02 | Applied authorized Slice 09 IA/BE reconciliation: generated protected registry list/detail types, exact content-type/version routes, CMS-03A-01..04 human commands, signed-release-only CMS-03A-05/CMS-03A-08/CMS-10 metadata and lifecycle telemetry, read-only/no-store/no-offline boundaries, exhaustive 03b/03c operation mappings, and eight-operation BE03a coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `/propagate-decision` | Shared types, state, routes, interactions, forms, data mapping, errors, navigation, tests                                                                                                                                           |
| 2026-09-26 | DEC-106: added protected initial-entry create (`CMS-03B-10` `POST /api/v1/cms/entries`) and authorized draft-detail read (`CMS-03B-11` `GET /api/v1/cms/entries/{entryId}`) to the `CMS-05` flow — atomic active entry plus first draft revision under `Idempotency-Key` with no update-only `If-Match`, protected `no-store`/`ETag` draft loading with 404/403 concealment, retained unsent values and focus recovery, and no browser authority fields or direct table grants                                                                                                                                                                                                                                                                                                                                                                                                                       | `/propagate-decision` | Shared types, state, routes, interactions, forms, data mapping, errors, navigation, tests, changelog                                                                                                                                |
| 2026-10-02 | DEC-108: added the CMS activation-producer surface — protected successor (`CMS-03A-09`), dry-run (`CMS-03A-10`), submit-review (`CMS-03A-11`), record-decision (`CMS-03A-12`), schema-review detail (`CMS-03A-13`) and owner assignment (`CMS-03A-14`) commands/read, the `schemaReviewAssigned` review-only variant distinct from `ownerFull`/`entitledRead`, the four generated request schemas and four resource projections plus `SchemaActivationPreparation`, the strict both-null-or-both-present dry-run transform pair and honest queued/running job status, the frozen review/assignment evidence with no private matching identifier, the display-only safe `contextEvidence` (label plus expiring step-up) replacing raw actor/party props, bounded owner-only `cms.schema_review.assign` and assigned `cms.schema_review` decision authority, and the fourteen-operation BE03a coverage | `/propagate-decision` | Status, design boundary, shared types, component contracts, state, routes, interactions, forms, data mapping, errors, accessibility, responsive, navigation, tests, changelog                                                       |
| 2026-10-02 | DEC-108 consistency closure: completed the truncated identifier sentence, added review-detail and dry-run `AsyncState` enumerations, the `activationPreparation` data mapping, prefilled approve-decision `approvalIds`, UUID reviewer-selection input with helper copy, review-read scope without `cms.schema_registry.read`, and resolver projection delivery through `activationPreparation.templateCompatibility`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-02 | DEC-119: added the owner-only `CmsCapabilityGrantConsole` and route `/app/cms-content-modeling/capability-grants` for CMS-03A-15 (grant), CMS-03A-16 (renew), CMS-03A-17 (revoke) and CMS-03A-18 (list), with list/command states, per-field form validation and error copy, owner-only role variants, accessibility, responsive and performance contracts, data mapping and error ownership.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `/propagate-decision` | Design System Compliance, Component Inventory, State Management, Page and Route Definitions, Interaction Specification, Conditional Rendering Matrix, Accessibility Inventory, FE Rubric Closure, Data Mapping, Testing Obligations |
| 2026-10-02 | DEC-111 and DEC-119 follow-ups: split 401 `UNAUTHENTICATED` (reauthenticate) from 401 `STEP_UP_REQUIRED` (route to `/step-up?returnTo=` with typed `allowedMethods`) in the global state and error-class tables and added the step-up recovery contract; removed `OWNER_SELF_GRANT_LIMITED` so the owner may self-grant any grantable capability; added the Delivery and media capability group (navigation editor, media contributor, media curator) to the grant console                                                                                                                                                                                                                                                                                                                                                                                                                           | `/write-fe-spec`      | State Management, Interaction Specification, Component Inventory, Data Mapping                                                                                                                                                      |
| 2026-10-02 | DEC-120: standing CMS capability grants (CMS-03A-15 grant, CMS-03A-16 renew) may run up to 90 UTC days, renewable with step-up, revocation immediate; the grant console `termWindow` maxDate is now the current UTC date plus 89 days, helper copy and the 422 `grant_term_spans_at_most_ninety_utc_days` field error updated, and the grant/renew interaction rows and boundary tests changed from the seven-day ceiling to 90 days. DEC-108 CMS-03A-14 assignment copy stays at seven days.                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-02 | WP2c contract follow-ups: mapped `SchemaReviewResource.assignments[]` (owner-only safe summaries for CMS-03A-14 revoke) and `activationPreparation.dryRunRef.failureCode` (safe failure copy source); removed the activation form's `stepUpToken` password field since DEC-111 step-up is session-based and a 401 `STEP_UP_REQUIRED` routes to `/step-up?returnTo=`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-10-02 | OD-4: added the Locale configuration fields contract (supported-language tag list, source and default selects, per-language fallback order editors with fixed final default, successor keep/replace choice, review-changes step, exact BE03a messages mapped by path, states and accessibility); the successor form and `ContentTypeDraftRequest` carry `supportedLocales`/`fallbackChains`; the locale variant form shows the active version's chain read-only and handles 409 `FALLBACK_CHAIN_MISMATCH`. |
| 2026-10-02 | Slice 09 implementation reconciliation: replaced the non-BE00 `DEPENDENCY_INVALID_RESPONSE`/`DEPENDENCY_DEADLINE_EXCEEDED` names and the `DEPENDENCY_*` wildcard with the BE00 `DEPENDENCY_UNAVAILABLE` (502/503/504) in every error list, and added the edit-on-review invalidation and `MIGRATION_SOURCE_DRIFT` recovery behavior to the DEC-108 review reconciliation. |
| 2026-10-02 | Slice 09 follow-ups reconciliation: the `MIGRATION_SOURCE_DRIFT` conflict copy states that the refused action changed nothing and that a new dry run (not the refusal) invalidates the review and returns the candidate to `draft`; `activationPreparation.dryRunRef` is mapped with the six sealed-only members (`sourceCount`, `targetCount`, `rowErrorCount`, `sourceHash`, `targetHash`, `reportHash`) rendered and announced only for a sealed report. |
| 2026-10-03 | DEC-123: the CMS-03A-01 create form no longer offers a default template or template bindings (a new type is created without a template and gains one through a successor version); the resolver is DB-internal and reaches the browser only as `activationPreparation.templateCompatibility`. | /implement-slice | CMS-03A-01 field mapping, Registry command forms |
| 2026-10-03 | DEC-123 completion: added the Successor template choice contract to the CMS-03A-09 successor form (keep or choose the default template and template list, both request members null or both present, per-field validation and server-refusal mapping) because a type gains its first template only through a successor version; `SchemaSuccessorRequest` now carries `defaultTemplateVersionId` and `templateBindings`. | /implement-slice | Registry command forms, CMS-03A-09 field mapping |
| 2026-10-03 | Slice 09 AC390 (orchestrator ruling; owner-ratified 2026-10-03 as DEC-126): `SchemaSuccessorRequest` carries the optional nullable `workflowKey`/`workflowVersion` pair as an API-only producer path (both null or absent keep the source member, both present replace it with a seeded registry member, strictest-of review applies); the successor form exposes no control for it, so Form-by-source completeness lists it as an API-only member. | /implement-slice | Form-by-source completeness, CMS-03A-09 field mapping |
| 2026-10-03 | Slice 09 AC527 (orchestrator ruling, more-work-now): the grant console routes a CMS-03A-15 409 by the API's recovery direction. `details.recoveryAction: 'renew'` (an existing active aggregate, BE03a changelog 2026-10-03) shows the existing-grant copy with the filter-to-capability link where the renew command is; any other grant 409 shows the changed copy and refetches, so the console never claims a person already holds a capability on an idempotency or version conflict. |
| 2026-10-04 | Slice 10 editorial cascade: added the assigned-entry list (`CMS-03B-13`), the authoring-context preparation read (`CMS-03B-14`, prefilling the create form's frozen request members with no typed JSON), the protected three-way conflict detail (`CMS-03B-12`) with bounded no-store preimages and no ownership identifier, the server-derived draft identity (`revisionNumber`/`schemaVersionId`/`openConflict`, D3), the domain-grouped field/block/relation comparison with the keyed relation `targetToken` and the 512-change/`comparison_unavailable` refusals (D5), and the restore preparation/chain confirmation carrier (D6); added the `object` field editor for the DEC-133 depth-1 structure, the DEC-112 constrained native `CmsRichTextEditor` and typed `CmsRichTextRenderer`, the client-side `rich_text_not_canonical`/`object_property_invalid` mappings, and the unconditional recent binding-bound MFA on every decision (D20) and on schedule/publication, with the missing/stale MFA routed to `/step-up?returnTo=` rather than a 403 gate. | /propagate-decision | Status, referenced material, component inventory, state management, routes, interactions, accessibility, responsive, permission variants, data mapping, errors, navigation, tests, changelog |

## Quality Gates Checklist

- [x] Every component has a props interface or explicit consumed-global props contract.
- [x] Every interactive element has trigger, keyboard/focus, success, failure, persistence, and recovery.
- [x] Every BE operation, schema group, parsed response field, and error class maps to a component owner.
- [x] Idle, loading, per-class error, empty, success, optimistic pending/rollback, disabled, and degraded states are defined.
- [x] WCAG 2.2 AA, keyboard, focus, screen reader, zoom/reflow, target size, contrast, timing, and reduced motion are specified.
- [x] Mobile, tablet, and desktop behavior is explicit.
- [x] IA accessibility, user flows, access controls, edge cases, and acceptance criteria are consumed.
- [x] Source Map covers every FE section.
- [x] Global design-system components and state language are consumed without reinvention.
- [x] Seven mandatory passes, two-implementer review, devil's-advocate review, and convergence pass completed.


<!-- spec-graph: auto-generated -->
## Related Specs

### Derives from
- [[specs/ia/03-cms-content-modeling|Shard 03 — CMS content modeling and authoring]]
- [[specs/ia/deep-dives/03-cms-content-modeling|Deep Dive 03 — CMS content modeling and authoring]]

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]

### References
- [[specs/ia/03-cms-content-modeling|Shard 03 — CMS content modeling and authoring]]
- [[specs/ia/deep-dives/03-cms-content-modeling|Deep Dive 03 — CMS content modeling and authoring]]
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
