# CMS navigation, media and delivery: Frontend Specification

> **Classification**: Feature specification
> **BE Source**: [04a-navigation-routes-discovery.md](../be/04a-navigation-routes-discovery.md), [04b-governed-media-renditions.md](../be/04b-governed-media-renditions.md), [04c-public-delivery-cache.md](../be/04c-public-delivery-cache.md)
> **IA Source**: [04-cms-delivery-media.md](../ia/04-cms-delivery-media.md)
> **Surface**: Responsive Astro hybrid web/PWA with bounded React islands
> **Status**: Complete

## Referenced Material Inventory

- **Primary IA**: [04-cms-delivery-media.md](../ia/04-cms-delivery-media.md) in full.
- **BE sources**: [04a-navigation-routes-discovery.md](../be/04a-navigation-routes-discovery.md), [04b-governed-media-renditions.md](../be/04b-governed-media-renditions.md), [04c-public-delivery-cache.md](../be/04c-public-delivery-cache.md).
- **Cross-cutting FE source**: [00-infrastructure.md](00-infrastructure.md).
- **Design sources**: [design-system.md](../design-system.md), root `PRODUCT.md`, root `DESIGN.md`, and `.agents/skills/brand-guidelines/SKILL.md`.
- **Contract conventions**: BE00 `ApiError`, opaque cursor pagination, ETag/`If-Match`, idempotency, rate-limit headers, canonical refetch after Realtime hints, and disclosure-safe authorization.

## Source Map

| FE section                                                           | Authoritative source                                                                                     | Consumed material                                                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Classification and scope                                             | `04-cms-delivery-media.md`; BE index                                                                     | Shard boundary and completed BE split group                                                         |
| Component inventory                                                  | BE response/request contracts; IA interactions                                                           | Typed props, commands, state machines, access variants                                              |
| Routes and navigation                                                | IA user flows; design-system navigation paradigm                                                         | Entry, deep-link, back, stack, compact-tab, and governed menu behavior                              |
| State management                                                     | BE resource versions/events; BE00                                                                        | Server authority, URL state, local drafts, optimistic rollback, offline intent                      |
| Interaction specification                                            | IA Interactions and Edge Cases; BE route registries                                                      | Triggers, guards, success, errors, retry, and persistence                                           |
| Responsive behavior                                                  | IA responsive/accessibility rules; design-system grid                                                    | Mobile, tablet, and desktop structural behavior                                                     |
| Accessibility                                                        | IA Accessibility and interaction rows; WCAG 2.2 AA baseline                                              | Keyboard, focus, names, live regions, reflow, target size, reduced motion                           |
| Data mapping                                                         | Every BE source listed above                                                                             | Operation, schema, response field, error, and component ownership                                   |
| Testing obligations                                                  | IA acceptance criteria; BE contract/security/recovery tests                                              | Component, integration, E2E, a11y, and degraded-network assertions                                  |
| Delivery review, discovery policy state, and media limit/scan states | BE04a DLV-NAV-API-05–08 and the discovery policy projection; BE04b DLV-04B-01 and asset/rendition states | `DeliveryCandidateReviewPanel`, discovery effective-policy region, upload limit and scan-state copy |

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
type Breakpoint = 'mobile' | 'tablet' | 'desktop';
```

### `CmsDeliveryMediaRoute` (Astro server route)

```ts
interface CmsDeliveryMediaRouteProps {
  children?: never;
  variant: DomainVariant;
  actorId: string | null;
  actingPartyId: string | null;
  capabilitySnapshot: readonly string[];
  canonicalUrl: string;
  initialQuery: Readonly<Record<string, string>>;
  requestId: string;
}
```

- Server-verifies session, acting context, route visibility, and initial data before HTML composition. Props are validated, minimal, serializable, and disclosure-safe.
- Renders useful semantic HTML before hydration. React is used only for bounded filtering, commands, realtime invalidation, media controls, or rich editing.
- **A11y inline contract**: skip link targets `<main tabindex="-1">`; one `h1`; landmarks have unique names; route changes focus the `h1`; title includes record and state; 200% zoom and 320 CSS px reflow preserve reading/action order.

### `NavigationRoutesDiscoveryWorkbench` (bounded React island)

**BE owner**: `04a-navigation-routes-discovery.md`

```ts
interface NavigationRoutesDiscoveryWorkbenchProps {
  contractFields: NavigationRoutesDiscoveryWorkbenchContractFields;
  children?: never;
  variant: DomainVariant;
  initial: AsyncState<readonly NavigationRoutesDiscoveryRecord[]>;
  actorId: string;
  actingPartyId: string;
  access: AccessVariant;
  query: Readonly<Record<string, string>>;
  selectedId: string | null;
  expectedVersion: string | null;
  onCanonicalRefetch: (
    reason: 'navigation' | 'realtime-hint' | 'mutation' | 'reconnect',
  ) => Promise<void>;
}

interface NavigationRoutesDiscoveryRecord {
  id: string;
  version: string;
  state: string;
  provenance: ReadonlyArray<{
    source: string;
    evidence: string;
    at: string;
    visibility: string;
  }>;
  projection: Readonly<Record<string, unknown>>;
}
```

- Astro owns route data and static structure. The island owns only selection, typed filters, pending commands, conflict resolution, and invalidation.
- `projection` is the parsed union of the response schemas named in the BE route registry; runtime validation rejects unknown variants.
- **A11y inline contract**: `<Workbench>` list/detail regions are named; selection is URL-addressable; rows use native links/buttons; Arrow keys are added only inside a declared composite; focus never moves on Realtime refetch; status changes use a polite atomic live region.
- **Responsive contract**: desktop shows list and detail; tablet preserves list with an inline inspector; mobile uses list then detail stack with a persistent Back action and no hidden command rail.
- **Error boundary**: isolates this domain section, sends scrubbed error plus request ID to provider-native diagnostics, preserves neighboring server HTML, and exposes Retry. A render error is never empty data.

### `GovernedMediaRenditionsWorkbench` (bounded React island)

**BE owner**: `04b-governed-media-renditions.md`

```ts
interface GovernedMediaRenditionsWorkbenchProps {
  contractFields: GovernedMediaRenditionsWorkbenchContractFields;
  children?: never;
  variant: DomainVariant;
  initial: AsyncState<readonly GovernedMediaRenditionsRecord[]>;
  actorId: string;
  actingPartyId: string;
  access: AccessVariant;
  query: Readonly<Record<string, string>>;
  selectedId: string | null;
  expectedVersion: string | null;
  onCanonicalRefetch: (
    reason: 'navigation' | 'realtime-hint' | 'mutation' | 'reconnect',
  ) => Promise<void>;
}

interface GovernedMediaRenditionsRecord {
  id: string;
  version: string;
  state: string;
  provenance: ReadonlyArray<{
    source: string;
    evidence: string;
    at: string;
    visibility: string;
  }>;
  projection: Readonly<Record<string, unknown>>;
}
```

- Astro owns route data and static structure. The island owns only selection, typed filters, pending commands, conflict resolution, and invalidation.
- `projection` is the parsed union of the response schemas named in the BE route registry; runtime validation rejects unknown variants.
- **A11y inline contract**: `<Workbench>` list/detail regions are named; selection is URL-addressable; rows use native links/buttons; Arrow keys are added only inside a declared composite; focus never moves on Realtime refetch; status changes use a polite atomic live region.
- **Responsive contract**: desktop shows list and detail; tablet preserves list with an inline inspector; mobile uses list then detail stack with a persistent Back action and no hidden command rail.
- **Error boundary**: isolates this domain section, sends scrubbed error plus request ID to provider-native diagnostics, preserves neighboring server HTML, and exposes Retry. A render error is never empty data.

### `PublicDeliveryCacheWorkbench` (bounded React island)

**BE owner**: `04c-public-delivery-cache.md`

```ts
interface PublicDeliveryCacheWorkbenchProps {
  contractFields: PublicDeliveryCacheWorkbenchContractFields;
  children?: never;
  variant: DomainVariant;
  initial: AsyncState<readonly PublicDeliveryCacheRecord[]>;
  actorId: string;
  actingPartyId: string;
  access: AccessVariant;
  query: Readonly<Record<string, string>>;
  selectedId: string | null;
  expectedVersion: string | null;
  onCanonicalRefetch: (
    reason: 'navigation' | 'realtime-hint' | 'mutation' | 'reconnect',
  ) => Promise<void>;
}

interface PublicDeliveryCacheRecord {
  id: string;
  version: string;
  state: string;
  provenance: ReadonlyArray<{
    source: string;
    evidence: string;
    at: string;
    visibility: string;
  }>;
  projection: Readonly<Record<string, unknown>>;
}
```

- Astro owns route data and static structure. The island owns only selection, typed filters, pending commands, conflict resolution, and invalidation.
- `projection` is the parsed union of the response schemas named in the BE route registry; runtime validation rejects unknown variants.
- **A11y inline contract**: `<Workbench>` list/detail regions are named; selection is URL-addressable; rows use native links/buttons; Arrow keys are added only inside a declared composite; focus never moves on Realtime refetch; status changes use a polite atomic live region.
- **Responsive contract**: desktop shows list and detail; tablet preserves list with an inline inspector; mobile uses list then detail stack with a persistent Back action and no hidden command rail.
- **Error boundary**: isolates this domain section, sends scrubbed error plus request ID to provider-native diagnostics, preserves neighboring server HTML, and exposes Retry. A render error is never empty data.

### `DeliveryCandidateReviewPanel` (island-local to `NavigationRoutesDiscoveryWorkbench`; DEC-115)

**BE owner**: `04a-navigation-routes-discovery.md` (DLV-NAV-API-05, -06, -07, -08)

```ts
type DeliverySubjectKind =
  'menu_version' | 'route_record' | 'discovery_metadata_version';
