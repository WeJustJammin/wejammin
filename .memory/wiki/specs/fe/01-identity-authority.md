# Identity authority and party governance: Frontend Specification

> **Classification**: Feature specification
> **BE Source**: [01a-auth-account-linking.md](../be/01a-auth-account-linking.md), [01b-party-identity-aliases.md](../be/01b-party-identity-aliases.md), [01c-relationships-authority-governance.md](../be/01c-relationships-authority-governance.md), [01d-identifiers-legacy.md](../be/01d-identifiers-legacy.md)
> **IA Source**: [01-identity-authority.md](../ia/01-identity-authority.md)
> **Surface**: Responsive Astro hybrid web/PWA with bounded React islands
> **Status**: Complete

## Referenced Material Inventory

- **Primary IA**: [01-identity-authority.md](../ia/01-identity-authority.md) in full.
- **BE sources**: [01a-auth-account-linking.md](../be/01a-auth-account-linking.md), [01b-party-identity-aliases.md](../be/01b-party-identity-aliases.md), [01c-relationships-authority-governance.md](../be/01c-relationships-authority-governance.md), [01d-identifiers-legacy.md](../be/01d-identifiers-legacy.md).
- **Cross-cutting FE source**: [00-infrastructure.md](00-infrastructure.md).
- **Step-up and TOTP surfaces (DEC-111)**: BE01a AUTH-API-16 through AUTH-API-21 and its Step-Up Proof and MFA Method Registry; BE00 STEP_UP_REQUIRED Recovery Routing.
- **Design sources**: [design-system.md](../design-system.md), root `PRODUCT.md`, root `DESIGN.md`, and `.agents/skills/brand-guidelines/SKILL.md`.
- **Contract conventions**: BE00 `ApiError`, opaque cursor pagination, ETag/`If-Match`, idempotency, rate-limit headers, canonical refetch after Realtime hints, and disclosure-safe authorization.

## Source Map

| FE section | Authoritative source | Consumed material |
|---|---|---|
| Classification and scope | `01-identity-authority.md`; BE index | Shard boundary and completed BE split group |
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

### `IdentityAuthorityRoute` (Astro server route)

```ts
interface IdentityAuthorityRouteProps {
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

### `AuthAccountLinkingWorkbench` (bounded React island)

**BE owner**: `01a-auth-account-linking.md`

```ts
interface AuthAccountLinkingWorkbenchProps {
  contractFields: AuthAccountLinkingWorkbenchContractFields;
  children?: never;
  variant: DomainVariant;
  initial: AsyncState<readonly AuthAccountLinkingRecord[]>;
  actorId: string;
  actingPartyId: string;
  access: AccessVariant;
  query: Readonly<Record<string, string>>;
  selectedId: string | null;
  expectedVersion: string | null;
  onCanonicalRefetch: (reason: 'navigation' | 'realtime-hint' | 'mutation' | 'reconnect') => Promise<void>;
}

