# Platform configuration, admin and quality: Frontend Specification

> **Classification**: Feature specification
> **BE Source**: [05a-settings-flags-runtime.md](../be/05a-settings-flags-runtime.md), [05b-admin-workspace-operations.md](../be/05b-admin-workspace-operations.md), [05c-portability-quality-lifecycle.md](../be/05c-portability-quality-lifecycle.md)
> **IA Source**: [05-platform-configuration-admin.md](../ia/05-platform-configuration-admin.md)
> **Surface**: Responsive Astro hybrid web/PWA with bounded React islands
> **Status**: Complete

## Referenced Material Inventory

- **Primary IA**: [05-platform-configuration-admin.md](../ia/05-platform-configuration-admin.md) in full.
- **BE sources**: [05a-settings-flags-runtime.md](../be/05a-settings-flags-runtime.md), [05b-admin-workspace-operations.md](../be/05b-admin-workspace-operations.md), [05c-portability-quality-lifecycle.md](../be/05c-portability-quality-lifecycle.md).
- **Cross-cutting FE source**: [00-infrastructure.md](00-infrastructure.md).
- **Design sources**: [design-system.md](../design-system.md), root `PRODUCT.md`, root `DESIGN.md`, and `.agents/skills/brand-guidelines/SKILL.md`.
- **Contract conventions**: BE00 `ApiError`, opaque cursor pagination, ETag/`If-Match`, idempotency, rate-limit headers, canonical refetch after Realtime hints, and disclosure-safe authorization.

## Source Map

| FE section | Authoritative source | Consumed material |
|---|---|---|
| Classification and scope | `05-platform-configuration-admin.md`; BE index | Shard boundary and completed BE split group |
| Component inventory | BE response/request contracts; IA interactions | Typed props, commands, state machines, access variants |
| Routes and navigation | IA user flows; design-system navigation paradigm | Entry, deep-link, back, stack, compact-tab, and governed menu behavior |
| State management | BE resource versions/events; BE00 | Server authority, URL state, local drafts, optimistic rollback, offline intent |
| Interaction specification | IA Interactions and Edge Cases; BE route registries | Triggers, guards, success, errors, retry, and persistence |
| Responsive behavior | IA responsive/accessibility rules; design-system grid | Mobile, tablet, and desktop structural behavior |
| Accessibility | IA Accessibility and interaction rows; WCAG 2.2 AA baseline | Keyboard, focus, names, live regions, reflow, target size, reduced motion |
| Data mapping | Every BE source listed above | Operation, schema, response field, error, and component ownership |
| Testing obligations | IA acceptance criteria; BE contract/security/recovery tests | Component, integration, E2E, a11y, and degraded-network assertions |

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
type UiError = { code: string; message: string; requestId: string; details: Record<string, unknown> | null };
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading'; startedAt: string }
  | { status: 'error'; error: UiError; retryable: boolean }
  | { status: 'empty'; reason: 'no-records' | 'filter-miss' | 'not-disclosed' }
  | { status: 'success'; data: T; version: string; stale: false }
  | { status: 'optimistic-pending'; data: T; operationId: string; version: string }
  | { status: 'optimistic-rollback'; data: T; error: UiError; version: string }
  | { status: 'disabled'; reason: string }
  | { status: 'degraded'; data: T | null; requestId: string; lastVerifiedAt: string | null };

