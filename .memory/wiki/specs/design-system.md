# Design System

> **Confirmed Design Direction**: Product-first restrained utility under **The Working Record**
> **Date**: 2026-08-02
> **Status**: Locked

## Navigation Paradigm

**Adaptive sidebar + topnav with compact bottom-tab + stack navigation.**

Authenticated desktop/tablet routes use a collapsible sidebar for product areas and a compact top bar for global search, acting context, create, notifications, help, and account controls. Public profiles, articles, policy, and discovery routes use a minimal top navigation and contextual links rather than exposing the professional application shell. Admin uses its own capability-gated sidebar and trust plane while preserving the same visual system.

At compact widths, four context-relevant primary destinations occupy a bottom bar and navigation within each destination follows a stack. A fifth **More** destination opens the complete governed menu tree; it is not a dumping ground for unauthorized routes. The current acting context remains visible before every protected write. Named CMS menu locations may configure eligible labels/order/visibility, but authorization, required recovery routes, and protected workflow entry points are code-owned.

**Rationale**: 25 domains and deep admin workflows need persistent orientation on wide screens, while PWA users need thumb-reachable access on phones. One fixed five-tab taxonomy cannot represent the platform; route-family shells and governed menu locations preserve clarity without hiding scope.

## Layout Grid

| Breakpoint          | Columns | Gutter | Max Width                   |
| ------------------- | ------- | ------ | --------------------------- |
| Mobile (≤768px)     | 4       | 16px   | 100% with 16px page margins |
| Tablet (769–1024px) | 8       | 20px   | 100% with 24px page margins |
| Desktop (≥1025px)   | 12      | 24px   | 1440px application shell    |

**Grid type**: Hybrid. CSS Grid owns page shells, workbenches, comparisons, timelines, and aligned record regions. Flexbox owns one-dimensional controls, toolbars, navigation rows, and inline metadata. Public reading content is capped at 65–75ch and public editorial composition usually caps at 1200px even inside the wider shell.

**Rationale**: Dense catalog, admin, schedule, and project views need a stable 12-column work surface; public profiles and content need readable measure. Components respond to available container width rather than duplicating route-specific breakpoint logic.

## Page Archetypes

### Public Record

**Layout zones**: minimal navigation | identity header | now | record | detail | contextual actions

The profile/EPK archetype preserves Header → Now → Record → Detail. Every material fact carries its own provenance treatment. Templates may fill permitted slots but cannot reorder the spine or reserved trust regions.

### Work Queue / Overview

**Layout zones**: application shell | scope/status bar | prioritized queue | supporting summaries | task actions

The landing view answers “what needs attention?” rather than presenting vanity metrics. Summaries link to the records and freshness evidence that produced them.

### List → Detail Workbench

**Layout zones**: application shell | query/filter bar | selectable list/table | detail inspector | action bar

Used for projects, credits, services, listings, people, media, admin records, and search-heavy operations. Compact split view becomes list then detail stack on narrow screens.

### Record Detail / Activity

**Layout zones**: application shell | record header | state/provenance summary | primary facts | timeline/audit | contextual actions

Used when one canonical record, its state machine, history, permissions, and allowed commands are the task.

### Guided Form / Transaction

**Layout zones**: application shell | purpose/progress | grouped fields | review summary | persistent action bar

Used for claims, split capture, contracts, checkout, publication, and other consequential multi-step work. Progress names completed decisions, not arbitrary percentages.

### Collaboration / Review Room

**Layout zones**: project context | media/work canvas | timeline/comments | participants/authority | approval/action rail

Used for file review, session capture, approvals, annotations, and bounded realtime status. Media and comments never displace authoritative version/state indicators.

### CMS Editor / Preview

**Layout zones**: admin shell | content outline | typed editor canvas | validation/inspector | version/preview/publish rail

Draft, review, preview, scheduling, publication, compare, restore, and convergence state remain visible. Preview is authenticated and cannot be mistaken for live output.

### Admin Operations

**Layout zones**: admin shell | task inbox/query | operations table | evidence/detail | capability-gated actions

Designed for search, bulk work, audit, moderation, diagnostics, migrations, and recovery. Destructive or sensitive actions show acting context, consequence, step-up state, and immutable audit outcome.

### Settings / Registry