interface AuthAccountLinkingRecord {
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

### Step-Up and TOTP Enrollment Components (DEC-111)

**BE owner**: `01a-auth-account-linking.md` AUTH-API-16 through AUTH-API-21. Browsers never hold a Supabase token or run an MFA client; every call is a same-origin first-party request that carries the session-bound CSRF token.

```ts
type MfaFactorSummary = { id: string; method: 'totp'; friendlyName: string; state: 'pending' | 'verified' | 'reconciling'; verifiedAt: string | null; lastUsedAt: string | null; pendingExpiresAt: string | null };
type StepUpState = { fresh: boolean; freshUntil: string | null };

interface StepUpRouteProps {
  children?: never;
  variant: 'authPage';
  returnTo: string; // server-validated safe relative path; '/app' fallback
  factors: readonly MfaFactorSummary[]; // AUTH-API-16, verified rows only
  allowedMethods: readonly 'totp'[];
  stepUp: StepUpState;
  requestId: string;
}

interface StepUpChallengeFormProps {
  children?: never;
  variant: 'authPage';
  returnTo: string; // never re-read from the URL on the client
  factors: readonly Pick<MfaFactorSummary, 'id' | 'friendlyName'>[];
  initialPhase: StepUpPhase;
}
type StepUpPhase = 'no-factor' | 'choosing-factor' | 'creating-challenge' | 'awaiting-code' | 'verifying' | 'verified' | 'challenge-expired' | 'locked' | 'degraded' | 'signed-out';

interface MfaEnrollmentWizardProps {
  children?: never;
  variant: 'authPage';
  returnTo: string | null; // set only when entered from `/step-up` or a protected form
  factors: readonly MfaFactorSummary[];
  allowedMethods: readonly 'totp'[];
  stepUp: StepUpState;
  expectedVersion: string; // AUTH-API-16 ETag, sent as If-Match
}

interface OneTimeCodeFieldProps {
  children?: never;
  name: 'code';
  label: string;
  describedBy: string;
  errorId: string | null;
  readOnly: boolean;
}
```

- **`/step-up` (`StepUpRoute` + `StepUpChallengeForm`)**: Astro renders the heading, explanation, and the verified-factor list from AUTH-API-16 server-side; the island owns challenge, code entry, and navigation. `returnTo` is parsed from the query on the server with the same relative first-party rule as sign-in (1–512 characters, no scheme, authority, backslash, control character, or ambiguous encoding), must not be `/step-up` or start with `/auth/`, and must pass the code-owned route allowlist; otherwise it is `/app`. The page is `Cache-Control: no-store`. Missing or expired session: 303 to `/auth/sign-in?returnTo=` carrying the encoded `/step-up?returnTo=…` (or `/step-up` alone when the combined value exceeds 512 characters). When `stepUp.fresh` is already true the page says so with the `freshUntil` time and offers a Continue link; it never auto-redirects, so a disagreement between pages can never loop.
- **Phases**: `no-factor` (no `verified` factor, or only `pending`/`reconciling`): explains that a verified authenticator is required, primary link to `/settings/security/mfa?returnTo=<returnTo>`, secondary link back to `returnTo`. One verified factor: the island creates the challenge on mount (POST AUTH-API-20 with `{ method: "totp" }`; never during server rendering). More than one: a labelled radio group chooses the authenticator, then Continue creates the challenge with `factorId`. `awaiting-code`: names the authenticator, shows `<OneTimeCodeField>` and a Verify button. `verifying`: the field becomes read-only (not disabled, so focus and the typed value survive), the button shows a stable "Verifying" label, duplicate activation is ignored. `verified`: polite status "Verified. Returning to your page." then `window.location.assign(returnTo)`, a full navigation so the rotated cookies are used and the CSRF token is re-read.
- **Multi-tab**: success posts an invalidation-only `BroadcastChannel` message; other tabs refetch AUTH-API-16 to refresh `stepUp`. No tab copies another tab's proof.
- **`/settings/security/mfa` (`MfaEnrollmentWizard` + `MfaFactorList`)**: a Guided Form / Transaction page reached from `/settings/security` (new "Two-step verification" link), from `/step-up` `no-factor`, and directly. `MfaFactorList` is a semantic table (Name, Status, Added, Last used, row action) that becomes a priority list on mobile; `reconciling` rows show "Checking status" with a refresh control; the empty state is "No authenticator is set up" with the single action "Set up an authenticator". Wizard steps are inline sections, not a modal: (1) Name: one text field `friendlyName` (persistent label, 1–80 characters, `autocomplete="off"`), submit sends AUTH-API-17 with `If-Match: expectedVersion` and keeps the `version` it returns as the `If-Match` for AUTH-API-18; (2) Scan: the QR code is rendered locally from `otpauthUri` as an inline SVG (`role="img"`, accessible name "QR code for adding WeJammin to an authenticator app") with no third-party QR service, plus the manual key as `<code translate="no">` shown in groups of four, a native Copy key button announcing "Key copied" politely, and `<OneTimeCodeField>` with a "Verify and finish" button (AUTH-API-18); no `otpauth:` link is rendered; (3) Done: heading "Authenticator added", the `freshUntil` time, one Continue link to `returnTo` or back to the list, and the plain note that losing every authenticator is handled by account recovery by email followed by an administrator resetting your authenticators, because no recovery codes exist.
- **Secret handling**: `otpauthUri` and `manualEntryKey` live only in island memory. They never enter the URL, `history.state`, Web Storage, IndexedDB, Astro props, analytics, `ErrorBoundary` payloads, or logs, and are cleared on success, supersession, `pagehide`, and unmount. A reload cannot re-show the secret: the pending row appears in the list as "Setup not finished" with Start again (AUTH-API-17, which supersedes) and Cancel setup (AUTH-API-19 with `user_request`, no step-up).
- **Removal**: row action "Remove <name>" opens an inline `<ConfirmationStep>` naming the consequence ("You will not be able to verify protected actions with it"; for the last verified factor, "…until you add another authenticator"), a required reason radio group (`user_request` default, `factor_compromise` with the note "Your other signed-in sessions will be signed out"), a per-instance `Idempotency-Key`, and `If-Match: expectedVersion`; Escape cancels before commit; success replaces the list from the response, focuses the list heading, and announces "Authenticator removed". While the account holds a capability that requires verification, removing the last verified authenticator is refused by the server (409 `last_factor_required`): the confirmation stays closed, the status "You still have access that needs verification, so add another authenticator before removing this one." is announced politely, and the single action "Set up an authenticator" opens the wizard; no state changes.
- **Consumption by protected forms**: on 401 `STEP_UP_REQUIRED` the originating form persists its scoped draft (tab-scoped, no codes, no secrets, original `Idempotency-Key` and expected version), computes `returnTo` from its current relative path plus query (path only when the combined value exceeds 512 characters, `/app` when still invalid), and navigates to `/step-up?returnTo=<encoded>`. On return it restores the draft, refetches the expected version (a change opens `<SyncConflict>`), announces "Verification complete. Review and confirm to continue.", focuses the confirm control, and waits: nothing is auto-submitted. `allowedMethods` containing anything other than `totp` is ignored; an empty list renders "No verification method is available" as a degraded state with the request ID.
- **Variants**: all roles see the same self-account surface. Acting context, alias, mandate, or representation never changes whose factor is verified; the heading and help always say "your account". Staff and Admin variants gain nothing except that their named-capability commands raise `STEP_UP_REQUIRED` as above.
- **A11y inline contract**: one `h1` that receives focus on route load ("Verify it's you" / "Two-step verification"); title includes the page purpose; `<OneTimeCodeField>` is a single `input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="12" spellcheck="false" autocapitalize="none" enterkeyhint="done"` with a persistent label, help text linked by `aria-describedby`, paste allowed, and no auto-advancing segmented boxes; the form sets `novalidate` and the client removes spaces and hyphens before the six-digit check (so `maxlength` of 12 tolerates a pasted "123 456"); no `pattern` attribute is used because native pattern validation would reject the pasted spaces. Field errors use `aria-invalid="true"`, a linked error element with `role="alert"`, and keep focus in the field; `code_incorrect` clears the value and re-selects the field. There is no ticking timer announcement: challenge expiry is announced once when it happens. Lockout countdown text updates visually each second but is announced politely at start, at most once per minute, and at unlock. Target size is 44 by 44 CSS px on mobile and at least 24 CSS px elsewhere; contrast and reduced-motion rules are inherited.
- **Error copy and routing**: 401 `UNAUTHENTICATED` from AUTH-API-17 when no verified factor exists (primary sign-in older than the 600-second window) redirects 303 to `/auth/sign-in` with `returnTo=/settings/security/mfa` and the status "For your security, sign in again to set up your first authenticator." (never routed to `/step-up`, which needs a factor); 409 `last_factor_required` as described under Removal; 422 `code_invalid` "Enter the 6-digit code from your authenticator app." (no request sent); 422 `code_incorrect` "That code didn't work. Check the code and try again."; 409 `challenge_expired` and `challenge_consumed` "This code request is no longer valid." with the button "Get a new code request" (focus moves to it after the announcement); 404 on a challenge is handled the same way; 409 `no_verified_factor` switches to `no-factor`; 409 `mfa_factor_limit` "You have reached the limit of 10 authenticators. Remove one first." with a link to the list; 409 `factor_name_taken` as a field error on the name; 409 `enrollment_expired` and `factor_not_pending` "Setup expired. Start again." with the Start again button; 409 `VERSION_MISMATCH` and `factor_state_conflict` open `<SyncConflict>` and refetch AUTH-API-16; 403 `account_not_eligible` `<CapabilityGate>` disabled with reason; 403 CSRF or origin "Your session changed. Reload to continue." with a Reload button; 429 lockout with countdown from `Retry-After` and the submit button disabled with a visible reason; 502/503/504 "Verification is temporarily unavailable." with request ID and a Retry button that creates a new challenge or enrollment (never a resend of the same code). Lost access: a link "Lost your authenticator? Recover your account" goes to the sign-in page recovery entry (AUTH-API-02 `intent: "recovery"`), not to any bypass.
- **Responsive contract**: mobile: one column, QR above the key and field, full-width field and 44 px buttons, action bar clear of the virtual keyboard; tablet: QR and key side by side when the container permits; desktop: two columns with the QR left and the steps right, list as a compact semantic table. No horizontal page scroll at 320 CSS px.

### `PartyIdentityAliasesWorkbench` (bounded React island)

**BE owner**: `01b-party-identity-aliases.md`

```ts
interface PartyIdentityAliasesWorkbenchProps {
  contractFields: PartyIdentityAliasesWorkbenchContractFields;
  children?: never;
  variant: DomainVariant;
  initial: AsyncState<readonly PartyIdentityAliasesRecord[]>;
  actorId: string;
  actingPartyId: string;
  access: AccessVariant;
  query: Readonly<Record<string, string>>;
  selectedId: string | null;
  expectedVersion: string | null;
  onCanonicalRefetch: (reason: 'navigation' | 'realtime-hint' | 'mutation' | 'reconnect') => Promise<void>;
}

interface PartyIdentityAliasesRecord {
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

### `RelationshipsAuthorityGovernanceWorkbench` (bounded React island)

**BE owner**: `01c-relationships-authority-governance.md`

```ts
interface RelationshipsAuthorityGovernanceWorkbenchProps {
  contractFields: RelationshipsAuthorityGovernanceWorkbenchContractFields;
  children?: never;
  variant: DomainVariant;
  initial: AsyncState<readonly RelationshipsAuthorityGovernanceRecord[]>;
  actorId: string;
  actingPartyId: string;
  access: AccessVariant;
  query: Readonly<Record<string, string>>;
  selectedId: string | null;
  expectedVersion: string | null;
  onCanonicalRefetch: (reason: 'navigation' | 'realtime-hint' | 'mutation' | 'reconnect') => Promise<void>;
}

interface RelationshipsAuthorityGovernanceRecord {
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

### `IdentifiersLegacyWorkbench` (bounded React island)

**BE owner**: `01d-identifiers-legacy.md`

```ts
interface IdentifiersLegacyWorkbenchProps {
  contractFields: IdentifiersLegacyWorkbenchContractFields;
  children?: never;
  variant: DomainVariant;
  initial: AsyncState<readonly IdentifiersLegacyRecord[]>;
  actorId: string;
  actingPartyId: string;
  access: AccessVariant;
  query: Readonly<Record<string, string>>;
  selectedId: string | null;
  expectedVersion: string | null;
  onCanonicalRefetch: (reason: 'navigation' | 'realtime-hint' | 'mutation' | 'reconnect') => Promise<void>;
}

interface IdentifiersLegacyRecord {
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

### Global feedback and command components

| Component | Props contract | Interactive and accessibility contract |
|---|---|---|
| `<ActionBar>` | `{ primary, secondary, destructive, state, expectedVersion, operationId }` | Native buttons; stable pending label; named destructive consequence; focus returns to trigger; Enter submits only the owning form. |
| `<CapabilityGate>` | `{ variant, reasonCode, recoveryHref, disclosure }` | `not-rendered` emits no protected label; disabled has reason/recovery; a 401 `STEP_UP_REQUIRED` never renders a gate and instead navigates to `/step-up` (see Step-Up and TOTP Enrollment Components); server remains authoritative. |
| `<FilterBar>` | `{ schema, values, resultCount, resetHref }` | Persistent labels; URL commits on Apply; Escape clears only the open combobox; result count is politely announced. |
| `<DataTable>` | `{ columns, rows, sort, selection, density }` | Semantic table wide; priority list mobile; header buttons expose sort; stable keys; bulk actions name count/scope. |
| `<ConfirmationStep>` | `{ consequence, affectedScope, expectedVersion, stepUpState, idempotencyKey }` | Inline first; heading focus; Escape cancels before commit; duplicate activation returns same operation. |
| `<OfflineStatus>` / `<SyncConflict>` | `{ connectivity, intents, serverVersion, localVersion }` | Text plus icon; refused intents remain; conflict actions name outcomes; no automatic overwrite. |

## State Management

| State class | Source of truth | Entry trigger | Render and copy | Exit/persistence |
|---|---|---|---|---|
| idle | URL and server HTML | Route composed with no client work | No artificial busy state | User interaction or invalidation |
| loading | In-flight request descriptor | Navigation/refetch exceeds 250 ms | Skeleton for known layout; “Loading current records” inline | Success, typed error, or cancellation; safe prior content remains when allowed |
| error per class | BE00 `ApiError` | Parsed non-success | Validation inline; 401 `UNAUTHENTICATED` reauthenticate; 401 `STEP_UP_REQUIRED` step-up navigation; 403 capability; 404 disclosure-safe; 409 conflict; 429 countdown; 5xx degraded | Explicit recovery; valid input retained |
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
| `/app/identity-authority` | Astro SSR or cache-safe prerender by route registry | Public exposes public projection; protected verifies session/acting context; admin requires explicit capability and named step-up | Query, cursor, selected record, tab are URL state; invalid values normalize with `replaceState`; Back restores selection/scroll |
| `/app/identity-authority/:recordId` | Server-first detail with bounded islands | Concealed returns disclosure-safe 404; visible forbidden uses `<CapabilityGate>`; expired session preserves safe return target | Bookmark resolves current canonical version; stale/deleted target shows exact state and safe parent |
| `/step-up` | Astro SSR, `no-store`, never prerendered | Signed-in session required; missing/expired session 303 to `/auth/sign-in` with encoded `/step-up?returnTo=`; invalid `returnTo` falls back to `/app` | `returnTo` is URL state; the challenge and code are never in the URL; Back leaves without verifying |
| `/settings/security/mfa` | Astro SSR, `no-store`, never prerendered | Signed-in session required; additional-factor enrollment and verified-factor removal raise `STEP_UP_REQUIRED`, handled by navigation to `/step-up` | Optional `returnTo` is URL state; wizard step is island state; the secret is never in the URL or history |
| System/degraded boundary | Preserved shell when safe | Unsafe cached content removed for privacy, legal, takedown, or revoked authority | Retry repeats safe read; mutation status reconciles before retry |

## Interaction Specification

| Interaction | Trigger and focus | Preconditions | Success | Failure and recovery | Persistence |
|---|---|---|---|---|---|
| `IDA-01` Create person record | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `IDA-02` Add/remove role facet | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `IDA-03` Create/retire/transfer alias | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `IDA-04` Switch acting context | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `IDA-05` Disclose legal identity | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `IDA-06` Create organization | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `IDA-07` Add/remove organization type | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `IDA-08` Invite/assert/end membership | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `IDA-09` Create representation | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `IDA-10` Grant/revoke mandate | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `IDA-11` Propose governance terms | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `IDA-12` Record name ownership | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `IDA-13` Use treasury authority | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `IDA-14` Close/dissolve/re-form party | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `IDA-15` Record external identifier | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `IDA-16` Resolve identifier collision | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `IDA-17` Nominate legacy successor | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |
| `IDA-18` Report death/memorialise | Native link/button/form; focus stays until navigation or named result heading | Server-derived actor/context/capability, valid Zod input, required ETag/idempotency | Render authoritative response/version/provenance/next action; announce status | Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry | URL for navigation/filter; scoped draft before commit; server after success |

### Step-up and TOTP interactions

Interactions are keyed by BE operation, not by new IA flow IDs.

| Interaction | Trigger and focus | Preconditions | Success | Failure and recovery | Persistence |
|---|---|---|---|---|---|
| Step-up verify (AUTH-API-20, AUTH-API-21) | Redirect from a 401 `STEP_UP_REQUIRED`; focus the `h1`, then the code field once the challenge exists | Signed-in session, at least one `verified` factor, safe `returnTo` | `StepUpResult` parsed; polite "Verified. Returning to your page."; full navigation to `returnTo` | Error copy and routing in the component section; the code is never resent; a new challenge replaces a failed one | `returnTo` only (server-validated); no code, challenge id, or token stored client-side |
| Enroll TOTP (AUTH-API-17, AUTH-API-18) | "Set up an authenticator" button; focus the name field, then the code field after the QR appears | Signed-in session; step-up fresh when a verified factor already exists, otherwise a primary sign-in within the last 600 seconds; fewer than 10 factors; current `expectedVersion` | `MfaFactorsResource` replaces the list; "Authenticator added"; `freshUntil` shown | 401 `STEP_UP_REQUIRED` navigates to `/step-up` and restores the name field on return; 401 `UNAUTHENTICATED` (first factor, stale primary sign-in) redirects to sign-in with `returnTo=/settings/security/mfa`; other errors as listed; lost secret means Start again | Secret in island memory only; list from the server after success |
| Remove TOTP (AUTH-API-19) | Row button "Remove <name>"; focus the confirmation heading, then back to the list heading on success | Own factor; step-up fresh when the factor is `verified`; reason chosen; current `expectedVersion`; per-instance `Idempotency-Key` | List replaced from the response; "Authenticator removed" | 401 `STEP_UP_REQUIRED` navigates to `/step-up` and restores the confirmation unsent; 409 `last_factor_required` shows the add-another-authenticator status and action; other 409 opens `<SyncConflict>` | Confirmation state is island-local; reason and key discarded on cancel |
| Review factors (AUTH-API-16) | Route load and refetch after step-up, enrollment, removal, or a multi-tab signal | Signed-in session | Table, `stepUp` status, and `ETag` in `expectedVersion` | 401 sign-in redirect; 429 countdown; 5xx degraded with last-verified time | Server state keyed by the operation ID |
| Return from step-up (protected form) | Navigation back to the stored relative path; focus the confirm control | Draft present for that path and operation | Draft restored, version refetched, nothing auto-submitted | Draft missing: form opens clean with the status "Verification complete."; version changed: `<SyncConflict>` | Tab-scoped draft cleared on commit or explicit discard |

### Network and retry contract

- Read over 250 ms exposes loading; protected commands use the BE deadline and never show false success.
- 429 waits for `Retry-After`, announces remaining wait, and preserves input.
- 502/503/504 retry at most twice after 250 ms and 750 ms only when BE declares safe. Mutations reuse idempotency and reconcile status first. AUTH-API-17, -18, -20, and -21 are never retried automatically: a one-time secret or single-use code is never replayed, and a manual Retry creates a new enrollment or challenge.
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
| Two-step verification (enroll, step-up, remove) | full for the signed-in human's own factor | full for own factor | full for own factor | full for own factor; a guardian mandate never verifies for the subject | full for own factor; minor accounts remain deferred | full for own factor; organization mandate never verifies for the human | full for own factor; named-capability commands raise `STEP_UP_REQUIRED` | full for own factor; named-capability commands raise `STEP_UP_REQUIRED` |

Named variants: `publicRead`, `entitledRead`, `ownerFull`, `guardianMandate`, `juniorRestricted`, `businessMandate`, `staffCaseScoped`, `adminStepUp`, `forbiddenHidden`, and `disabledPrerequisite`. Role labels never grant authority client-side.

## Responsive Behavior

| Breakpoint | Grid/navigation | Workbench/detail | Forms/actions | Tables/media |
|---|---|---|---|---|
| Mobile ≤768 px | 4 columns, 16 px gutter/margins; compact tabs and stack; acting context before writes | List then detail; Back first; inspector inline; no horizontal page scroll at 320 CSS px | One column; labels above; action bar avoids keyboard; 44 by 44 px targets | Priority list preserves every field in expandable facts; media controls wrap logically |
| Tablet 769–1024 px | 8 columns, 20 px gutter, 24 px margins; collapsible sidebar | List plus inspector when container permits, else stack; URL selection | Two-column only for independent fields; action bar cannot cover errors | Lower-priority columns move to row details, never disappear |
| Desktop ≥1025 px | 12 columns, 24 px gutter, max 1440 px; sidebar/top bar | Stable list/detail split; detail owns heading/action rail | Grouped form/review summary; action rail cites context/version | Compact semantic table, virtualize >100 rows, stable IDs, functional media only |

- Container queries may switch composition but cannot change semantics, authorization, or consequences.
- 200% zoom and text-spacing overrides retain content/action order. Hover-only disclosure and pointer-only reordering are prohibited.

## Accessibility Inventory

| Component/interaction | WCAG requirement | Keyboard/focus | Screen reader/semantics | IA source |
|---|---|---|---|---|
| Route shell/navigation | 1.3.1, 2.4.1–2.4.3, 2.4.7/2.4.11 | Skip link; logical DOM; route focuses `h1` | Named landmarks, one main, `aria-current=page`, unique title | `01-identity-authority.md` Accessibility/User Flows |
| Workbench selection | 1.3.1, 2.1.1, 2.4.3, 4.1.2 | Native controls; Enter opens; Escape closes bounded inspector; focus returns | Named list/detail; selected state; state/provenance text | `01-identity-authority.md` Interactions/Access Control |
| Forms/validation | 1.3.1, 3.3.1–3.3.4, 4.1.3 | Persistent labels; linked summary focuses first invalid field; no trap | `aria-invalid`, `aria-describedby`, error links, polite status | `01-identity-authority.md` Acceptance Criteria/Edge Cases |
| Async/refetch/conflict | 2.2.1, 2.4.3, 4.1.3 | Refresh never steals focus; Retry native; conflict begins at heading | Polite atomic update; stale/pending/failed text; request ID | `01-identity-authority.md` Interactions/BE failures |
| Tables/filters | 1.3.1, 1.4.10, 2.1.1, 2.5.8 | Header buttons; Apply/Reset; 24 CSS px minimum, 44 preferred | Caption, headers, sort, count, active-filter summary | `01-identity-authority.md` User Flows/responsive |
| High-risk confirmation | 2.1.2, 2.4.3, 3.3.4, 4.1.2 | Inline first; dialog heading focus, Tab containment, Escape before commit, return focus | Consequence, scope, version, context, step-up, irreversible effect | `01-identity-authority.md` Access Control/Edge Cases |
| One-time code field | 1.3.5, 3.3.1, 3.3.2, 3.3.8, 4.1.3 | Persistent label; paste and autofill allowed; Enter submits only this form; focus stays in the field on error | `autocomplete="one-time-code"`, numeric input mode, `aria-invalid`, linked help and `role="alert"` error | `01-identity-authority.md` Accessibility (step-up restores prior context) |
| QR enrollment | 1.1.1, 1.3.1, 2.1.1 | Manual key and Copy key reachable in DOM order before the code field | Named `role="img"` QR with the manual key as its text alternative; copy result announced politely | `01-identity-authority.md` Accessibility |
| Lockout and expiry | 2.2.1, 3.3.4, 4.1.3 | Submit disabled with a visible reason; no focus theft at unlock | Coarse polite announcements; expiry announced once; no ticking timer | `01-identity-authority.md` Accessibility |
| Motion/media | 1.2.x where applicable, 2.2.2, 2.3.3 | Media keyboard controls; pause/stop; no essential timed gesture | Captions/transcript/metadata; reduced motion; waveform never sole content | `01-identity-authority.md` Accessibility |

The inventory exceeds the thin-coverage threshold and is woven into component contracts. WCAG 2.2 AA is the release floor, exceeding the requested 2.1 AA gate.

## FE Rubric Closure

This section makes every FE-rubric checkpoint explicit. It narrows implementation choices without changing any upstream product, permission, security, or data contract.

### Complete component contracts

Every local component interface above includes `children?: never` and a `DomainVariant`. “Never” is deliberate because Astro slots and canonical global components own composition; these route/workbench boundaries do not accept arbitrary children.

| Component | Props interface | Children | Named variants | BE/IA source |
|---|---|---|---|---|
| `IdentityAuthorityRoute` | `IdentityAuthorityRouteProps` | `never` | `publicPage`, `appPage`, `adminPage`, `authPage`, `degradedPage` | `01-identity-authority.md` user flows/accessibility; design-system page archetypes |
| `AuthAccountLinkingWorkbench` | `AuthAccountLinkingWorkbenchProps` | `never` | `publicRead`, `entitledRead`, `ownerFull`, `guardianMandate`, `juniorRestricted`, `businessMandate`, `staffCaseScoped`, `adminStepUp`, `forbiddenHidden`, `disabledPrerequisite` | `01a-auth-account-linking.md` request/response fields; `01-identity-authority.md` interactions/access rules |
| `StepUpRoute` / `StepUpChallengeForm` | `StepUpRouteProps` / `StepUpChallengeFormProps` | `never` | `authPage` | `01a-auth-account-linking.md` AUTH-API-16, -20, -21; BE00 STEP_UP_REQUIRED routing |
| `MfaEnrollmentWizard` / `MfaFactorList` / `OneTimeCodeField` | `MfaEnrollmentWizardProps` / `OneTimeCodeFieldProps` | `never` | `authPage` | `01a-auth-account-linking.md` AUTH-API-16 through AUTH-API-19 |
| `PartyIdentityAliasesWorkbench` | `PartyIdentityAliasesWorkbenchProps` | `never` | `publicRead`, `entitledRead`, `ownerFull`, `guardianMandate`, `juniorRestricted`, `businessMandate`, `staffCaseScoped`, `adminStepUp`, `forbiddenHidden`, `disabledPrerequisite` | `01b-party-identity-aliases.md` request/response fields; `01-identity-authority.md` interactions/access rules |
| `RelationshipsAuthorityGovernanceWorkbench` | `RelationshipsAuthorityGovernanceWorkbenchProps` | `never` | `publicRead`, `entitledRead`, `ownerFull`, `guardianMandate`, `juniorRestricted`, `businessMandate`, `staffCaseScoped`, `adminStepUp`, `forbiddenHidden`, `disabledPrerequisite` | `01c-relationships-authority-governance.md` request/response fields; `01-identity-authority.md` interactions/access rules |
| `IdentifiersLegacyWorkbench` | `IdentifiersLegacyWorkbenchProps` | `never` | `publicRead`, `entitledRead`, `ownerFull`, `guardianMandate`, `juniorRestricted`, `businessMandate`, `staffCaseScoped`, `adminStepUp`, `forbiddenHidden`, `disabledPrerequisite` | `01d-identifiers-legacy.md` request/response fields; `01-identity-authority.md` interactions/access rules |
| Global primitives consumed by this spec | Canonical interfaces from design-system Global Component Inventory; local wrappers forbidden | Canonical slot only where that interface declares it, otherwise `never` | `default`, `hover`, `focus`, `active`, `disabled`, `loading`, `error` plus semantic/access variants named above | `design-system.md` Global Component Inventory and State Language |

### IA flow to page/component ownership

| IA flow | Trigger/response owner | Source citation | Visual feedback and timing |
|---|---|---|---|
| `IDA-01` Create person record | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-01` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `IDA-02` Add/remove role facet | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-02` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `IDA-03` Create/retire/transfer alias | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-03` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `IDA-04` Switch acting context | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-04` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `IDA-05` Disclose legal identity | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-05` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `IDA-06` Create organization | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-06` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `IDA-07` Add/remove organization type | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-07` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `IDA-08` Invite/assert/end membership | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-08` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `IDA-09` Create representation | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-09` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `IDA-10` Grant/revoke mandate | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-10` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `IDA-11` Propose governance terms | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-11` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `IDA-12` Record name ownership | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-12` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `IDA-13` Use treasury authority | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-13` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `IDA-14` Close/dissolve/re-form party | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-14` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `IDA-15` Record external identifier | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-15` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `IDA-16` Resolve identifier collision | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-16` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `IDA-17` Nominate legacy successor | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-17` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |
| `IDA-18` Report death/memorialise | `IdentityAuthorityRoute` orchestrates; `AuthAccountLinkingWorkbench`, `PartyIdentityAliasesWorkbench`, `RelationshipsAuthorityGovernanceWorkbench`, `IdentifiersLegacyWorkbench` renders the relevant BE response and command state | `01-identity-authority.md` Interactions row `IDA-18` | Pressed/pending state in the same animation frame; inline progress after 250 ms; result or typed error text plus polite announcement within 100 ms of parsed response; 150–220 ms visual transition |

Every IA interaction row is represented above. No flow is inferred from a heading or omitted because it shares an endpoint.

### Server, URL, and client state query registry

| BE operation/query | Server-state key | URL state | Island-local state | All async render states |
|---|---|---|---|---|
| `AUTH-API-07` from `01a-auth-account-linking.md` | `['AUTH-API-07', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `AUTH-API-01` from `01a-auth-account-linking.md` | `['AUTH-API-01', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `AUTH-API-02` from `01a-auth-account-linking.md` | `['AUTH-API-02', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `AUTH-API-03` from `01a-auth-account-linking.md` | `['AUTH-API-03', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `AUTH-API-04` from `01a-auth-account-linking.md` | `['AUTH-API-04', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `AUTH-API-05` from `01a-auth-account-linking.md` | `['AUTH-API-05', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `AUTH-API-06` from `01a-auth-account-linking.md` | `['AUTH-API-06', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `AUTH-API-08` from `01a-auth-account-linking.md` | `['AUTH-API-08', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `AUTH-API-09` from `01a-auth-account-linking.md` | `['AUTH-API-09', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `AUTH-API-10` from `01a-auth-account-linking.md` | `['AUTH-API-10', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `AUTH-API-11` from `01a-auth-account-linking.md` | `['AUTH-API-11', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `AUTH-API-12` from `01a-auth-account-linking.md` | `['AUTH-API-12', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `AUTH-API-13` from `01a-auth-account-linking.md` | `['AUTH-API-13', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `AUTH-API-14` from `01a-auth-account-linking.md` | `['AUTH-API-14', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `AUTH-API-15` from `01a-auth-account-linking.md` | `['AUTH-API-15', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `AUTH-API-16` from `01a-auth-account-linking.md` | `['AUTH-API-16', actorId, normalizedPath]`; response parsed by its named Zod schema; versioned by ETag | `returnTo` only | Draft name or code, pending operation ID, focus, and (AUTH-API-17 only) the in-memory secret; nothing else | idle, loading after 250 ms, typed error per class, empty, success, disabled, degraded |
| `AUTH-API-17` from `01a-auth-account-linking.md` | `['AUTH-API-17', actorId, normalizedPath]`; response parsed by its named Zod schema; never cached as server state (one-time or single-use result) | `returnTo` only | Draft name or code, pending operation ID, focus, and (AUTH-API-17 only) the in-memory secret; nothing else | idle, loading after 250 ms, typed error per class, empty, success, disabled, degraded |
| `AUTH-API-18` from `01a-auth-account-linking.md` | `['AUTH-API-18', actorId, normalizedPath]`; response parsed by its named Zod schema; result replaces the `AUTH-API-16` key | `returnTo` only | Draft name or code, pending operation ID, focus, and (AUTH-API-17 only) the in-memory secret; nothing else | idle, loading after 250 ms, typed error per class, empty, success, disabled, degraded |
| `AUTH-API-19` from `01a-auth-account-linking.md` | `['AUTH-API-19', actorId, normalizedPath]`; response parsed by its named Zod schema; result replaces the `AUTH-API-16` key | none | Draft name or code, pending operation ID, focus, and (AUTH-API-17 only) the in-memory secret; nothing else | idle, loading after 250 ms, typed error per class, empty, success, disabled, degraded |
| `AUTH-API-20` from `01a-auth-account-linking.md` | `['AUTH-API-20', actorId, normalizedPath]`; response parsed by its named Zod schema; never cached as server state (one-time or single-use result) | `returnTo` only (server-validated) | Draft name or code, pending operation ID, focus, and (AUTH-API-17 only) the in-memory secret; nothing else | idle, loading after 250 ms, typed error per class, empty, success, disabled, degraded |
| `AUTH-API-21` from `01a-auth-account-linking.md` | `['AUTH-API-21', actorId, normalizedPath]`; response parsed by its named Zod schema; result replaces the `AUTH-API-16` key | `returnTo` only (server-validated) | Draft name or code, pending operation ID, focus, and (AUTH-API-17 only) the in-memory secret; nothing else | idle, loading after 250 ms, typed error per class, empty, success, disabled, degraded |
| `IDL-API-01` from `01d-identifiers-legacy.md` | `['IDL-API-01', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `IDL-API-05` from `01d-identifiers-legacy.md` | `['IDL-API-05', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `IDL-API-06` from `01d-identifiers-legacy.md` | `['IDL-API-06', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `IDL-API-15` from `01d-identifiers-legacy.md` | `['IDL-API-15', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `IDL-API-02` from `01d-identifiers-legacy.md` | `['IDL-API-02', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `IDL-API-03` from `01d-identifiers-legacy.md` | `['IDL-API-03', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `IDL-API-04` from `01d-identifiers-legacy.md` | `['IDL-API-04', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `IDL-API-07` from `01d-identifiers-legacy.md` | `['IDL-API-07', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `IDL-API-08` from `01d-identifiers-legacy.md` | `['IDL-API-08', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `IDL-API-09` from `01d-identifiers-legacy.md` | `['IDL-API-09', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `IDL-API-10` from `01d-identifiers-legacy.md` | `['IDL-API-10', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `IDL-API-11` from `01d-identifiers-legacy.md` | `['IDL-API-11', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `IDL-API-12` from `01d-identifiers-legacy.md` | `['IDL-API-12', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `IDL-API-13` from `01d-identifiers-legacy.md` | `['IDL-API-13', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |
| `IDL-API-14` from `01d-identifiers-legacy.md` | `['IDL-API-14', actingPartyId, normalizedPath, normalizedQuery]`; response parsed by its named Zod schema and versioned by ETag | `q`, `sort`, `filter`, `cursor`, `selected`, and `tab` when the operation uses them; absent keys are explicit defaults | Draft fields, disclosure state, focus, pending operation ID, and reversible optimistic overlay only | idle, loading after 250 ms, typed error per class, empty, success, optimistic pending, optimistic rollback, disabled, degraded |

No global client store is authorized. A new cross-island state need requires architecture review; until then URL/server state or a colocated island state owns it.

### Route registry with guards and metadata

| URL pattern | Auth guard and failure redirect | Page component | Meta title | Meta description |
|---|---|---|---|---|
| `/app/identity-authority` | Server validates Supabase token, expiry, acting context, and route capability. Missing/expired token redirects 303 to `/auth/sign-in?returnTo=%2Fapp%2Fidentity-authority` after allowlist normalization. Valid but concealed target returns 404; visible forbidden target renders `CapabilityGate`. | `IdentityAuthorityRoute` variant `appPage` | `Identity authority and party governance | WeJammin` | `Work with identity authority and party governance using current authority, record state, and provenance.` |
| `/app/identity-authority/:recordId` | Same token/expiry/context check; malformed ID returns 400, concealed/unreadable returns 404, expired session uses the same safe sign-in redirect. | `IdentityAuthorityRoute` with the matching workbench detail variant | `Record | Identity authority and party governance | WeJammin` | `Review the current record, provenance, history, and permitted actions.` |
| `/step-up` | Server validates the session; missing/expired redirects 303 to `/auth/sign-in?returnTo=` with the encoded `/step-up?returnTo=…` after allowlist normalization; `returnTo` that is not a relative first-party allowlisted path, points at `/step-up` or `/auth/`, or exceeds 512 characters falls back to `/app`. No capability beyond the session. | `StepUpRoute` variant `authPage` | `Verify it's you \| WeJammin` | `Confirm a one-time code to continue with a protected action.` |
| `/settings/security/mfa` | Server validates the session; missing/expired redirects 303 to `/auth/sign-in?returnTo=%2Fsettings%2Fsecurity%2Fmfa`; optional `returnTo` normalized as above. | `MfaEnrollmentWizard` variant `authPage` | `Two-step verification \| WeJammin` | `Add or remove an authenticator app and review your verification status.` |
| Public projection when a BE route declares one | No session accepted as authority; public projection only. Unsafe or non-public record returns disclosure-safe 404, never app-shell redirect. | `IdentityAuthorityRoute` variant `publicPage` | `Identity authority and party governance | WeJammin` | `View the public, provenance-labelled record.` |
| System/degraded boundary | Preserves verified shell only; Retry stays on canonical URL; unsafe cached data is removed. | `IdentityAuthorityRoute` variant `degradedPage` | `Service status | WeJammin` | `Review affected scope, last verified time, request ID, and recovery action.` |

### Per-component responsive contract

| Component | Mobile ≤768 px | Tablet 769–1024 px | Desktop ≥1025 px |
|---|---|---|---|
| `IdentityAuthorityRoute` | Four-column shell, 16 px gutter/margins, compact tabs, stack navigation, Back before detail, no horizontal page scroll at 320 CSS px | Eight-column shell, 20 px gutter, 24 px margins, collapsible sidebar, list/inspector when container permits | Twelve-column shell, 24 px gutter, max 1440 px, persistent sidebar/top bar, stable route heading/action region |
| `AuthAccountLinkingWorkbench` | List then detail stack; priority facts remain; action bar avoids virtual keyboard; controls at least 44 by 44 px | List plus inline inspector or stack by container; two-column fields only when independent; lower-priority columns move into row details | List/detail workbench; compact semantic table; virtualize over 100 rows; detail/action rail shows acting context and version |
| `StepUpChallengeForm` / `MfaEnrollmentWizard` | One column; full-width code field and 44 by 44 px buttons; QR above manual key; factor list as priority list; action bar clear of the virtual keyboard | QR and key side by side when the container permits; list as semantic table | Two columns (QR left, steps right); compact semantic table; same semantics and authorization |
| `PartyIdentityAliasesWorkbench` | List then detail stack; priority facts remain; action bar avoids virtual keyboard; controls at least 44 by 44 px | List plus inline inspector or stack by container; two-column fields only when independent; lower-priority columns move into row details | List/detail workbench; compact semantic table; virtualize over 100 rows; detail/action rail shows acting context and version |
| `RelationshipsAuthorityGovernanceWorkbench` | List then detail stack; priority facts remain; action bar avoids virtual keyboard; controls at least 44 by 44 px | List plus inline inspector or stack by container; two-column fields only when independent; lower-priority columns move into row details | List/detail workbench; compact semantic table; virtualize over 100 rows; detail/action rail shows acting context and version |
| `IdentifiersLegacyWorkbench` | List then detail stack; priority facts remain; action bar avoids virtual keyboard; controls at least 44 by 44 px | List plus inline inspector or stack by container; two-column fields only when independent; lower-priority columns move into row details | List/detail workbench; compact semantic table; virtualize over 100 rows; detail/action rail shows acting context and version |
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
| One-time code field | Native `input` with persistent `label`, help and error IDs; `autocomplete="one-time-code"`, numeric input mode | Tab, Enter submits the owning form only; focus stays on error; paste allowed | Inline `role="alert"` error within 100 ms of the response; value cleared and re-selected on `code_incorrect` |
| QR code and Copy key | Inline SVG `role="img"` named "QR code for adding WeJammin to an authenticator app"; Copy key is a native `button` | Tab to key then Copy; Enter or Space activates | Polite "Key copied"; manual key remains selectable text |

- **Image alt policy**: informative images use concise purpose-specific alt; functional images use the action name; decorative images use empty `alt=""` and no redundant ARIA; complex charts/artwork use short alt plus adjacent long description/data table; user/CMS images require governed alt before publication; avatars use the visible person/organization name only when the image adds identity.
- **Output semantics**: every icon is decorative or named, every status combines text/icon/structure, and every dynamic result uses the least interruptive correct live region. WCAG 2.2 AA is mandatory.

### Performance budgets and loading strategy

| Page/component | JavaScript budget (gzip) | Lazy loading | Image/media policy | Runtime targets |
|---|---:|---|---|---|
| `IdentityAuthorityRoute` public variant | ≤45 KB initial route JS; zero hydration when static | Hydrate only a visible interaction with `client:visible`; no global router | Astro image pipeline emits width/height, AVIF/WebP plus fallback, responsive `srcset`/`sizes`; below-fold images lazy; hero/record identity eager only when LCP | LCP <2.5 s, INP <200 ms, CLS <0.1 at p75 |
| `IdentityAuthorityRoute` app/admin variant | ≤90 KB initial route JS including shared shell | Each workbench island ≤35 KB initial; editor/media/chart modules split to ≤80 KB lazy chunk and load on explicit entry/visibility; independent fetches parallel | Same optimized image contract; audio/video metadata preload only until explicit play; waveform data lazy and functional | LCP <2.5 s, INP <200 ms, CLS <0.1; interaction feedback same frame |
| `AuthAccountLinkingWorkbench` | ≤35 KB hydrated entry | Detail/editor/media/export modules dynamic-import on selection; list over 100 virtualizes; no barrel import | Preserve intrinsic dimensions; thumbnails use bounded variants; originals never download for list rows | Long task off main thread or chunked; no task >50 ms during input |
| `StepUpChallengeForm` / `MfaEnrollmentWizard` | ≤35 KB hydrated entry each; route JS within the ≤90 KB app budget | The QR renderer loads dynamically only when the Scan step opens and stays within the ≤80 KB lazy chunk; no barrel import | No images; QR is inline SVG | No task >50 ms during input; challenge creation starts at hydration, not render |
| `PartyIdentityAliasesWorkbench` | ≤35 KB hydrated entry | Detail/editor/media/export modules dynamic-import on selection; list over 100 virtualizes; no barrel import | Preserve intrinsic dimensions; thumbnails use bounded variants; originals never download for list rows | Long task off main thread or chunked; no task >50 ms during input |
| `RelationshipsAuthorityGovernanceWorkbench` | ≤35 KB hydrated entry | Detail/editor/media/export modules dynamic-import on selection; list over 100 virtualizes; no barrel import | Preserve intrinsic dimensions; thumbnails use bounded variants; originals never download for list rows | Long task off main thread or chunked; no task >50 ms during input |
| `IdentifiersLegacyWorkbench` | ≤35 KB hydrated entry | Detail/editor/media/export modules dynamic-import on selection; list over 100 virtualizes; no barrel import | Preserve intrinsic dimensions; thumbnails use bounded variants; originals never download for list rows | Long task off main thread or chunked; no task >50 ms during input |

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
| Step-up return | The server validates `returnTo` once (relative first-party rule, 1–512 characters, not `/step-up` or `/auth/`, code-owned allowlist, `/app` fallback) and passes it to the island as a prop; the client never re-reads or rewrites it, and navigates with `window.location.assign` so rotated cookies apply. |
| Provider tokens | The browser never receives, stores, or sends a Supabase access token, refresh token, factor id, challenge id, or `amr`; it sees only first-party JSON and `HttpOnly` cookies. |
| Enrollment secret | `otpauthUri` and `manualEntryKey` stay in island memory, are never placed in URL, storage, props, logs, analytics, or error payloads, and are cleared on success, supersession, `pagehide`, and unmount. |
| CSRF after rotation | A successful AUTH-API-18 or AUTH-API-21 changes the session-bound CSRF token; the client reads the new value from the cookie before the next mutation and never reuses the old one. |
| Caching | `/step-up` and `/settings/security/mfa` are `no-store`; AUTH-API-16 through AUTH-API-21 responses are `no-store`. |

### Form-by-source completeness

| BE source | Fields/validation | Error display | Submission and success | Security |
|---|---|---|---|---|
| `01a-auth-account-linking.md` | Exact named Zod request schema: type, optionality, default, min/max/enum/format, cross-field rule; safe local checks on blur and full authoritative check on submit | Linked summary plus exact field errors; preserve all valid and server-accepted input; no raw upstream copy | One idempotent commit with expected version; stable pending label; parsed authoritative response replaces draft; result heading receives focus | CSRF/origin rule by credential mode, unknown-key rejection, allowlist sanitization, framework output encoding, secret/PII redaction |
| `01b-party-identity-aliases.md` | Exact named Zod request schema: type, optionality, default, min/max/enum/format, cross-field rule; safe local checks on blur and full authoritative check on submit | Linked summary plus exact field errors; preserve all valid and server-accepted input; no raw upstream copy | One idempotent commit with expected version; stable pending label; parsed authoritative response replaces draft; result heading receives focus | CSRF/origin rule by credential mode, unknown-key rejection, allowlist sanitization, framework output encoding, secret/PII redaction |
| `01c-relationships-authority-governance.md` | Exact named Zod request schema: type, optionality, default, min/max/enum/format, cross-field rule; safe local checks on blur and full authoritative check on submit | Linked summary plus exact field errors; preserve all valid and server-accepted input; no raw upstream copy | One idempotent commit with expected version; stable pending label; parsed authoritative response replaces draft; result heading receives focus | CSRF/origin rule by credential mode, unknown-key rejection, allowlist sanitization, framework output encoding, secret/PII redaction |
| `01d-identifiers-legacy.md` | Exact named Zod request schema: type, optionality, default, min/max/enum/format, cross-field rule; safe local checks on blur and full authoritative check on submit | Linked summary plus exact field errors; preserve all valid and server-accepted input; no raw upstream copy | One idempotent commit with expected version; stable pending label; parsed authoritative response replaces draft; result heading receives focus | CSRF/origin rule by credential mode, unknown-key rejection, allowlist sanitization, framework output encoding, secret/PII redaction |

## Data Mapping

Every BE operation and parsed response field is owned below. Components consume generated Zod-inferred types; no hand-written partial DTO may silently omit a field. A field is displayed, drives explicit state/control, or is non-rendered for a named security reason.

| BE source | Operation | Method/path | Success to component | Error mapping |
|---|---|---|---|---|
| `01a-auth-account-linking.md` | `AUTH-API-01` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `AuthAccountLinkingWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01a-auth-account-linking.md` | `AUTH-API-02` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `AuthAccountLinkingWorkbench`; update only after validation | `DEPENDENCY_UNAVAILABLE` to inline, capability, conflict, rate-wait, or degraded state |
| `01a-auth-account-linking.md` | `AUTH-API-03` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `AuthAccountLinkingWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01a-auth-account-linking.md` | `AUTH-API-04` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `AuthAccountLinkingWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01a-auth-account-linking.md` | `AUTH-API-05` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `AuthAccountLinkingWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01a-auth-account-linking.md` | `AUTH-API-06` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `AuthAccountLinkingWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01a-auth-account-linking.md` | `AUTH-API-07` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `AuthAccountLinkingWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01a-auth-account-linking.md` | `AUTH-API-08` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `AuthAccountLinkingWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01a-auth-account-linking.md` | `AUTH-API-09` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `AuthAccountLinkingWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01a-auth-account-linking.md` | `AUTH-API-10` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `AuthAccountLinkingWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01a-auth-account-linking.md` | `AUTH-API-11` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `AuthAccountLinkingWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01a-auth-account-linking.md` | `AUTH-API-12` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `AuthAccountLinkingWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01a-auth-account-linking.md` | `AUTH-API-13` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `AuthAccountLinkingWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01a-auth-account-linking.md` | `AUTH-API-14` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `AuthAccountLinkingWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01a-auth-account-linking.md` | `AUTH-API-15` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `AuthAccountLinkingWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01a-auth-account-linking.md` | `AUTH-API-16` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `MfaEnrollmentWizard`/`MfaFactorList`; update only after validation | BE00 typed envelope: 401 `STEP_UP_REQUIRED` to step-up navigation, 409 reasons to the component error copy, 422 to field errors, 429 to lockout countdown, 502/503/504 to degraded |
| `01a-auth-account-linking.md` | `AUTH-API-17` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `MfaEnrollmentWizard`; update only after validation | BE00 typed envelope: 401 `STEP_UP_REQUIRED` to step-up navigation, 409 reasons to the component error copy, 422 to field errors, 429 to lockout countdown, 502/503/504 to degraded |
| `01a-auth-account-linking.md` | `AUTH-API-18` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `MfaEnrollmentWizard`; update only after validation | BE00 typed envelope: 401 `STEP_UP_REQUIRED` to step-up navigation, 409 reasons to the component error copy, 422 to field errors, 429 to lockout countdown, 502/503/504 to degraded |
| `01a-auth-account-linking.md` | `AUTH-API-19` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `MfaEnrollmentWizard`/`MfaFactorList`; update only after validation | BE00 typed envelope: 401 `STEP_UP_REQUIRED` to step-up navigation, 409 reasons to the component error copy, 422 to field errors, 429 to lockout countdown, 502/503/504 to degraded |
| `01a-auth-account-linking.md` | `AUTH-API-20` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `StepUpChallengeForm`; update only after validation | BE00 typed envelope: 401 `STEP_UP_REQUIRED` to step-up navigation, 409 reasons to the component error copy, 422 to field errors, 429 to lockout countdown, 502/503/504 to degraded |
| `01a-auth-account-linking.md` | `AUTH-API-21` | `REGISTERED See 01a-auth-account-linking.md route registry` | `2xx` parsed into `StepUpChallengeForm`; update only after validation | BE00 typed envelope: 401 `STEP_UP_REQUIRED` to step-up navigation, 409 reasons to the component error copy, 422 to field errors, 429 to lockout countdown, 502/503/504 to degraded |
| `01b-party-identity-aliases.md` | `AUTH-API-07` | `REGISTERED See 01b-party-identity-aliases.md route registry` | `2xx` parsed into `PartyIdentityAliasesWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01c-relationships-authority-governance.md` | `01C-RELATIONSHIPS-AUTHORITY-GOVERNANCE-REGISTRY` | `REGISTERED See route registry` | `2xx` parsed into `RelationshipsAuthorityGovernanceWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01d-identifiers-legacy.md` | `IDL-API-01` | `REGISTERED See 01d-identifiers-legacy.md route registry` | `2xx` parsed into `IdentifiersLegacyWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01d-identifiers-legacy.md` | `IDL-API-06` | `REGISTERED See 01d-identifiers-legacy.md route registry` | `2xx` parsed into `IdentifiersLegacyWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01d-identifiers-legacy.md` | `IDL-API-02` | `REGISTERED See 01d-identifiers-legacy.md route registry` | `2xx` parsed into `IdentifiersLegacyWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01d-identifiers-legacy.md` | `IDL-API-03` | `REGISTERED See 01d-identifiers-legacy.md route registry` | `2xx` parsed into `IdentifiersLegacyWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01d-identifiers-legacy.md` | `IDL-API-04` | `REGISTERED See 01d-identifiers-legacy.md route registry` | `2xx` parsed into `IdentifiersLegacyWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01d-identifiers-legacy.md` | `IDL-API-05` | `REGISTERED See 01d-identifiers-legacy.md route registry` | `2xx` parsed into `IdentifiersLegacyWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01d-identifiers-legacy.md` | `IDL-API-07` | `REGISTERED See 01d-identifiers-legacy.md route registry` | `2xx` parsed into `IdentifiersLegacyWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01d-identifiers-legacy.md` | `IDL-API-08` | `REGISTERED See 01d-identifiers-legacy.md route registry` | `2xx` parsed into `IdentifiersLegacyWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01d-identifiers-legacy.md` | `IDL-API-09` | `REGISTERED See 01d-identifiers-legacy.md route registry` | `2xx` parsed into `IdentifiersLegacyWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01d-identifiers-legacy.md` | `IDL-API-10` | `REGISTERED See 01d-identifiers-legacy.md route registry` | `2xx` parsed into `IdentifiersLegacyWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01d-identifiers-legacy.md` | `IDL-API-11` | `REGISTERED See 01d-identifiers-legacy.md route registry` | `2xx` parsed into `IdentifiersLegacyWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01d-identifiers-legacy.md` | `IDL-API-12` | `REGISTERED See 01d-identifiers-legacy.md route registry` | `2xx` parsed into `IdentifiersLegacyWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01d-identifiers-legacy.md` | `IDL-API-13` | `REGISTERED See 01d-identifiers-legacy.md route registry` | `2xx` parsed into `IdentifiersLegacyWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01d-identifiers-legacy.md` | `IDL-API-14` | `REGISTERED See 01d-identifiers-legacy.md route registry` | `2xx` parsed into `IdentifiersLegacyWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |
| `01d-identifiers-legacy.md` | `IDL-API-15` | `REGISTERED See 01d-identifiers-legacy.md route registry` | `2xx` parsed into `IdentifiersLegacyWorkbench`; update only after validation | BE00 typed envelope to inline, capability, conflict, rate-wait, or degraded state |

### Response field ownership

| BE source | Contract schemas | Parsed field set | UI ownership |
|---|---|---|---|
| `01a-auth-account-linking.md` | Named source schemas | `PersonParty`, `RequestContext`, `AuditEvent`, `OutboxEvent`, `JobStatus`, `google`, `apple`, `facebook`, `soundcloud`, `session_id`, `traceparent`, `email`, `tiktok`, `bandlab`, `ETag`, `EmailStartRequest`, `OAuthStartRequest`, `PersonBootstrapResource`, `LogoutRequest`, `current`, `all`, `LinkIntentRequest`, `UnlinkRequest`, `MergeCreateRequest`, `MergeProofRequest`, `MergeConfirmRequest`, `Location`, `email_invalid`, `intent`, `sign_in`, `recovery`, `intent_invalid`, `returnTo`, `return_target_invalid`, `provider`, `provider_not_available`, `link`, `prove_merge`, `mergeId`, `merge_id_invalid`, `state`, `SessionResource`, `authUserId`, `account_not_eligible`, `account_binding_conflict`, `scope_invalid`, `id`, `removable`, `intentId`, `reconciling`, `identityId`, `final_login_method`, `awaiting_duplicate_proof`, `analyzing`, `same_account`, `login_identity_conflict`, `manual_review`, `JsonValue`, `FieldViolation`, `scope`, `provider_already_linked`, `reason`, `reason_invalid`, `conflictPlanVersion`, `version_invalid`, `merge_plan_stale`, `acknowledgements`, `acknowledgement_unknown`, `merge_conflicts_unresolved`, `not_survivor`, `support_bypass_denied`, `merge_already_active`, `merge_state_conflict`, `idempotency_mismatch`, `identity`, `anon`, `search_path`, `issued_at`, `last_seen_at`, `return_path`, `MfaFactorsResource`, `TotpEnrollmentStart`, `StepUpChallenge`, `StepUpResult`, `factors`, `allowedMethods`, `stepUp`, `fresh`, `freshUntil`, `friendlyName`, `pendingExpiresAt`, `otpauthUri`, `manualEntryKey`, `challengeId`, `factorId`, `stepUpAt`, `verifiedAt`, `lastUsedAt` | `AuthAccountLinkingWorkbench`: identity/version/state in `<RecordHeader>`; provenance in `<ProvenanceFact>`; command/status in `<ActionBar>`/`<StateLabel>`; remaining authorized facts in detail rows; security-only fields never serialize. MFA fields are owned by `MfaEnrollmentWizard`/`MfaFactorList` (`factors`, `allowedMethods`, `stepUp`, `friendlyName`, `state`, `verifiedAt`, `lastUsedAt`, `pendingExpiresAt`) and `StepUpChallengeForm` (`challengeId`, `factorId`, `friendlyName`, `expiresAt`, `stepUpAt`, `freshUntil`); `otpauthUri` and `manualEntryKey` render once and are never retained |
| `01b-party-identity-aliases.md` | Named source schemas | `requestId`, `authSubjectRef`, `contractVersion`, `idempotencyKey`, `expectedPersonVersion`, `humanId`, `personId`, `personVersion`, `resolutionState`, `authoritySnapshotVersion`, `requestedPartyId`, `relationshipId`, `sourceVersion`, `purposeCode`, `candidatePartyId`, `contextState`, `relationshipVersion`, `capabilityClasses`, `expiresAt`, `protectedRefIds`, `audiencePartyId`, `legalRecordVersion`, `referenceReceiptIds`, `readinessState`, `effectiveUntil`, `retentionClass`, `transactionId`, `subjectPersonId`, `recipientPartyId`, `requestedFieldCodes`, `eligibilityState`, `audienceState`, `minimumFieldCodes`, `policyVersion`, `eventId`, `eventType`, `aggregateId`, `aggregateVersion`, `correlationId`, `accepted`, `deliveryAttemptId`, `inboxState` | `PartyIdentityAliasesWorkbench`: identity/version/state in `<RecordHeader>`; provenance in `<ProvenanceFact>`; command/status in `<ActionBar>`/`<StateLabel>`; remaining authorized facts in detail rows; security-only fields never serialize |
| `01c-relationships-authority-governance.md` | Named source schemas | `startsOn`, `Resource`, `actorHumanId`, `actingPartyId`, `targetOrganizationId`, `capabilityCode`, `purposeCode`, `sourceVersion`, `requestId`, `decision`, `organizationVersion`, `relationshipVersion`, `mandateVersion`, `scope`, `expiresAt`, `organizationId`, `normalizedInputHash`, `registryVersion`, `detectorVersion`, `reviewState`, `matchReferenceHashes`, `completedAt`, `eventId`, `eventType`, `aggregateId`, `aggregateVersion`, `correlationId`, `accepted`, `inboxState`, `projectionVersion` | `RelationshipsAuthorityGovernanceWorkbench`: identity/version/state in `<RecordHeader>`; provenance in `<ProvenanceFact>`; command/status in `<ActionBar>`/`<StateLabel>`; remaining authorized facts in detail rows; security-only fields never serialize |
| `01d-identifiers-legacy.md` | Named source schemas | `identifier_collision`, `estate_representation`, `RepresentationEdge`, `delayed`, `requestId`, `claimId`, `claimVersion`, `namespace`, `normalizedValueHash`, `capacityCode`, `attemptId`, `expectedVersion`, `evidenceRefIds`, `verificationState`, `registryReferenceHash`, `observedAt`, `providerAttemptState`, `sourceVersion`, `verifying`, `purposeCode`, `subjectPartyId`, `claimOrCaseId`, `expectedDigest`, `readinessState`, `receiptIds`, `digest`, `retentionClass`, `legalHoldState`, `representationId`, `representationVersion`, `sourceCaseId`, `scopeHash`, `expectedAuthorityVersion`, `decision`, `relationshipId`, `relationshipVersion`, `authorityState`, `effectiveAt`, `revokedAt`, `personId`, `caseId`, `lifecycleVersion`, `eventId`, `eventType`, `accepted`, `deliveryAttemptId`, `inboxState` | `IdentifiersLegacyWorkbench`: identity/version/state in `<RecordHeader>`; provenance in `<ProvenanceFact>`; command/status in `<ActionBar>`/`<StateLabel>`; remaining authorized facts in detail rows; security-only fields never serialize |

### Exhaustive BE field and error ownership

The unions below are generated from every contract identifier in each complete BE source, not a representative sample. Request-only identifiers remain because their owning form consumes them; response identifiers remain because the workbench renders them or uses them for explicit state/control. Generated Zod types remain normative if this conservative union includes a non-field identifier.

```ts
type AuthAccountLinkingContractField =
  | 'ApiError'
  | 'AuditEvent'
  | 'ETag'
  | 'EmailStartRequest'
  | 'FieldViolation'
  | 'JobStatus'
  | 'JsonValue'
  | 'LinkIntentRequest'
  | 'Location'
  | 'LogoutRequest'
  | 'MergeConfirmRequest'
  | 'MergeCreateRequest'
  | 'MergeProofRequest'
  | 'MfaFactorRemoveRequest'
  | 'MfaFactorVerifyRequest'
  | 'MfaFactorsResource'
  | 'OAuthStartRequest'
  | 'OutboxEvent'
  | 'PersonBootstrapResource'
  | 'PersonParty'
  | 'PlatformEvent'
  | 'ProviderOperation'
  | 'RequestContext'
  | 'SessionResource'
  | 'StepUpChallenge'
  | 'StepUpChallengeRequest'
  | 'StepUpResult'
  | 'StepUpVerifyRequest'
  | 'TotpEnrollmentStart'
  | 'TotpEnrollmentStartRequest'
  | 'UnlinkRequest'
  | 'acceptedAt'
  | 'account_binding_conflict'
  | 'account_not_eligible'
  | 'acknowledgement_unknown'
  | 'acknowledgements'
  | 'aggregateVersion'
  | 'all'
  | 'allowedMethods'
  | 'analyzing'
  | 'anon'
  | 'apple'
  | 'authUserId'
  | 'auth_user_bindings'
  | 'awaiting_confirmation'
  | 'awaiting_duplicate_proof'
  | 'bandlab'
  | 'challengeId'
  | 'challenge_consumed'
  | 'challenge_expired'
  | 'claimed'
  | 'code'
  | 'code_incorrect'
  | 'code_invalid'
  | 'conflictPlanVersion'
  | 'current'
  | 'deliveryAttemptId'
  | 'deliveryState'
  | 'domain'
  | 'email'
  | 'email_invalid'
  | 'enroll_factor'
  | 'enrollment_expired'
  | 'erasure_processing'
  | 'eventType'
  | 'expiresAt'
  | 'facebook'
  | 'factorId'
  | 'factor_compromise'
  | 'factor_id_invalid'
  | 'factor_id_required'
  | 'factor_name_taken'
  | 'factor_not_pending'
  | 'factor_not_verified'
  | 'factor_state_conflict'
  | 'factors'
  | 'final_login_method'
  | 'fresh'
  | 'freshUntil'
  | 'friendlyName'
  | 'friendly_name_invalid'
  | 'google'
  | 'idempotency_mismatch'
  | 'identity'
  | 'identityId'
  | 'intent'
  | 'intentId'
  | 'intent_invalid'
  | 'issued_at'
  | 'jobs'
  | 'lastUsedAt'
  | 'last_seen_at'
  | 'link'
  | 'login_identity_conflict'
  | 'manualEntryKey'
  | 'manual_review'
  | 'memorialised'
  | 'mergeId'
  | 'merge_already_active'
  | 'merge_conflicts_unresolved'
  | 'merge_id_invalid'
  | 'merge_plan_stale'
  | 'merge_state_conflict'
  | 'method'
  | 'method_not_available'
  | 'mfa_factor_limit'
  | 'new_challenge'
  | 'no_verified_factor'
  | 'normalizedIdentity'
  | 'normalizedVersion'
  | 'not_survivor'
  | 'notificationId'
  | 'operationId'
  | 'otpauthUri'
  | 'outbox_events'
  | 'pending'
  | 'pendingExpiresAt'
  | 'personId'
  | 'pkceVerifier'
  | 'prove_merge'
  | 'provider'
  | 'providerCodeHash'
  | 'providerIdentityRef'
  | 'providerIdentityState'
  | 'providerOperationId'
  | 'providerReference'
  | 'providerSubject'
  | 'provider_already_linked'
  | 'provider_not_available'
  | 'provider_operations'
  | 'reason'
  | 'reason_invalid'
  | 'recipientClass'
  | 'reconciling'
  | 'recovery'
  | 'redirectUri'
  | 'removable'
  | 'responseClass'
  | 'returnTo'
  | 'return_path'
  | 'return_target_invalid'
  | 'revokedAt'
  | 'safeTemplateCode'
  | 'same_account'
  | 'scope'
  | 'scope_invalid'
  | 'search_path'
  | 'sessionId'
  | 'sessionReceipt'
  | 'sessionState'
  | 'session_id'
  | 'sign_in'
  | 'soundcloud'
  | 'state'
  | 'stateId'
  | 'stepUp'
  | 'stepUpAt'
  | 'support_bypass_denied'
  | 'suspended'
  | 'tiktok'
  | 'totp'
  | 'traceparent'
  | 'user_request'
  | 'verified'
  | 'verifiedAt'
  | 'version'
  | 'version_invalid';
interface AuthAccountLinkingWorkbenchContractFields {
  source: '01a-auth-account-linking.md';
  fields: Readonly<Record<AuthAccountLinkingContractField, unknown>>;
}
```

```ts
type PartyIdentityAliasesContractField =
  | 'ApiError'
  | 'accepted'
  | 'aggregateId'
  | 'aggregateVersion'
  | 'audiencePartyId'
  | 'audienceState'
  | 'authSubjectRef'
  | 'authoritySnapshotVersion'
  | 'candidatePartyId'
  | 'capabilityClasses'
  | 'contextState'
  | 'contractVersion'
  | 'correlationId'
  | 'deliveryAttemptId'
  | 'effectiveUntil'
  | 'eligibilityState'
  | 'eventId'
  | 'eventType'
  | 'expectedPersonVersion'
  | 'expiresAt'
  | 'humanId'
  | 'idempotencyKey'
  | 'inboxState'
  | 'legalRecordVersion'
  | 'minimumFieldCodes'
  | 'personId'
  | 'personVersion'
  | 'policyVersion'
  | 'protectedRefIds'
  | 'purposeCode'
  | 'readinessState'
  | 'recipientPartyId'
  | 'referenceReceiptIds'
  | 'relationshipId'
  | 'relationshipVersion'
  | 'requestedFieldCodes'
  | 'requestedPartyId'
  | 'resolutionState'
  | 'retentionClass'
  | 'sourceVersion'
  | 'subjectPersonId'
  | 'transactionId';
interface PartyIdentityAliasesWorkbenchContractFields {
  source: '01b-party-identity-aliases.md';
  fields: Readonly<Record<PartyIdentityAliasesContractField, unknown>>;
}
```

```ts
type RelationshipsAuthorityGovernanceContractField =
  | 'Resource'
  | 'accepted'
  | 'actingPartyId'
  | 'actorHumanId'
  | 'aggregateId'
  | 'aggregateVersion'
  | 'capabilityCode'
  | 'completedAt'
  | 'correlationId'
  | 'decision'
  | 'detectorVersion'
  | 'eventId'
  | 'eventType'
  | 'expiresAt'
  | 'inboxState'
  | 'mandateVersion'
  | 'matchReferenceHashes'
  | 'normalizedInputHash'
  | 'organizationId'
  | 'organizationVersion'
  | 'projectionVersion'
  | 'purposeCode'
  | 'registryVersion'
  | 'relationshipVersion'
  | 'reviewState'
  | 'scope'
  | 'sourceVersion'
  | 'startsOn'
  | 'targetOrganizationId';
interface RelationshipsAuthorityGovernanceWorkbenchContractFields {
  source: '01c-relationships-authority-governance.md';
  fields: Readonly<Record<RelationshipsAuthorityGovernanceContractField, unknown>>;
}
```

```ts
type IdentifiersLegacyContractField =
  | 'RepresentationEdge'
  | 'accepted'
  | 'attemptId'
  | 'authorityState'
  | 'capacityCode'
  | 'caseId'
  | 'claimId'
  | 'claimOrCaseId'
  | 'claimVersion'
  | 'decision'
  | 'delayed'
  | 'deliveryAttemptId'
  | 'digest'
  | 'effectiveAt'
  | 'estate_representation'
  | 'eventId'
  | 'eventType'
  | 'evidenceRefIds'
  | 'expectedAuthorityVersion'
  | 'expectedDigest'
  | 'expectedVersion'
  | 'identifier_collision'
  | 'inboxState'
  | 'legalHoldState'
  | 'lifecycleVersion'
  | 'namespace'
  | 'normalizedValueHash'
  | 'observedAt'
  | 'personId'
  | 'providerAttemptState'
  | 'purposeCode'
  | 'readinessState'
  | 'receiptIds'
  | 'registryReferenceHash'
  | 'relationshipId'
  | 'relationshipVersion'
  | 'representationId'
  | 'representationVersion'
  | 'retentionClass'
  | 'revokedAt'
  | 'scopeHash'
  | 'sourceCaseId'
  | 'sourceVersion'
  | 'subjectPartyId'
  | 'verificationState'
  | 'verifying';
interface IdentifiersLegacyWorkbenchContractFields {
  source: '01d-identifiers-legacy.md';
  fields: Readonly<Record<IdentifiersLegacyContractField, unknown>>;
}
```

| BE source | Owning component/prop | Every discovered application error code | UI state owner |
|---|---|---|---|
| `01a-auth-account-linking.md` | `AuthAccountLinkingWorkbenchContractFields.fields` and `AuthAccountLinkingWorkbenchProps.contractFields` | `AUTH_CALLBACK_INVALID`, `CONFLICT`, `DEPENDENCY_UNAVAILABLE`, `FORBIDDEN`, `IDEMPOTENCY_MISMATCH`, `INVALID_REQUEST`, `INVALID_TRANSITION`, `NOT_FOUND`, `RATE_LIMITED`, `STEP_UP_REQUIRED`, `UNAUTHENTICATED`, `VALIDATION_FAILED`, `VERSION_MISMATCH` | validation/input → linked summary; auth/permission → auth, step-up navigation (`STEP_UP_REQUIRED`), or capability gate; not-found → disclosure-safe route/row; conflict/stale/mismatch/duplicate → sync conflict; rate → retry wait; dependency/timeout/unavailable → degraded; blocked/failed/cancelled/revoked → exact terminal state and legitimate recovery |
| `01b-party-identity-aliases.md` | `PartyIdentityAliasesWorkbenchContractFields.fields` and `PartyIdentityAliasesWorkbenchProps.contractFields` | `ALIAS_NOT_FOUND`, `CONFLICT`, `CONTEXT_NOT_FOUND`, `CONTEXT_RECONFIRM_REQUIRED`, `CONTEXT_REVOKED`, `DEPENDENCY_UNAVAILABLE`, `DISCLOSURE_NOT_FOUND`, `EFFECTIVE_PERIOD_CONFLICT`, `FACET_NOT_FOUND`, `FORBIDDEN`, `HANDLE_INVALID`, `IDEMPOTENCY_MISMATCH`, `IF_MATCH_REQUIRED`, `INVALID_REQUEST`, `LEGAL_IDENTITY_NOT_FOUND`, `LEGAL_REF_INVALID`, `NOT_FOUND`, `PERSON_NOT_FOUND`, `RATE_LIMITED`, `STEP_UP_REQUIRED`, `TRANSFER_EXPIRED`, `TRANSFER_NOT_FOUND`, `UNAUTHENTICATED`, `VERSION_MISMATCH` | validation/input → linked summary; auth/permission → auth or capability gate; not-found → disclosure-safe route/row; conflict/stale/mismatch/duplicate → sync conflict; rate → retry wait; dependency/timeout/unavailable → degraded; blocked/failed/cancelled/revoked → exact terminal state and legitimate recovery |
| `01c-relationships-authority-governance.md` | `RelationshipsAuthorityGovernanceWorkbenchContractFields.fields` and `RelationshipsAuthorityGovernanceWorkbenchProps.contractFields` | `AUTHORITY_STALE`, `CEILING_INVALID`, `COMMUNICATION_INVALID`, `CONFLICT`, `CURRENCY_REQUIRED`, `DATE_INVALID`, `DEPENDENCY_UNAVAILABLE`, `DISPOSITION_INVALID`, `DISPOSITION_REQUIRED`, `EVIDENCE_REFERENCE_INVALID`, `FORBIDDEN`, `GOVERNANCE_CONFIRMATION_REQUIRED`, `GOVERNANCE_CONFIRMATION_STALE`, `GOVERNANCE_MEMBER_SET_STALE`, `HASH_INVALID`, `IDEMPOTENCY_MISMATCH`, `INVALID_REQUEST`, `MANDATE_STATE_INVALID`, `MEMBERSHIP_STATE_INVALID`, `MEMBERSHIP_VERSION_CONFLICT`, `NAME_OWNERS_INVALID`, `NAME_STATEMENT_INVALID`, `NOT_FOUND`, `OBLIGATION_DISPOSITION_REQUIRED`, `ORGANIZATION_DISSOLUTION_VOTE_REQUIRED`, `ORGANIZATION_MODE_REQUIRED`, `ORGANIZATION_VERSION_CONFLICT`, `PERIOD_INVALID`, `RATE_LIMITED`, `REPRESENTATION_CONFIRMATION_REQUIRED`, `REPRESENTATION_CURRENCY_REQUIRED`, `REPRESENTATION_SCOPE_INVALID`, `REPRESENTATION_STATE_INVALID`, `REPRESENTATION_TERM_INVALID`, `RETROACTIVE_END_CONFIRMATION_REQUIRED`, `SCOPE_INVALID`, `SUCCESSOR_LINEAGE_REQUIRED`, `TERMS_ACCEPTANCE_REQUIRED`, `TERMS_HASH_MISMATCH`, `TERM_INVALID`, `TERRITORY_INVALID`, `TREASURY_AMOUNT_INVALID`, `TREASURY_CURRENCY_MISMATCH`, `TREASURY_MANDATE_REQUIRED`, `TREASURY_RESOURCE_UNAVAILABLE`, `UNAUTHENTICATED`, `VALIDATION_FAILED`, `VERSION_MISMATCH` | validation/input → linked summary; auth/permission → auth or capability gate; not-found → disclosure-safe route/row; conflict/stale/mismatch/duplicate → sync conflict; rate → retry wait; dependency/timeout/unavailable → degraded; blocked/failed/cancelled/revoked → exact terminal state and legitimate recovery |
| `01d-identifiers-legacy.md` | `IdentifiersLegacyWorkbenchContractFields.fields` and `IdentifiersLegacyWorkbenchProps.contractFields` | `CONFLICT`, `DEPENDENCY_UNAVAILABLE`, `FORBIDDEN`, `IDEMPOTENCY_MISMATCH`, `INVALID_REQUEST`, `NOT_FOUND`, `RATE_LIMITED`, `STEP_UP_REQUIRED`, `UNAUTHENTICATED`, `VALIDATION_FAILED`, `VERSION_MISMATCH` | validation/input → linked summary; auth/permission → auth or capability gate; not-found → disclosure-safe route/row; conflict/stale/mismatch/duplicate → sync conflict; rate → retry wait; dependency/timeout/unavailable → degraded; blocked/failed/cancelled/revoked → exact terminal state and legitimate recovery |

No discovered field or error code is allowed to fall through to generic rendering. An unrecognized schema discriminant or code is a contract mismatch: isolate in `ErrorBoundary`, show request ID and Retry/Status, and report scrubbed telemetry.

### Error class ownership

| Class | Required UI | Retry | Focus/announcement |
|---|---|---|---|
| 400 `INVALID_REQUEST` / 422 `VALIDATION_FAILED` | Summary plus field/row errors; preserve valid input | Correction only | Focus linked summary then field; concise alert |
| 401 `UNAUTHENTICATED` | Reauthentication with safe return; protected data removed | After session recovery | Focus auth heading; announce expiry |
| 401 `STEP_UP_REQUIRED` | Persist the scoped draft, then navigate to `/step-up?returnTo=<current relative path>`; no gate, no data loss | After step-up the form restores and the human re-confirms | Focus the confirm control on return; announce "Verification complete. Review and confirm to continue." |
| 403 `FORBIDDEN` | `<CapabilityGate>` with reason/recovery; no broadened disclosure | After capability refetch | Focus gate; no protected names |
| 404 | Disclosure-safe not-found; distinguish deleted only when authorized | Navigation | Focus route heading |
| 409 conflict/idempotency/state | `<SyncConflict>` with server/current version and preserved draft | Reconcile first | Focus conflict; announce no overwrite |
| 429 `RATE_LIMITED` | Inline countdown from `Retry-After`; input kept | At server time only | Polite coarse updates |
| 502/503/504 | Scoped degraded or full System / Degraded by honest renderability | Safe BE attempts only; mutation status first | Request ID/Retry; no raw provider detail |

## Navigation, Degradation, and Concurrency

- **Back/deep link/bookmark**: URL owns query, selection, cursor, and tab. Deep link refetches current authority/version, never serialized client authority.
- **Multi-tab**: version mismatch opens `<SyncConflict>`; another tab only invalidates. No last-write-wins UI claim.
- **Unsaved changes**: scoped draft survives recoverable auth and same-record navigation, but never enters logs, analytics, URL, or Realtime.
- **Authorization change**: revoke protected props/cache, cancel pending presentation, and refetch. Stale UI never authorizes.
- **Realtime reorder/duplication**: hints coalesce; canonical refetch is authoritative; focus/selection/draft remain if allowed.
- **Unknown mutation outcome**: render pending/manual review from operation status. Never show success or blindly resend.
- **Step-up interruption**: a 401 `STEP_UP_REQUIRED` leaves no committed state, so the form keeps its tab-scoped draft and the interrupted command is never replayed automatically; after `/step-up` the human re-confirms. A `reconciling` MFA factor renders "Checking status" and refetches AUTH-API-16 rather than showing success or failure.
- **Telemetry**: operation, route template, request ID, status, duration, and scrubbed IDs/hashes only. No bodies, evidence, secrets, contact data, or media URLs.

## Testing Obligations

| Level | Required assertions |
|---|---|
| Vitest unit/component | Exhaustive `AsyncState` and access variants; exact error copy/action; blur/submit timing; optimistic confirm/rollback; focus return; reduced motion; no unauthorized props |
| Vitest integration | Zod schemas accept BE fixtures/reject invalid variants; every operation maps fields/errors; ETag/idempotency/rate headers drive UI; Realtime only invalidates |
| Playwright E2E | Critical IA flows by role; keyboard; landmarks/names/live regions; three breakpoints; 200% zoom; offline/reconnect; stale multi-tab; auth expiry; 429/outage; protected command to `/step-up` to enrolled-factor verification to restored draft; first-factor enrollment; removal with and without step-up; lockout countdown; expired challenge recovery; unsafe `returnTo` fallback to `/app` |
| Accessibility | one-time code field autofill, paste with spaces, error announcement without focus loss, QR text alternative, lockout announcements; axe zero serious/critical; contrast/non-color cues; VoiceOver/NVDA smoke; target size; focus; no trap; captions/transcripts where media exists |
| Performance | Server-first HTML; bounded islands; no hydration waterfall; stable skeleton; LCP <2.5 s, CLS <0.1; virtualize >100; route JS budget verified in phase plan |

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
| 2026-10-02 | DEC-111: added the protected `/step-up` page and `/settings/security/mfa` TOTP enrollment page (components, props, phases, safe `returnTo`, one-time-code semantics, secret handling, error matrix, lockout, responsive, a11y), step-up consumption by protected forms, AUTH-API-16..21 mappings, and corrected 401 `STEP_UP_REQUIRED` handling | `/propagate-decision` | Component Inventory, Routes, Interactions, Matrix, Accessibility, FE Rubric Closure, Data Mapping, Error Class Ownership, Testing |
| 2026-10-02 | DEC-111 follow-ups: first-factor enrollment 401 `UNAUTHENTICATED` redirects to sign-in with `returnTo=/settings/security/mfa` (stale primary sign-in); 409 `last_factor_required` copy and action for removing the last verified authenticator; recovery note names the administrator factor reset | `/write-fe-spec` | Step-Up and TOTP Enrollment Components, Interaction Specification, Error handling |

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
- [[specs/ia/01-identity-authority|Shard 01 — Identity authority and party governance]]

### References
- [[specs/ia/01-identity-authority|Shard 01 — Identity authority and party governance]]