type DeliveryReviewState = 'open' | 'approved' | 'rejected' | 'invalidated';
interface DeliveryReviewView {
  reviewId: string;
  subjectKind: DeliverySubjectKind;
  subjectId: string;
  subjectVersion: string;
  state: DeliveryReviewState;
  version: string;
  requiredDecisionCount: number;
  recordedDecisionCount: number;
  decisions: ReadonlyArray<{
    decisionId: string;
    decision: 'approve' | 'reject';
    decidedAt: string;
  }>;
  frozenHash: string;
  permittedNextActions: ReadonlyArray<'decide' | 'assign' | 'resubmit'>;
  submittedAt: string;
  decidedAt: string | null;
}
interface DeliveryCandidateReviewPanelProps {
  children?: never;
  variant: DomainVariant;
  subject: {
    kind: DeliverySubjectKind;
    id: string;
    version: string;
    state:
      'draft' | 'review' | 'approved' | 'active' | 'superseded' | 'revoked';
  };
  review: AsyncState<DeliveryReviewView>;
  access: AccessVariant;
  actorId: string;
  actingPartyId: string;
  onCanonicalRefetch: (
    reason: 'navigation' | 'realtime-hint' | 'mutation' | 'reconnect',
  ) => Promise<void>;
}
```

- The panel renders only what the capability-safe DLV-NAV-API-07 projection returns: the candidate kind and version, review state, required versus recorded decision counts, decision outcomes and times, and the next actions the server permits. It never shows reviewer or grantor identity and never computes authority.
- A route candidate is shown together with the redirect candidate written with it, and the panel states that they are reviewed and approved together. A redirect is never offered as its own subject.
- **Action visibility by server capability.** The editor sees Submit for review only when the candidate is `draft` and `permittedNextActions` allows it, and Resubmit after `rejected` or `invalidated`. The assigned reviewer sees Approve and Reject only when `decide` is permitted. The owner sees Assign reviewer only when `assign` is permitted. The publisher sees the candidate as `approved` and continues in the existing publish flow (DLV-02); an unapproved candidate shows the publish control disabled with the reason "Needs an approved review".
- **Async states.** idle (candidate is `draft`, no review: one action, Submit for review), loading after 250 ms, error per class, success per review state, disabled (reason shown), degraded (503: last-known review state with timestamp and request ID, Retry). There is no empty state beyond "Not yet submitted" and no optimistic state: submit shows a stable pending label, and decide and assign are irreversible and always wait for the server.
- **Review state copy.** `open`: "Waiting for {required} approval, {recorded} recorded." `approved`: "Approved. Ready to publish." `rejected`: "Rejected. The candidate is back in draft." `invalidated`: "Changed since submission. The review was closed and the candidate is back in draft."
- **Conflict copy** (from `REVIEW_CONFLICT` `details.reason`): `live_review_exists` "A review is already open for this version." `subject_not_draft` "Only a draft can be submitted." `submitter_self` "You cannot review your own submission." `repeated_human` "You already decided this review." `review_closed` "This review is closed." `evidence_drift` "This candidate changed after submission, so the review was closed." `ineligible_reviewer` "Choose an existing person who can review." `self_assignment` "The submitter cannot be assigned as reviewer." `assignment_not_found` "That assignment no longer exists." A stale `VERSION_CONFLICT` opens `<SyncConflict>` with the current review version.
- **Step-up.** Decide and assign need recent MFA. `STEP_UP_REQUIRED` focuses the `<CapabilityGate>` heading and offers the protected step-up page with the current record as an allowlisted relative `returnTo` (DEC-111); on return the command is not resent automatically and the form values are retained for an explicit second activation.
- **Confirmation.** Approve and Reject use `<ConfirmationStep>` inline first, naming the consequence ("Approve this candidate for activation" or "Reject and return to draft"), the candidate kind and version, and the step-up state; Escape cancels before commit; duplicate activation returns the same operation.
- **Assign form.** Reviewer chosen by an existing person lookup when one is available to the owner, otherwise a validated UUID input with helper text "Enter the person ID of an existing team member"; expiry is a date-time field with the stated maximum of seven days; optional reason up to 256 characters.
- **A11y inline contract**: the panel is a named region with one heading; counts and state are text with an icon, never color alone; buttons are native; the review state change is announced politely and atomically; focus never moves on refetch; the confirmation heading takes focus and focus returns to the trigger.
- **Responsive contract**: the panel is a single column at every breakpoint, below the record header on mobile, in the inspector on tablet and in the detail rail on desktop; actions keep 44 by 44 px targets on mobile.

| Variant source                     | Capability          | Rendered                                                                  |
| ---------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| Navigation editor in subject scope | submit and resubmit | Submit for review, review status                                          |
| Assigned delivery reviewer         | decide              | Review status, Approve, Reject                                            |
| Owner with assign capability       | assign              | Review status, Assign reviewer                                            |
| CMS publisher                      | publish             | Review status, publish control state                                      |
| Any other visible reader           | read                | Review status only, or `not-rendered` when the server conceals the review |

### Discovery effective-policy region (D24)

Inside the discovery-metadata form of `NavigationRoutesDiscoveryWorkbench`, a read-only region shows the effective result returned by DLV-NAV-API-04: noindex, sitemap exclusion and the blocker, each as text with an icon. Authored fields stay editable; the region states which authored values the platform overrides without naming the protected fact.

| `blocker_code`                                                                    | Region copy                                                                                                            | Control effect                                                          |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `policy_unavailable`                                                              | "Search visibility is locked while policy cannot be checked. This page stays out of search and sitemaps until it can." | noindex and sitemap fields shown locked on                              |
| `settings_noindex`                                                                | "A platform setting keeps pages out of search."                                                                        | noindex locked on                                                       |
| `unclaimed_subject`, `suppressed_subject`, `lifecycle_hold`, `target_not_visible` | "Search visibility is restricted by platform policy." plus the code in monospace                                       | noindex and sitemap locked on; affected optional fields marked redacted |
| none                                                                              | "No platform restriction applies."                                                                                     | authored values apply                                                   |

A `503 DEPENDENCY_UNAVAILABLE` from DLV-NAV-API-04 or DLV-NAV-API-05 shows the degraded state "Policy check is unavailable. Nothing was saved." with Retry and the request ID; the draft form values are retained. The region is a polite live region and does not steal focus.

### Media limit and scan-state surfaces (DEC-116)

Inside `GovernedMediaRenditionsWorkbench`, the upload form sends the declared size and the server decides. `422 PLAN_LIMIT_EXCEEDED` shows an inline field error from `details.maxObjectBytes`: "This file is larger than the current plan limit of {limit}. Choose a smaller file." and keeps every other field; no asset row is shown. After a successful ingest the form shows the returned `maxObjectBytes` as the limit for that upload.

| Asset or rendition state     | Text and icon                                                                                       | Behavior                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `pending_upload`, `uploaded` | "Upload in progress" or "Upload received"                                                           | determinate progress where bytes are known                                 |
| `inspecting`                 | "Scanning for malware" with indeterminate progress                                                  | no preview, no publish control, no rendition control                       |
| `quarantined`                | "Held: the safety check is incomplete. This file cannot be published until scanning finishes."      | publish and rendition controls disabled with the reason; no finding detail |
| `rejected`                   | "Rejected: this file failed the safety check."                                                      | terminal; no finding names, bytes, or preview                              |
| `ready`                      | "Ready"                                                                                             | rendition and reference controls follow rights and accessibility state     |
| rendition `failed_retryable` | "Resizing timed out. Retrying." (`TRANSFORM_TIME_EXCEEDED`)                                         | status only; announced politely                                            |
| rendition `failed_terminal`  | "This image is too large to process for this profile." (`MEDIA_DECODE_LIMIT`, `MEDIA_OUTPUT_LIMIT`) | reference stays blocked; original never offered                            |

Scan and rendition progress are announced politely and never with an assertive alert; a quarantined or rejected state is status content and never an empty media slot.

### Global feedback and command components

| Component                            | Props contract                                                                 | Interactive and accessibility contract                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `<ActionBar>`                        | `{ primary, secondary, destructive, state, expectedVersion, operationId }`     | Native buttons; stable pending label; named destructive consequence; focus returns to trigger; Enter submits only the owning form. |
| `<CapabilityGate>`                   | `{ variant, reasonCode, recoveryHref, disclosure }`                            | `not-rendered` emits no protected label; disabled has reason/recovery; step-up focuses heading; server remains authoritative.      |
| `<FilterBar>`                        | `{ schema, values, resultCount, resetHref }`                                   | Persistent labels; URL commits on Apply; Escape clears only the open combobox; result count is politely announced.                 |
| `<DataTable>`                        | `{ columns, rows, sort, selection, density }`                                  | Semantic table wide; priority list mobile; header buttons expose sort; stable keys; bulk actions name count/scope.                 |
| `<ConfirmationStep>`                 | `{ consequence, affectedScope, expectedVersion, stepUpState, idempotencyKey }` | Inline first; heading focus; Escape cancels before commit; duplicate activation returns same operation.                            |
| `<OfflineStatus>` / `<SyncConflict>` | `{ connectivity, intents, serverVersion, localVersion }`                       | Text plus icon; refused intents remain; conflict actions name outcomes; no automatic overwrite.                                    |

## State Management

| State class         | Source of truth                | Entry trigger                                  | Render and copy                                                                                                       | Exit/persistence                                                               |
| ------------------- | ------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| idle                | URL and server HTML            | Route composed with no client work             | No artificial busy state                                                                                              | User interaction or invalidation                                               |
| loading             | In-flight request descriptor   | Navigation/refetch exceeds 250 ms              | Skeleton for known layout; “Loading current records” inline                                                           | Success, typed error, or cancellation; safe prior content remains when allowed |
| error per class     | BE00 `ApiError`                | Parsed non-success                             | Validation inline; 401 reauthenticate; 403 capability; 404 disclosure-safe; 409 conflict; 429 countdown; 5xx degraded | Explicit recovery; valid input retained                                        |
| empty               | Canonical success              | Zero records or filtered results               | Distinguish no records from filter miss; one legitimate action                                                        | Create/import/invite or Reset filters                                          |
| success             | Server resource and ETag       | Validated 2xx                                  | Canonical facts, state, version, provenance, allowed actions                                                          | Invalidation or command                                                        |
| optimistic-pending  | Local overlay by operation ID  | Reversible command accepted locally            | Pending text/icon; affected controls disabled                                                                         | Confirmed refetch or rollback                                                  |
| optimistic-rollback | Canonical preimage plus error  | Command refused/ambiguous after reconciliation | Restore preimage; announce refusal; retain input                                                                      | Edit/retry/dismiss                                                             |
| disabled            | Capability/config contract     | Known unavailable action                       | Visible reason and prerequisite; no handler                                                                           | Capability/config refetch                                                      |
| degraded            | Last-known-good plus freshness | Dependency/network failure                     | Exact scope, stale timestamp, request ID, Retry/Status                                                                | Canonical refetch                                                              |

- **Server state**: Astro/Hono resources, ETags, cursor pages, job status, and canonical authorization.
- **URL state**: query, sort, filters, cursor, selected record, tab, and return target. It is bookmarkable and Back/Forward safe.
- **Island-local state**: draft fields, disclosure toggles, transient focus, and bounded optimistic overlay. No global client store.
- **Realtime**: entity/event hints only. Deduplicate, preserve focus, refetch canonical data, and apply only currently authorized responses.
- **Multi-tab**: `BroadcastChannel` signals invalidation only. Each tab refetches; no tab writes another tab's canonical cache.
- **Unsaved changes**: retain scoped draft, show inline leave confirmation, use `beforeunload` only while dirty, and clear only after success or explicit discard.
- **Offline**: store non-canonical intents only where BE permits. Reconnect revalidates identity, authority, input, and version; refused intents remain visible.

## Page and Route Definitions

| Route                               | Rendering                                           | Guard and redirect                                                                                                                | Deep-link and history                                                                                                           |
| ----------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/app/cms-delivery-media`           | Astro SSR or cache-safe prerender by route registry | Public exposes public projection; protected verifies session/acting context; admin requires explicit capability and named step-up | Query, cursor, selected record, tab are URL state; invalid values normalize with `replaceState`; Back restores selection/scroll |
| `/app/cms-delivery-media/:recordId` | Server-first detail with bounded islands            | Concealed returns disclosure-safe 404; visible forbidden uses `<CapabilityGate>`; expired session preserves safe return target    | Bookmark resolves current canonical version; stale/deleted target shows exact state and safe parent                             |
| System/degraded boundary            | Preserved shell when safe                           | Unsafe cached content removed for privacy, legal, takedown, or revoked authority                                                  | Retry repeats safe read; mutation status reconciles before retry                                                                |