type AccessVariant = 'full' | 'read-only' | 'partial-hidden' | 'disabled' | 'not-rendered';
type DomainVariant = 'publicPage' | 'appPage' | 'adminPage' | 'authPage' | 'degradedPage' | 'publicRead' | 'entitledRead' | 'ownerFull' | 'guardianMandate' | 'juniorRestricted' | 'businessMandate' | 'staffCaseScoped' | 'adminStepUp' | 'forbiddenHidden' | 'disabledPrerequisite';
type Breakpoint = 'mobile' | 'tablet' | 'desktop';
```

### `PlatformConfigurationAdminRoute` (Astro server route)

```ts
interface PlatformConfigurationAdminRouteProps {
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

### Capability projection for settings and admin affordances

- Settings and admin affordances derive only from the server capability snapshot
  (BE05b `CFG-05B-07`, `GET /api/v1/admin/capability-snapshot`): the Astro
  server reads it through the private Worker service binding with the verified
  session cookies, and passes the resulting `capabilitySnapshot` to the route.
  A browser never calls it. Any failure yields an empty snapshot and every
  affordance falls to `read-only`.
- Capability is never read from a response header, a role label, a URL
  parameter or a client alias list.
- Admin tabs render from `admin.*` keys in the snapshot (for example
  `admin.inbox.read`, `admin.capability.grant`, `admin.audit.read`). The
  settings editor affordance is enabled when the effective-value response's
  `ownerCapability` (BE05a `CFG-05A-02`) is in the snapshot. Approve, release and
  rollback are enabled by `settings.approve`, `settings.release` and
  `settings.rollback`. These only select what renders; the Worker and database
  enforce every command, so a stale or forged affordance returns 403.

### `SettingsFlagsRuntimeWorkbench` (bounded React island)

**BE owner**: `05a-settings-flags-runtime.md`

```ts
interface SettingsFlagsRuntimeWorkbenchProps {
  contractFields: SettingsFlagsRuntimeWorkbenchContractFields;
  children?: never;
  variant: DomainVariant;
  initial: AsyncState<readonly SettingsFlagsRuntimeRecord[]>;
  actorId: string;
  actingPartyId: string;
  access: AccessVariant;
  query: Readonly<Record<string, string>>;
  selectedId: string | null;
  expectedVersion: string | null;
  onCanonicalRefetch: (reason: 'navigation' | 'realtime-hint' | 'mutation' | 'reconnect') => Promise<void>;
}

interface SettingsFlagsRuntimeRecord {
  id: string;
  version: string;
  state: string;
  provenance: ReadonlyArray<{ source: string; evidence: string; at: string; visibility: string }>;
  projection: Readonly<Record<string, unknown>>;
}
```
- Astro owns route data and static structure. The island owns only selection, typed filters, pending commands, conflict resolution, and invalidation.
- `projection` is the parsed union of the response schemas named in the BE route registry; runtime validation rejects unknown variants.
- **A11y inline contract**: `<Workbench>` list/detail regions are named; selection is URL-addressable; rows use native links/buttons; Arrow keys are added only inside a declared composite; focus never moves on Realtime refetch; status changes use a polite atomic live region.
- **Responsive contract**: desktop shows list and detail; tablet preserves list with an inline inspector; mobile uses list then detail stack with a persistent Back action and no hidden command rail.
- **Error boundary**: isolates this domain section, sends scrubbed error plus request ID to provider-native diagnostics, preserves neighboring server HTML, and exposes Retry. A render error is never empty data.

### `AdminWorkspaceOperationsWorkbench` (bounded React island)

**BE owner**: `05b-admin-workspace-operations.md`

```ts
interface AdminWorkspaceOperationsWorkbenchProps {
  contractFields: AdminWorkspaceOperationsWorkbenchContractFields;
  children?: never;
  variant: DomainVariant;
  initial: AsyncState<readonly AdminWorkspaceOperationsRecord[]>;
  actorId: string;
  actingPartyId: string;
  access: AccessVariant;
  query: Readonly<Record<string, string>>;
  selectedId: string | null;
  expectedVersion: string | null;
  onCanonicalRefetch: (reason: 'navigation' | 'realtime-hint' | 'mutation' | 'reconnect') => Promise<void>;
}

interface AdminWorkspaceOperationsRecord {
  id: string;
  version: string;
  state: string;
  provenance: ReadonlyArray<{ source: string; evidence: string; at: string; visibility: string }>;
  projection: Readonly<Record<string, unknown>>;
}
```
- Astro owns route data and static structure. The island owns only selection, typed filters, pending commands, conflict resolution, and invalidation.
- `projection` is the parsed union of the response schemas named in the BE route registry; runtime validation rejects unknown variants.
- **A11y inline contract**: `<Workbench>` list/detail regions are named; selection is URL-addressable; rows use native links/buttons; Arrow keys are added only inside a declared composite; focus never moves on Realtime refetch; status changes use a polite atomic live region.
- **Responsive contract**: desktop shows list and detail; tablet preserves list with an inline inspector; mobile uses list then detail stack with a persistent Back action and no hidden command rail.
- **Error boundary**: isolates this domain section, sends scrubbed error plus request ID to provider-native diagnostics, preserves neighboring server HTML, and exposes Retry. A render error is never empty data.

#### `AdminMfaFactorResetForm` (CFG-05B-06, DEC-111 recovery)

**BE owner**: `05b-admin-workspace-operations.md` (`CFG-05B-06`, `POST /api/v1/admin/identity/mfa-factor-resets`); identity state change owned by `01a-auth-account-linking.md`.

```ts
interface AdminMfaFactorResetFormProps {
  variant: 'adminStepUp' | 'forbiddenHidden' | 'disabledPrerequisite';
  stepUp: { fresh: boolean; freshUntil: string | null }; // display-only; the server decides
  onCanonicalRefetch: (reason: 'mutation') => Promise<void>;
}

interface AdminMfaFactorResetFormValues {
  targetPersonId: string; // UUID, island memory only
  reason: string; // 1..512 after trim
}

type AdminMfaFactorResetResult = {
  resetId: string;
  targetPersonId: string;
  state: 'completed' | 'reconciling';
  removedFactorCount: number; // 0..10
  mfaVersion: string;
};
```

- **Rendering and access.** The form is a tab (`tab=mfa-reset`) of the admin workbench, rendered only when the server projection says the actor holds `admin.identity.mfa_reset` (variant `adminStepUp`). Every other actor sees no navigation entry and a direct URL gets the disclosure-safe 404 or `<CapabilityGate>` the BE returns. A held capability with no fresh step-up renders `disabledPrerequisite` with `Verify your identity to reset a person's two-step verification.`
- **Fields.** `targetPersonId` is a native text input with a persistent label, UUID validation on blur and submit, helper copy `Enter the person's ID exactly as it appears in the admin directory.`, and no autocomplete; no person lookup read operation exists, so none is invented. `reason` is a native textarea, required, 1..512 characters after trim, with a live character count. Unknown keys are never serialized, and the operator, organization, capability and step-up time are never sent.
- **Confirmation.** A named confirmation step states the consequence in text: `Remove every two-step verification factor for this person. They will need to set up a new authenticator before they can approve protected actions. This cannot be undone.` The commit button reads `Reset factors` and shows a stable pending label (`Resetting`) with duplicate activation ignored; the request carries a per-instance `Idempotency-Key`.
- **Success.** `200` (`completed`) announces `Two-step verification was reset for this person.`; `202` (`reconciling`) announces `The reset was recorded and is finishing. Check back shortly.` and never reports `completed` before the BE does. The result heading receives focus; the form clears `targetPersonId` and `reason`.
- **Errors (exact copy; no more than the status is disclosed).** 401 `STEP_UP_REQUIRED`: navigate to `/step-up?returnTo=<current relative path>` using the typed `allowedMethods`, persist nothing (the person ID is never stored), and on return the form opens empty with `Your entries were not saved.` 401 `UNAUTHENTICATED`: safe sign-in redirect. 403: `You do not have permission to reset two-step verification.` 404: `That person could not be found.` 409 `MFA_RESET_IN_PROGRESS`: `A reset for this person is already finishing.` 409 `IDEMPOTENCY_CONFLICT`: refresh and re-enter. 422 `MFA_RESET_INVALID`: `You cannot reset your own two-step verification. Ask another administrator.` plus field errors from the schema. 429: inline countdown from `Retry-After`. 502/503/504 and `IDENTITY_UNAVAILABLE`: degraded with the request ID; an unknown outcome renders pending and is never guessed as reset.
- **Sole administrator.** When the operator is the only administrator and has lost their own factor, no UI path exists. The form's help panel links the runbook `docs/runbooks/platform/sole-admin-mfa-lockout.md` by name as plain text, without exposing any operational detail.
- **Accessibility and responsive.** Persistent labels, linked error summary focused on first invalid field, `aria-describedby` for helper and count, confirmation heading focus with Escape cancelling before commit, 44 by 44 px targets, single-column stack at every width, no information conveyed by color alone.

### `PortabilityQualityLifecycleWorkbench` (bounded React island)

**BE owner**: `05c-portability-quality-lifecycle.md`

```ts
interface PortabilityQualityLifecycleWorkbenchProps {
  contractFields: PortabilityQualityLifecycleWorkbenchContractFields;
  children?: never;
  variant: DomainVariant;
  initial: AsyncState<readonly PortabilityQualityLifecycleRecord[]>;
  actorId: string;
  actingPartyId: string;
  access: AccessVariant;
  query: Readonly<Record<string, string>>;
  selectedId: string | null;
  expectedVersion: string | null;
  onCanonicalRefetch: (reason: 'navigation' | 'realtime-hint' | 'mutation' | 'reconnect') => Promise<void>;
}

interface PortabilityQualityLifecycleRecord {
  id: string;
  version: string;
  state: string;
  provenance: ReadonlyArray<{ source: string; evidence: string; at: string; visibility: string }>;
  projection: Readonly<Record<string, unknown>>;
}
```
- Astro owns route data and static structure. The island owns only selection, typed filters, pending commands, conflict resolution, and invalidation.
- `projection` is the parsed union of the response schemas named in the BE route registry; runtime validation rejects unknown variants.
- **A11y inline contract**: `<Workbench>` list/detail regions are named; selection is URL-addressable; rows use native links/buttons; Arrow keys are added only inside a declared composite; focus never moves on Realtime refetch; status changes use a polite atomic live region.
- **Responsive contract**: desktop shows list and detail; tablet preserves list with an inline inspector; mobile uses list then detail stack with a persistent Back action and no hidden command rail.
- **Error boundary**: isolates this domain section, sends scrubbed error plus request ID to provider-native diagnostics, preserves neighboring server HTML, and exposes Retry. A render error is never empty data.

### `PortabilityQualityLifecycleWorkbench` views (Slice 16)

The island renders five views selected by the URL `tab` query value `import`, `export`, `restore`, `quality` or `lifecycle`. Each view is a lazy module (dynamic import on selection) so the hydrated entry stays within budget; each view module is a lazy chunk of at most 80 KB gzip under the app/admin budget. All BE contracts are the generated Zod-inferred types of `05c-portability-quality-lifecycle.md` (`Cfg05c01PortabilityActionRequest`, `Cfg05c01PortabilityActionResponse`, `Cfg05c03PortabilityRecordPage`, `Cfg05c04PortabilityRecordDetail`, `Cfg05c02QualityLifecycleActionRequest`, `Cfg05c02QualityLifecycleActionResponse`, `Cfg05c06QualityLifecycleRecordPage`, `Cfg05c07QualityLifecycleRecordDetail`). The Supabase Free plan has no point-in-time recovery: the restore view states this in text and never offers promotion.

```ts
type PortabilityTab = 'import' | 'export' | 'restore' | 'quality' | 'lifecycle';
type PortabilityRecordKind = 'import' | 'export' | 'restore';

interface PortabilityRecordListProps {
  kind: PortabilityRecordKind;
  page: AsyncState<Cfg05c03PortabilityRecordPage>;
  stateFilter: PortabilityState | null;
  onFilter: (state: PortabilityState | null) => void;
  onSelect: (kind: PortabilityRecordKind, recordId: string) => void;
  access: AccessVariant;
  children?: never;
}

interface ImportSourceUploadProps {
  maxBytes: 52428800;
  sourceFormat: Cfg05c01SourceFormat;
  onReady: (object: { objectId: string; sha256: string; byteSize: number }) => void;
  access: AccessVariant;
  children?: never;
}

interface ImportRequestFormProps {
  object: { objectId: string; sha256: string; byteSize: number } | null;
  mappers: ReadonlyArray<{ mapperKey: string; mappingVersion: string; formats: readonly Cfg05c01SourceFormat[]; fields: readonly string[]; protectedData: boolean }>;
  contentTypeSelectors: AsyncState<ReadonlyArray<{ contentTypeId: string; contentTypeVersionId: string; label: string; locale: string }>>;
  stepUp: 'fresh' | 'required' | 'not-needed';
  onSubmit: (request: Cfg05c01ImportAction) => Promise<Cfg05c01PortabilityActionResponse>;
  access: AccessVariant;
  children?: never;
}

interface ImportDryRunReportPanelProps {
  detail: AsyncState<Cfg05c04PortabilityRecordDetail>;
  canCommit: boolean;
  canCancel: boolean;
  stepUp: 'fresh' | 'required' | 'not-needed';
  onCommit: (input: { importJobId: string; expectedVersion: string; expectedReportHash: string; reason: string }) => Promise<Cfg05c01PortabilityActionResponse>;
  onCancel: (input: { importJobId: string; expectedVersion: string; reason: string }) => Promise<Cfg05c01PortabilityActionResponse>;
  onRowsPage: (cursor: string | null) => void;
  children?: never;
}

interface ExportRequestFormProps {
  resourceFields: Readonly<Record<string, readonly string[]>>;
  scopeCandidates: AsyncState<ReadonlyArray<{ resourceType: string; resourceId: string; version: string; label: string; protectedData: boolean }>>;
  maxExpiryDays: 7;
  stepUp: 'fresh' | 'required' | 'not-needed';
  onSubmit: (request: Cfg05c01ExportAction) => Promise<Cfg05c01PortabilityActionResponse>;
  access: AccessVariant;
  children?: never;
}

interface ExportArtifactPanelProps {
  detail: AsyncState<Cfg05c04PortabilityRecordDetail>;
  canDownload: boolean;
  canRevoke: boolean;
  stepUp: 'fresh' | 'required' | 'not-needed';
  onDownload: (exportArtifactId: string) => Promise<{ status: 'saved' | 'refused'; error: UiError | null }>;
  onRevoke: (input: { exportArtifactId: string; expectedVersion: string; reason: string }) => Promise<Cfg05c01PortabilityActionResponse>;
  children?: never;
}

interface RestoreRequestFormProps {
  readyArtifacts: AsyncState<ReadonlyArray<{ exportArtifactId: string; manifestHash: string; expiresAt: string; scopeCount: number }>>;
  targets: ReadonlyArray<{ targetEnvironment: string; label: string; isolated: true }>;
  stepUp: 'fresh' | 'required' | 'not-needed';
  onSubmit: (request: Cfg05c01RestoreAction) => Promise<Cfg05c01PortabilityActionResponse>;
  access: AccessVariant;
  children?: never;
}

interface RestoreVerificationPanelProps {
  detail: AsyncState<Cfg05c04PortabilityRecordDetail>;
  onRequestAgain: () => void;
  children?: never;
}

interface QualityRunFormProps {
  prefill: { targetType: string; targetId: string; targetVersion: string } | null;
  checkers: ReadonlyArray<{ checkerKey: string; checkerVersion: string; targetTypes: readonly string[] }>;
  onSubmit: (request: Cfg05c02QualityAction) => Promise<Cfg05c02QualityLifecycleActionResponse>;
  access: AccessVariant;
  children?: never;
}

interface QualityRunPanelProps {
  detail: AsyncState<Cfg05c07QualityLifecycleRecordDetail>;
  severityFilter: 'all' | 'blocking' | 'warning';
  onFindingsPage: (cursor: string | null) => void;
  onRerun: () => void;
  children?: never;
}

interface LifecycleRequestPanelProps {
  detail: AsyncState<Cfg05c07QualityLifecycleRecordDetail>;
  onStoresPage: (cursor: string | null) => void;
  children?: never;
}
```

- **Common contract**: every command component sends one `Idempotency-Key` per user intent (regenerated only after an edit), the current `expectedVersion` where the BE branch has one, and never a client-chosen actor, party, state or hash that the server derives. A `202` response renders the record in its returned state with a polite status message and starts a status poll of CFG-05C-04 every 5,000 ms while the tab is visible, stopping at a terminal state, on navigation away, and waiting out any `Retry-After`; polling never moves focus. A `200` renders the terminal state.
- **`ImportSourceUpload`**: wraps `<FileUpload>` with BE00 purpose `portability.import`, a `maxBytes` of 52,428,800 shown as “50 MiB”, and allowed media types per selected format (`application/json`, `application/x-ndjson`, `application/vnd.wejammin.cms-bundle+json`; `csv` and `xml` are listed with the disabled reason “No import mapper is registered for this format”). A file over the cap is refused before upload with “This file is larger than the 50 MiB hosted limit. Split it and import the parts.” Verification states (`uploaded`, `verifying`, `ready`, `rejected`, `quarantined`) are text; only `ready` calls `onReady`. Inactivity abort, cancel, and retry follow the shared network contract.
- **`ImportRequestForm`**: fields are listed in the form table below. Mapper choice filters source formats and shows the registered mapping version read-only; `sourceHash` is read-only from the verified object; `duplicatePolicy` is a radio group whose descriptions are exactly: `reject` “Stop the whole import if any row duplicates a previously imported row”; `quarantine` “Set duplicate and conflicting rows aside and import the rest”; `update_if_version_matches` “Update a previously imported draft only when its version still matches, otherwise set the row aside”; `create_new` “Create a new draft for duplicates and never overwrite”. Submitting creates a dry run, never an import.
- **`ImportDryRunReportPanel`**: renders `dryRunReport` as three semantic tables (classification counts, impact counts, the sampled `errors` with row index, classification and rule text) plus the paged `rows` table (50 per page, `Previous`/`Next` native buttons, URL `rowsCursor`). The report hash and version appear in `<ProvenanceFact>`. `errorsTruncated` is announced as “Showing the first 50 problems; open the row list for all rows.” **Commit import** opens `<ConfirmationStep>` stating “Creates N drafts and updates M drafts, sets Q rows aside. Nothing is published or activated.” with the counts from the report; it sends `expectedVersion` and `expectedReportHash` from the rendered report. A `409 MANIFEST_CONFLICT` or `VERSION_CONFLICT` shows `<SyncConflict>` with “The dry run changed. Review the new report before committing.” and reloads the detail. Cancel is a separate native button with its own confirmation naming that committed drafts stay.
- **`ExportRequestForm`**: `scopeCandidates` come from the CFG-05B-02 admin search over the allowlisted entity types and from an accessible paste field accepting one `resourceType resourceId version` triple per line (up to 500 lines, with a per-line error list); selected scope is a `<DataTable>` basket with a remove button per row and a running count out of 500. Field checkboxes come from the shared registry constant and are grouped by resource type. `excludeProtectedEvidence` renders checked and disabled with the text “Protected evidence is never exported.” `expiresAt` is a labelled date-time input that shows the user's timezone and the resolved UTC instant and rejects values in the past or more than 7 days ahead. `maxDownloads` is a select of 1, 2 or 3. `encryptionMode` radios: “Managed key (the platform decrypts for you on download)” and “Your public key (only you can decrypt; the platform cannot)”; the second reveals a labelled textarea for an EC P-256 JWK with a local format check and the hint “Paste the public JWK, never a private key.” A pasted object containing a `d` member is rejected locally and never submitted.
- **`ExportArtifactPanel`**: shows state, expiry with timezone, downloads used out of the maximum, byte size, encryption mode in words, manifest hash and, when `containsProtected`, “This export includes protected data and needs recent verification.” **Download** is a native button that sends `POST …/downloads` with a fresh `Idempotency-Key`, streams the response into a `Blob`, and saves it through a temporary object URL and a native anchor with the `download` attribute, then revokes the URL. The button is disabled with a visible reason when the state is not `ready`, the artifact is expired or revoked, or `downloadCount` equals `maxDownloads`. A network failure after the claim announces “The download was interrupted and still counts toward the limit.” **Revoke** opens `<ConfirmationStep>` (“Anyone with this export can no longer download it”) and sends `expectedVersion`.
- **`RestoreRequestForm` and `RestoreVerificationPanel`**: `targets` lists the registered isolated targets (Phase 2: one, labelled “Isolated local restore target (diagnostic)”). Static text above the submit button reads “Supabase Free has no point-in-time recovery. This verification is diagnostic evidence only. It does not enable production recovery and nothing is promoted.” The panel renders the eight results (`schema`, `counts`, `hashes`, `references`, `rls`, `rendering`, `accessibility`, `secretScan`) as a semantic table with `pass`, `fail` or `unknown` as text plus icon, never a single green summary. `requested`, `restoring` and `verifying` show “Waiting for the isolated verifier” with attempt count out of 3; `failed` shows the failure code in words (RESTORE_KEY_UNAVAILABLE “The verifier did not have your private key”, OBJECT_BYTES_UNAVAILABLE “This export carries object references but no object bytes”, MANIFEST_HASH_MISMATCH “The restored data does not match the export”, LEASE_EXHAUSTED “The verifier stopped responding after 3 attempts”, CHECK_FAILED “One or more checks failed”) and offers **Request another verification** which creates a new evidence version. There is no promote control in any state; the panel states “Promotion is not available in this phase.”
- **`QualityRunForm` and `QualityRunPanel`**: the form is prefilled from the URL when launched from an entry (`targetType`, `targetId`, `targetVersion`); the checker is read-only text showing key and version. The panel header shows state in words (`healthy` “No blocking findings”, `blocked` “Blocking findings found”, `failed` “The check could not finish”, `stale` “Out of date, run again”), blocking and warning counts, checker key and version, run time and the freshness expiry. A `504 UPSTREAM_TIMEOUT` shows the failed run with **Run again**. The panel always states “Automated checks do not replace human review.”
- **Quality findings table**: a semantic table with caption “Findings for revision N”, columns Severity (text: Blocking or Warning), Rule (catalog title and rule ID in mono), Location and Human review (“Required”). Rows are ordered as returned, 50 per page, with a severity filter that is sent to the server as the `severity` query value. Location text reads “Field” or “Block” plus the pointer in mono; when `targetEntryId` is present it is a native link to the field in the CMS editor, otherwise plain text. A truncated document shows “Showing the first 500 of N findings.” The table never renders author text because the BE never sends any.
- **`LifecycleRequestPanel`**: shows request type, state, manifest hash, hold conflict (“A legal hold blocks this action”) and the paged store-results table with state, item and residual counts and error code in words. It never states success while any store is not terminal.

**Form field contracts for CFG-13 and CFG-14**

| Form | Field | Control and validation | Error copy |
|---|---|---|---|
| Import | `sourceFormat` | Select; csv and xml disabled | “Choose a supported format.” |
| Import | `mapperKey`, `mappingVersion` | Select of registered mappers; version read-only | “Choose a mapper for this format.” |
| Import | `objectId`, `provenance.sourceHash` | Read-only from the verified upload | “Upload and verify a file first.” |
| Import | `provenance.sourceSystem`, `provenance.sourceRunId` | Text, trimmed, 1–128 | “Enter 1 to 128 characters.” |
| Import | `duplicatePolicy` | Radio group of four | “Choose how duplicates are handled.” |
| Import | `targetScope` | Mapper-specific selectors; cms.entry needs content type version and locale (BCP 47), settings.value needs scope type, scope and environment | “Choose where imported drafts go.” |
| Import | `fieldManifest` | Checkboxes from the mapper allowlist, 1–128 | “Select at least one field.” |
| Import | `reason` | Textarea, trimmed, 1–512 | “Enter a reason of 1 to 512 characters.” |
| Export | `exportType` | Select of four | “Choose an export type.” |
| Export | `scopeManifest` | Basket or paste, 1–500 triples, UUID and version format per line | “Line N is not a resource type, UUID and version.” |
| Export | `fieldManifest` | Checkboxes, 1–128 | “Select at least one field.” |
| Export | `actorPurpose`, `reason` | Text/textarea, trimmed, 1–512 | “Enter 1 to 512 characters.” |
| Export | `encryptionMode`, `recipientPublicKey` | Radio; JWK textarea required only for the public-key mode | “Paste an EC P-256 public key.” |
| Export | `expiresAt` | Date-time with timezone, future and at most 7 days | “Choose a time within the next 7 days.” |
| Export | `maxDownloads` | Select 1–3 | “Choose 1, 2 or 3 downloads.” |
| Restore | `sourceArtifactId`, `expectedManifestHash` | Select of ready artifacts; hash read-only | “Choose an export that is ready.” |
| Restore | `targetEnvironment` | Select of registered isolated targets | “Choose an isolated target.” |
| Restore | `requestedScope` | Checkbox list defaulting to the whole artifact scope | “Select at least one resource.” |
| Quality | `targetType`, `targetId`, `targetVersion` | Prefilled or typed; UUID and positive integer | “Enter a revision ID and version.” |
| Quality | `reason` | Textarea, trimmed, 1–512 | “Enter a reason of 1 to 512 characters.” |

Server errors map as in the error table below; `422 PROTECTED_FIELD` focuses the field manifest group with “One or more selected fields cannot be exported.”, and `422 PORTABILITY_LIMIT_EXCEEDED` shows the stated limit (50 MiB or 500 rows) and the Split action text.

### Global feedback and command components

| Component | Props contract | Interactive and accessibility contract |
|---|---|---|
| `<ActionBar>` | `{ primary, secondary, destructive, state, expectedVersion, operationId }` | Native buttons; stable pending label; named destructive consequence; focus returns to trigger; Enter submits only the owning form. |
| `<CapabilityGate>` | `{ variant, reasonCode, recoveryHref, disclosure }` | `not-rendered` emits no protected label; disabled has reason/recovery; step-up focuses heading; server remains authoritative. |
| `<FilterBar>` | `{ schema, values, resultCount, resetHref }` | Persistent labels; URL commits on Apply; Escape clears only the open combobox; result count is politely announced. |
| `<DataTable>` | `{ columns, rows, sort, selection, density }` | Semantic table wide; priority list mobile; header buttons expose sort; stable keys; bulk actions name count/scope. |
| `<ConfirmationStep>` | `{ consequence, affectedScope, expectedVersion, stepUpState, idempotencyKey }` | Inline first; heading focus; Escape cancels before commit; duplicate activation returns same operation. |
| `<OfflineStatus>` / `<SyncConflict>` | `{ connectivity, intents, serverVersion, localVersion }` | Text plus icon; refused intents remain; conflict actions name outcomes; no automatic overwrite. |

## State Management

| State class | Source of truth | Entry trigger | Render and copy | Exit/persistence |
|---|---|---|---|---|
| idle | URL and server HTML | Route composed with no client work | No artificial busy state | User interaction or invalidation |
| loading | In-flight request descriptor | Navigation/refetch exceeds 250 ms | Skeleton for known layout; “Loading current records” inline | Success, typed error, or cancellation; safe prior content remains when allowed |
| error per class | BE00 `ApiError` | Parsed non-success | Validation inline; 401 reauthenticate; 403 capability; 404 disclosure-safe; 409 conflict; 429 countdown; 5xx degraded | Explicit recovery; valid input retained |
| empty | Canonical success | Zero records or filtered results | Distinguish no records from filter miss; one legitimate action | Create/import/invite or Reset filters |
| success | Server resource and ETag | Validated 2xx | Canonical facts, state, version, provenance, allowed actions | Invalidation or command |
| optimistic-pending | Local overlay by operation ID | Reversible command accepted locally | Pending text/icon; affected controls disabled | Confirmed refetch or rollback |
| optimistic-rollback | Canonical preimage plus error | Command refused/ambiguous after reconciliation | Restore preimage; announce refusal; retain input | Edit/retry/dismiss |
| disabled | Capability/config contract | Known unavailable action | Visible reason and prerequisite; no handler | Capability/config refetch |
| degraded | Last-known-good plus freshness | Dependency/network failure | Exact scope, stale timestamp, request ID, Retry/Status | Canonical refetch |

- **Server state**: Astro/Hono resources, ETags, cursor pages, job status, and canonical authorization.
- **URL state**: query, sort, filters, cursor, selected record, tab, and return target. It is bookmarkable and Back/Forward safe.
- **Island-local state**: draft fields, disclosure toggles, transient focus, and bounded optimistic overlay. No global client store.
- **Realtime**: entity/event hints only. Deduplicate, preserve focus, refetch canonical data, and apply only currently authorized responses.
- **Multi-tab**: `BroadcastChannel` signals invalidation only. Each tab refetches; no tab writes another tab's canonical cache.
- **Unsaved changes**: retain scoped draft, show inline leave confirmation, use `beforeunload` only while dirty, and clear only after success or explicit discard.
- **Offline**: store non-canonical intents only where BE permits. Reconnect revalidates identity, authority, input, and version; refused intents remain visible.

## Page and Route Definitions

| Route | Rendering | Guard and redirect | Deep-link and history |
|---|---|---|---|
| `/app/platform-configuration-admin` | Astro SSR or cache-safe prerender by route registry | Public exposes public projection; protected verifies session/acting context; admin requires explicit capability and named step-up | Query, cursor, selected record, tab are URL state; invalid values normalize with `replaceState`; Back restores selection/scroll |
| `/app/platform-configuration-admin/:recordId` | Server-first detail with bounded islands | Concealed returns disclosure-safe 404; visible forbidden uses `<CapabilityGate>`; expired session preserves safe return target | Bookmark resolves current canonical version; stale/deleted target shows exact state and safe parent |
| System/degraded boundary | Preserved shell when safe | Unsafe cached content removed for privacy, legal, takedown, or revoked authority | Retry repeats safe read; mutation status reconciles before retry |

## Interaction Specification

| Interaction | Trigger and focus | Preconditions | Success | Failure and recovery | Persistence |
|---|---|---|---|---|---|
| `CFG-01` Register setting definition | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `CFG-02` Resolve effective value | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `CFG-03` Propose setting change | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `CFG-04` Approve/schedule/activate/rollback | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `CFG-05` Manage release flag | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `CFG-06` Run experiment | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `CFG-07` Activate kill switch | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `CFG-08` Work admin inbox | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `CFG-09` Search/filter control plane | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `CFG-10` Preview/run bulk action | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `CFG-11` Grant/revoke admin capability | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `CFG-12` Inspect audit/diagnostics | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `CFG-13` Import/export/restore | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `CFG-14` Run quality/retention action | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `CFG-05B-06` Reset a person's MFA factors | Native form and named confirmation step on the `mfa-reset` tab; focus stays until the result heading | `admin.identity.mfa_reset` in the server projection, fresh step-up, valid `targetPersonId` UUID and reason 1..512, per-instance `Idempotency-Key`, no `If-Match` | Render `200` or `202` result per `AdminMfaFactorResetForm`; announce the state; clear the form | 401 `STEP_UP_REQUIRED` navigates to `/step-up?returnTo=` with no persisted entries; 403/404/409/422/429/503 render the exact copy in the component; unknown outcome reconciles by the BE reset state, never guessed | None: the person ID and reason live only in island memory |

### Portability, quality and lifecycle action contracts (CFG-13 and CFG-14)

| Interaction | Trigger and focus | Preconditions | Success | Failure and recovery | Persistence |
|---|---|---|---|---|---|
| Upload import source | `<FileUpload>` choose or drop; focus stays on the control, then the status heading | Capability `admin.portability.import`; format selected; file at most 50 MiB | BE00 upload intent then verification reaches `ready`; `onReady` fills the form read-only fields | 413/422 refusal copy with the 50 MiB limit; `rejected` or `quarantined` is shown as unusable; abort after 30 s without bytes; retry creates a new intent | Nothing persisted client-side; the server object survives reload through the form's `objectId` URL value |
| Start import dry run | Submit `ImportRequestForm`; focus to result heading | Ready object, valid form, fresh step-up when the mapper is protected | `202` job in `draft`, then poll to `dry_run`; the report panel opens | 400 summary; 415 “This format has no registered mapper”; 409 hash conflict “The file changed after upload”; 401 `STEP_UP_REQUIRED` opens the step-up page with a safe `returnTo`; 429 countdown; 503 degraded | Form draft kept per tab; job in URL as `recordId` |
| Review dry-run report | Native links to rows and page controls | Detail read succeeded | Tables render report and row results; no focus move on refetch | 404 disclosure-safe; 503 degraded with Retry | URL `recordId`, `rowsCursor` |
| Commit import | `Commit import` button then `<ConfirmationStep>`; focus to confirmation heading, then result heading | State `dry_run` or `partial`; `canCommit`; report rendered; fresh step-up for protected data | `202`, state `running`, poll to `completed` or `partial` with counts | 409 `VERSION_CONFLICT` or `MANIFEST_CONFLICT` shows `<SyncConflict>` and reloads the report; 422 or 503 degrade; unknown outcome reconciles by reading the job before any retry | Server job state |
| Cancel import | `Cancel import` button then confirmation | Non-terminal state; `canCancel` | `200` state `cancelled`; committed drafts remain and are listed | 409 conflict reloads; 404/403 gate | Server job state |
| Create export | Submit `ExportRequestForm`; focus to result heading | Valid manifests; step-up fresh when any scoped resource is protected | `202` artifact `requested`, poll to `ready` | 422 `PROTECTED_FIELD` and `PORTABILITY_LIMIT_EXCEEDED` copy as above; 400 on expiry; 401 step-up; 429; 503 | Form draft per tab; artifact in URL |
| Download export | `Download` button; focus stays on the button, result in the live region | State `ready`, unexpired, downloads remain; `canDownload`; fresh step-up when protected | Bytes saved; `downloadCount` refetched | 409 `ARTIFACT_NOT_DOWNLOADABLE` shows the state in words and disables the button; 403 gate; 429 countdown; interrupted transfer announced and counted | None client-side; blob URL revoked after click |
| Revoke export | `Revoke` button then confirmation | State `requested`, `generating` or `ready`; `canRevoke` | `200` state `revoked` | 409 conflict reloads; 404/403 gate | Server artifact state |
| Request restore verification | Submit `RestoreRequestForm`; focus to result heading | Ready unexpired artifact, registered target, step-up when protected | `202` verification `requested`, poll through `restoring` and `verifying` to `verified` or `failed` | 400 unknown target; 409 `MANIFEST_CONFLICT` with the artifact state or `VERSION_CONFLICT` “A verification is already open”; 401 step-up; 503 | Server verification; URL `recordId` |
| Run quality check | Submit `QualityRunForm`; focus to result heading | `admin.quality.run`; exact target version | `200` run in `healthy` or `blocked`; findings table loads | 504 failed run with Run again; 404 hidden target; 403 gate; 429 countdown | Server run; URL `recordId` |
| Read findings | Page and filter controls | Detail read succeeded | Findings page renders; focus never moves on refetch | 503 degraded with Retry | URL `childCursor`, severity filter |

### Network and retry contract

- Read over 250 ms exposes loading; protected commands use the BE deadline and never show false success.
- 429 waits for `Retry-After`, announces remaining wait, and preserves input.
- 502/503/504 retry at most twice after 250 ms and 750 ms only when BE declares safe. Mutations reuse idempotency and reconcile status first.
- Offline/startup failure renders System / Degraded. Last-known-good appears only when policy permits and always includes freshness.
- `<FileUpload>` aborts after 30 seconds with no transferred byte; any byte resets inactivity; cancellation is explicit; quarantined/unverified bytes never appear ready.

### Form contract

| Concern | Required behavior |
|---|---|
| Fields | Generate controls from named Zod request schema. Every field has persistent label, type, required/optional state, help, autocomplete/inputmode, and canonical serialization. Unknown keys are not submitted. |
| Validation timing | Syntax and safe local constraints on blur; cross-field on review/submit; server remains authoritative. No pre-visit error. |
| Error copy | `VALIDATION_FAILED`: “Check the highlighted fields.” Field copy states rule and correction. `INVALID_REQUEST`: “This request could not be read. Review the form and try again.” |
| Submission | Disable only commit action, preserve width/label, expose pending text, send expected version/idempotency, and ignore duplicate activation. |
| Conflict | Show current server version beside preserved draft. Actions: Review changes, Reapply when permitted, or Discard. Never overwrite automatically. |
| Completion | Focus result heading, update URL/version, clear committed draft, and expose exact next action. Important outcomes also enter durable history/notification. |

## Conditional Rendering Matrix

| Feature/component | Free | Paid | Creator | Guardian | Junior | Business | Staff | Admin |
|---|---|---|---|---|---|---|---|---|
| Public/read projection | full public | full entitled | full owned/public | full mandate-visible | full age-allowed own/public | full organization public/mandated | read-only with explicit case capability | read-only with explicit capability |
| Protected command form | not-rendered without capability | full only with server capability, else disabled | full owned/mandated, else not-rendered | full only within guardian mandate | partial-hidden for restricted fields, else capability-bound | full only in organization mandate | full only with operation/case capability | full only with named capability, recent step-up, audited reason |
| Provenance/evidence | public subset | entitled subset | owned/participating subset | mandate-visible subset | disclosure-safe age-allowed subset | organization-mandated subset | case-scoped read-only | capability-scoped read-only |
| Destructive/high-risk | not-rendered | disabled unless named capability/step-up | disabled unless owner capability/step-up | not-rendered unless mandate grants | not-rendered where age policy forbids | disabled unless organization capability/step-up | full only named case capability/step-up | full only named operation capability/step-up |

Named variants: `publicRead`, `entitledRead`, `ownerFull`, `guardianMandate`, `juniorRestricted`, `businessMandate`, `staffCaseScoped`, `adminStepUp`, `forbiddenHidden`, and `disabledPrerequisite`. Role labels never grant authority client-side.

**Portability, quality and lifecycle capability variants**

| Capability held | Import view | Export view | Restore view | Quality view | Lifecycle view | Variant |
|---|---|---|---|---|---|---|
| `admin.portability.import` | full forms and commit | not-rendered | not-rendered | not-rendered | not-rendered | `adminStepUp` |
| `admin.portability.export` | not-rendered | full forms, download, revoke | read-only artifacts list for selection | not-rendered | not-rendered | `adminStepUp` |
| `admin.portability.restore` | not-rendered | read-only ready artifacts for selection | full form and verification panel | not-rendered | not-rendered | `adminStepUp` |
| `admin.portability.read` only | read-only report and rows | read-only artifact facts, download disabled with reason | read-only verification | not-rendered | not-rendered | `disabledPrerequisite` |
| `admin.quality.run` | not-rendered | not-rendered | not-rendered | full form, findings, rerun | not-rendered | `adminStepUp` |
| `admin.quality.read` only | not-rendered | not-rendered | not-rendered | read-only run and findings, rerun disabled with reason | not-rendered | `disabledPrerequisite` |
| `admin.privacy.lifecycle` | not-rendered | not-rendered | not-rendered | read-only | full request and store results with MFA | `adminStepUp` |
| Support purpose grant on one quality or lifecycle record | not-rendered | not-rendered | not-rendered | read-only for that record | read-only for that record | `staffCaseScoped` |
| No capability or hidden record | not-rendered with disclosure-safe 404 | not-rendered | not-rendered | not-rendered | not-rendered | `forbiddenHidden` |

Tabs render only when the actor holds a capability that reaches them, and a tab never reveals the existence of a record outside the actor's scope. The restore verifier is a service principal with no UI.

## Responsive Behavior

| Breakpoint | Grid/navigation | Workbench/detail | Forms/actions | Tables/media |
|---|---|---|---|---|
| Mobile ≤768 px | 4 columns, 16 px gutter/margins; compact tabs and stack; acting context before writes | List then detail; Back first; inspector inline; no horizontal page scroll at 320 CSS px | One column; labels above; action bar avoids keyboard; 44 by 44 px targets | Priority list preserves every field in expandable facts; media controls wrap logically |
| Tablet 769–1024 px | 8 columns, 20 px gutter, 24 px margins; collapsible sidebar | List plus inspector when container permits, else stack; URL selection | Two-column only for independent fields; action bar cannot cover errors | Lower-priority columns move to row details, never disappear |
| Desktop ≥1025 px | 12 columns, 24 px gutter, max 1440 px; sidebar/top bar | Stable list/detail split; detail owns heading/action rail | Grouped form/review summary; action rail cites context/version | Compact semantic table, virtualize >100 rows, stable IDs, functional media only |

- Container queries may switch composition but cannot change semantics, authorization, or consequences.
- 200% zoom and text-spacing overrides retain content/action order. Hover-only disclosure and pointer-only reordering are prohibited.
- Portability and quality tables keep every column reachable: on mobile each row is a priority list with the remaining columns in expandable facts, the export basket and findings table never scroll the page horizontally at 320 CSS px, and the download, commit, cancel and revoke buttons keep 44 by 44 px targets.

## Accessibility Inventory

| Component/interaction | WCAG requirement | Keyboard/focus | Screen reader/semantics | IA source |
|---|---|---|---|---|
| Route shell/navigation | 1.3.1, 2.4.1–2.4.3, 2.4.7/2.4.11 | Skip link; logical DOM; route focuses `h1` | Named landmarks, one main, `aria-current=page`, unique title | `05-platform-configuration-admin.md` Accessibility/User Flows |
| Workbench selection | 1.3.1, 2.1.1, 2.4.3, 4.1.2 | Native controls; Enter opens; Escape closes bounded inspector; focus returns | Named list/detail; selected state; state/provenance text | `05-platform-configuration-admin.md` Interactions/Access Control |
| Forms/validation | 1.3.1, 3.3.1–3.3.4, 4.1.3 | Persistent labels; linked summary focuses first invalid field; no trap | `aria-invalid`, `aria-describedby`, error links, polite status | `05-platform-configuration-admin.md` Acceptance Criteria/Edge Cases |
| Async/refetch/conflict | 2.2.1, 2.4.3, 4.1.3 | Refresh never steals focus; Retry native; conflict begins at heading | Polite atomic update; stale/pending/failed text; request ID | `05-platform-configuration-admin.md` Interactions/BE failures |
| Tables/filters | 1.3.1, 1.4.10, 2.1.1, 2.5.8 | Header buttons; Apply/Reset; 24 CSS px minimum, 44 preferred | Caption, headers, sort, count, active-filter summary | `05-platform-configuration-admin.md` User Flows/responsive |
| High-risk confirmation | 2.1.2, 2.4.3, 3.3.4, 4.1.2 | Inline first; dialog heading focus, Tab containment, Escape before commit, return focus | Consequence, scope, version, context, step-up, irreversible effect | `05-platform-configuration-admin.md` Access Control/Edge Cases |
| Motion/media | 1.2.x where applicable, 2.2.2, 2.3.3 | Media keyboard controls; pause/stop; no essential timed gesture | Captions/transcript/metadata; reduced motion; waveform never sole content | `05-platform-configuration-admin.md` Accessibility |
| Import upload and dry-run report | 1.3.1, 1.4.10, 2.1.1, 3.3.1, 4.1.3 | Native file control; tables reachable by Tab; page buttons native; focus never moves on poll | Caption names job and report hash; counts, impact and errors in separate captioned tables; status in a polite live region | `05-platform-configuration-admin.md` Accessibility, Contracts |
| Commit, cancel, revoke and download confirmations | 2.1.2, 2.4.3, 3.3.4, 4.1.2 | Inline first; heading focus; Escape before commit; focus returns to the trigger | Consequence, counts, scope and irreversibility stated before activation | `05-platform-configuration-admin.md` Access Control |
| Export form | 1.3.1, 3.3.1–3.3.4, 1.3.5 | Persistent labels; basket remove buttons native; paste error list linked to the field | Expiry shows timezone and resolved UTC; encryption choice described in words; protected-evidence exclusion stated | `05-platform-configuration-admin.md` Accessibility |
| Restore verification vector | 1.3.1, 1.4.1, 4.1.3 | Table reachable by Tab; Request another verification native button | Eight rows with pass, fail or unknown as text plus icon; the Free-tier no-PITR statement is plain text | `05-platform-configuration-admin.md` Contracts, Edge Cases |
| Quality findings table | 1.3.1, 1.4.1, 2.4.4, 4.1.3 | Filter and page controls native; location links have specific names | Severity as text; “Human review required”; automation disclaimer in the caption | `05-platform-configuration-admin.md` Accessibility |

The inventory exceeds the thin-coverage threshold and is woven into component contracts. WCAG 2.2 AA is the release floor, exceeding the requested 2.1 AA gate.

## FE Rubric Closure

This section makes every FE-rubric checkpoint explicit. It narrows implementation choices without changing any upstream product, permission, security, or data contract.

### Complete component contracts

Every local component interface above includes `children?: never` and a `DomainVariant`. “Never” is deliberate because Astro slots and canonical global components own composition; these route/workbench boundaries do not accept arbitrary children.

| Component | Props interface | Children | Named variants | BE/IA source |
|---|---|---|---|---|
| `PlatformConfigurationAdminRoute` | `PlatformConfigurationAdminRouteProps` | `never` | `publicPage`, `appPage`, `adminPage`, `authPage`, `degradedPage` | `05-platform-configuration-admin.md` user flows/accessibility; design-system page archetypes |
| `SettingsFlagsRuntimeWorkbench` | `SettingsFlagsRuntimeWorkbenchProps` | `never` | `publicRead`, `entitledRead`, `ownerFull`, `guardianMandate`, `juniorRestricted`, `businessMandate`, `staffCaseScoped`, `adminStepUp`, `forbiddenHidden`, `disabledPrerequisite` | `05a-settings-flags-runtime.md` request/response fields; `05-platform-configuration-admin.md` interactions/access rules |
| `AdminWorkspaceOperationsWorkbench` | `AdminWorkspaceOperationsWorkbenchProps` | `never` | `publicRead`, `entitledRead`, `ownerFull`, `guardianMandate`, `juniorRestricted`, `businessMandate`, `staffCaseScoped`, `adminStepUp`, `forbiddenHidden`, `disabledPrerequisite` | `05b-admin-workspace-operations.md` request/response fields; `05-platform-configuration-admin.md` interactions/access rules |
| `PortabilityQualityLifecycleWorkbench` | `PortabilityQualityLifecycleWorkbenchProps` | `never` | `publicRead`, `entitledRead`, `ownerFull`, `guardianMandate`, `juniorRestricted`, `businessMandate`, `staffCaseScoped`, `adminStepUp`, `forbiddenHidden`, `disabledPrerequisite` | `05c-portability-quality-lifecycle.md` request/response fields; `05-platform-configuration-admin.md` interactions/access rules |
| Global primitives consumed by this spec | Canonical interfaces from design-system Global Component Inventory; local wrappers forbidden | Canonical slot only where that interface declares it, otherwise `never` | `default`, `hover`, `focus`, `active`, `disabled`, `loading`, `error` plus semantic/access variants named above | `design-system.md` Global Component Inventory and State Language |

### IA flow to page/component ownership

| IA flow | Trigger/response owner | Source citation | Visual feedback and timing |
|---|---|---|---|
| `CFG-01` Register setting definition | `PlatformConfigurationAdminRoute` orchestrates; `SettingsFlagsRuntimeWorkbench`, `AdminWorkspaceOperationsWorkbench`, `PortabilityQualityLifecycleWorkbench` renders the relevant BE response and command state | `05-platform-configuration-admin.md` Interactions row `CFG-01` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `CFG-02` Resolve effective value | `PlatformConfigurationAdminRoute` orchestrates; `SettingsFlagsRuntimeWorkbench`, `AdminWorkspaceOperationsWorkbench`, `PortabilityQualityLifecycleWorkbench` renders the relevant BE response and command state | `05-platform-configuration-admin.md` Interactions row `CFG-02` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `CFG-03` Propose setting change | `PlatformConfigurationAdminRoute` orchestrates; `SettingsFlagsRuntimeWorkbench`, `AdminWorkspaceOperationsWorkbench`, `PortabilityQualityLifecycleWorkbench` renders the relevant BE response and command state | `05-platform-configuration-admin.md` Interactions row `CFG-03` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `CFG-04` Approve/schedule/activate/rollback | `PlatformConfigurationAdminRoute` orchestrates; `SettingsFlagsRuntimeWorkbench`, `AdminWorkspaceOperationsWorkbench`, `PortabilityQualityLifecycleWorkbench` renders the relevant BE response and command state | `05-platform-configuration-admin.md` Interactions row `CFG-04` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `CFG-05` Manage release flag | `PlatformConfigurationAdminRoute` orchestrates; `SettingsFlagsRuntimeWorkbench`, `AdminWorkspaceOperationsWorkbench`, `PortabilityQualityLifecycleWorkbench` renders the relevant BE response and command state | `05-platform-configuration-admin.md` Interactions row `CFG-05` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `CFG-06` Run experiment | `PlatformConfigurationAdminRoute` orchestrates; `SettingsFlagsRuntimeWorkbench`, `AdminWorkspaceOperationsWorkbench`, `PortabilityQualityLifecycleWorkbench` renders the relevant BE response and command state | `05-platform-configuration-admin.md` Interactions row `CFG-06` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `CFG-07` Activate kill switch | `PlatformConfigurationAdminRoute` orchestrates; `SettingsFlagsRuntimeWorkbench`, `AdminWorkspaceOperationsWorkbench`, `PortabilityQualityLifecycleWorkbench` renders the relevant BE response and command state | `05-platform-configuration-admin.md` Interactions row `CFG-07` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `CFG-08` Work admin inbox | `PlatformConfigurationAdminRoute` orchestrates; `SettingsFlagsRuntimeWorkbench`, `AdminWorkspaceOperationsWorkbench`, `PortabilityQualityLifecycleWorkbench` renders the relevant BE response and command state | `05-platform-configuration-admin.md` Interactions row `CFG-08` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `CFG-09` Search/filter control plane | `PlatformConfigurationAdminRoute` orchestrates; `SettingsFlagsRuntimeWorkbench`, `AdminWorkspaceOperationsWorkbench`, `PortabilityQualityLifecycleWorkbench` renders the relevant BE response and command state | `05-platform-configuration-admin.md` Interactions row `CFG-09` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `CFG-10` Preview/run bulk action | `PlatformConfigurationAdminRoute` orchestrates; `SettingsFlagsRuntimeWorkbench`, `AdminWorkspaceOperationsWorkbench`, `PortabilityQualityLifecycleWorkbench` renders the relevant BE response and command state | `05-platform-configuration-admin.md` Interactions row `CFG-10` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `CFG-11` Grant/revoke admin capability | `PlatformConfigurationAdminRoute` orchestrates; `SettingsFlagsRuntimeWorkbench`, `AdminWorkspaceOperationsWorkbench`, `PortabilityQualityLifecycleWorkbench` renders the relevant BE response and command state | `05-platform-configuration-admin.md` Interactions row `CFG-11` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `CFG-12` Inspect audit/diagnostics | `PlatformConfigurationAdminRoute` orchestrates; `SettingsFlagsRuntimeWorkbench`, `AdminWorkspaceOperationsWorkbench`, `PortabilityQualityLifecycleWorkbench` renders the relevant BE response and command state | `05-platform-configuration-admin.md` Interactions row `CFG-12` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `CFG-13` Import/export/restore | `PlatformConfigurationAdminRoute` orchestrates; `SettingsFlagsRuntimeWorkbench`, `AdminWorkspaceOperationsWorkbench`, `PortabilityQualityLifecycleWorkbench` renders the relevant BE response and command state | `05-platform-configuration-admin.md` Interactions row `CFG-13` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `CFG-14` Run quality/retention action | `PlatformConfigurationAdminRoute` orchestrates; `SettingsFlagsRuntimeWorkbench`, `AdminWorkspaceOperationsWorkbench`, `PortabilityQualityLifecycleWorkbench` renders the relevant BE response and command state | `05-platform-configuration-admin.md` Interactions row `CFG-14` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |

Every IA interaction row is represented above. No flow is inferred from a heading or omitted because it shares an endpoint.

### Server, URL, and client state query registry

| BE operation/query | Server-state key | URL state | Island-local state | All async render states |
|---|---|---|---|---|
| `CFG-05C-03` records list | `portability-records` keyed by kind, state, cursor | `tab`, `kind`, `state`, `cursor` | Pending filter edit | idle, loading, success, empty (no records or filter miss), not-disclosed, error, degraded |
| `CFG-05C-04` record detail | `portability-record` keyed by kind and record ID | `recordId`, `kind`, `rowsCursor` | Open confirmation, upload progress | idle, loading, success, optimistic-pending (cancel or revoke only), conflict, not-disclosed, error, degraded |
| `CFG-05C-01` actions | none (command) | none | Pending command and idempotency key | idle, pending, success, per-class error, conflict, step-up required |
| `CFG-05C-05` download | none (command) | none | Pending transfer and claim key | idle, pending, saved, per-class error |
| `CFG-05C-06` records list | `quality-lifecycle-records` keyed by kind, state, target, cursor | `tab`, `kind`, `state`, `targetId`, `cursor` | Pending filter edit | idle, loading, success, empty, not-disclosed, error, degraded |
| `CFG-05C-07` record detail | `quality-lifecycle-record` keyed by kind and record ID | `recordId`, `kind`, `childCursor`, `severity` | Open confirmation | idle, loading, success, stale, not-disclosed, error, degraded |
| `CFG-05C-02` actions | none (command) | none | Pending command and idempotency key | idle, pending, success, per-class error, conflict, step-up required |
| `CFG-05B-06` reset | none (command) | `tab=mfa-reset` | Form values, open confirmation, pending command and idempotency key | idle, pending, success (completed or reconciling), per-class error, conflict, step-up required |

No global client store is authorized. A new cross-island state need requires architecture review; until then URL/server state or a colocated island state owns it.

### Route registry with guards and metadata

| URL pattern | Auth guard and failure redirect | Page component | Meta title | Meta description |
|---|---|---|---|---|
| `/app/platform-configuration-admin` | Server validates Supabase token, expiry, acting context, and route capability. Missing/expired token redirects 303 to `/auth/sign-in?returnTo=%2Fapp%2Fplatform-configuration-admin` after allowlist normalization. Valid but concealed target returns 404; visible forbidden target renders `CapabilityGate`. | `PlatformConfigurationAdminRoute` variant `appPage` | `Platform configuration, admin and quality | WeJammin` | `Work with platform configuration, admin and quality using current authority, record state, and provenance.` |
| `/app/platform-configuration-admin/:recordId` | Same token/expiry/context check; malformed ID returns 400, concealed/unreadable returns 404, expired session uses the same safe sign-in redirect. | `PlatformConfigurationAdminRoute` with the matching workbench detail variant | `Record | Platform configuration, admin and quality | WeJammin` | `Review the current record, provenance, history, and permitted actions.` |
| Public projection when a BE route declares one | No session accepted as authority; public projection only. Unsafe or non-public record returns disclosure-safe 404, never app-shell redirect. | `PlatformConfigurationAdminRoute` variant `publicPage` | `Platform configuration, admin and quality | WeJammin` | `View the public, provenance-labelled record.` |
| System/degraded boundary | Preserves verified shell only; Retry stays on canonical URL; unsafe cached data is removed. | `PlatformConfigurationAdminRoute` variant `degradedPage` | `Service status | WeJammin` | `Review affected scope, last verified time, request ID, and recovery action.` |

### Per-component responsive contract

| Component | Mobile ≤768 px | Tablet 769–1024 px | Desktop ≥1025 px |
|---|---|---|---|
| `PlatformConfigurationAdminRoute` | Four-column shell, 16 px gutter/margins, compact tabs, stack navigation, Back before detail, no horizontal page scroll at 320 CSS px | Eight-column shell, 20 px gutter, 24 px margins, collapsible sidebar, list/inspector when container permits | Twelve-column shell, 24 px gutter, max 1440 px, persistent sidebar/top bar, stable route heading/action region |
| `SettingsFlagsRuntimeWorkbench` | List then detail stack; priority facts remain; action bar avoids virtual keyboard; controls at least 44 by 44 px | List plus inline inspector or stack by container; two-column fields only when independent; lower-priority columns move into row details | List/detail workbench; compact semantic table; virtualize over 100 rows; detail/action rail shows acting context and version |
| `AdminWorkspaceOperationsWorkbench` | List then detail stack; priority facts remain; action bar avoids virtual keyboard; controls at least 44 by 44 px | List plus inline inspector or stack by container; two-column fields only when independent; lower-priority columns move into row details | List/detail workbench; compact semantic table; virtualize over 100 rows; detail/action rail shows acting context and version |
| `PortabilityQualityLifecycleWorkbench` | List then detail stack; priority facts remain; action bar avoids virtual keyboard; controls at least 44 by 44 px | List plus inline inspector or stack by container; two-column fields only when independent; lower-priority columns move into row details | List/detail workbench; compact semantic table; virtualize over 100 rows; detail/action rail shows acting context and version |
| Global `FilterBar`, `DataTable`, `ActionBar`, `ConfirmationStep` | Apply/Reset and priority-list form; action labels remain text; confirmation becomes separate review step | Wrapped toolbar and row detail expansion; no hidden material field | Full typed filter/table/action composition; same semantics and authorization |

### Interaction, accessibility, and image rules

| Interactive element | Native role and accessible name | Keyboard/focus | Feedback |
|---|---|---|---|
| Navigation/record link | `a` with visible purpose; `aria-current` only for current route | Tab, Enter; route focuses `h1`; Back restores prior trigger/scroll | Visited/current are not color-only; navigation busy only after 250 ms |
| Button/icon button | `button`; visible label or specific `aria-label`; decorative icon `aria-hidden=true` | Tab, Enter, Space; disabled is native when unavailable; focus ring never removed | Same-frame pressed/pending; stable label width; result in polite live region |
| Form controls | Native `input`/`select`/`textarea` with persistent `label` and help/error IDs | Logical Tab; first invalid field from linked summary; Enter cannot bypass review; Escape does not erase form | Blur validation where safe, authoritative submit validation, errors within 100 ms of response |
| Table/filter/selection | Native table/header buttons and labelled filter form; no ARIA grid without grid behavior | Tab through controls; Arrow keys only in declared composite; stable selection focus on refetch | Sort/filter state text and result count announced politely |
| Dialog/drawer/popover when inline is exhausted | Named dialog/region; trigger relationship; consequence in heading | Initial heading focus, Tab containment for modal, Escape before commit, return focus | Open/close 150–220 ms or instant under reduced motion |
| Media/upload | Native media/file controls with filename, type, progress, cancel, transcript/caption links | Full keyboard operation; no drag-only or waveform-only action | Determinate progress where known; quarantine/failed/ready text |

- **Image alt policy**: informative images use concise purpose-specific alt; functional images use the action name; decorative images use empty `alt=""` and no redundant ARIA; complex charts/artwork use short alt plus adjacent long description/data table; user/CMS images require governed alt before publication; avatars use the visible person/organization name only when the image adds identity.
- **Output semantics**: every icon is decorative or named, every status combines text/icon/structure, and every dynamic result uses the least interruptive correct live region. WCAG 2.2 AA is mandatory.

### Performance budgets and loading strategy

| Page/component | JavaScript budget (gzip) | Lazy loading | Image/media policy | Runtime targets |
|---|---:|---|---|---|
| `PlatformConfigurationAdminRoute` public variant | ≤45 KB initial route JS; zero hydration when static | Hydrate only a visible interaction with `client:visible`; no global router | Astro image pipeline emits width/height, AVIF/WebP plus fallback, responsive `srcset`/`sizes`; below-fold images lazy; hero/record identity eager only when LCP | LCP <2.5 s, INP <200 ms, CLS <0.1 at p75 |
| `PlatformConfigurationAdminRoute` app/admin variant | ≤90 KB initial route JS including shared shell | Each workbench island ≤35 KB initial; editor/media/chart modules split to ≤80 KB lazy chunk and load on explicit entry/visibility; independent fetches parallel | Same optimized image contract; audio/video metadata preload only until explicit play; waveform data lazy and functional | LCP <2.5 s, INP <200 ms, CLS <0.1; interaction feedback same frame |
| `SettingsFlagsRuntimeWorkbench` | ≤35 KB hydrated entry | Detail/editor/media/export modules dynamic-import on selection; list over 100 virtualizes; no barrel import | Preserve intrinsic dimensions; thumbnails use bounded variants; originals never download for list rows | Long task off main thread or chunked; no task >50 ms during input |
| `AdminWorkspaceOperationsWorkbench` | ≤35 KB hydrated entry | Detail/editor/media/export modules dynamic-import on selection; list over 100 virtualizes; no barrel import | Preserve intrinsic dimensions; thumbnails use bounded variants; originals never download for list rows | Long task off main thread or chunked; no task >50 ms during input |
| `PortabilityQualityLifecycleWorkbench` | ≤35 KB hydrated entry | Detail/editor/media/export modules dynamic-import on selection; list over 100 virtualizes; no barrel import | Preserve intrinsic dimensions; thumbnails use bounded variants; originals never download for list rows | Long task off main thread or chunked; no task >50 ms during input |

Budgets are hard acceptance criteria for `/plan-phase` and implementation. A feature exceeding a budget must split or obtain an originating architecture decision, not silently raise the number.

### Form and auth security rules

| Boundary | Exact frontend rule |
|---|---|
| Token/session | Astro verifies the Supabase token server-side on every protected route and write, checks expiry/revocation and server-derived acting context, strips protected props on failure, and uses the allowlisted 303 sign-in redirect above. Client role strings never authorize. |
| CSRF | Cookie-authenticated mutations require same-site `Secure`/`HttpOnly` cookies, strict allowed `Origin`/`Referer` validation, and the architecture-approved CSRF token binding. Bearer-only API calls do not rely on cookies but still enforce CORS/origin policy. No GET mutates. |
| Input validation/sanitization | Controls serialize only named Zod request fields; trim/normalize only where the contract says; reject unknown keys; rich text/URLs/filenames pass allowlist sanitizers server-side. Client checks improve feedback but never replace boundary validation. |
| Output encoding | Render untrusted text through framework text bindings. `dangerouslySetInnerHTML` is prohibited except an approved sanitized typed CMS renderer; URL attributes use allowlisted schemes; CSS/script/expression content is never executed. |
| Secrets/PII | Tokens, provider responses, evidence bodies, contact data, media URLs, and drafts never enter URL, analytics, logs, structured diagnostic events, Realtime payloads, or client-persisted global state. |
| Upload | Server-authorized short-lived intent binds actor, target, type, size, key, and checksum. Client cannot choose canonical object key; unverified/quarantined bytes never render as ready. |
| Redirects | `returnTo` is a relative route from a code-owned allowlist, normalized before encoding. External schemes, protocol-relative URLs, control characters, and unauthorized admin destinations fall back to the safe app root. |

### Form-by-source completeness

| BE source | Fields/validation | Error display | Submission and success | Security |
|---|---|---|---|---|
| `05a-settings-flags-runtime.md` | Exact named Zod request schema: type, optionality, default, min/max/enum/format, cross-field rule; safe local checks on blur and full authoritative check on submit | Linked summary plus exact field errors; preserve all valid and server-accepted input; no raw upstream copy | One idempotent commit with expected version; stable pending label; parsed authoritative response replaces draft; result heading receives focus | CSRF/origin rule by credential mode, unknown-key rejection, allowlist sanitization, framework output encoding, secret/PII redaction |
| `05b-admin-workspace-operations.md` | Exact named Zod request schema: type, optionality, default, min/max/enum/format, cross-field rule; safe local checks on blur and full authoritative check on submit | Linked summary plus exact field errors; preserve all valid and server-accepted input; no raw upstream copy | One idempotent commit with expected version; stable pending label; parsed authoritative response replaces draft; result heading receives focus | CSRF/origin rule by credential mode, unknown-key rejection, allowlist sanitization, framework output encoding, secret/PII redaction |
| `05c-portability-quality-lifecycle.md` | Exact named Zod request schema: type, optionality, default, min/max/enum/format, cross-field rule; safe local checks on blur and full authoritative check on submit | Linked summary plus exact field errors; preserve all valid and server-accepted input; no raw upstream copy | One idempotent commit with expected version; stable pending label; parsed authoritative response replaces draft; result heading receives focus | CSRF/origin rule by credential mode, unknown-key rejection, allowlist sanitization, framework output encoding, secret/PII redaction |

## Data Mapping

Every BE operation and parsed response field is owned below. Components consume generated Zod-inferred types; no hand-written partial DTO may silently omit a field. A field is displayed, drives explicit state/control, or is non-rendered for a named security reason.

| BE source | Operation | Method/path | Success to component | Error mapping |
|---|---|---|---|---|
| `05a-settings-flags-runtime.md` | `05A-SETTINGS-FLAGS-RUNTIME-REGISTRY` | `REGISTERED See route registry` | `2xx` parsed into `SettingsFlagsRuntimeWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `05b-admin-workspace-operations.md` | `05B-ADMIN-WORKSPACE-OPERATIONS-REGISTRY` | `REGISTERED See route registry` | `2xx` parsed into `AdminWorkspaceOperationsWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `05c-portability-quality-lifecycle.md` | `CFG-05C-01` to `CFG-05C-07` (`CFG-05C-08` and `CFG-05C-09` are service-principal routes and have no UI) | `POST /api/v1/admin/portability/actions`; `POST /api/v1/admin/quality-lifecycle/actions`; `GET /api/v1/admin/portability/records`; `GET /api/v1/admin/portability/records/{kind}/{recordId}`; `POST /api/v1/admin/portability/artifacts/{artifactId}/downloads`; `GET /api/v1/admin/quality-lifecycle/records`; `GET /api/v1/admin/quality-lifecycle/records/{kind}/{recordId}` | `2xx` parsed into the matching `PortabilityQualityLifecycleWorkbench` view by schema; update only after validation; `202` starts a status poll of the detail read | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |

### Response field ownership

| BE source | Contract schemas | Parsed field set | UI ownership |
|---|---|---|---|
| `05a-settings-flags-runtime.md` | Named source schemas | All named response fields | `SettingsFlagsRuntimeWorkbench`: identity/version/state in `<RecordHeader>`; provenance in `<ProvenanceFact>`; command/status in `<ActionBar>`/`<StateLabel>`; remaining authorized facts in detail rows; security-only fields never serialize |
| `05b-admin-workspace-operations.md` | Named source schemas | `taskClasses`, `states`, `staleAfter` | `AdminWorkspaceOperationsWorkbench`: identity/version/state in `<RecordHeader>`; provenance in `<ProvenanceFact>`; command/status in `<ActionBar>`/`<StateLabel>`; remaining authorized facts in detail rows; security-only fields never serialize |
| `05c-portability-quality-lifecycle.md` | Named source schemas | All named response fields | `PortabilityQualityLifecycleWorkbench`: identity/version/state in `<RecordHeader>`; provenance in `<ProvenanceFact>`; command/status in `<ActionBar>`/`<StateLabel>`; remaining authorized facts in detail rows; security-only fields never serialize |

### Exhaustive BE field and error ownership

The unions below are generated from every contract identifier in each complete BE source, not a representative sample. Request-only identifiers remain because their owning form consumes them; response identifiers remain because the workbench renders them or uses them for explicit state/control. Generated Zod types remain normative if this conservative union includes a non-field identifier.

```ts
type SettingsFlagsRuntimeContractField =
  never;
interface SettingsFlagsRuntimeWorkbenchContractFields {
  source: '05a-settings-flags-runtime.md';
  fields: Readonly<Record<SettingsFlagsRuntimeContractField, unknown>>;
}
```

```ts
type AdminWorkspaceOperationsContractField =
  | 'mfaVersion'
  | 'reason'
  | 'removedFactorCount'
  | 'resetId'
  | 'staleAfter'
  | 'states'
  | 'targetPersonId'
  | 'taskClasses';
interface AdminWorkspaceOperationsWorkbenchContractFields {
  source: '05b-admin-workspace-operations.md';
  fields: Readonly<Record<AdminWorkspaceOperationsContractField, unknown>>;
}
```

```ts
type PortabilityQualityLifecycleContractField =
  | 'action'
  | 'actorPurpose'
  | 'actualManifestHash'
  | 'attemptCount'
  | 'blockedCount'
  | 'blockingCount'
  | 'blockPath'
  | 'byteSize'
  | 'checkerKey'
  | 'checkerVersion'
  | 'checkSetVersion'
  | 'childCursor'
  | 'childLimit'
  | 'classification'
  | 'containsProtected'
  | 'counselDecisionRef'
  | 'counts'
  | 'createdAt'
  | 'cursor'
  | 'downloadCount'
  | 'dryRunReport'
  | 'duplicatePolicy'
  | 'encryptionMode'
  | 'errorCode'
  | 'errors'
  | 'errorsTruncated'
  | 'evidenceRef'
  | 'excludeProtectedEvidence'
  | 'expectedManifestHash'
  | 'expectedReportHash'
  | 'expectedVersion'
  | 'expiresAt'
  | 'exportArtifactId'
  | 'exportType'
  | 'failureCode'
  | 'fieldId'
  | 'fieldManifest'
  | 'findings'
  | 'findingsTruncated'
  | 'holdConflict'
  | 'humanReview'
  | 'impact'
  | 'importedCount'
  | 'importJobId'
  | 'inputHash'
  | 'isolatedTarget'
  | 'itemCount'
  | 'items'
  | 'kind'
  | 'lifecycleRequestId'
  | 'limit'
  | 'location'
  | 'manifest'
  | 'manifestHash'
  | 'mapperKey'
  | 'mappingVersion'
  | 'maxDownloads'
  | 'message'
  | 'nextCursor'
  | 'objectId'
  | 'outboxEventId'
  | 'outcome'
  | 'pointer'
  | 'provenance'
  | 'qualityCheckRunId'
  | 'quarantinedCount'
  | 'reason'
  | 'recipientPublicKey'
  | 'recordId'
  | 'reportHash'
  | 'requestedScope'
  | 'requestType'
  | 'residualCount'
  | 'restoreVerificationId'
  | 'rowCount'
  | 'rowIndex'
  | 'rows'
  | 'rowsCursor'
  | 'rowsLimit'
  | 'ruleCode'
  | 'ruleId'
  | 'runAt'
  | 'scope'
  | 'scopeCount'
  | 'scopeManifest'
  | 'severity'
  | 'sourceArtifactId'
  | 'sourceFormat'
  | 'sourceHash'
  | 'sourceRowId'
  | 'sourceVersion'
  | 'state'
  | 'stepUpToken'
  | 'store'
  | 'stores'
  | 'subjectPersonId'
  | 'summary'
  | 'targetEntryId'
  | 'targetEnvironment'
  | 'targetId'
  | 'targetScope'
  | 'targetType'
  | 'targetVersion'
  | 'timeoutMs'
  | 'updatedAt'
  | 'verification'
  | 'verifiedSubject'
  | 'verifyAccessibility'
  | 'verifyRls'
  | 'version'
  | 'warningCount';
interface PortabilityQualityLifecycleWorkbenchContractFields {
  source: '05c-portability-quality-lifecycle.md';
  fields: Readonly<Record<PortabilityQualityLifecycleContractField, unknown>>;
}
```

| BE source | Owning component/prop | Every discovered application error code | UI state owner |
|---|---|---|---|
| `05a-settings-flags-runtime.md` | `SettingsFlagsRuntimeWorkbenchContractFields.fields` and `SettingsFlagsRuntimeWorkbenchProps.contractFields` | `APPROVAL_INVALID`, `CONSENT_REQUIRED`, `CONTROL_PLANE_UNAVAILABLE`, `DEFINITION_NOT_FOUND`, `EXPERIMENT_NOT_FOUND`, `FLAG_INVALID`, `FLAG_NOT_FOUND`, `FORBIDDEN`, `IDEMPOTENCY_CONFLICT`, `INVALID_DEFINITION`, `INVALID_REQUEST`, `NOT_FOUND`, `RATE_LIMITED`, `REVIEW_NOT_FOUND`, `SNAPSHOT_UNAVAILABLE`, `STALE_DEFINITION`, `STEP_UP_REQUIRED`, `SWITCH_INVALID`, `SWITCH_NOT_FOUND`, `UNAUTHENTICATED`, `UPSTREAM_TIMEOUT`, `VALUE_INVALID`, `VALUE_UNAVAILABLE`, `VERSION_CONFLICT` | validation/input → linked summary; auth/permission → auth or capability gate; not-found → disclosure-safe route/row; conflict/stale/mismatch/duplicate → sync conflict; rate → retry wait; dependency/timeout/unavailable → degraded; blocked/failed/cancelled/revoked → exact terminal state and legitimate recovery |
| `05b-admin-workspace-operations.md` | `AdminWorkspaceOperationsWorkbenchContractFields.fields` and `AdminWorkspaceOperationsWorkbenchProps.contractFields` | `AUDIT_TARGET_NOT_FOUND`, `BULK_UNAVAILABLE`, `DIAGNOSTIC_UNAVAILABLE`, `DIAGNOSTIC_VERSION_CONFLICT`, `FORBIDDEN`, `GRANT_INVALID`, `GRANT_NOT_FOUND`, `GRANT_VERSION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `IDENTITY_UNAVAILABLE`, `INVALID_REQUEST`, `MANIFEST_CONFLICT`, `MFA_RESET_INVALID`, `MFA_RESET_IN_PROGRESS`, `NOT_FOUND`, `RATE_LIMITED`, `SEARCH_UNAVAILABLE`, `STEP_UP_REQUIRED`, `TARGET_NOT_FOUND`, `TASK_SOURCE_UNAVAILABLE`, `UNAUTHENTICATED`, `UPSTREAM_TIMEOUT`, `VERSION_CONFLICT` | validation/input → linked summary; auth/permission → auth or capability gate; not-found → disclosure-safe route/row; conflict/stale/mismatch/duplicate → sync conflict; rate → retry wait; dependency/timeout/unavailable → degraded; blocked/failed/cancelled/revoked → exact terminal state and legitimate recovery |
| `05c-portability-quality-lifecycle.md` | `PortabilityQualityLifecycleWorkbenchContractFields.fields` and `PortabilityQualityLifecycleWorkbenchProps.contractFields` | `ARTIFACT_NOT_DOWNLOADABLE`, `BLOCKING_FINDING`, `FORBIDDEN`, `HOLD_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `INVALID_REQUEST`, `LIFECYCLE_TARGET_NOT_FOUND`, `LIFECYCLE_UNAVAILABLE`, `MANIFEST_CONFLICT`, `NOT_FOUND`, `PORTABILITY_LIMIT_EXCEEDED`, `PORTABILITY_TARGET_NOT_FOUND`, `PORTABILITY_UNAVAILABLE`, `PROTECTED_FIELD`, `RATE_LIMITED`, `RESTORE_UNVERIFIED`, `STEP_UP_REQUIRED`, `UNAUTHENTICATED`, `UNSUPPORTED_FORMAT`, `UPSTREAM_TIMEOUT`, `VERSION_CONFLICT` | validation/input → linked summary; auth/permission → auth or capability gate; not-found → disclosure-safe route/row; conflict/stale/mismatch/duplicate → sync conflict; rate → retry wait; dependency/timeout/unavailable → degraded; blocked/failed/cancelled/revoked → exact terminal state and legitimate recovery |

No discovered field or error code is allowed to fall through to generic rendering. An unrecognized schema discriminant or code is a contract mismatch: isolate in `ErrorBoundary`, show request ID and Retry/Status, and report scrubbed telemetry.

### Error class ownership

| Class | Required UI | Retry | Focus/announcement |
|---|---|---|---|
| 400 `INVALID_REQUEST` / 422 `VALIDATION_FAILED` | Summary plus field/row errors; preserve valid input | Correction only | Focus linked summary then field; concise alert |
| 401 `UNAUTHENTICATED` | Reauthentication with safe return; protected data removed | After session recovery | Focus auth heading; announce expiry |
| 401 `STEP_UP_REQUIRED` | Navigate to `/step-up?returnTo=<current relative path>` with the typed `allowedMethods`; no gate, never a 403 | After step-up the form re-opens and the human re-confirms | Focus the confirm control on return; announce `Verification complete. Review and confirm to continue.` |
| 403 `FORBIDDEN` | `<CapabilityGate>` with reason/recovery; no broadened disclosure | After capability refetch | Focus gate; no protected names |
| 404 | Disclosure-safe not-found; distinguish deleted only when authorized | Navigation | Focus route heading |
| 409 conflict/idempotency/state | `<SyncConflict>` with server/current version and preserved draft | Reconcile first | Focus conflict; announce no overwrite |
| 429 `RATE_LIMITED` | Inline countdown from `Retry-After`; input kept | At server time only | Polite coarse updates |
| 415 `UNSUPPORTED_FORMAT` | Inline at the format control: “This format has no registered mapper”; no job created | Choose another format or mapper | Focus the format control; concise alert |
| 422 `PROTECTED_FIELD` / `PORTABILITY_LIMIT_EXCEEDED` / `BLOCKING_FINDING` / `HOLD_CONFLICT` / `RESTORE_UNVERIFIED` | Inline at the named control or panel with the stated limit or blocker; no state change, never toast-only | Correction or splitting the source only | Focus the field group or panel heading; concise alert |
| 409 `ARTIFACT_NOT_DOWNLOADABLE` | Artifact panel states not ready, expired, revoked or out of downloads; Download disabled with that reason | None; request a new export | Focus the panel heading; polite status |
| 502/503/504 | Scoped degraded or full System / Degraded by honest renderability | Safe BE attempts only; mutation status first | Request ID/Retry; no raw provider detail |

## Navigation, Degradation, and Concurrency

- **Back/deep link/bookmark**: URL owns query, selection, cursor, and tab. Deep link refetches current authority/version, never serialized client authority.
- **Multi-tab**: version mismatch opens `<SyncConflict>`; another tab only invalidates. No last-write-wins UI claim.
- **Unsaved changes**: scoped draft survives recoverable auth and same-record navigation, but never enters logs, analytics, URL, or Realtime.
- **Authorization change**: revoke protected props/cache, cancel pending presentation, and refetch. Stale UI never authorizes.
- **Realtime reorder/duplication**: hints coalesce; canonical refetch is authoritative; focus/selection/draft remain if allowed.
- **Unknown mutation outcome**: render pending/manual review from operation status. Never show success or blindly resend.
- **Telemetry**: operation, route template, request ID, status, duration, and scrubbed IDs/hashes only. No bodies, evidence, secrets, contact data, or media URLs.

## Testing Obligations

| Level | Required assertions |
|---|---|
| Vitest unit/component | Exhaustive `AsyncState` and access variants; exact error copy/action; blur/submit timing; optimistic confirm/rollback; focus return; reduced motion; no unauthorized props |
| Vitest integration | Zod schemas accept BE fixtures/reject invalid variants; every operation maps fields/errors; ETag/idempotency/rate headers drive UI; Realtime only invalidates |
| Playwright E2E | Critical IA flows by role; keyboard; landmarks/names/live regions; three breakpoints; 200% zoom; offline/reconnect; stale multi-tab; auth expiry; 429/outage |
| Accessibility | axe zero serious/critical; contrast/non-color cues; VoiceOver/NVDA smoke; target size; focus; no trap; captions/transcripts where media exists |
| Performance | Server-first HTML; bounded islands; no hydration waterfall; stable skeleton; LCP <2.5 s, CLS <0.1; virtualize >100; route JS budget verified in phase plan |
| Portability and quality (Vitest component and integration, Playwright E2E) | Upload refusal over 50 MiB; dry-run report tables and 50-row paging; commit sends the rendered `expectedReportHash` and a stale hash shows `<SyncConflict>`; protected import and export require step-up and return to the same view; export form rejects past and over-7-day expiry and a pasted private JWK; recipient-key field appears only for the public-key mode; download uses POST with an idempotency key, saves a blob and shows interruption copy; Download disabled for every non-downloadable state; revoke and cancel confirmations; the restore panel shows eight text results, the Free-tier no-PITR statement, no promote control in any state and Request another verification only after failure; quality panel states for healthy, blocked, failed and stale; findings table has no author text, shows truncation and links locations only with a `targetEntryId`; status poll never moves focus and stops at terminal states; capability variants render per the table with no protected label leaking |

## Deepening and Ambiguity Gate

| Pass | Result |
|---:|---|
| 1 state synchronization | URL, server resource/version, drafts, Realtime, and multi-tab have one authority order. |
| 2 degraded network | Thresholds, timeouts, rate waits, retries, offline intent, and unknown mutations are deterministic. |
| 3 user-flow persistence | Back, deep link, bookmark, auth return, drafts, and success transitions are named. |
| 4 responsive/touch | Every archetype has mobile, tablet, desktop composition plus target/keyboard parity. |
| 5 state enumeration | Idle, loading, per-class error, empty, success, optimistic states, disabled, degraded have triggers/exits. |
| 6 role rendering | Fixed matrix has no empty cells; named variants are capability-selected and disclosure-safe. |
| 7 accessibility edges | Keyboard, focus, announcements, contrast, reflow, reduced motion, timing, tables, media, confirmation are explicit. |
| 8 two-implementer | Components, props, routes, authority, interactions, errors, breakpoints, access, mappings need no undocumented choice. |
| 9 devil's advocate | Forged role/context, stale cache, duplicate activation, reordered hints, offline authority loss, inference, telemetry leaks fail closed. |
| 10 convergence | No new component, state, route, field mapping, permission, or unresolved locked decision emerged. |

**Ambiguity status**: PASS. Upstream IA and BE remain authoritative; this spec selects only allowed frontend implementation details. No product, permission, security, or data-placement decision is redefined.

## Open Questions

None. New product or architecture choices must re-open their originating locked stage and propagate forward.

## Changelog

| Date | Change | Workflow | Sections affected |
|---|---|---|---|
| 2026-08-29 | Initial complete FE specification, source mapping, mandatory deepening, and convergence review | `/write-fe-spec` | All |
| 2026-10-02 | DEC-114 Phase 2 scope: specified the portability, quality and lifecycle workbench views, forms, action contracts, capability variants, download, restore and findings behavior, contract field and error ownership for CFG-05C-01 to CFG-05C-07 | `/propagate-decision` | Component inventory, interactions, state registry, conditional rendering, accessibility, data mapping, testing |
| 2026-10-02 | DEC-111 follow-up: specified the admin MFA factor-reset form (`CFG-05B-06`) with fields, confirmation, exact states and error copy, step-up recovery to `/step-up?returnTo=`, capability variant and a11y; split 401 `STEP_UP_REQUIRED` from 403 in the error-class table | `/write-fe-spec` | Component Inventory, Interaction Specification, FE Rubric Closure, Data Mapping |
| 2026-10-02 | FX-E: specified that settings and admin affordances derive from the CFG-05B-07 capability snapshot (never a response header or alias), and that the settings editor affordance derives from the CFG-05A-02 `ownerCapability` being in that snapshot | `/propagate-decision` | Capability projection, Conditional Rendering |

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
- [[specs/ia/05-platform-configuration-admin|Shard 05 — Platform configuration, admin and quality]]

### References
- [[specs/ia/05-platform-configuration-admin|Shard 05 — Platform configuration, admin and quality]]