**Layout zones**: admin or application shell | registry navigation | definition/effective value | scope/inheritance | version/approval actions

Used for typed settings, feature flags, schemas, taxonomies, menus, integrations, and policy configuration. Effective value, source scope, owner, and rollback target are always inspectable.

### Content / Discovery

**Layout zones**: minimal navigation | title/context | content/results | filters or table of contents | related actions

Used for articles, help, policies, discovery, catalogs, and fan-facing content. Reading measure is protected; filter/result density increases only when the user begins an explicit browse task.

### Auth / Claim / Recovery

**Layout zones**: focused identity context | primary task | provider choices or proof | recovery/help | legal notice

Provider linking is additive and never visually implies a new account when an existing canonical user is detected. Account merge, claim, and recovery risks are stated before commitment.

### System / Degraded

**Layout zones**: preserved shell when safe | exact state | affected scope | last-known-good context | recovery/status action

Used for 404, offline, dependency outage, blocked publication, and service degradation. Security, privacy, legal, and takedown state may remove unsafe content even when last-known-good delivery would otherwise remain.

## Global Component Inventory

- `<PublicNav>` — minimal public navigation resolved from a named governed menu location.
- `<AppSidebar>` — collapsible authenticated product-area navigation with current route and unread/task state.
- `<AdminSidebar>` — separate capability-gated admin navigation; never inferred from a consumer role.
- `<CompactTabBar>` — four context-relevant mobile destinations plus governed More entry.
- `<TopBar>` — global search, acting context, create, notifications, help, and account actions.
- `<Breadcrumbs>` — canonical route ancestry, CMS-governed only where route policy allows.
- `<ActingContextSwitcher>` — current party plus eligible alias/org/mandate contexts with authority summary.
- `<PageShell>` — public, app, or admin shell boundary with skip links and responsive regions.
- `<Workbench>` — list/detail responsive composition with selection and URL-addressable state.
- `<ActionBar>` — stable primary/secondary/destructive actions with pending/conflict handling.
- `<Button>` / `<IconButton>` / `<TextLink>` — accessible action primitives with explicit hierarchy.
- `<Field>` / `<Select>` / `<Checkbox>` / `<RadioGroup>` / `<TextArea>` — persistent-label form primitives.
- `<DateTimeField>` / `<MoneyField>` / `<DurationField>` — locale-aware typed inputs with canonical serialization.
- `<Combobox>` / `<TokenField>` — controlled-vocabulary entry with preserved unmapped values where contracts allow.
- `<FileUpload>` — authorized resumable upload with quarantine, validation, rights, progress, retry, and cancellation state.
- `<DataTable>` — sortable/filterable/selectable table with keyboard operation, responsive priority, and bulk-action contracts.
- `<FilterBar>` / `<SavedViewMenu>` — typed query controls whose active state is shareable and resettable.
- `<Pagination>` — opaque-cursor navigation with result/freshness context.
- `<RecordHeader>` — identity, canonical state, owner, version, and allowed-action summary.
- `<ProvenanceFact>` — value, source, evidence rung, timestamp, visibility, and allowed action per material fact.
- `<StateLabel>` — text/icon/semantic treatment for pending, blocked, stale, degraded, failed, disputed, and other states.
- `<Timeline>` — immutable or versioned chronological events with actor, causation, and correlation context.
- `<AuditLink>` — authorized route from a mutation/result to its attributable history.
- `<VersionBadge>` / `<CompareView>` — current/candidate/superseded identity and structured diff.
- `<TaskInbox>` — prioritized actionable work with owner, severity, due state, and deep link.
- `<NotificationCenter>` — durable notification state; toasts are never the only record of important outcomes.
- `<InlineMessage>` / `<Banner>` / `<Toast>` — scoped feedback selected by persistence and actionability.
- `<ErrorBoundary>` — component isolation with correlation ID, preserved context, and recovery action.
- `<LoadingSkeleton>` / `<InlineProgress>` — layout-stable page loading and bounded operation progress.
- `<EmptyState>` — contextual explanation and truthful next action without completion scoring.
- `<Dialog>` / `<Drawer>` / `<Popover>` / `<Tooltip>` — overlays used only after inline/progressive alternatives are exhausted.
- `<ConfirmationStep>` — consequence, affected scope, expected version, step-up, and idempotent commit for high-risk commands.
- `<MediaPlayer>` / `<WaveformTimeline>` — functional audio review with keyboard, transcript/metadata, and version context; never decoration.
- `<BlockPicker>` / `<SlotCanvas>` / `<Inspector>` — approved CMS block composition and typed configuration.
- `<ValidationSummary>` — grouped accessibility/schema/policy blockers linked to exact fields/blocks.
- `<PreviewStatus>` / `<PublishPanel>` — draft/live distinction, candidate version, schedule, approval, and convergence state.
- `<CapabilityGate>` — unavailable/forbidden/step-up UI that never grants authority client-side.
- `<OfflineStatus>` / `<SyncConflict>` — local intent, pending sync, stale data, reconnect, and server-authoritative resolution.