## Interaction Specification

| Interaction                                   | Trigger and focus                                                                                                                                   | Preconditions                                                                                                                    | Success                                                                                                                                                                | Failure and recovery                                                                                                                                                                                                                                                                 | Persistence                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `DLV-01` Create/edit menu tree                | Native link/button/form; focus stays until navigation or named result heading                                                                       | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency                                              | Render authoritative response/version/provenance/next action; announce status                                                                                          | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                     | URL for navigation/filter; scoped draft before commit; server after success |
| `DLV-02` Publish menu version                 | Native link/button/form; focus stays until navigation or named result heading                                                                       | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency                                              | Render authoritative response/version/provenance/next action; announce status                                                                                          | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                     | URL for navigation/filter; scoped draft before commit; server after success |
| `DLV-03` Create/change slug                   | Native link/button/form; focus stays until navigation or named result heading                                                                       | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency                                              | Render authoritative response/version/provenance/next action; announce status                                                                                          | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                     | URL for navigation/filter; scoped draft before commit; server after success |
| `DLV-04` Configure discovery metadata         | Native link/button/form; focus stays until navigation or named result heading                                                                       | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency                                              | Render authoritative response/version/provenance/next action; announce status                                                                                          | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                     | URL for navigation/filter; scoped draft before commit; server after success |
| `DLV-05` Ingest media                         | Native link/button/form; focus stays until navigation or named result heading                                                                       | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency                                              | Render authoritative response/version/provenance/next action; announce status                                                                                          | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                     | URL for navigation/filter; scoped draft before commit; server after success |
| `DLV-06` Add rights/consent                   | Native link/button/form; focus stays until navigation or named result heading                                                                       | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency                                              | Render authoritative response/version/provenance/next action; announce status                                                                                          | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                     | URL for navigation/filter; scoped draft before commit; server after success |
| `DLV-07` Generate rendition                   | Native link/button/form; focus stays until navigation or named result heading                                                                       | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency                                              | Render authoritative response/version/provenance/next action; announce status                                                                                          | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                     | URL for navigation/filter; scoped draft before commit; server after success |
| `DLV-08` Replace/takedown asset               | Native link/button/form; focus stays until navigation or named result heading                                                                       | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency                                              | Render authoritative response/version/provenance/next action; announce status                                                                                          | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                     | URL for navigation/filter; scoped draft before commit; server after success |
| `DLV-09` Query published content              | Native link/button/form; focus stays until navigation or named result heading                                                                       | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency                                              | Render authoritative response/version/provenance/next action; announce status                                                                                          | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                     | URL for navigation/filter; scoped draft before commit; server after success |
| `DLV-10` Open preview                         | Native link/button/form; focus stays until navigation or named result heading                                                                       | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency                                              | Render authoritative response/version/provenance/next action; announce status                                                                                          | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                     | URL for navigation/filter; scoped draft before commit; server after success |
| `DLV-11` Converge publication                 | Native link/button/form; focus stays until navigation or named result heading                                                                       | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency                                              | Render authoritative response/version/provenance/next action; announce status                                                                                          | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                     | URL for navigation/filter; scoped draft before commit; server after success |
| `DLV-12` Serve degraded/recover               | Native link/button/form; focus stays until navigation or named result heading                                                                       | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency                                              | Render authoritative response/version/provenance/next action; announce status                                                                                          | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                     | URL for navigation/filter; scoped draft before commit; server after success |
| `DLV-13` Apply/release delivery hold          | Native link/button/form; focus stays until navigation or named result heading                                                                       | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency                                              | Render authoritative response/version/provenance/next action; announce status                                                                                          | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                     | URL for navigation/filter; scoped draft before commit; server after success |
| `DLV-14` Revoke delivery eligibility          | Native link/button/form; focus stays until navigation or named result heading                                                                       | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency                                              | Render authoritative response/version/provenance/next action; announce status                                                                                          | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry                                                                                                                                                                                     | URL for navigation/filter; scoped draft before commit; server after success |
| `DLV-15` Submit delivery candidate for review | Native button in the candidate record; focus stays on the button until the result heading                                                           | Candidate is `draft` at the displayed version; editor capability in the subject scope; valid Zod input; ETag and idempotency key | Panel shows the open review, required and recorded decision counts, and the candidate state `review`; polite announcement                                              | `REVIEW_POLICY_UNRESOLVED`, `REVIEW_CONFLICT`, `VERSION_CONFLICT`, `TARGET_NOT_ELIGIBLE`, `TREE_INVALID`, `DISCOVERY_POLICY_BLOCKED`, and 503 keep the draft and name the cause; unknown outcome reconciles through the review read before any retry                                 | Server after success; no local draft needed                                 |
| `DLV-16` Decide delivery candidate review     | `<ConfirmationStep>` opened from the Approve or Reject button; focus moves to its heading and returns to the trigger                                | Review is open; the caller holds an active assignment and capability; recent step-up; the displayed review version is current    | Review and candidate states update from the response; approve names the activation consequence; polite announcement; submitter and others see the new state on refetch | `STEP_UP_REQUIRED` opens the protected step-up page with an allowlisted `returnTo` of this record; `REVIEW_CONFLICT` reasons map to the copy table below; `evidence_drift` shows that the review was invalidated and the candidate returned to draft; decisions are never optimistic | Server after success                                                        |
| `DLV-17` Assign delivery review capability    | Native form (reviewer person lookup or validated UUID input, expiry, optional reason) opened from the review panel; focus moves to the form heading | Owner variant with the assign capability; review is open; recent step-up                                                         | Assignment appears in the review projection as read and decide until its end time; polite announcement                                                                 | `STEP_UP_REQUIRED` as above; `INVALID_EXPIRY`, `REVIEW_CONFLICT` (`ineligible_reviewer`, `self_assignment`, `review_closed`, `assignment_not_found`) map inline to the field or summary; never optimistic                                                                            | Server after success                                                        |

### Network and retry contract

- Read over 250 ms exposes loading; protected commands use the BE deadline and never show false success.
- 429 waits for `Retry-After`, announces remaining wait, and preserves input.
- 502/503/504 retry at most twice after 250 ms and 750 ms only when BE declares safe. Mutations reuse idempotency and reconcile status first.
- Offline/startup failure renders System / Degraded. Last-known-good appears only when policy permits and always includes freshness.
- `<FileUpload>` aborts after 30 seconds with no transferred byte; any byte resets inactivity; cancellation is explicit; quarantined/unverified bytes never appear ready.

### Form contract

| Concern           | Required behavior                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fields            | Generate controls from named Zod request schema. Every field has persistent label, type, required/optional state, help, autocomplete/inputmode, and canonical serialization. Unknown keys are not submitted. |
| Validation timing | Syntax and safe local constraints on blur; cross-field on review/submit; server remains authoritative. No pre-visit error.                                                                                   |
| Error copy        | `VALIDATION_FAILED`: “Check the highlighted fields.” Field copy states rule and correction. `INVALID_REQUEST`: “This request could not be read. Review the form and try again.”                              |
| Submission        | Disable only commit action, preserve width/label, expose pending text, send expected version/idempotency, and ignore duplicate activation.                                                                   |
| Conflict          | Show current server version beside preserved draft. Actions: Review changes, Reapply when permitted, or Discard. Never overwrite automatically.                                                              |
| Completion        | Focus result heading, update URL/version, clear committed draft, and expose exact next action. Important outcomes also enter durable history/notification.                                                   |

## Conditional Rendering Matrix

| Feature/component      | Free                            | Paid                                            | Creator                                  | Guardian                           | Junior                                                      | Business                                        | Staff                                    | Admin                                                           |
| ---------------------- | ------------------------------- | ----------------------------------------------- | ---------------------------------------- | ---------------------------------- | ----------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------- |
| Public/read projection | full public                     | full entitled                                   | full owned/public                        | full mandate-visible               | full age-allowed own/public                                 | full organization public/mandated               | read-only with explicit case capability  | read-only with explicit capability                              |
| Protected command form | not-rendered without capability | full only with server capability, else disabled | full owned/mandated, else not-rendered   | full only within guardian mandate  | partial-hidden for restricted fields, else capability-bound | full only in organization mandate               | full only with operation/case capability | full only with named capability, recent step-up, audited reason |
| Provenance/evidence    | public subset                   | entitled subset                                 | owned/participating subset               | mandate-visible subset             | disclosure-safe age-allowed subset                          | organization-mandated subset                    | case-scoped read-only                    | capability-scoped read-only                                     |
| Destructive/high-risk  | not-rendered                    | disabled unless named capability/step-up        | disabled unless owner capability/step-up | not-rendered unless mandate grants | not-rendered where age policy forbids                       | disabled unless organization capability/step-up | full only named case capability/step-up  | full only named operation capability/step-up                    |

Named variants: `publicRead`, `entitledRead`, `ownerFull`, `guardianMandate`, `juniorRestricted`, `businessMandate`, `staffCaseScoped`, `adminStepUp`, `forbiddenHidden`, and `disabledPrerequisite`. Role labels never grant authority client-side.

## Responsive Behavior

| Breakpoint         | Grid/navigation                                                                       | Workbench/detail                                                                        | Forms/actions                                                             | Tables/media                                                                           |
| ------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Mobile ≤768 px     | 4 columns, 16 px gutter/margins; compact tabs and stack; acting context before writes | List then detail; Back first; inspector inline; no horizontal page scroll at 320 CSS px | One column; labels above; action bar avoids keyboard; 44 by 44 px targets | Priority list preserves every field in expandable facts; media controls wrap logically |
| Tablet 769–1024 px | 8 columns, 20 px gutter, 24 px margins; collapsible sidebar                           | List plus inspector when container permits, else stack; URL selection                   | Two-column only for independent fields; action bar cannot cover errors    | Lower-priority columns move to row details, never disappear                            |
| Desktop ≥1025 px   | 12 columns, 24 px gutter, max 1440 px; sidebar/top bar                                | Stable list/detail split; detail owns heading/action rail                               | Grouped form/review summary; action rail cites context/version            | Compact semantic table, virtualize >100 rows, stable IDs, functional media only        |

- Container queries may switch composition but cannot change semantics, authorization, or consequences.
- 200% zoom and text-spacing overrides retain content/action order. Hover-only disclosure and pointer-only reordering are prohibited.

## Accessibility Inventory

| Component/interaction  | WCAG requirement                     | Keyboard/focus                                                                          | Screen reader/semantics                                                   | IA source                                                 |
| ---------------------- | ------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| Route shell/navigation | 1.3.1, 2.4.1–2.4.3, 2.4.7/2.4.11     | Skip link; logical DOM; route focuses `h1`                                              | Named landmarks, one main, `aria-current=page`, unique title              | `04-cms-delivery-media.md` Accessibility/User Flows       |
| Workbench selection    | 1.3.1, 2.1.1, 2.4.3, 4.1.2           | Native controls; Enter opens; Escape closes bounded inspector; focus returns            | Named list/detail; selected state; state/provenance text                  | `04-cms-delivery-media.md` Interactions/Access Control    |
| Forms/validation       | 1.3.1, 3.3.1–3.3.4, 4.1.3            | Persistent labels; linked summary focuses first invalid field; no trap                  | `aria-invalid`, `aria-describedby`, error links, polite status            | `04-cms-delivery-media.md` Acceptance Criteria/Edge Cases |
| Async/refetch/conflict | 2.2.1, 2.4.3, 4.1.3                  | Refresh never steals focus; Retry native; conflict begins at heading                    | Polite atomic update; stale/pending/failed text; request ID               | `04-cms-delivery-media.md` Interactions/BE failures       |
| Tables/filters         | 1.3.1, 1.4.10, 2.1.1, 2.5.8          | Header buttons; Apply/Reset; 24 CSS px minimum, 44 preferred                            | Caption, headers, sort, count, active-filter summary                      | `04-cms-delivery-media.md` User Flows/responsive          |
| High-risk confirmation | 2.1.2, 2.4.3, 3.3.4, 4.1.2           | Inline first; dialog heading focus, Tab containment, Escape before commit, return focus | Consequence, scope, version, context, step-up, irreversible effect        | `04-cms-delivery-media.md` Access Control/Edge Cases      |
| Motion/media           | 1.2.x where applicable, 2.2.2, 2.3.3 | Media keyboard controls; pause/stop; no essential timed gesture                         | Captions/transcript/metadata; reduced motion; waveform never sole content | `04-cms-delivery-media.md` Accessibility                  |

The inventory exceeds the thin-coverage threshold and is woven into component contracts. WCAG 2.2 AA is the release floor, exceeding the requested 2.1 AA gate.

## FE Rubric Closure

This section makes every FE-rubric checkpoint explicit. It narrows implementation choices without changing any upstream product, permission, security, or data contract.

### Complete component contracts

Every local component interface above includes `children?: never` and a `DomainVariant`. “Never” is deliberate because Astro slots and canonical global components own composition; these route/workbench boundaries do not accept arbitrary children.

| Component                               | Props interface                                                                              | Children                                                                | Named variants                                                                                                                                                                   | BE/IA source                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `CmsDeliveryMediaRoute`                 | `CmsDeliveryMediaRouteProps`                                                                 | `never`                                                                 | `publicPage`, `appPage`, `adminPage`, `authPage`, `degradedPage`                                                                                                                 | `04-cms-delivery-media.md` user flows/accessibility; design-system page archetypes                                 |
| `NavigationRoutesDiscoveryWorkbench`    | `NavigationRoutesDiscoveryWorkbenchProps`                                                    | `never`                                                                 | `publicRead`, `entitledRead`, `ownerFull`, `guardianMandate`, `juniorRestricted`, `businessMandate`, `staffCaseScoped`, `adminStepUp`, `forbiddenHidden`, `disabledPrerequisite` | `04a-navigation-routes-discovery.md` request/response fields; `04-cms-delivery-media.md` interactions/access rules |
| `GovernedMediaRenditionsWorkbench`      | `GovernedMediaRenditionsWorkbenchProps`                                                      | `never`                                                                 | `publicRead`, `entitledRead`, `ownerFull`, `guardianMandate`, `juniorRestricted`, `businessMandate`, `staffCaseScoped`, `adminStepUp`, `forbiddenHidden`, `disabledPrerequisite` | `04b-governed-media-renditions.md` request/response fields; `04-cms-delivery-media.md` interactions/access rules   |
| `PublicDeliveryCacheWorkbench`          | `PublicDeliveryCacheWorkbenchProps`                                                          | `never`                                                                 | `publicRead`, `entitledRead`, `ownerFull`, `guardianMandate`, `juniorRestricted`, `businessMandate`, `staffCaseScoped`, `adminStepUp`, `forbiddenHidden`, `disabledPrerequisite` | `04c-public-delivery-cache.md` request/response fields; `04-cms-delivery-media.md` interactions/access rules       |
| Global primitives consumed by this spec | Canonical interfaces from design-system Global Component Inventory; local wrappers forbidden | Canonical slot only where that interface declares it, otherwise `never` | `default`, `hover`, `focus`, `active`, `disabled`, `loading`, `error` plus semantic/access variants named above                                                                  | `design-system.md` Global Component Inventory and State Language                                                   |

### IA flow to page/component ownership