## Motion Language

**Style**: Subtle, with responsive state feedback
**Default duration**: 150–220ms
**Default easing**: `cubic-bezier(0.16, 1, 0.3, 1)`
**Interaction transitions**: Opacity, color, border, and transform may confirm hover, focus, selection, expansion, and bounded layer entry. Navigation does not wait for choreography. Progress reflects real work; indeterminate motion stops when state becomes known. Width, height, padding, margin, bounce, and elastic animation are prohibited.
**Reduced-motion policy**: All spatial animations collapse to instant when `prefers-reduced-motion: reduce` is active; essential continuity may use opacity-only transitions no longer than 100ms.

**Rationale**: Users operate under time pressure and the p95 budget measures responsiveness, so motion confirms state without becoming a gate or hiding network work.

## Data Density Philosophy

**Default density**: Hybrid

**Rules**:

- Compact density applies to data tables, search results, task queues, timelines, schedules, inventory, admin operations, media libraries, audit, and registries. It uses the same minimum target/focus/accessibility contract as every other density.
- Standard density applies to record details, forms, transactions, collaboration rooms, settings detail, and CMS inspectors. Grouping and progressive disclosure reduce cognitive load without hiding required consequences.
- Spacious density applies to public profiles, articles, policy/help, auth/claim/recovery, and focused empty/degraded states. Reading measure remains 65–75ch.
- Density changes only at named archetype or container boundaries. Users never experience one component silently switching semantics because the viewport narrowed.
- User-selectable compactness may be added as a governed preference later, but cannot reduce target size, text legibility, or information required for authorization/provenance.

## Global State Design Language

### Loading States

- **Skeleton screens**: use for page/section layout only after the server knows the section exists. Never skeleton a section that may resolve to absence.
- **Spinner/shimmer**: use only for bounded inline operations with a stable label and no meaningful determinate progress. Never block the whole application for one component.
- **Progressive**: resolve identity/header and canonical state first, then independently load known lower sections. Preserve last-known-good content when policy allows and label it stale/degraded.

### Error States

- **Inline errors**: use for field, block, row, permission, version, and local operation failures. Preserve valid input and link summaries to exact failures.
- **Toast errors**: use only for non-blocking transient failures when the underlying screen remains accurate and a durable task/notification is unnecessary. Security, money, rights, publication, or data-loss errors are never toast-only.
- **Full-page errors**: use for route-level absence, offline startup without a safe shell, global authorization failure, or dependency failure that prevents any honest page state.
- **Error boundaries**: isolate component/section failures, preserve safe neighboring context, expose a correlation ID and retry/recovery path, and never render failure as absence.

### Empty States

**Illustration style**: Minimal and contextual. Text and the next truthful action come first; illustration is optional and never decorative filler.
**Copy tone**: Plainspoken, calm, accountable, and specific.
**CTA**: Every empty state includes one primary next action. When the user cannot directly create the missing evidence, the action routes to the legitimate prerequisite, such as inviting a collaborator, requesting a credit, changing filters, or learning how the record is populated; it never fabricates completion.

- New professional profiles explain that attested credits arrive from collaborators and never show a completion percentage.
- Empty filtered results distinguish “nothing matches these filters” from “no records exist” and provide clear reset/create actions.
- Empty task queues confirm there is no current required work and do not invent engagement.
- Permission-hidden data is not an empty state; it renders the disclosure-safe forbidden/limited state defined by policy.
- Offline, unavailable, failed, stale, blocked, disputed, and absent remain separate states with separate recovery language.