| IA flow                                       | Trigger/response owner                                                                                                                                                                            | Source citation                                      | Visual feedback and timing                                                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DLV-01` Create/edit menu tree                | `CmsDeliveryMediaRoute` orchestrates; `NavigationRoutesDiscoveryWorkbench`, `GovernedMediaRenditionsWorkbench`, `PublicDeliveryCacheWorkbench` renders the relevant BE response and command state | `04-cms-delivery-media.md` Interactions row `DLV-01` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `DLV-02` Publish menu version                 | `CmsDeliveryMediaRoute` orchestrates; `NavigationRoutesDiscoveryWorkbench`, `GovernedMediaRenditionsWorkbench`, `PublicDeliveryCacheWorkbench` renders the relevant BE response and command state | `04-cms-delivery-media.md` Interactions row `DLV-02` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `DLV-03` Create/change slug                   | `CmsDeliveryMediaRoute` orchestrates; `NavigationRoutesDiscoveryWorkbench`, `GovernedMediaRenditionsWorkbench`, `PublicDeliveryCacheWorkbench` renders the relevant BE response and command state | `04-cms-delivery-media.md` Interactions row `DLV-03` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `DLV-04` Configure discovery metadata         | `CmsDeliveryMediaRoute` orchestrates; `NavigationRoutesDiscoveryWorkbench`, `GovernedMediaRenditionsWorkbench`, `PublicDeliveryCacheWorkbench` renders the relevant BE response and command state | `04-cms-delivery-media.md` Interactions row `DLV-04` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `DLV-05` Ingest media                         | `CmsDeliveryMediaRoute` orchestrates; `NavigationRoutesDiscoveryWorkbench`, `GovernedMediaRenditionsWorkbench`, `PublicDeliveryCacheWorkbench` renders the relevant BE response and command state | `04-cms-delivery-media.md` Interactions row `DLV-05` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `DLV-06` Add rights/consent                   | `CmsDeliveryMediaRoute` orchestrates; `NavigationRoutesDiscoveryWorkbench`, `GovernedMediaRenditionsWorkbench`, `PublicDeliveryCacheWorkbench` renders the relevant BE response and command state | `04-cms-delivery-media.md` Interactions row `DLV-06` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `DLV-07` Generate rendition                   | `CmsDeliveryMediaRoute` orchestrates; `NavigationRoutesDiscoveryWorkbench`, `GovernedMediaRenditionsWorkbench`, `PublicDeliveryCacheWorkbench` renders the relevant BE response and command state | `04-cms-delivery-media.md` Interactions row `DLV-07` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `DLV-08` Replace/takedown asset               | `CmsDeliveryMediaRoute` orchestrates; `NavigationRoutesDiscoveryWorkbench`, `GovernedMediaRenditionsWorkbench`, `PublicDeliveryCacheWorkbench` renders the relevant BE response and command state | `04-cms-delivery-media.md` Interactions row `DLV-08` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `DLV-09` Query published content              | `CmsDeliveryMediaRoute` orchestrates; `NavigationRoutesDiscoveryWorkbench`, `GovernedMediaRenditionsWorkbench`, `PublicDeliveryCacheWorkbench` renders the relevant BE response and command state | `04-cms-delivery-media.md` Interactions row `DLV-09` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `DLV-10` Open preview                         | `CmsDeliveryMediaRoute` orchestrates; `NavigationRoutesDiscoveryWorkbench`, `GovernedMediaRenditionsWorkbench`, `PublicDeliveryCacheWorkbench` renders the relevant BE response and command state | `04-cms-delivery-media.md` Interactions row `DLV-10` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `DLV-11` Converge publication                 | `CmsDeliveryMediaRoute` orchestrates; `NavigationRoutesDiscoveryWorkbench`, `GovernedMediaRenditionsWorkbench`, `PublicDeliveryCacheWorkbench` renders the relevant BE response and command state | `04-cms-delivery-media.md` Interactions row `DLV-11` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `DLV-12` Serve degraded/recover               | `CmsDeliveryMediaRoute` orchestrates; `NavigationRoutesDiscoveryWorkbench`, `GovernedMediaRenditionsWorkbench`, `PublicDeliveryCacheWorkbench` renders the relevant BE response and command state | `04-cms-delivery-media.md` Interactions row `DLV-12` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `DLV-13` Apply/release delivery hold          | `CmsDeliveryMediaRoute` orchestrates; `NavigationRoutesDiscoveryWorkbench`, `GovernedMediaRenditionsWorkbench`, `PublicDeliveryCacheWorkbench` renders the relevant BE response and command state | `04-cms-delivery-media.md` Interactions row `DLV-13` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `DLV-14` Revoke delivery eligibility          | `CmsDeliveryMediaRoute` orchestrates; `NavigationRoutesDiscoveryWorkbench`, `GovernedMediaRenditionsWorkbench`, `PublicDeliveryCacheWorkbench` renders the relevant BE response and command state | `04-cms-delivery-media.md` Interactions row `DLV-14` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `DLV-15` Submit delivery candidate for review | `CmsDeliveryMediaRoute` orchestrates; `NavigationRoutesDiscoveryWorkbench` renders the `DeliveryCandidateReviewPanel` response and command state                                                  | `04-cms-delivery-media.md` Interactions row `DLV-15` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `DLV-16` Decide delivery candidate review     | `CmsDeliveryMediaRoute` orchestrates; `NavigationRoutesDiscoveryWorkbench` renders the `DeliveryCandidateReviewPanel` response and command state                                                  | `04-cms-delivery-media.md` Interactions row `DLV-16` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `DLV-17` Assign delivery review capability    | `CmsDeliveryMediaRoute` orchestrates; `NavigationRoutesDiscoveryWorkbench` renders the `DeliveryCandidateReviewPanel` response and command state                                                  | `04-cms-delivery-media.md` Interactions row `DLV-17` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |

Every IA interaction row is represented above. No flow is inferred from a heading or omitted because it shares an endpoint.

### Server, URL, and client state query registry

| BE operation/query                                         | Server-state key                                                                                                                    | URL state                                                                                                              | Island-local state                                                                                                              | All async render states                                                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `DLV-NAV-API-01` from `04a-navigation-routes-discovery.md` | `['DLV-NAV-API-01', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only                             | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `DLV-04B-01` from `04b-governed-media-renditions.md`       | `['DLV-04B-01', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag     | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only                             | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `DLV-04B-02` from `04b-governed-media-renditions.md`       | `['DLV-04B-02', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag     | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only                             | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `DLV-04B-03` from `04b-governed-media-renditions.md`       | `['DLV-04B-03', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag     | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only                             | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `DLV-04B-04` from `04b-governed-media-renditions.md`       | `['DLV-04B-04', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag     | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only                             | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `DLV-DEL-API-01` from `04c-public-delivery-cache.md`       | `['DLV-DEL-API-01', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only                             | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `DLV-NAV-API-02` from `04a-navigation-routes-discovery.md` | `['DLV-NAV-API-02', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only                             | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `DLV-NAV-API-03` from `04a-navigation-routes-discovery.md` | `['DLV-NAV-API-03', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only                             | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `DLV-NAV-API-04` from `04a-navigation-routes-discovery.md` | `['DLV-NAV-API-04', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only                             | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `DLV-NAV-API-05` from `04a-navigation-routes-discovery.md` | `['DLV-NAV-API-05', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only                             | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `DLV-NAV-API-06` from `04a-navigation-routes-discovery.md` | `['DLV-NAV-API-06', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, and pending operation ID only; no optimistic overlay because the command is irreversible | idle, loading after 250 ms, typed error per class, success, disabled, degraded                                                 |
| `DLV-NAV-API-07` from `04a-navigation-routes-discovery.md` | `['DLV-NAV-API-07', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only                             | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `DLV-NAV-API-08` from `04a-navigation-routes-discovery.md` | `['DLV-NAV-API-08', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, and pending operation ID only; no optimistic overlay because the command is irreversible | idle, loading after 250 ms, typed error per class, success, disabled, degraded                                                 |
| `DLV-DEL-API-02` from `04c-public-delivery-cache.md`       | `['DLV-DEL-API-02', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only                             | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `DLV-DEL-API-03` from `04c-public-delivery-cache.md`       | `['DLV-DEL-API-03', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only                             | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `DLV-DEL-API-04` from `04c-public-delivery-cache.md`       | `['DLV-DEL-API-04', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only                             | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `DLV-DEL-API-05` from `04c-public-delivery-cache.md`       | `['DLV-DEL-API-05', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only                             | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `DLV-DEL-API-06` from `04c-public-delivery-cache.md`       | `['DLV-DEL-API-06', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only                             | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |

No global client store is authorized. A new cross-island state need requires architecture review; until then URL/server state or a colocated island state owns it.

### Route registry with guards and metadata

| URL pattern                                    | Auth guard and failure redirect                                                                                                                                                                                                                                                                      | Page component                                                     | Meta title                          | Meta description                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------- | ---------------------------------- |
| `/app/cms-delivery-media`                      | Server validates Supabase token, expiry, acting context, and route capability. Missing/expired token redirects 303 to `/auth/sign-in?returnTo=%2Fapp%2Fcms-delivery-media` after allowlist normalization. Valid but concealed target returns 404; visible forbidden target renders `CapabilityGate`. | `CmsDeliveryMediaRoute` variant `appPage`                          | `CMS navigation, media and delivery | WeJammin`                          | `Work with cms navigation, media and delivery using current authority, record state, and provenance.` |
| `/app/cms-delivery-media/:recordId`            | Same token/expiry/context check; malformed ID returns 400, concealed/unreadable returns 404, expired session uses the same safe sign-in redirect.                                                                                                                                                    | `CmsDeliveryMediaRoute` with the matching workbench detail variant | `Record                             | CMS navigation, media and delivery | WeJammin`                                                                                             | `Review the current record, provenance, history, and permitted actions.` |
| Public projection when a BE route declares one | No session accepted as authority; public projection only. Unsafe or non-public record returns disclosure-safe 404, never app-shell redirect.                                                                                                                                                         | `CmsDeliveryMediaRoute` variant `publicPage`                       | `CMS navigation, media and delivery | WeJammin`                          | `View the public, provenance-labelled record.`                                                        |
| System/degraded boundary                       | Preserves verified shell only; Retry stays on canonical URL; unsafe cached data is removed.                                                                                                                                                                                                          | `CmsDeliveryMediaRoute` variant `degradedPage`                     | `Service status                     | WeJammin`                          | `Review affected scope, last verified time, request ID, and recovery action.`                         |

### Per-component responsive contract

| Component                                                        | Mobile ≤768 px                                                                                                                       | Tablet 769–1024 px                                                                                                                      | Desktop ≥1025 px                                                                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `CmsDeliveryMediaRoute`                                          | Four-column shell, 16 px gutter/margins, compact tabs, stack navigation, Back before detail, no horizontal page scroll at 320 CSS px | Eight-column shell, 20 px gutter, 24 px margins, collapsible sidebar, list/inspector when container permits                             | Twelve-column shell, 24 px gutter, max 1440 px, persistent sidebar/top bar, stable route heading/action region               |
| `NavigationRoutesDiscoveryWorkbench`                             | List then detail stack; priority facts remain; action bar avoids virtual keyboard; controls at least 44 by 44 px                     | List plus inline inspector or stack by container; two-column fields only when independent; lower-priority columns move into row details | List/detail workbench; compact semantic table; virtualize over 100 rows; detail/action rail shows acting context and version |
| `GovernedMediaRenditionsWorkbench`                               | List then detail stack; priority facts remain; action bar avoids virtual keyboard; controls at least 44 by 44 px                     | List plus inline inspector or stack by container; two-column fields only when independent; lower-priority columns move into row details | List/detail workbench; compact semantic table; virtualize over 100 rows; detail/action rail shows acting context and version |
| `PublicDeliveryCacheWorkbench`                                   | List then detail stack; priority facts remain; action bar avoids virtual keyboard; controls at least 44 by 44 px                     | List plus inline inspector or stack by container; two-column fields only when independent; lower-priority columns move into row details | List/detail workbench; compact semantic table; virtualize over 100 rows; detail/action rail shows acting context and version |
| Global `FilterBar`, `DataTable`, `ActionBar`, `ConfirmationStep` | Apply/Reset and priority-list form; action labels remain text; confirmation becomes separate review step                             | Wrapped toolbar and row detail expansion; no hidden material field                                                                      | Full typed filter/table/action composition; same semantics and authorization                                                 |

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

| Page/component                            |                            JavaScript budget (gzip) | Lazy loading                                                                                                                                                    | Image/media policy                                                                                                                                              | Runtime targets                                                    |
| ----------------------------------------- | --------------------------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `CmsDeliveryMediaRoute` public variant    | ≤45 KB initial route JS; zero hydration when static | Hydrate only a visible interaction with `client:visible`; no global router                                                                                      | Astro image pipeline emits width/height, AVIF/WebP plus fallback, responsive `srcset`/`sizes`; below-fold images lazy; hero/record identity eager only when LCP | LCP <2.5 s, INP <200 ms, CLS <0.1 at p75                           |
| `CmsDeliveryMediaRoute` app/admin variant |      ≤90 KB initial route JS including shared shell | Each workbench island ≤35 KB initial; editor/media/chart modules split to ≤80 KB lazy chunk and load on explicit entry/visibility; independent fetches parallel | Same optimized image contract; audio/video metadata preload only until explicit play; waveform data lazy and functional                                         | LCP <2.5 s, INP <200 ms, CLS <0.1; interaction feedback same frame |
| `NavigationRoutesDiscoveryWorkbench`      |                               ≤35 KB hydrated entry | Detail/editor/media/export modules dynamic-import on selection; list over 100 virtualizes; no barrel import                                                     | Preserve intrinsic dimensions; thumbnails use bounded variants; originals never download for list rows                                                          | Long task off main thread or chunked; no task >50 ms during input  |
| `GovernedMediaRenditionsWorkbench`        |                               ≤35 KB hydrated entry | Detail/editor/media/export modules dynamic-import on selection; list over 100 virtualizes; no barrel import                                                     | Preserve intrinsic dimensions; thumbnails use bounded variants; originals never download for list rows                                                          | Long task off main thread or chunked; no task >50 ms during input  |
| `PublicDeliveryCacheWorkbench`            |                               ≤35 KB hydrated entry | Detail/editor/media/export modules dynamic-import on selection; list over 100 virtualizes; no barrel import                                                     | Preserve intrinsic dimensions; thumbnails use bounded variants; originals never download for list rows                                                          | Long task off main thread or chunked; no task >50 ms during input  |

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

| BE source                            | Fields/validation                                                                                                                                                   | Error display                                                                                              | Submission and success                                                                                                                         | Security                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `04a-navigation-routes-discovery.md` | Exact named Zod request schema: type, optionality, default, min/max/enum/format, cross-field rule; safe local checks on blur and full authoritative check on submit | Linked summary plus exact field errors; preserve all valid and server-accepted input; no raw upstream copy | One idempotent commit with expected version; stable pending label; parsed authoritative response replaces draft; result heading receives focus | CSRF/origin rule by credential mode, unknown-key rejection, allowlist sanitization, framework output encoding, secret/PII redaction |
| `04b-governed-media-renditions.md`   | Exact named Zod request schema: type, optionality, default, min/max/enum/format, cross-field rule; safe local checks on blur and full authoritative check on submit | Linked summary plus exact field errors; preserve all valid and server-accepted input; no raw upstream copy | One idempotent commit with expected version; stable pending label; parsed authoritative response replaces draft; result heading receives focus | CSRF/origin rule by credential mode, unknown-key rejection, allowlist sanitization, framework output encoding, secret/PII redaction |
| `04c-public-delivery-cache.md`       | Exact named Zod request schema: type, optionality, default, min/max/enum/format, cross-field rule; safe local checks on blur and full authoritative check on submit | Linked summary plus exact field errors; preserve all valid and server-accepted input; no raw upstream copy | One idempotent commit with expected version; stable pending label; parsed authoritative response replaces draft; result heading receives focus | CSRF/origin rule by credential mode, unknown-key rejection, allowlist sanitization, framework output encoding, secret/PII redaction |

## Data Mapping

Every BE operation and parsed response field is owned below. Components consume generated Zod-inferred types; no hand-written partial DTO may silently omit a field. A field is displayed, drives explicit state/control, or is non-rendered for a named security reason.

| BE source                            | Operation        | Method/path                                                        | Success to component                                                                                                                                                                         | Error mapping                                                                     |
| ------------------------------------ | ---------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `04a-navigation-routes-discovery.md` | `DLV-NAV-API-01` | `REGISTERED See 04a-navigation-routes-discovery.md route registry` | `2xx` parsed into `NavigationRoutesDiscoveryWorkbench`; update only after validation                                                                                                         | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04a-navigation-routes-discovery.md` | `DLV-NAV-API-02` | `REGISTERED See 04a-navigation-routes-discovery.md route registry` | `2xx` parsed into `NavigationRoutesDiscoveryWorkbench`; update only after validation                                                                                                         | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04a-navigation-routes-discovery.md` | `DLV-NAV-API-03` | `REGISTERED See 04a-navigation-routes-discovery.md route registry` | `2xx` parsed into `NavigationRoutesDiscoveryWorkbench`; update only after validation                                                                                                         | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04a-navigation-routes-discovery.md` | `DLV-NAV-API-04` | `REGISTERED See 04a-navigation-routes-discovery.md route registry` | `2xx` parsed into `NavigationRoutesDiscoveryWorkbench`; update only after validation                                                                                                         | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04a-navigation-routes-discovery.md` | `DLV-NAV-API-05` | `REGISTERED See 04a-navigation-routes-discovery.md route registry` | `2xx` parsed into `NavigationRoutesDiscoveryWorkbench`; update only after validation                                                                                                         | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04a-navigation-routes-discovery.md` | `DLV-NAV-API-06` | `REGISTERED See 04a-navigation-routes-discovery.md route registry` | `2xx` parsed into `NavigationRoutesDiscoveryWorkbench`; update only after validation                                                                                                         | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04a-navigation-routes-discovery.md` | `DLV-NAV-API-07` | `REGISTERED See 04a-navigation-routes-discovery.md route registry` | `2xx` parsed into `NavigationRoutesDiscoveryWorkbench`; update only after validation                                                                                                         | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04a-navigation-routes-discovery.md` | `DLV-NAV-API-08` | `REGISTERED See 04a-navigation-routes-discovery.md route registry` | `2xx` parsed into `NavigationRoutesDiscoveryWorkbench`; update only after validation                                                                                                         | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04b-governed-media-renditions.md`   | `DLV-04B-01`     | `REGISTERED See 04b-governed-media-renditions.md route registry`   | `2xx` parsed into `GovernedMediaRenditionsWorkbench`; update only after validation                                                                                                           | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04b-governed-media-renditions.md`   | `DLV-04B-02`     | `REGISTERED See 04b-governed-media-renditions.md route registry`   | `2xx` parsed into `GovernedMediaRenditionsWorkbench`; update only after validation                                                                                                           | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04b-governed-media-renditions.md`   | `DLV-04B-03`     | `REGISTERED See 04b-governed-media-renditions.md route registry`   | `2xx` parsed into `GovernedMediaRenditionsWorkbench`; update only after validation                                                                                                           | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04b-governed-media-renditions.md`   | `DLV-04B-04`     | `REGISTERED See 04b-governed-media-renditions.md route registry`   | `2xx` parsed into `GovernedMediaRenditionsWorkbench`; update only after validation                                                                                                           | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04b-governed-media-renditions.md`   | `DLV-04B-05`     | `REGISTERED See 04b-governed-media-renditions.md route registry`   | Internal scanner lease; the browser never calls it; scan progress reaches the UI only as the asset `state` of DLV-04B-01 and lifecycle reads, parsed into `GovernedMediaRenditionsWorkbench` | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04b-governed-media-renditions.md`   | `DLV-04B-06`     | `REGISTERED See 04b-governed-media-renditions.md route registry`   | Internal scanner verdict; the browser never calls it; its effect reaches the UI only as the asset `state`, parsed into `GovernedMediaRenditionsWorkbench`                                    | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04c-public-delivery-cache.md`       | `DLV-DEL-API-01` | `REGISTERED See 04c-public-delivery-cache.md route registry`       | `2xx` parsed into `PublicDeliveryCacheWorkbench`; update only after validation                                                                                                               | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04c-public-delivery-cache.md`       | `DLV-DEL-API-02` | `REGISTERED See 04c-public-delivery-cache.md route registry`       | `2xx` parsed into `PublicDeliveryCacheWorkbench`; update only after validation                                                                                                               | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04c-public-delivery-cache.md`       | `DLV-DEL-API-03` | `REGISTERED See 04c-public-delivery-cache.md route registry`       | `2xx` parsed into `PublicDeliveryCacheWorkbench`; update only after validation                                                                                                               | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04c-public-delivery-cache.md`       | `DLV-DEL-API-04` | `REGISTERED See 04c-public-delivery-cache.md route registry`       | `2xx` parsed into `PublicDeliveryCacheWorkbench`; update only after validation                                                                                                               | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04c-public-delivery-cache.md`       | `DLV-DEL-API-05` | `REGISTERED See 04c-public-delivery-cache.md route registry`       | `2xx` parsed into `PublicDeliveryCacheWorkbench`; update only after validation                                                                                                               | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `04c-public-delivery-cache.md`       | `DLV-DEL-API-06` | `REGISTERED See 04c-public-delivery-cache.md route registry`       | `2xx` parsed into `PublicDeliveryCacheWorkbench`; update only after validation                                                                                                               | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |

### Response field ownership

| BE source                            | Contract schemas     | Parsed field set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | UI ownership                                                                                                                                                                                                                                        |
| ------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `04a-navigation-routes-discovery.md` | Named source schemas | `Menu`, `MenuVersion`, `MenuItemVersion`, `RouteRecord`, `RedirectRecord`, `DiscoveryMetadataVersion`, `CreateMenuVersionRequest`, `CreateMenuVersionSuccess`, `ErrorResponse`, `PublishMenuVersionRequest`, `PublishMenuVersionSuccess`, `SlugRequest`, `SlugSuccess`, `DiscoveryMetadataRequest`, `DiscoveryMetadataSuccess`, `SubmitDeliveryReviewRequest`, `DeliveryReviewResource`, `DecideDeliveryReviewRequest`, `DeliveryReviewDecisionResource`, `AssignDeliveryReviewRequest`, `DeliveryReviewAssignmentResource`, `DeliverySubjectKind`, `DeliveryReviewState`, `primary`, `utility`, `footer`, `legal`, `account`, `expected_version`, `service_role` | `NavigationRoutesDiscoveryWorkbench`: identity/version/state in `<RecordHeader>`; provenance in `<ProvenanceFact>`; command/status in `<ActionBar>`/`<StateLabel>`; remaining authorized facts in detail rows; security-only fields never serialize |
| `04b-governed-media-renditions.md`   | Named source schemas | `AssetRecord`, `AssetRight`, `AssetAccessibility`, `TransformProfileVersion`, `RenditionRecord`, `AssetReference`, `TakedownCaseLink`, `PlanLimitProfile`, `AssetIngestRequest`, `AssetIngestResource`, `AssetRightCreateRequest`, `AssetRightResource`, `RenditionGenerateRequest`, `RenditionAcceptedResource`, `ReferenceDecision`, `LifecycleActionRequest`, `LifecycleActionResource`, `AssetState`, `RightState`, `RenditionState`, `ApiError`; the scanner schemas of the internal DLV-04B-05 and DLV-04B-06 are never serialized to the browser                                                                                                           | `GovernedMediaRenditionsWorkbench`: identity/version/state in `<RecordHeader>`; provenance in `<ProvenanceFact>`; command/status in `<ActionBar>`/`<StateLabel>`; remaining authorized facts in detail rows; security-only fields never serialize   |
| `04c-public-delivery-cache.md`       | Named source schemas | `PublicationProjection`, `ProjectionConsumerState`, `DeliveryPurgeRecord` (defined in 04b and consumed by 04c), `active_delivery_pointer`, `preview_session`, `publication_projection`, `projection_consumer_state`, `AssetRight`, `PublishedContentRequest`, `PublishedContentSuccess`, `ErrorResponse`, `PreviewRequest`, `PreviewSuccess`, `ConvergeRequest`, `ConvergeSuccess`, `RecoverRequest`, `RecoverSuccess`, `HoldRequest`, `HoldSuccess`, `RevocationRequest`, `RevocationSuccess`, `case_id`, `anon`, `partial`, `noindex`                                                                                                                           | `PublicDeliveryCacheWorkbench`: identity/version/state in `<RecordHeader>`; provenance in `<ProvenanceFact>`; command/status in `<ActionBar>`/`<StateLabel>`; remaining authorized facts in detail rows; security-only fields never serialize       |

### Exhaustive BE field and error ownership

The unions below are generated from every contract identifier in each complete BE source, not a representative sample. Request-only identifiers remain because their owning form consumes them; response identifiers remain because the workbench renders them or uses them for explicit state/control. Generated Zod types remain normative if this conservative union includes a non-field identifier.

```ts
type NavigationRoutesDiscoveryContractField =
  | 'ApiError'
  | 'AssignDeliveryReviewRequest'
  | 'CreateMenuVersionRequest'
  | 'CreateMenuVersionSuccess'
  | 'DecideDeliveryReviewRequest'
  | 'DeliveryReviewAssignmentResource'
  | 'DeliveryReviewDecisionResource'
  | 'DeliveryReviewResource'
  | 'DeliveryReviewState'
  | 'DeliverySubjectKind'
  | 'DiscoveryMetadataRequest'
  | 'DiscoveryMetadataSuccess'
  | 'DiscoveryMetadataVersion'
  | 'ErrorResponse'
  | 'Menu'
  | 'MenuItemVersion'
  | 'MenuVersion'
  | 'PublishMenuVersionRequest'
  | 'PublishMenuVersionSuccess'
  | 'RedirectRecord'
  | 'RouteRecord'
  | 'SlugRequest'
  | 'SlugSuccess'
  | 'SubmitDeliveryReviewRequest'
  | 'account'
  | 'expected_version'
  | 'footer'
  | 'legal'
  | 'primary'
  | 'service_role'
  | 'utility';
interface NavigationRoutesDiscoveryWorkbenchContractFields {
  source: '04a-navigation-routes-discovery.md';
  fields: Readonly<Record<NavigationRoutesDiscoveryContractField, unknown>>;
}
```

```ts
type GovernedMediaRenditionsContractField =
  | 'ApiError'
  | 'AssetAccessibility'
  | 'AssetIngestRequest'
  | 'AssetIngestResource'
  | 'AssetRecord'
  | 'AssetReference'
  | 'AssetRight'
  | 'AssetRightCreateRequest'
  | 'AssetRightResource'
  | 'AssetState'
  | 'LifecycleActionRequest'
  | 'LifecycleActionResource'
  | 'PlanLimitProfile'
  | 'ReferenceDecision'
  | 'RenditionAcceptedResource'
  | 'RenditionGenerateRequest'
  | 'RenditionRecord'
  | 'RenditionState'
  | 'RightState'
  | 'TakedownCaseLink'
  | 'TransformProfileVersion';
interface GovernedMediaRenditionsWorkbenchContractFields {
  source: '04b-governed-media-renditions.md';
  fields: Readonly<Record<GovernedMediaRenditionsContractField, unknown>>;
}
```

```ts
type PublicDeliveryCacheContractField =
  | 'ApiError'
  | 'AssetRight'
  | 'ConvergeRequest'
  | 'ConvergeSuccess'
  | 'DeliveryPurgeRecord'
  | 'ErrorResponse'
  | 'HoldRequest'
  | 'HoldSuccess'
  | 'PreviewRequest'
  | 'PreviewSuccess'
  | 'ProjectionConsumerState'
  | 'PublicationProjection'
  | 'PublishedContentRequest'
  | 'PublishedContentSuccess'
  | 'RecoverRequest'
  | 'RecoverSuccess'
  | 'RevocationRequest'
  | 'RevocationSuccess'
  | 'active_delivery_pointer'
  | 'anon'
  | 'case_id'
  | 'noindex'
  | 'partial'
  | 'preview_session'
  | 'projection_consumer_state'
  | 'publication_projection';
interface PublicDeliveryCacheWorkbenchContractFields {
  source: '04c-public-delivery-cache.md';
  fields: Readonly<Record<PublicDeliveryCacheContractField, unknown>>;
}
```

| BE source                            | Owning component/prop                                                                                                  | Every discovered application error code                                                                                                                                                                                                                                                                                                                                                                                                                                                            | UI state owner                                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `04a-navigation-routes-discovery.md` | `NavigationRoutesDiscoveryWorkbenchContractFields.fields` and `NavigationRoutesDiscoveryWorkbenchProps.contractFields` | `CANONICAL_INVALID`, `DEPENDENCY_UNAVAILABLE`, `DISCOVERY_POLICY_BLOCKED`, `FORBIDDEN`, `IDEMPOTENCY_MISMATCH`, `MENU_NOT_FOUND`, `MENU_VERSION_NOT_FOUND`, `INVALID_EXPIRY`, `PUBLICATION_NOT_FOUND`, `PUBLISH_BLOCKED`, `RATE_LIMITED`, `REDIRECT_GRAPH_INVALID`, `REVIEW_CONFLICT`, `REVIEW_NOT_FOUND`, `REVIEW_POLICY_UNRESOLVED`, `ROUTE_CONFLICT`, `STEP_UP_REQUIRED`, `SUBJECT_NOT_FOUND`, `TREE_HASH_MISMATCH`, `TREE_INVALID`, `UNAUTHENTICATED`, `VALIDATION_FAILED`, `VERSION_CONFLICT` | validation/input → linked summary; auth/permission → auth or capability gate; not-found → disclosure-safe route/row; conflict/stale/mismatch/duplicate → sync conflict; rate → retry wait; dependency/timeout/unavailable → degraded; blocked/failed/cancelled/revoked → exact terminal state and legitimate recovery |
| `04b-governed-media-renditions.md`   | `GovernedMediaRenditionsWorkbenchContractFields.fields` and `GovernedMediaRenditionsWorkbenchProps.contractFields`     | `ASSET_NOT_READY`, `CONFLICT`, `DEPENDENCY_UNAVAILABLE`, `ERASURE_BLOCKED`, `FORBIDDEN`, `HOLD_CONFLICT`, `IDEMPOTENCY_MISMATCH`, `INVALID_REQUEST`, `MEDIA_DECODE_LIMIT`, `MEDIA_INELIGIBLE`, `MEDIA_OUTPUT_LIMIT`, `NOT_FOUND`, `PLAN_LIMIT_EXCEEDED`, `PROFILE_NOT_ALLOWED`, `RATE_LIMITED`, `RIGHT_DUPLICATE`, `TRANSFORM_TIME_EXCEEDED`, `UNAUTHENTICATED`, `VALIDATION_FAILED`, `VERSION_MISMATCH`                                                                                           | validation/input → linked summary; auth/permission → auth or capability gate; not-found → disclosure-safe route/row; conflict/stale/mismatch/duplicate → sync conflict; rate → retry wait; dependency/timeout/unavailable → degraded; blocked/failed/cancelled/revoked → exact terminal state and legitimate recovery |
| `04c-public-delivery-cache.md`       | `PublicDeliveryCacheWorkbenchContractFields.fields` and `PublicDeliveryCacheWorkbenchProps.contractFields`             | `CASE_REFERENCE_INVALID`, `CONTENT_NOT_FOUND`, `DEPENDENCY_UNAVAILABLE`, `FORBIDDEN`, `HOLD_SCOPE_INVALID`, `IDEMPOTENCY_MISMATCH`, `PREVIEW_DENIED`, `PREVIEW_NOT_FOUND`, `PREVIEW_REVOKED`, `PROJECTION_BLOCKED`, `PROJECTION_VERSION_CONFLICT`, `PUBLICATION_NOT_FOUND`, `PURGE_REQUIRED`, `RATE_LIMITED`, `REVOKE_STATE_INVALID`, `RIGHT_NOT_FOUND`, `STALE_CONTENT`, `SUBJECT_NOT_FOUND`, `UNAUTHENTICATED`, `UNAVAILABLE_NO_SAFE_SNAPSHOT`, `VALIDATION_FAILED`, `VERSION_CONFLICT`          | validation/input → linked summary; auth/permission → auth or capability gate; not-found → disclosure-safe route/row; conflict/stale/mismatch/duplicate → sync conflict; rate → retry wait; dependency/timeout/unavailable → degraded; blocked/failed/cancelled/revoked → exact terminal state and legitimate recovery |

No discovered field or error code is allowed to fall through to generic rendering. An unrecognized schema discriminant or code is a contract mismatch: isolate in `ErrorBoundary`, show request ID and Retry/Status, and report scrubbed telemetry.

### Error class ownership

| Class                                                                       | Required UI                                                         | Retry                                        | Focus/announcement                             |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| 400 `INVALID_REQUEST` / 422 `VALIDATION_FAILED` / 422 `PLAN_LIMIT_EXCEEDED` | Summary plus field/row errors; preserve valid input                 | Correction only                              | Focus linked summary then field; concise alert |
| 401 `UNAUTHENTICATED`                                                       | Reauthentication with safe return; protected data removed           | After session recovery                       | Focus auth heading; announce expiry            |
| 403 `FORBIDDEN` / 401 `STEP_UP_REQUIRED`                                    | `<CapabilityGate>` with reason/recovery; no broadened disclosure    | After capability/step-up refetch             | Focus gate; no protected names                 |
| 404                                                                         | Disclosure-safe not-found; distinguish deleted only when authorized | Navigation                                   | Focus route heading                            |
| 409 conflict/idempotency/state                                              | `<SyncConflict>` with server/current version and preserved draft    | Reconcile first                              | Focus conflict; announce no overwrite          |
| 429 `RATE_LIMITED`                                                          | Inline countdown from `Retry-After`; input kept                     | At server time only                          | Polite coarse updates                          |
| 502/503/504                                                                 | Scoped degraded or full System / Degraded by honest renderability   | Safe BE attempts only; mutation status first | Request ID/Retry; no raw provider detail       |

## Navigation, Degradation, and Concurrency

- **Back/deep link/bookmark**: URL owns query, selection, cursor, and tab. Deep link refetches current authority/version, never serialized client authority.
- **Multi-tab**: version mismatch opens `<SyncConflict>`; another tab only invalidates. No last-write-wins UI claim.
- **Unsaved changes**: scoped draft survives recoverable auth and same-record navigation, but never enters logs, analytics, URL, or Realtime.
- **Authorization change**: revoke protected props/cache, cancel pending presentation, and refetch. Stale UI never authorizes.
- **Realtime reorder/duplication**: hints coalesce; canonical refetch is authoritative; focus/selection/draft remain if allowed.
- **Unknown mutation outcome**: render pending/manual review from operation status. Never show success or blindly resend.
- **Telemetry**: operation, route template, request ID, status, duration, and scrubbed IDs/hashes only. No bodies, evidence, secrets, contact data, or media URLs.

## Testing Obligations

| Level                 | Required assertions                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest unit/component | Exhaustive `AsyncState` and access variants; exact error copy/action; blur/submit timing; optimistic confirm/rollback; focus return; reduced motion; no unauthorized props                                                                                                                                                                                                                                                                   |
| Vitest integration    | Zod schemas accept BE fixtures/reject invalid variants; every operation maps fields/errors; ETag/idempotency/rate headers drive UI; Realtime only invalidates                                                                                                                                                                                                                                                                                |
| Playwright E2E        | Critical IA flows by role; keyboard; landmarks/names/live regions; three breakpoints; 200% zoom; offline/reconnect; stale multi-tab; auth expiry; 429/outage; candidate submit, assign, decide and step-up recovery; plan-limit refusal; scan and quarantine states; `policy_unavailable` discovery state                                                                                                                                    |
| Accessibility         | axe zero serious/critical; contrast/non-color cues; automated Chrome accessibility-tree screen-reader smoke (roles, names, landmarks, focus order) for the public delivery pages, with its evidence stated as automated; real-device VoiceOver/Safari and NVDA/Firefox verification is the pre-release gate (DEC-117) and is never represented by this automated smoke; target size; focus; no trap; captions/transcripts where media exists |
| Performance           | Server-first HTML; bounded islands; no hydration waterfall; stable skeleton; LCP <2.5 s, CLS <0.1; virtualize >100; route JS budget verified in phase plan                                                                                                                                                                                                                                                                                   |

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

| Date       | Change                                                                                                                                                                                                                                                            | Workflow              | Sections affected                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------ |
| 2026-08-29 | Initial complete FE specification, source mapping, mandatory deepening, and convergence review                                                                                                                                                                    | `/write-fe-spec`      | All                                                                            |
| 2026-10-02 | G6: corrected the media operation IDs to the BE04b `DLV-04B-01` through `DLV-04B-06` range in the query registry and data mapping, fixed the `DLV-DEL-API-01` source to 04c, populated the 04b contract field union, and removed the stale `delivery_purge` field | `/propagate-decision` | State Management, Data Mapping, Exhaustive BE field and error ownership        |
| 2026-10-02 | DEC-115: added `DLV-15` to `DLV-17` interactions, the `DeliveryCandidateReviewPanel`, and the `DLV-NAV-API-05` to `-08` mappings                                                                                                                                  | `/propagate-decision` | Component Inventory, Interaction Specification, State Management, Data Mapping |
| 2026-10-02 | D24 and DEC-116: added the discovery effective-policy region, plan-limit refusal, and scan and rendition state copy                                                                                                                                               | `/propagate-decision` | Component Inventory, Data Mapping                                              |
| 2026-10-02 | DEC-117: stated that the delivery-page screen-reader smoke is automated Chrome accessibility-tree smoke and that real-device verification is the pre-release gate                                                                                                 | `/propagate-decision` | Testing Obligations                                                            |

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

- [[specs/ia/04-cms-delivery-media|Shard 04 — CMS navigation, media and delivery]]

### References

- [[specs/ia/04-cms-delivery-media|Shard 04 — CMS navigation, media and delivery]]
