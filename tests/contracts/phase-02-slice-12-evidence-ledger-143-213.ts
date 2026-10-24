import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 12 evidence ledger, criteria AC143-AC213. Aggregated by
// tests/contracts/phase-02-slice-12-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-12-evidence-guard.test.ts.
// Filled by evidence lane C (2026-10-12): citations name only tests whose assertions produce and check the
// condition of the clause; every uncited clause is named in `limitation`; unbuilt behaviour stays unverified.
export const S12_EVIDENCE_LEDGER_143_213: readonly EvidenceLedgerEntry[] = [
  {
    criterion: 'P2-S12-AC-143',
    text: "CMS-03C-19 claims only due `pending` or `failed_retryable` schedules and executes only a claimed schedule whose `lease_id` still matches (a stale lease is refused with no effect), re-reading the review (`approved` at the schedule's stored `expected_version`), the subject (`scheduled` with an equal hash), the policy basis, the dependencies and the canonical providers, and rechecking that the schedule creator's designer or curator grant is unrevoked and has not ended before the fire instant.",
    clauses: [
      {
        text: "CMS-03C-19 claims only due `pending` or `failed_retryable` schedules and executes only a claimed schedule whose `lease_id` still matches (a stale lease is refused with no effect), re-reading the review (`approved` at the schedule's stored `expected_version`), the subject (`scheduled` with an equal hash), the policy basis, the dependencies and the canonical providers, and rechecking that the schedule creator's designer or curator grant is unrevoked and has not ended before the fire instant.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: no CMS-03C-19 claim/execute RPC, governed activation schedule table, lease logic or Worker sweep exists, so there is no behavior to test yet.',
  },
  {
    criterion: 'P2-S12-AC-144',
    text: "CMS-03C-19 grants EXECUTE only to the registered Worker `scheduled` sweep principal (PUBLIC, anon, authenticated and every other role revoked), re-derives the schedule creator's designer or curator authority at the fire instant by checking revocation and a grant end before the fire instant only, never rechecking MFA (DEC-120), and carries only identifiers, versions and correlation data in claims.",
    clauses: [
      {
        text: "CMS-03C-19 grants EXECUTE only to the registered Worker `scheduled` sweep principal (PUBLIC, anon, authenticated and every other role revoked), re-derives the schedule creator's designer or curator authority at the fire instant by checking revocation and a grant end before the fire instant only, never rechecking MFA (DEC-120), and carries only identifiers, versions and correlation data in claims.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: the CMS-03C-19 RPCs, their EXECUTE grants and the registered scheduled-sweep principal do not exist yet.',
  },
  {
    criterion: 'P2-S12-AC-145',
    text: 'CMS-03C-19 mirrors CMS-03B-20: the Worker `scheduled` sweep runs every minute with batch 25, claims under `FOR UPDATE SKIP LOCKED` with a version CAS from `pending` or `failed_retryable` to `executing` and a five-minute `lease_id` and `lease_until`, and applies the retry ladder in which a `failed_retryable` outcome sets `attempt_count` + 1 and `next_attempt_at` to now + 15 s, 60 s and 300 s for the first, second and third failure and a fourth consecutive retryable failure blocks the schedule with `retries_exhausted`.',
    clauses: [
      {
        text: 'CMS-03C-19 mirrors CMS-03B-20: the Worker `scheduled` sweep runs every minute with batch 25, claims under `FOR UPDATE SKIP LOCKED` with a version CAS from `pending` or `failed_retryable` to `executing` and a five-minute `lease_id` and `lease_until`, and applies the retry ladder in which a `failed_retryable` outcome sets `attempt_count` + 1 and `next_attempt_at` to now + 15 s, 60 s and 300 s for the first, second and third failure and a fourth consecutive retryable failure blocks the schedule with `retries_exhausted`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: no governed-activation sweep (cron, batch 25, SKIP LOCKED claim, lease, retry ladder) exists to test.',
  },
  {
    criterion: 'P2-S12-AC-146',
    text: 'CMS-03C-19 returns an expired `executing` lease to `failed_retryable` with `attempt_count` + 1 before claiming, returns a repeated execution of a `completed` schedule as `already_completed` with no effect, blocks a terminal failure with the closed `reasonCode` (`approval_invalidated`, `dependency_changed`, `activation_authority_ended`, `canonical_source_unavailable`, `retries_exhausted`) making the subject `blocked` with the prior active version intact, cancels a schedule whose review is invalidated (`cancelled`, `approval_invalidated`) and returns the subject to `draft`, and runs a late schedule and records its `deviation_seconds`.',
    clauses: [
      {
        text: 'CMS-03C-19 returns an expired `executing` lease to `failed_retryable` with `attempt_count` + 1 before claiming, returns a repeated execution of a `completed` schedule as `already_completed` with no effect, blocks a terminal failure with the closed `reasonCode` (`approval_invalidated`, `dependency_changed`, `activation_authority_ended`, `canonical_source_unavailable`, `retries_exhausted`) making the subject `blocked` with the prior active version intact, cancels a schedule whose review is invalidated (`cancelled`, `approval_invalidated`) and returns the subject to `draft`, and runs a late schedule and records its `deviation_seconds`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: lease-expiry return, already_completed replay, terminal reasonCode blocking, review-invalidation cancel and late-run deviation_seconds have no implementation.',
  },
  {
    criterion: 'P2-S12-AC-147',
    text: 'CMS-03C-19 performs the `activate` switch for a due schedule, sets the schedule `completed` with `actual_at_utc` and `deviation_seconds`, and commits one activation event, the audit record and the schedule CAS atomically as CMS-03B-20 does; verification covers execution with only a revocation and grant-end recheck, worker lease expiry, the retry ladder and every `reasonCode`, a late run and a repeated run, and the absence of both RPCs from browser routes and generated OpenAPI.',
    clauses: [
      {
        text: 'CMS-03C-19 performs the `activate` switch for a due schedule, sets the schedule `completed` with `actual_at_utc` and `deviation_seconds`, and commits one activation event, the audit record and the schedule CAS atomically as CMS-03B-20 does; verification covers execution with only a revocation and grant-end recheck, worker lease expiry, the retry ladder and every `reasonCode`, a late run and a repeated run, and the absence of both RPCs from browser routes and generated OpenAPI.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: there is no governed activate-switch execution, atomic event/audit/schedule commit, or browser-route absence check to test.',
  },
  {
    criterion: 'P2-S12-AC-148',
    text: 'CMS-03C-20 is the database RPC `platform_private.cms_resolve_locale_field(p_entry_id uuid, p_locale text, p_field_id uuid)` returning the strict `LocaleFieldResolution` (`fieldId`, `locale`, `mode` `none`, `localized` or `no_fallback`, `outcome` `resolved` or `missing`, `provenance` `authored`, `localized_fallback` or `missing`, `resolvedFromLocale`, `stale`, `blocking`, and `reasonCode` `no_fallback_missing`, `no_fallback_stale` or null) and the registered preflight provider `cms.locale.no_fallback_gate`; it is the one resolver used by the 03b `locale` preflight provider, the Shard 04 delivery projection and editorial reads, and it has no browser route.',
    clauses: [
      {
        text: 'CMS-03C-20 is the database RPC `platform_private.cms_resolve_locale_field(p_entry_id uuid, p_locale text, p_field_id uuid)` returning the strict `LocaleFieldResolution` (`fieldId`, `locale`, `mode` `none`, `localized` or `no_fallback`, `outcome` `resolved` or `missing`, `provenance` `authored`, `localized_fallback` or `missing`, `resolvedFromLocale`, `stale`, `blocking`, and `reasonCode` `no_fallback_missing`, `no_fallback_stale` or null) and the registered preflight provider `cms.locale.no_fallback_gate`; it is the one resolver used by the 03b `locale` preflight provider, the Shard 04 delivery projection and editorial reads, and it has no browser route.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: platform_private.cms_resolve_locale_field and the LocaleFieldResolution contract do not exist.',
  },
  {
    criterion: 'P2-S12-AC-149',
    text: "CMS-03C-20 resolves a field by its `localizationMode`: with `none` the value is the source-locale value, and with `localized` (fallback permitted) it is the field in the target locale's own revision when present, otherwise the first locale of the active version's `fallbackChains[locale]` (ordered, at most 16, ending at the default locale) that has a value, recording `resolvedFromLocale` and provenance `localized_fallback`, otherwise `missing`; the `no_fallback` and stale clauses are owned by AC051 and AC052.",
    clauses: [
      {
        text: "CMS-03C-20 resolves a field by its `localizationMode`: with `none` the value is the source-locale value, and with `localized` (fallback permitted) it is the field in the target locale's own revision when present, otherwise the first locale of the active version's `fallbackChains[locale]` (ordered, at most 16, ending at the default locale) that has a value, recording `resolvedFromLocale` and provenance `localized_fallback`, otherwise `missing`; the `no_fallback` and stale clauses are owned by AC051 and AC052.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: no resolver exists, so mode none/localized/no_fallback resolution, the fallback-chain walk and resolvedFromLocale are untested.',
  },
  {
    criterion: 'P2-S12-AC-150',
    text: 'CMS-03C-20 is executable only by the registered non-browser callers (the publication preflight `locale` provider, the Shard 04 delivery projection and the editorial reads; PUBLIC, anon, authenticated and every other role have EXECUTE revoked), returns identifiers, enums and booleans only and never locale text, and is absent from the browser route inventory and generated OpenAPI.',
    clauses: [
      {
        text: 'CMS-03C-20 is executable only by the registered non-browser callers (the publication preflight `locale` provider, the Shard 04 delivery projection and the editorial reads; PUBLIC, anon, authenticated and every other role have EXECUTE revoked), returns identifiers, enums and booleans only and never locale text, and is absent from the browser route inventory and generated OpenAPI.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: the resolver, its restricted EXECUTE grants and its absence from the browser inventory cannot be tested yet.',
  },
  {
    criterion: 'P2-S12-AC-151',
    text: 'CMS-03C-20 is read-only and deterministic, performing no insert, update, delete, audit row or outbox row, so a retry is harmless and identical inputs resolve identically.',
    clauses: [
      {
        text: 'CMS-03C-20 is read-only and deterministic, performing no insert, update, delete, audit row or outbox row, so a retry is harmless and identical inputs resolve identically.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: determinism and read-only behavior cannot be tested without the resolver.',
  },
  {
    criterion: 'P2-S12-AC-152',
    text: 'CMS-03C-20 is consumed by the 03b `locale` preflight provider, by the Shard 04 delivery projection (which adds no resolution rule of its own) and by `CmsLocaleVariantForm` per-field resolution, so a field blocked at publication is never resolved differently at delivery; verification covers the resolver for each `localizationMode`, the fallback chain walk and `resolvedFromLocale`, and the absence of the RPC from browser routes.',
    clauses: [
      {
        text: 'CMS-03C-20 is consumed by the 03b `locale` preflight provider, by the Shard 04 delivery projection (which adds no resolution rule of its own) and by `CmsLocaleVariantForm` per-field resolution, so a field blocked at publication is never resolved differently at delivery; verification covers the resolver for each `localizationMode`, the fallback chain walk and `resolvedFromLocale`, and the absence of the RPC from browser routes.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: neither the 03b locale preflight provider call, the Shard 04 delivery projection nor CmsLocaleVariantForm consume a resolver.',
  },
  {
    criterion: 'P2-S12-AC-153',
    text: 'CMS-03C-21 is the database RPC `platform_private.cms_related_content_public_targets(p_source_entry_id uuid, p_locale text, p_audience text)` returning an ordered array of at most 128 strict `RelatedPublicTarget` records (`entryId`, `source` `pin` or `derived`, a nullable `reasonCode` and `position` 0-127); it has no browser route and is absent from the browser route inventory.',
    clauses: [
      {
        text: 'CMS-03C-21 is the database RPC `platform_private.cms_related_content_public_targets(p_source_entry_id uuid, p_locale text, p_audience text)` returning an ordered array of at most 128 strict `RelatedPublicTarget` records (`entryId`, `source` `pin` or `derived`, a nullable `reasonCode` and `position` 0-127); it has no browser route and is absent from the browser route inventory.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: platform_private.cms_related_content_public_targets and the RelatedPublicTarget contract do not exist.',
  },
  {
    criterion: 'P2-S12-AC-154',
    text: "CMS-03C-21 returns eligible pins first in `position` order (public eligibility: the target's lineage head is an `active` `publish` row for `(locale, audience)` and no hold applies), then derived candidates in rank order, always removes exclusions, and refills a vacated slot only from eligible derived candidates.",
    clauses: [
      {
        text: "CMS-03C-21 returns eligible pins first in `position` order (public eligibility: the target's lineage head is an `active` `publish` row for `(locale, audience)` and no hold applies), then derived candidates in rank order, always removes exclusions, and refills a vacated slot only from eligible derived candidates.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: ordering, public eligibility and exclusion/refill rules have no implementation.',
  },
  {
    criterion: 'P2-S12-AC-155',
    text: 'CMS-03C-21 is executable only by the registered non-browser callers (the Shard 04 delivery projection and the Slice 11 related-content recheck; PUBLIC, anon, authenticated and every other role have EXECUTE revoked), never returns a draft, hidden, unpublished or other-owner target, and never lets a recommendation grant access.',
    clauses: [
      {
        text: 'CMS-03C-21 is executable only by the registered non-browser callers (the Shard 04 delivery projection and the Slice 11 related-content recheck; PUBLIC, anon, authenticated and every other role have EXECUTE revoked), never returns a draft, hidden, unpublished or other-owner target, and never lets a recommendation grant access.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: the RPC, its restricted callers and its draft/hidden/other-owner filtering cannot be tested yet.',
  },
  {
    criterion: 'P2-S12-AC-156',
    text: 'CMS-03C-21 is read-only, bounded to 128 targets, recomputed at every projection, preview and publication and never stored, performing no insert, update, delete, audit row or outbox row.',
    clauses: [
      {
        text: 'CMS-03C-21 is read-only, bounded to 128 targets, recomputed at every projection, preview and publication and never stored, performing no insert, update, delete, audit row or outbox row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: bound, statelessness and read-only behavior cannot be tested without the RPC.',
  },
  {
    criterion: 'P2-S12-AC-157',
    text: 'CMS-03C-21 lets a target that becomes unpublished or unavailable disappear from the output while its editorial explanation and history stay private, so a stale or unavailable target is never exposed.',
    clauses: [
      {
        text: 'CMS-03C-21 lets a target that becomes unpublished or unavailable disappear from the output while its editorial explanation and history stay private, so a stale or unavailable target is never exposed.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: disappearance of an unpublished target while the editorial explanation stays private cannot be tested without the RPC.',
  },
  {
    criterion: 'P2-S12-AC-158',
    text: 'CMS-03C-21 is consumed by the Shard 04 delivery projection (which re-implements neither resolution nor eligibility) and by the Slice 11 related-content recheck; verification covers pins-first ordering, the deterministic `shared-terms` and `same-type-recent` ranking and tie-breaks, the 128-target bound, refill only from eligible derived candidates, recomputation at every projection, and the absence of the RPC from browser routes.',
    clauses: [
      {
        text: 'CMS-03C-21 is consumed by the Shard 04 delivery projection (which re-implements neither resolution nor eligibility) and by the Slice 11 related-content recheck; verification covers pins-first ordering, the deterministic `shared-terms` and `same-type-recent` ranking and tie-breaks, the 128-target bound, refill only from eligible derived candidates, recomputation at every projection, and the absence of the RPC from browser routes.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: neither consumer (Shard 04 delivery projection, Slice 11 related-content recheck) calls a public-targets RPC.',
  },
  {
    criterion: 'P2-S12-AC-159',
    text: 'cmsTemplateContextRead registers GET /api/v1/cms/templates/context with an empty request and returns the strict `TemplateDesignerContext`: at most 64 owned active compiled content-type selectors (`id`, `typeKey`, `activeVersionId`, `activeVersion`, `sourceLocale`) and at most 128 owned registered, currently supported block selectors (`blockKey`, `blockVersion`), excluding owner IDs, grant records, renderer refs, manifests and policy internals; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'cmsTemplateContextRead registers GET /api/v1/cms/templates/context with an empty request',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-01 canonical OpenAPI authority registers a separate protected, no-store CMS-11 context read',
          },
        ],
      },
      {
        text: 'returns the strict `TemplateDesignerContext`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts accepts only a bounded, disclosure-safe designer context',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read fails closed on malformed provider data',
          },
        ],
      },
      {
        text: 'at most 64',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts accepts only a bounded, disclosure-safe designer context',
          },
        ],
      },
      {
        text: 'owned active compiled content-type selectors (`id`, `typeKey`, `activeVersionId`, `activeVersion`, `sourceLocale`)',
        citations: [],
      },
      {
        text: 'at most 128 owned registered, currently supported block selectors (`blockKey`, `blockVersion`)',
        citations: [],
      },
      {
        text: 'excluding owner IDs, grant records, renderer refs, manifests and policy internals',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts accepts only a bounded, disclosure-safe designer context',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_context.sql',
            title:
              'context contains only bounded safe active type and block selectors',
          },
        ],
      },
      {
        text: 'generated OpenAPI',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-01 canonical OpenAPI authority registers a separate protected, no-store CMS-11 context read',
          },
        ],
      },
      {
        text: 'the discovered Hono route match the registry row.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-01 canonical OpenAPI authority registers a separate protected, no-store CMS-11 context read',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read returns only validated owner-scoped selectors with no-store',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: clause 3 ("owned active compiled content-type selectors": the real-stack case proves the caller owner and active versions but no draft or uncompiled type exclusion case exists) and clause 4 ("at most 128 owned registered, currently supported block selectors": no test builds 129 registered blocks or excludes other-owner, withdrawn or unsupported blocks). Clause 7 is cited like the other registry-row clauses: the OpenAPI registration of the separate protected no-store context read plus the Worker route returning validated owner-scoped selectors with no-store; no test compares the mounted Hono route table to the registry row.',
  },
  {
    criterion: 'P2-S12-AC-160',
    text: 'cmsTemplateContextRead accepts an empty request only: no request body, no CSRF requirement, no `Idempotency-Key`, no `If-Match` and no owner selector, with the owner and acting context derived server-side, and an invalid query is 400.',
    clauses: [
      {
        text: 'cmsTemplateContextRead accepts an empty request only',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-01 canonical OpenAPI authority registers a separate protected, no-store CMS-11 context read',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'query selector' before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'nonempty body claim' on a read before authorization or the RPC",
          },
        ],
      },
      {
        text: 'no request body',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read answers request media on a read with 415 and an empty allowlist (BE00)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'request media' on a read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'nonempty body claim' on a read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'transfer encoding' on a read before authorization or the RPC",
          },
        ],
      },
      {
        text: 'no CSRF requirement',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-01 canonical OpenAPI authority registers a separate protected, no-store CMS-11 context read',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read returns only validated owner-scoped selectors with no-store',
          },
        ],
      },
      {
        text: 'no `Idempotency-Key`, no `If-Match`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'idempotency key' on a read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'write precondition' on a read before authorization or the RPC",
          },
        ],
      },
      {
        text: 'no owner selector',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'query selector' before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/templates/context.test.ts',
            title:
              'same-origin template context read rejects query authority and malformed provider data',
          },
        ],
      },
      {
        text: 'with the owner and acting context derived server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-context.test.ts',
            title:
              'CMS-03C-01 production template adapter reads only the named protected context RPC with server-derived identity',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-context.test.ts',
            title:
              'CMS-03C-01 production template adapter rejects invalid context operation and mismatched verified session before transport',
          },
        ],
      },
      {
        text: 'an invalid query is 400.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'query selector' before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/templates/context.test.ts',
            title:
              'same-origin template context read rejects query authority and malformed provider data',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-161',
    text: 'cmsTemplateContextRead serves only an authenticated human with confirmed acting-party membership and an active `cms.template_designer` grant, rechecks the actor, acting party, confirmed membership and current designer grant on every read in a private RPC that the browser and authenticated database roles cannot call or read through its source tables, answers a denied read as 403, and never reserves permission for a later write.',
    clauses: [
      {
        text: 'cmsTemplateContextRead serves only an authenticated human with confirmed acting-party membership and an active `cms.template_designer` grant',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read fails closed for 'unauthenticated' session",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read fails closed for 'malformed human' session",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read fails closed for 'no acting party' session",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read denies missing designer authority before invoking the RPC',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_context.sql',
            title: 'authorized template designer can read context',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_context.sql',
            title:
              'revoked designer grant denies context without disclosing records',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_dec119_future_membership.sql',
            title:
              'with the tenure not yet started every effective-capability predicate refuses, whatever grant exists',
          },
        ],
      },
      {
        text: 'rechecks the actor, acting party, confirmed membership and current designer grant on every read',
        citations: [],
      },
      {
        text: 'in a private RPC that the browser and authenticated database roles cannot call',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_context.sql',
            title: 'browser roles cannot execute the context RPC directly',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_r8_api_surface.sql',
            title:
              'every amendment and supporting RPC is service-role only: never anon, PUBLIC or authenticated [P2-S09-AC-180]',
          },
        ],
      },
      {
        text: 'read through its source tables',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_evidence_misc.sql',
            title:
              'no cms_ table grants any direct privilege to anon, authenticated or service_role [P2-S09-AC-181]',
          },
        ],
      },
      {
        text: 'answers a denied read as 403',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read denies missing designer authority before invoking the RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-context.test.ts',
            title:
              'CMS-03C-01 production template adapter maps context RPC denial and refuses malformed or unavailable projections',
          },
        ],
      },
      {
        text: 'never reserves permission for a later write.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      "Uncited: (1) 'rechecks the actor, acting party, confirmed membership and current designer grant on every read' - only the grant revocation is asserted against cms_template_context (an acting party the actor is not a confirmed member of, an absent actor and an ended or pending membership are not tested against the RPC; the membership predicate is tested on the helper only); (2) 'never reserves permission for a later write' - no test asserts that a context read stores or mints nothing.",
  },
  {
    criterion: 'P2-S12-AC-162',
    text: 'cmsTemplateContextRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match` and enforces read buckets of 60/min/user and 60/min/party, a 15,000 ms deadline and the Tier 2 target.',
    clauses: [
      {
        text: 'cmsTemplateContextRead is a no-store',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read returns only validated owner-scoped selectors with no-store',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/templates/context.test.ts',
            title:
              'same-origin template context read is dynamic, forwards only approved cookies, and validates its body',
          },
        ],
      },
      {
        text: 'read-only call that accepts neither `Idempotency-Key` nor `If-Match`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'idempotency key' on a read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'write precondition' on a read before authorization or the RPC",
          },
        ],
      },
      {
        text: 'enforces read buckets of 60/min/user and 60/min/party',
        citations: [],
      },
      {
        text: 'a 15,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read enforces a total deadline and catches unexpected execution failures',
          },
        ],
      },
      {
        text: 'the Tier 2 target.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      "Uncited: (1) 'enforces read buckets of 60/min/user and 60/min/party' - no context-route test asserts that both the user and the party bucket are consulted with limit 60 and window 60 s (only the 429 header limit and a rejected wrong limit are checked; the detail route has the scope assertion, the context route does not); (2) 'the Tier 2 target' - no latency or SLO evidence.",
  },
  {
    criterion: 'P2-S12-AC-163',
    text: 'cmsTemplateContextRead answers a denied read as 403, an invalid query as 400, a malformed provider projection as 502 and a dependency or deadline failure as 503 or 504 with a typed ApiError, and the POST independently rechecks all authority and compatibility so a stale context never authorizes a write.',
    clauses: [
      {
        text: 'cmsTemplateContextRead answers a denied read as 403, an invalid query as 400, a malformed provider projection as 502 and a dependency or deadline failure as 503 or 504 with a typed ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read denies missing designer authority before invoking the RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read rejects 'query selector' before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read fails closed on malformed provider data',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              "CMS-11 protected template context read fails closed for 'throw' context provider",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-context-routes.test.ts',
            title:
              'CMS-11 protected template context read enforces a total deadline and catches unexpected execution failures',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-context.test.ts',
            title:
              'CMS-03C-01 production template adapter maps context RPC denial and refuses malformed or unavailable projections',
          },
        ],
      },
      {
        text: 'the POST independently rechecks all authority and compatibility so a stale context never authorizes a write.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 confirmed member without designer grant cannot define templates',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title: 'CMS-03C-01 anonymous caller cannot define templates',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 refuses nonexistent or inactive compatible types',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 rejects a registered block whose compiler range excludes the active type compiler_version',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-routes.test.ts',
            title:
              'CMS-03C-01 protected template-version route fails closed on missing identity, wrong capability and absent acting party',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-164',
    text: 'cmsTemplateContextRead is consumed by the protected `CmsTemplateDesigner`, `CmsTemplateEditDesigner` and `CmsPatternVersionDesigner`, which load their picker options (active content types and supported blocks) from this same-origin no-store GET before enabling the form, disable submission with the corresponding sign-in, capability, rate-wait or retry state when the context is missing, denied or degraded, and neither extend the general auth-session resource nor grant designer authority in the browser; verification covers each denied or degraded state and that the POST revalidates authority.',
    clauses: [
      {
        text: 'cmsTemplateContextRead is consumed by the protected `CmsTemplateDesigner`, `CmsTemplateEditDesigner`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.test.tsx',
            title:
              'CMS-11 template designer shell renders a native form with protected selectors and no privileged evidence fields',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-real-route.spec.ts',
            title:
              'CMS-11 keeps a stale tab’s unsent values through a real-route conflict and explicit rebase',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-edit.spec.ts',
            title:
              'Phase 2 Slice 12 protected template edit > without validated protected projections, a valid key does not fabricate an editable draft',
            project: 'chrome',
          },
        ],
      },
      {
        text: '`CmsPatternVersionDesigner`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/load-pattern-designer-page.test.ts',
            title:
              'loadPatternDesignerPage: a new pattern serves only the selectors the form needs and the CSRF token',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx',
            title:
              'CmsPatternVersionDesigner: prerequisites explains a missing session and a missing content type, and cannot submit',
          },
        ],
      },
      {
        text: 'which load their picker options (active content types and supported blocks) from this same-origin no-store GET before enabling the form',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.test.tsx',
            title:
              'CMS-11 template designer shell renders a native form with protected selectors and no privileged evidence fields',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateDesigner.test.tsx',
            title:
              'CMS-11 template designer shell disables submission when a selector or CSRF prerequisite is absent',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/templates/context.test.ts',
            title:
              'same-origin template context read is dynamic, forwards only approved cookies, and validates its body',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-edit.spec.ts',
            title:
              'Phase 2 Slice 12 protected template edit > without validated protected projections, a valid key does not fabricate an editable draft',
            project: 'chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-real-route.spec.ts',
            title:
              'CMS-11 keeps a stale tab’s unsent values through a real-route conflict and explicit rebase',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'disable submission with the corresponding sign-in, capability, rate-wait or retry state when the context is missing, denied or degraded',
        citations: [],
      },
      {
        text: 'neither extend the general auth-session resource nor grant designer authority in the browser',
        citations: [],
      },
      {
        text: 'verification covers each denied or degraded state and that the POST revalidates authority.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: clause 3 (disable submission with the corresponding sign-in, capability, rate-wait or retry state when the context is missing, denied or degraded: the pattern designer loader is behaviour-tested, but for the template designers the 401/403/429 context-load states are asserted only as Astro source substrings), clause 4 (the browser neither extends the general auth-session resource nor grants designer authority: no negative test) and clause 5 (per-state verification for the template designers and that the POST revalidates authority). Clause 1 (CmsPatternVersionDesigner) is cited: the pattern designer now reads the same context through its loader and explains a missing session or content type without submitting.',
  },
  {
    criterion: 'P2-S12-AC-165',
    text: "cmsTemplateLatestRead registers GET /api/v1/cms/templates/{templateKey} with `TemplateLatestQuery` (path) and returns the strict `TemplateVersionDetail` of the caller owner's latest version of the key: the `TemplateVersionResource` plus `slots`, `bindings`, `locale` and `audience`, with no owner or authority field; generated OpenAPI and the discovered Hono route match the registry row.",
    clauses: [
      {
        text: 'cmsTemplateLatestRead registers GET /api/v1/cms/templates/{templateKey} with `TemplateLatestQuery` (path)',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-01 canonical OpenAPI authority registers a protected current-definition read for edit and conflict reconciliation',
          },
        ],
      },
      {
        text: "returns the strict `TemplateVersionDetail` of the caller owner's latest version of the key",
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-detail.test.ts',
            title:
              'CMS-11 protected latest-template detail contract returns a complete editable definition with a strong current version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_detail.sql',
            title: 'read returns the current version, not a stale first draft',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route reads only the validated latest definition with a strong ETag and no-store',
          },
        ],
      },
      {
        text: 'the `TemplateVersionResource` plus `slots`, `bindings`, `locale` and `audience`, with no owner or authority field',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-detail.test.ts',
            title:
              'CMS-11 protected latest-template detail contract returns a complete editable definition with a strong current version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_detail.sql',
            title:
              'detail carries exact editable fields but no private authority data',
          },
        ],
      },
      {
        text: 'generated OpenAPI',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-template-openapi.test.ts',
            title:
              'Slice 12 CMS-03C-01 canonical OpenAPI authority registers a protected current-definition read for edit and conflict reconciliation',
          },
        ],
      },
      {
        text: 'the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven for citation purposes: none by assertion. The registry row and the Worker route reading only the validated latest definition with a strong ETag and no-store are asserted by the OpenAPI and Worker route tests listed (the same evidence style as the other registry-row clauses); no test compares the mounted Hono route table to the registry row. Every clause would be cited, so the citations are held until root regenerates receipts and decides promotion.',
  },
  {
    criterion: 'P2-S12-AC-166',
    text: "cmsTemplateLatestRead accepts only a path `templateKey` that matches the template grammar and is not a reserved key (`context`, `versions`, `new`), resolves it only within the caller's owner scope, rejects a body, `Idempotency-Key` and `If-Match`, and answers a hidden or absent key with the same 404.",
    clauses: [
      {
        text: 'cmsTemplateLatestRead accepts only a path `templateKey` that matches the template grammar',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route rejects invalid selectors after authentication and before authorization or the read',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template.test.ts',
            title:
              'CMS-03C-01 template definition contracts enforces immutable template-key grammar and a positive version field',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/templates/template-detail.test.ts',
            title:
              'same-origin current-template detail proxy rejects invalid path or query selectors before transport',
          },
        ],
      },
      {
        text: 'is not a reserved key (`context`, `versions`, `new`)',
        citations: [],
      },
      {
        text: "resolves it only within the caller's owner scope",
        citations: [],
      },
      {
        text: 'rejects a body, `Idempotency-Key` and `If-Match`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'idempotency key' on a detail read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'write precondition' on a detail read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'request media' on a detail read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'nonempty body claim' on a detail read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'transfer encoding' on a detail read before authorization or the RPC",
          },
        ],
      },
      {
        text: 'answers a hidden or absent key with the same 404.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven for citation purposes: none by assertion. The reserved template keys context, versions and new (E13) are refused with a 400 at the Worker route and the contract and through the real stack, the path templateKey is resolved only within the caller owner scope, and a key held by another owner answers the same 404 as an unused key (real-stack case, with the Worker concealed not-found); the real-stack citations have no receipt yet (shared Supabase stack run). Every clause would be cited, so the citations are held until root regenerates receipts and decides promotion.',
  },
  {
    criterion: 'P2-S12-AC-167',
    text: "cmsTemplateLatestRead serves only `cms.template_designer` in the caller's owner scope (a caller without the capability is 403), resolves the key only within that scope so that a key held by another owner is the same 404 as an unused key, and serializes no owner or authority field.",
    clauses: [
      {
        text: 'cmsTemplateLatestRead serves only `cms.template_designer`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route requires the live designer capability before reading',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_detail.sql',
            title: 'authorized designer reads the current template definition',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_detail.sql',
            title: 'revoked designer grant denies the current template read',
          },
        ],
      },
      {
        text: "in the caller's owner scope",
        citations: [],
      },
      {
        text: '(a caller without the capability is 403)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route requires the live designer capability before reading',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-detail.test.ts',
            title:
              'CMS-11 protected latest-template production adapter rejects invalid operation, key, and both missing authority cases before transport',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_detail.sql',
            title: 'revoked designer grant denies the current template read',
          },
        ],
      },
      {
        text: 'resolves the key only within that scope so that a key held by another owner is the same 404 as an unused key',
        citations: [],
      },
      {
        text: 'serializes no owner or authority field.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-detail.test.ts',
            title:
              'CMS-11 protected latest-template detail contract returns a complete editable definition with a strong current version',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/template-detail.test.ts',
            title:
              'CMS-11 protected latest-template detail contract rejects hidden renderer data and malformed editable fields',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_detail.sql',
            title:
              'detail carries exact editable fields but no private authority data',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route preserves concealed not-found and rejects malformed dependency data',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/templates/template-detail.test.ts',
            title:
              'same-origin current-template detail proxy fails closed on mismatched or private provider fields',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven for citation purposes: none by assertion. The caller owner scope and the same-404 concealment of a key only another owner holds (with each owner reading its own definition of a shared key) are asserted by one real-stack case, which has no receipt yet (shared Supabase stack run); every clause would be cited, so the citations are held until root regenerates receipts and decides promotion.',
  },
  {
    criterion: 'P2-S12-AC-168',
    text: 'cmsTemplateLatestRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match`, carries the strong ETag `"{version}"` of the returned version, and enforces read buckets of 60/min/user and 60/min/party, a 15,000 ms deadline and the Tier 2 target.',
    clauses: [
      {
        text: 'cmsTemplateLatestRead is a no-store',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route reads only the validated latest definition with a strong ETag and no-store',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/templates/template-detail.test.ts',
            title:
              'same-origin current-template detail proxy forwards only approved identity material and exact validated definition',
          },
        ],
      },
      {
        text: 'read-only call that accepts neither `Idempotency-Key` nor `If-Match`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'idempotency key' on a detail read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'write precondition' on a detail read before authorization or the RPC",
          },
        ],
      },
      {
        text: 'carries the strong ETag `"{version}"` of the returned version',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route reads only the validated latest definition with a strong ETag and no-store',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/templates/template-detail.test.ts',
            title:
              'same-origin current-template detail proxy forwards only approved identity material and exact validated definition',
          },
        ],
      },
      {
        text: 'enforces read buckets of 60/min/user and 60/min/party',
        citations: [],
      },
      {
        text: 'a 15,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route returns the deadline even when a session dependency never resolves',
          },
        ],
      },
      {
        text: 'the Tier 2 target.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      "Uncited: (1) 'enforces read buckets of 60/min/user and 60/min/party' - the user and party scopes and the 60 limit are asserted, but the 60-second window is passed by the route (windowSeconds 60) and never asserted, so '/min' is unproven; (2) 'the Tier 2 target' - no latency or SLO evidence.",
  },
  {
    criterion: 'P2-S12-AC-169',
    text: 'cmsTemplateLatestRead maps a malformed path (400 `INVALID_REQUEST`), a missing session (401), a missing capability (403 `TEMPLATE_FORBIDDEN`), a hidden or absent key (404 `TEMPLATE_NOT_FOUND`), an unsupported body (415), the read limit (429), a dependency failure (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.template.v1`, and as a safe read is retried by a browser caller at most twice, after 250 ms and 750 ms (FE03), while server, queue and job callers retry it at most three times at 15 s, 60 s and 300 s with jitter (DEC-211).',
    clauses: [
      {
        text: 'cmsTemplateLatestRead maps a malformed path (400 `INVALID_REQUEST`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route rejects invalid selectors after authentication and before authorization or the read',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'idempotency key' on a detail read before authorization or the RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'write precondition' on a detail read before authorization or the RPC",
          },
        ],
      },
      {
        text: 'a missing session (401)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route fails closed when 'unauthenticated'",
          },
        ],
      },
      {
        text: 'a missing capability (403 `TEMPLATE_FORBIDDEN`)',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-167] no session is 401, no designer capability is 403, and a revoked database grant is 403 from the database',
          },
        ],
      },
      {
        text: 'a hidden or absent key (404 `TEMPLATE_NOT_FOUND`)',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-166] [P2-S12-AC-167] a key only another owner holds is the same 404 as an unused key, and each owner reads its own definition of a shared key',
          },
        ],
      },
      {
        text: 'an unsupported body (415)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route answers request media on a read with 415 and an empty allowlist (BE00)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              "CMS-11 protected current-template detail HTTP route rejects 'request media' on a detail read before authorization or the RPC",
          },
        ],
      },
      {
        text: 'the read limit (429)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route publishes the BE00 429 details and RateLimit headers on the detail route',
          },
        ],
      },
      {
        text: 'a dependency failure (502/503/504 `DEPENDENCY_UNAVAILABLE`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'cmsTemplateLatestRead' a port failure of 502 answers that status as DEPENDENCY_UNAVAILABLE with the bound message and closed details",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'cmsTemplateLatestRead' the 15-second route deadline answers 504 DEPENDENCY_UNAVAILABLE",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-template-reads.apispec.ts',
            title:
              'cmsTemplateLatestRead through the real stack [P2-S12-AC-169] a dependency that never answers is 503 DEPENDENCY_UNAVAILABLE',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'cmsTemplateLatestRead' a port failure of 503 answers that status as DEPENDENCY_UNAVAILABLE with the bound message and closed details",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/phase-02-slice-12-dependency-unavailable.test.ts',
            title:
              "[P2-S12-AC-008] CMS-03C dependency failures are DEPENDENCY_UNAVAILABLE 'cmsTemplateLatestRead' a port failure of 504 answers that status as DEPENDENCY_UNAVAILABLE with the bound message and closed details",
          },
        ],
      },
      {
        text: 'an internal failure (500)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/template-detail-routes.test.ts',
            title:
              'CMS-11 protected current-template detail HTTP route contains an unexpected execution error in the generic 500 envelope',
          },
        ],
      },
      {
        text: 'to typed ApiError of catalog `cms.03c.template.v1`',
        citations: [],
      },
      {
        text: 'as a safe read is retried by a browser caller at most twice, after 250 ms and 750 ms (FE03), while server, queue and job callers retry it at most three times at 15 s, 60 s and 300 s with jitter (DEC-211).',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: clause 8 ("typed ApiError of catalog cms.03c.template.v1": no such catalog id exists in code) and clause 9 ("as a safe read is retried by a browser caller at most twice, after 250 ms and 750 ms (FE03), while server, queue and job callers retry it at most three times at 15 s, 60 s and 300 s with jitter (DEC-211)"): SPEC/CODE DRIFT, the client retries twice at 250 ms then 750 ms (FE03 :1173), so either the clause text or the code is wrong and root must decide before it can be cited. Clauses 2, 3 and 6 are cited from the real-stack read cases (TEMPLATE_FORBIDDEN, the same TEMPLATE_NOT_FOUND for a key only another owner holds, DEPENDENCY_UNAVAILABLE) and the Worker dependency-unavailable suite; the real-stack citations have no receipt yet (shared Supabase stack run).',
  },
  {
    criterion: 'P2-S12-AC-170',
    text: "cmsTemplateLatestRead is consumed by the protected `CmsTemplateEditDesigner` at `/app/cms-content-modeling/templates/:templateKey`, which prefills the form from the owner's latest version, sends its `version` as `expectedVersion` to create a successor through CMS-03C-01, reconciles a 409 by refetching this read, reuses the idempotency key for an unchanged uncertain attempt, and never resolves `context`, `versions` or `new` as a template key; verification covers the prefill, the successor `expectedVersion`, the 409 reconciliation and the 403/404 split.",
    clauses: [
      {
        text: 'cmsTemplateLatestRead is consumed by the protected `CmsTemplateEditDesigner` at `/app/cms-content-modeling/templates/:templateKey`',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-real-route.spec.ts',
            title:
              'CMS-11 keeps a stale tab’s unsent values through a real-route conflict and explicit rebase',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-edit.spec.ts',
            title:
              'Phase 2 Slice 12 protected template edit > without validated protected projections, a valid key does not fabricate an editable draft',
            project: 'chrome',
          },
        ],
      },
      {
        text: "which prefills the form from the owner's latest version",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-request.test.ts',
            title:
              'CMS-11 template draft request loads every editable field from canonical detail and builds a version-checked successor',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateEditDesigner.interaction.test.tsx',
            title:
              'CMS-11 successor edit and reconciliation keeps unsent values through conflict and requires an explicit latest-version rebase',
          },
        ],
      },
      {
        text: 'sends its `version` as `expectedVersion` to create a successor through CMS-03C-01',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-request.test.ts',
            title:
              'CMS-11 template draft request loads every editable field from canonical detail and builds a version-checked successor',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-designer-submit.test.ts',
            title:
              'CMS-11 first-party draft submission posts a successor with exact strong If-Match and accepts only a newer authoritative draft',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateEditDesigner.interaction.test.tsx',
            title:
              'CMS-11 successor edit and reconciliation keeps unsent values through conflict and requires an explicit latest-version rebase',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-real-route.spec.ts',
            title:
              'CMS-11 keeps a stale tab’s unsent values through a real-route conflict and explicit rebase',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'reconciles a 409 by refetching this read',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateEditDesigner.interaction.test.tsx',
            title:
              'CMS-11 successor edit and reconciliation keeps unsent values through conflict and requires an explicit latest-version rebase',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/cms-template-edit-reconcile.test.ts',
            title:
              'CMS-11 canonical reconciliation read reads only the same-origin protected latest version and checks identity and ETag',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-real-route.spec.ts',
            title:
              'CMS-11 keeps a stale tab’s unsent values through a real-route conflict and explicit rebase',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'reuses the idempotency key for an unchanged uncertain attempt',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition/CmsTemplateEditDesigner.interaction.test.tsx',
            title:
              'CMS-11 successor edit and reconciliation retains the key after an uncertain same-version reconciliation read',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-uncertain-real-route.spec.ts',
            title:
              'Phase 2 Slice 12 uncertain template mutation > an unknown outcome keeps values, reuses the idempotency key, and reconciles before retry',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'never resolves `context`, `versions` or `new` as a template key',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-edit.spec.ts',
            title:
              'Phase 2 Slice 12 protected template edit > [P2-S12-AC-265] [P2-S12-AC-189] the reserved key context never resolves as a template key',
            project: 'chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-template-edit.spec.ts',
            title:
              'Phase 2 Slice 12 protected template edit > [P2-S12-AC-265] [P2-S12-AC-189] the reserved key versions never resolves as a template key',
            project: 'chrome',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/key-grammar.test.ts',
            title:
              'BE03c key grammar (E13, E14, lineage ids) [P2-S12-AC-189] refuses a reserved template key with the key_reserved reason and keeps near-misses valid',
          },
        ],
      },
      {
        text: 'verification covers the prefill, the successor `expectedVersion`, the 409 reconciliation and the 403/404 split.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: clause 6 ("verification covers the prefill, the successor expectedVersion, the 409 reconciliation and the 403/404 split"): the prefill, expectedVersion and 409 parts are cited on clauses 1-4, but no test asserts the distinct 403 versus 404 outcome of the template edit page. Clause 5 (never resolves context, versions or new as a template key) is cited from the Playwright edit spec (context and versions; project chrome) and the contract refusal of all three reserved keys; the Playwright citations run only in the browser gate.',
  },
  {
    criterion: 'P2-S12-AC-171',
    text: "cmsPatternLatestRead registers GET /api/v1/cms/patterns/{patternKey} with `PatternLatestQuery` (path) and returns the strict `PatternVersionDetail` of the caller owner's latest version of the key in any state: the `PatternVersionResource` plus the `blockTree` of 1-32 root nodes; generated OpenAPI and the discovered Hono route match the registry row.",
    clauses: [
      {
        text: "cmsPatternLatestRead registers GET /api/v1/cms/patterns/{patternKey} with `PatternLatestQuery` (path) and returns the strict `PatternVersionDetail` of the caller owner's latest version of the key in any state: the `PatternVersionResource` plus the `blockTree` of 1-32 root nodes; generated OpenAPI and the discovered Hono route match the registry row.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Unproven for citation purposes: none by assertion. The GET route registry row, the generated OpenAPI, the strict PatternVersionDetail (resource plus a blockTree of 1-32 root nodes) and the Worker serving the latest version in every definition state with the definition version ETag (draft, review, approved, scheduled, active, superseded, retired, blocked) are asserted by the OpenAPI, contract and Worker tests listed. The clause is a single sentence; no test compares the mounted Hono route table to the registry row; the clause citations are held until root regenerates receipts and decides promotion (RPC is pgTAP, not cited this pass).',
  },
  {
    criterion: 'P2-S12-AC-172',
    text: "cmsPatternLatestRead accepts only a path `patternKey` that matches the pattern grammar and is not a reserved key (`context`, `versions`, `selector`, `new`), resolves it only within the caller's owner scope, rejects a body, `Idempotency-Key` and `If-Match`, and answers a hidden or absent key with the same 404.",
    clauses: [
      {
        text: "cmsPatternLatestRead accepts only a path `patternKey` that matches the pattern grammar and is not a reserved key (`context`, `versions`, `selector`, `new`), resolves it only within the caller's owner scope, rejects a body, `Idempotency-Key` and `If-Match`, and answers a hidden or absent key with the same 404.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: this operation has no route, RPC or contract yet, so there is nothing to test.',
  },
  {
    criterion: 'P2-S12-AC-173',
    text: "cmsPatternLatestRead serves only `cms.template_designer` in the caller's owner scope (a caller without the capability is 403), resolves the key only within that scope so that another owner's identical key is the same 404 as an unused key, and serializes no owner or authority field.",
    clauses: [
      {
        text: "cmsPatternLatestRead serves only `cms.template_designer` in the caller's owner scope (a caller without the capability is 403), resolves the key only within that scope so that another owner's identical key is the same 404 as an unused key, and serializes no owner or authority field.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: this operation has no route, RPC or contract yet, so there is nothing to test.',
  },
  {
    criterion: 'P2-S12-AC-174',
    text: 'cmsPatternLatestRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match`, carries the strong ETag `"{version}"` of the returned version, and enforces read buckets of 60/min/user and 60/min/party, a 15,000 ms deadline and the Tier 2 target.',
    clauses: [
      {
        text: 'cmsPatternLatestRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match`, carries the strong ETag `"{version}"` of the returned version, and enforces read buckets of 60/min/user and 60/min/party, a 15,000 ms deadline and the Tier 2 target.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: this operation has no route, RPC or contract yet, so there is nothing to test.',
  },
  {
    criterion: 'P2-S12-AC-175',
    text: 'cmsPatternLatestRead maps a malformed path (400), a missing session (401), a missing designer capability (403), a hidden or absent key (404), an unsupported body (415), the read limit (429), a read dependency or deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1`.',
    clauses: [
      {
        text: 'cmsPatternLatestRead maps a malformed path (400), a missing session (401), a missing designer capability (403), a hidden or absent key (404), an unsupported body (415), the read limit (429), a read dependency or deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Unproven for citation purposes: none by assertion, with one caveat. The single clause names every mapping of the latest read (400, 401, 403, 404, 415, 429, 502/503/504, 500). The Worker admission, latest-projection, production-transport and provider-fault suites cited assert each of them against stubbed ports, but the Slice 12 dependency-unavailable suite does not list cmsPatternLatestRead and the 502/503/504 evidence is the "never promoted into a caller refusal" relay plus the retryable 502 envelope case, so the dependency mapping is the weakest part. The citations are held until root regenerates receipts and decides promotion; no real-stack case exists for the pattern read.',
  },
  {
    criterion: 'P2-S12-AC-176',
    text: "cmsPatternLatestRead is consumed by the protected `CmsPatternVersionDesigner` and `CmsGovernedReviewPanel` at `/app/cms-content-modeling/patterns/:patternKey`, which address the owner's latest version by key, prefill the node list from it, send the read version as `expectedVersion` for a successor and show the version's lifecycle; verification covers the prefill, the successor `expectedVersion`, the 403/404 split and that the reserved keys never resolve as `:patternKey`.",
    clauses: [
      {
        text: "cmsPatternLatestRead is consumed by the protected `CmsPatternVersionDesigner` and `CmsGovernedReviewPanel` at `/app/cms-content-modeling/patterns/:patternKey`, which address the owner's latest version by key, prefill the node list from it, send the read version as `expectedVersion` for a successor and show the version's lifecycle; verification covers the prefill, the successor `expectedVersion`, the 403/404 split and that the reserved keys never resolve as `:patternKey`.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Unproven for citation purposes: none by assertion, with caveats. The designer prefill from the latest version, the read version sent as expectedVersion, the reserved keys (selector, new, context, versions) answered 400 before any read, the disclosure-safe 404, the missing-capability copy and the governed pattern panel (subject taken as served, no submit for a non-draft, review summary) are asserted by jsdom component and loader tests. No Playwright spec exists for /patterns/:patternKey, so the route-level behaviour in a real browser is unproven; the single clause is therefore held until root decides promotion.',
  },
  {
    criterion: 'P2-S12-AC-177',
    text: 'cmsTaxonomyVersionsRead registers GET /api/v1/cms/taxonomies/{taxonomyId}/versions with `TaxonomyVersionsQuery` (path) and returns the strict `TaxonomyVersionsPage` of at most 50 `TaxonomyVersionResource` items, newest first, and `pageVersion`; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'cmsTaxonomyVersionsRead registers GET /api/v1/cms/taxonomies/{taxonomyId}/versions with `TaxonomyVersionsQuery` (path) and returns the strict `TaxonomyVersionsPage` of at most 50 `TaxonomyVersionResource` items, newest first, and `pageVersion`; generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Unproven for citation purposes: none by assertion. The GET route registry row, the generated OpenAPI, the strict TaxonomyVersionsPage of at most 50 TaxonomyVersionResource items newest first with a page version, the Worker serving newest-first versions with a strong page-version ETag and without MFA, and the first-party vocabulary route set are asserted by the tests listed; the single clause is held until root regenerates receipts and decides promotion. No test compares the mounted Hono route table to the registry row; the RPC read is pgTAP (not cited this pass).',
  },
  {
    criterion: 'P2-S12-AC-178',
    text: 'cmsTaxonomyVersionsRead accepts only a UUID `taxonomyId` path (the vocabulary lineage id) with no query key (400 otherwise), rejects a body, `Idempotency-Key` and `If-Match`, and answers a hidden or absent vocabulary with the same 404.',
    clauses: [
      {
        text: 'cmsTaxonomyVersionsRead accepts only a UUID `taxonomyId` path (the vocabulary lineage id) with no query key (400 otherwise), rejects a body, `Idempotency-Key` and `If-Match`, and answers a hidden or absent vocabulary with the same 404.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: this operation has no route, RPC or contract yet, so there is nothing to test.',
  },
  {
    criterion: 'P2-S12-AC-179',
    text: "cmsTaxonomyVersionsRead serves only `cms.taxonomy_curator` in the caller's owner scope (a caller without the capability is 403; a hidden or absent vocabulary is 404) over the owner's vocabulary lineage, and serializes no owner or authority field.",
    clauses: [
      {
        text: "cmsTaxonomyVersionsRead serves only `cms.taxonomy_curator` in the caller's owner scope (a caller without the capability is 403; a hidden or absent vocabulary is 404) over the owner's vocabulary lineage, and serializes no owner or authority field.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: this operation has no route, RPC or contract yet, so there is nothing to test.',
  },
  {
    criterion: 'P2-S12-AC-180',
    text: 'cmsTaxonomyVersionsRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match`, carries an ETag on the page version, and enforces read buckets of 60/min/user and 60/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
    clauses: [
      {
        text: 'cmsTaxonomyVersionsRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match`, carries an ETag on the page version, and enforces read buckets of 60/min/user and 60/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: this operation has no route, RPC or contract yet, so there is nothing to test.',
  },
  {
    criterion: 'P2-S12-AC-181',
    text: 'cmsTaxonomyVersionsRead maps a malformed path, query or cursor (400), a missing session (401), a missing curator capability (403 `TAXONOMY_FORBIDDEN`), a hidden or absent vocabulary (404 `TAXONOMY_NOT_FOUND`), an unsupported body if sent (415), a query-bound failure (422), the read limit (429), a read dependency or deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.taxonomy.v1`.',
    clauses: [
      {
        text: 'cmsTaxonomyVersionsRead maps a malformed path, query or cursor (400), a missing session (401), a missing curator capability (403 `TAXONOMY_FORBIDDEN`), a hidden or absent vocabulary (404 `TAXONOMY_NOT_FOUND`), an unsupported body if sent (415), a query-bound failure (422), the read limit (429), a read dependency or deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.taxonomy.v1`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: this operation has no route, RPC or contract yet, so there is nothing to test.',
  },
  {
    criterion: 'P2-S12-AC-182',
    text: "cmsTaxonomyVersionsRead is consumed by the protected `CmsTaxonomyVersionDesigner` and `CmsGovernedReviewPanel` at `/app/cms-content-modeling/taxonomies/:taxonomyId`, which read the vocabulary's versions (newest first, at most 50) to show each version's lifecycle, review summary and permitted actions, while term actions render only against an `active` version and `taxonomy_not_active` links to the vocabulary's governed review; verification covers the 403/404 split, the 50-version bound and the active-version gating of term actions.",
    clauses: [
      {
        text: "cmsTaxonomyVersionsRead is consumed by the protected `CmsTaxonomyVersionDesigner` and `CmsGovernedReviewPanel` at `/app/cms-content-modeling/taxonomies/:taxonomyId`, which read the vocabulary's versions (newest first, at most 50) to show each version's lifecycle, review summary and permitted actions, while term actions render only against an `active` version and `taxonomy_not_active` links to the vocabulary's governed review; verification covers the 403/404 split, the 50-version bound and the active-version gating of term actions.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: this operation has no route, RPC or contract yet, so there is nothing to test.',
  },
  {
    criterion: 'P2-S12-AC-183',
    text: 'cmsTaxonomyTermsRead registers GET /api/v1/cms/taxonomies/{taxonomyId}/terms with the strict `TaxonomyTermListQuery` and returns the strict `TaxonomyTermListPage` of at most 50 `TaxonomyTermListItem` rows (`termId`, `termKey`, `lifecycle`, `version`, `parentId`, `successorId`, at most 64 `labels` and at most 64 `aliases`), a `nextCursor` of at most 512 characters or null and `pageVersion`, ordered by the signed keyset `(termKey ASC, termId ASC)`.',
    clauses: [
      {
        text: 'cmsTaxonomyTermsRead registers GET /api/v1/cms/taxonomies/{taxonomyId}/terms with the strict `TaxonomyTermListQuery` and returns the strict `TaxonomyTermListPage` of at most 50 `TaxonomyTermListItem` rows (`termId`, `termKey`, `lifecycle`, `version`, `parentId`, `successorId`, at most 64 `labels` and at most 64 `aliases`), a `nextCursor` of at most 512 characters or null and `pageVersion`, ordered by the signed keyset `(termKey ASC, termId ASC)`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: this operation has no route, RPC or contract yet, so there is nothing to test.',
  },
  {
    criterion: 'P2-S12-AC-184',
    text: 'cmsTaxonomyTermsRead accepts only a UUID `taxonomyId` path, an optional `lifecycle` of `active`, `deprecated` or `merged`, a signed context-bound `cursor` of at most 512 characters and a `limit` of 1-50 (default 25), rejects every other key, a body and any mutation header, and refuses a response over 256 KiB as a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure.',
    clauses: [
      {
        text: 'cmsTaxonomyTermsRead accepts only a UUID `taxonomyId` path, an optional `lifecycle` of `active`, `deprecated` or `merged`, a signed context-bound `cursor` of at most 512 characters and a `limit` of 1-50 (default 25), rejects every other key, a body and any mutation header, and refuses a response over 256 KiB as a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: this operation has no route, RPC or contract yet, so there is nothing to test.',
  },
  {
    criterion: 'P2-S12-AC-185',
    text: "cmsTaxonomyTermsRead serves only `cms.taxonomy_curator` in the caller's owner scope (a caller without the capability is 403; a hidden or absent vocabulary is 404), lists merged terms with their `successorId`, and serializes no owner or authority field.",
    clauses: [
      {
        text: "cmsTaxonomyTermsRead serves only `cms.taxonomy_curator` in the caller's owner scope (a caller without the capability is 403; a hidden or absent vocabulary is 404), lists merged terms with their `successorId`, and serializes no owner or authority field.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: this operation has no route, RPC or contract yet, so there is nothing to test.',
  },
  {
    criterion: 'P2-S12-AC-186',
    text: 'cmsTaxonomyTermsRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match`, carries an ETag on the page version and a signed cursor bound to the query and acting context, and enforces read buckets of 120/min/user and 240/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
    clauses: [
      {
        text: 'cmsTaxonomyTermsRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match`, carries an ETag on the page version and a signed cursor bound to the query and acting context, and enforces read buckets of 120/min/user and 240/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: this operation has no route, RPC or contract yet, so there is nothing to test.',
  },
  {
    criterion: 'P2-S12-AC-187',
    text: 'cmsTaxonomyTermsRead answers a structurally malformed cursor with 400 and an expired, tampered or foreign-bound cursor with 409 (the client restarts from the first page), and maps session, capability, concealment, read-limit, read-dependency and internal failures to typed ApiError of catalog `cms.03c.taxonomy.v1` with no audit or outbox effect.',
    clauses: [
      {
        text: 'cmsTaxonomyTermsRead answers a structurally malformed cursor with 400 and an expired, tampered or foreign-bound cursor with 409 (the client restarts from the first page), and maps session, capability, concealment, read-limit, read-dependency and internal failures to typed ApiError of catalog `cms.03c.taxonomy.v1` with no audit or outbox effect.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: this operation has no route, RPC or contract yet, so there is nothing to test.',
  },
  {
    criterion: 'P2-S12-AC-188',
    text: "cmsTaxonomyTermsRead is consumed by the protected `CmsTaxonomyTermForm`, which lists the vocabulary's terms with their lifecycle, keeps the term list cursor as URL state without serializing a protected value, shows a merged term's survivor redirect, renders `canonical_overlap` as \"This matches a canonical {domain} record. Reference the canonical record instead\" with the canonical id as copyable text and never creates the term, and links `taxonomy_not_active` to the vocabulary's governed review; verification covers term keyset order, cursor binding and merged terms listed with their successor.",
    clauses: [
      {
        text: "cmsTaxonomyTermsRead is consumed by the protected `CmsTaxonomyTermForm`, which lists the vocabulary's terms with their lifecycle, keeps the term list cursor as URL state without serializing a protected value, shows a merged term's survivor redirect, renders `canonical_overlap` as \"This matches a canonical {domain} record. Reference the canonical record instead\" with the canonical id as copyable text and never creates the term, and links `taxonomy_not_active` to the vocabulary's governed review; verification covers term keyset order, cursor binding and merged terms listed with their successor.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: this operation has no route, RPC or contract yet, so there is nothing to test.',
  },
  {
    criterion: 'P2-S12-AC-189',
    text: 'Reserved keys (E13): `templateKey` must not equal `context`, `versions` or `new` and `patternKey` must not equal `context`, `versions`, `selector` or `new`, enforced in the contracts schema and in a SQL CHECK on `cms_template_versions.template_key` and `cms_pattern_versions.pattern_key`, so that a reserved key is 422 `TEMPLATE_VALIDATION_FAILED` (or `COMPOSITION_VALIDATION_FAILED`) at `/templateKey` or `/patternKey` with `details.reasonCode` `key_reserved` and can never resolve as the `{templateKey}` or `{patternKey}` of a latest read.',
    clauses: [
      {
        text: 'Reserved keys (E13): `templateKey` must not equal `context`, `versions` or `new` and `patternKey` must not equal `context`, `versions`, `selector` or `new`, enforced in the contracts schema and in a SQL CHECK on `cms_template_versions.template_key` and `cms_pattern_versions.pattern_key`, so that a reserved key is 422 `TEMPLATE_VALIDATION_FAILED` (or `COMPOSITION_VALIDATION_FAILED`) at `/templateKey` or `/patternKey` with `details.reasonCode` `key_reserved` and can never resolve as the `{templateKey}` or `{patternKey}` of a latest read.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built (E13): neither the contracts schema nor a SQL CHECK rejects the reserved template and pattern keys; CmsTemplateKeySchema accepts context, versions and new.',
  },
  {
    criterion: 'P2-S12-AC-190',
    text: "Per-owner uniqueness (E14): `UNIQUE (template_key, version)`, `UNIQUE (pattern_key, version)` and `UNIQUE (taxonomy_key, version)` are replaced by `UNIQUE (owner_id, <key>, version)` by forward migration, every lookup by key (the latest reads, parents and selectors) is scoped to the caller's owner party, and a key held by another owner is indistinguishable from an unused key, so that no cross-owner existence signal such as a 409 is possible.",
    clauses: [
      {
        text: "Per-owner uniqueness (E14): `UNIQUE (template_key, version)`, `UNIQUE (pattern_key, version)` and `UNIQUE (taxonomy_key, version)` are replaced by `UNIQUE (owner_id, <key>, version)` by forward migration, every lookup by key (the latest reads, parents and selectors) is scoped to the caller's owner party, and a key held by another owner is indistinguishable from an unused key, so that no cross-owner existence signal such as a 409 is possible.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built (E14): uniqueness is still global per key and cms_define_template looks the previous version up without the owner, so a second owner creating an existing key gets CONFLICT - a live cross-owner existence signal.',
  },
  {
    criterion: 'P2-S12-AC-191',
    text: "Lineage ids: `templateId`, `patternId` and `taxonomyId` are the stable lineage ids of (owner, key), the `id` of the version-1 row carried on every successor row as `template_id`, `pattern_id` and `taxonomy_id`; a version number is unique within its lineage, a successor names its parent through `supersedes_id`, and a partial unique index on each lineage id `WHERE state = 'active'` allows one active version per lineage.",
    clauses: [
      {
        text: "Lineage ids: `templateId`, `patternId` and `taxonomyId` are the stable lineage ids of (owner, key), the `id` of the version-1 row carried on every successor row as `template_id`, `pattern_id` and `taxonomy_id`; a version number is unique within its lineage, a successor names its parent through `supersedes_id`, and a partial unique index on each lineage id `WHERE state = 'active'` allows one active version per lineage.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: no template_id/pattern_id/taxonomy_id lineage columns and no partial unique index on the active version of a lineage exist; supersedes_id exists only on templates.',
  },
  {
    criterion: 'P2-S12-AC-192',
    text: 'Template audience (E4): `audience` follows the BE04c audience grammar `^[a-z0-9_-]{1,48}$`, matched as submitted and never trimmed, in the contracts schema and in a SQL CHECK on `cms_template_versions.audience`, so that an audience outside the grammar is refused 422 `TEMPLATE_VALIDATION_FAILED` with a bounded JSON-pointer violation at `/audience`.',
    clauses: [
      {
        text: 'Template audience (E4): `audience` follows the BE04c audience grammar `^[a-z0-9_-]{1,48}$`, matched as submitted and never trimmed, in the contracts schema and in a SQL CHECK on `cms_template_versions.audience`, so that an audience outside the grammar is refused 422 `TEMPLATE_VALIDATION_FAILED` with a bounded JSON-pointer violation at `/audience`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built (E4): audience still follows the older safe-text rule (1-64 characters excluding <>{}), not the BE04c grammar ^[a-z0-9_-]{1,48}$.',
  },
  {
    criterion: 'P2-S12-AC-193',
    text: 'blockRegistryDigest: the server resolves every reachable block from the 03a safe registry and computes the lowercase SHA-256 of the RFC 8785/JCS array of the reachable, deduplicated `{blockKey,blockVersion,releaseDigest,propsSchemaHash,rendererRef,lifecycle}` tuples sorted by the UTF-8 bytes of `blockKey` and then numeric `blockVersion`; a client-supplied digest is only an equality expectation, compared with the server result and never stored in place of it, so the recomputed server digest is authoritative; and the server recomputes the digest at template create, template activate, pattern create, pattern activate and 03b publication preflight.',
    clauses: [
      {
        text: 'blockRegistryDigest: the server resolves every reachable block from the 03a safe registry and computes the lowercase SHA-256 of the RFC 8785/JCS array of the reachable',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 empty reachable-block set hashes exact canonical JSON []',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 persisted digest equals exact server-derived safe tuple hash',
          },
        ],
      },
      {
        text: 'deduplicated `{blockKey,blockVersion,releaseDigest,propsSchemaHash,rendererRef,lifecycle}` tuples sorted by the UTF-8 bytes of `blockKey` and then numeric `blockVersion`',
        citations: [],
      },
      {
        text: 'a client-supplied digest is only an equality expectation, compared with the server result and never stored in place of it, so the recomputed server digest is authoritative',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_template_authority.sql',
            title:
              'CMS-03C-01 refuses caller digest that differs from current registry with the typed token [BE03c 323-327, 1273; DEC-186]',
          },
        ],
      },
      {
        text: 'the server recomputes the digest at template create, template activate, pattern create, pattern activate and 03b publication preflight.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      "Uncited: (1) 'deduplicated ... tuples sorted by the UTF-8 bytes of `blockKey` and then numeric `blockVersion`' - the SQL digest is tested with zero or one block only (no duplicate reference, no multi-block ordering); the multi-block TypeScript reference apps/worker/src/cms-composition/block-registry-digest.ts has unit tests but no production caller; (2) 'the server recomputes the digest at template create, template activate, pattern create, pattern activate and 03b publication preflight' - only template create exists; activation, pattern create/activate and a registry-recomputing preflight do not.",
  },
  {
    criterion: 'P2-S12-AC-194',
    text: 'Block registry consumption: 03c consumes only the safe `BlockDefinitionRegistryRecord` projection (`id`, `version`, `blockKey`, `blockVersion`, `propsSchemaRef`, `propsSchemaHash`, `rendererRef`, `releaseDigest`, `lifecycle`, with the literal `resourceKind` `block_definition_registry_record` and no release principal, signature or raw manifest), never registers, updates or deletes a block, and before every template or pattern validation refetches the record or consumes the latest `cms.block.lifecycle.changed.v1`, so that a missing, withdrawn, incompatible, duplicate or unreachable block fails closed before mutation and a deprecated block follows the fixed compatibility policy.',
    clauses: [
      {
        text: 'Block registry consumption: 03c consumes only the safe `BlockDefinitionRegistryRecord` projection (`id`, `version`, `blockKey`, `blockVersion`, `propsSchemaRef`, `propsSchemaHash`, `rendererRef`, `releaseDigest`, `lifecycle`, with the literal `resourceKind` `block_definition_registry_record` and no release principal, signature or raw manifest), never registers, updates or deletes a block, and before every template or pattern validation refetches the record or consumes the latest `cms.block.lifecycle.changed.v1`, so that a missing, withdrawn, incompatible, duplicate or unreachable block fails closed before mutation and a deprecated block follows the fixed compatibility policy.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not proven as a whole: only the template-create SQL path reads the registry (pgTAP refuses withdrawn, deprecated and renderer-incompatible blocks); missing/duplicate/unreachable blocks, the safe BlockDefinitionRegistryRecord adapter (block-registry-digest.ts has no production caller), the never-mutates guarantee, the lifecycle-event consumer and pattern validation are untested or unbuilt.',
  },
  {
    criterion: 'P2-S12-AC-195',
    text: 'Definition immutability: the definition fields of TemplateVersion, PatternVersion and TaxonomyVersion never change after creation (an edit is a successor version through CMS-03C-01, -12 or -16), activation makes the definition immutable, and the lifecycle columns `state` (`draft`, `review`, `approved`, `scheduled`, `active`, `superseded`, `retired`, `blocked`), `version`, `activated_at`, `retired_at` and `updated_at` advance only through the governed RPCs CMS-03C-06 to -09.',
    clauses: [
      {
        text: 'Definition immutability: the definition fields of TemplateVersion, PatternVersion and TaxonomyVersion never change after creation (an edit is a successor version through CMS-03C-01, -12 or -16), activation makes the definition immutable, and the lifecycle columns `state` (`draft`, `review`, `approved`, `scheduled`, `active`, `superseded`, `retired`, `blocked`), `version`, `activated_at`, `retired_at` and `updated_at` advance only through the governed RPCs CMS-03C-06 to -09.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      "Not proven as a whole: definition immutability is enforced by guard triggers and tested for patterns ('pattern definition cannot mutate in place') and taxonomies ('taxonomy definition is immutable after creation') but the TemplateVersion guard has no test, activation-immutability is unbuilt, and the governed RPCs CMS-03C-06..09 that are the only lifecycle writers do not exist.",
  },
  {
    criterion: 'P2-S12-AC-196',
    text: 'Governed review tables: CMS-03C-06 to CMS-03C-11 serve the closed, code-owned `subject_kind` set (`template_version`, `pattern_version`, `taxonomy_version`) through one set of private tables keyed by `(subject_kind, subject_id)` (`cms_governed_reviews`, `cms_governed_review_decisions`, `cms_governed_review_assignments`, `cms_governed_review_dependencies` and, for scheduled activation, `cms_governed_activation_schedules`) so that slot semantics, MFA, assignment, strictest-policy counting and invalidation have one implementation; a later subject kind is added only by forward migration; and the 03a `cms_schema_reviews` set and the 03b editorial review tables keep their own tables and operations.',
    clauses: [
      {
        text: 'Governed review tables: CMS-03C-06 to CMS-03C-11 serve the closed, code-owned `subject_kind` set (`template_version`, `pattern_version`, `taxonomy_version`) through one set of private tables keyed by `(subject_kind, subject_id)` (`cms_governed_reviews`, `cms_governed_review_decisions`, `cms_governed_review_assignments`, `cms_governed_review_dependencies` and, for scheduled activation, `cms_governed_activation_schedules`) so that slot semantics, MFA, assignment, strictest-policy counting and invalidation have one implementation; a later subject kind is added only by forward migration; and the 03a `cms_schema_reviews` set and the 03b editorial review tables keep their own tables and operations.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: the five governed review/schedule tables keyed by (subject_kind, subject_id) do not exist.',
  },
  {
    criterion: 'P2-S12-AC-197',
    text: 'Subject state machine: `draft` becomes `review` at submission and `review` becomes `approved` when the last required approval lands; a rejection or invalidation returns the subject from `review` (or from `approved`, `scheduled` or `blocked`) to `draft` through an audited transition while the review stays `rejected` or `invalidated`; `approved` becomes `active` or `scheduled`; `scheduled` becomes `active` at execution or `blocked` when execution fails terminally; `blocked` becomes `active` or `scheduled` through a new activation command while its review is still `approved` and current; `active` becomes `superseded` in the transaction that activates a newer version of the lineage, or `retired`; `superseded` and `retired` are terminal; and the review states are `open` to `approved`, `rejected` or `invalidated` and `approved` to `invalidated`, with assignment create and revoke never changing the review state.',
    clauses: [
      {
        text: 'Subject state machine: `draft` becomes `review` at submission and `review` becomes `approved` when the last required approval lands; a rejection or invalidation returns the subject from `review` (or from `approved`, `scheduled` or `blocked`) to `draft` through an audited transition while the review stays `rejected` or `invalidated`; `approved` becomes `active` or `scheduled`; `scheduled` becomes `active` at execution or `blocked` when execution fails terminally; `blocked` becomes `active` or `scheduled` through a new activation command while its review is still `approved` and current; `active` becomes `superseded` in the transaction that activates a newer version of the lineage, or `retired`; `superseded` and `retired` are terminal; and the review states are `open` to `approved`, `rejected` or `invalidated` and `approved` to `invalidated`, with assignment create and revoke never changing the review state.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: the subject and review state machines are not implemented, so no transition is testable.',
  },
  {
    criterion: 'P2-S12-AC-198',
    text: "Governed policy basis: the review count and slots are the strictest DEC-110 workflow policy among the content types the subject is bound to (a template or pattern version's `compatibleTypeIds`; for a taxonomy version the content types of the caller's owner scope whose keys appear in `allowedTypeKeys`), each resolved through the fail-closed `cms_editorial_workflow_policy_evidence` seam; the basis is the array of `{ contentTypeId, policyKey, policyVersion, policyHash }` sorted by `(policyKey, policyVersion, contentTypeId)`; `risk_class` is `protected` if any member is protected, `required_decision_count` is the largest member count and `required_capabilities` is the base slot `cms.reviewer` followed by each specialist capability in order of first appearance (at most 16); a subject with no resolvable bound type uses the registry member `editorial.default` version 1 (`CMS_GOVERNED_DEFAULT_POLICY`); and `policy_basis_hash` is the lowercase SHA-256 of the JCS basis array.",
    clauses: [
      {
        text: "Governed policy basis: the review count and slots are the strictest DEC-110 workflow policy among the content types the subject is bound to (a template or pattern version's `compatibleTypeIds`; for a taxonomy version the content types of the caller's owner scope whose keys appear in `allowedTypeKeys`), each resolved through the fail-closed `cms_editorial_workflow_policy_evidence` seam; the basis is the array of `{ contentTypeId, policyKey, policyVersion, policyHash }` sorted by `(policyKey, policyVersion, contentTypeId)`; `risk_class` is `protected` if any member is protected, `required_decision_count` is the largest member count and `required_capabilities` is the base slot `cms.reviewer` followed by each specialist capability in order of first appearance (at most 16); a subject with no resolvable bound type uses the registry member `editorial.default` version 1 (`CMS_GOVERNED_DEFAULT_POLICY`); and `policy_basis_hash` is the lowercase SHA-256 of the JCS basis array.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: no governed policy basis resolution (strictest DEC-110 policy, basis array, basis hash) exists.',
  },
  {
    criterion: 'P2-S12-AC-199',
    text: "Submitting a `template_version` requires the state `draft`, a compatibility-resolver success for the active version of every `compatibleTypeIds` member and a recomputed `blockRegistryDigest` equal to the stored one, and freezes the dependency kinds `block` (each reachable block record) and `content_type` (each compatible content type's active version id) into `cms_governed_review_dependencies`.",
    clauses: [
      {
        text: "Submitting a `template_version` requires the state `draft`, a compatibility-resolver success for the active version of every `compatibleTypeIds` member and a recomputed `blockRegistryDigest` equal to the stored one, and freezes the dependency kinds `block` (each reachable block record) and `content_type` (each compatible content type's active version id) into `cms_governed_review_dependencies`.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: template_version submission (CMS-03C-06) does not exist.',
  },
  {
    criterion: 'P2-S12-AC-200',
    text: 'Submitting a `pattern_version` requires the state `draft`, every nested pattern `active`, compatible and acyclic, and a recomputed digest equal to the stored one, and freezes the dependency kinds `block`, `pattern` (each nested pattern version) and `content_type`.',
    clauses: [
      {
        text: 'Submitting a `pattern_version` requires the state `draft`, every nested pattern `active`, compatible and acyclic, and a recomputed digest equal to the stored one, and freezes the dependency kinds `block`, `pattern` (each nested pattern version) and `content_type`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: pattern_version submission does not exist (no pattern definition command at all).',
  },
  {
    criterion: 'P2-S12-AC-201',
    text: 'Submitting a `taxonomy_version` requires the state `draft` and a registered provider for every declared canonical domain (else 422 `canonical_source_unavailable` with `details.domain`), and freezes the dependency kinds `content_type` (each content type named by `allowedTypeKeys`) and `canonical_domain` (the provider registry row of each declared domain).',
    clauses: [
      {
        text: 'Submitting a `taxonomy_version` requires the state `draft` and a registered provider for every declared canonical domain (else 422 `canonical_source_unavailable` with `details.domain`), and freezes the dependency kinds `content_type` (each content type named by `allowedTypeKeys`) and `canonical_domain` (the provider registry row of each declared domain).',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: taxonomy_version submission and the canonical-domain provider registry do not exist.',
  },
  {
    criterion: 'P2-S12-AC-202',
    text: 'Governed review invalidation producers: the consumers of `cms.block.lifecycle.changed.v1` (a withdrawn block), `cms.schema.activated.v1` (a changed bound policy or type version) and `cms.pattern.activated.v1` enqueue the idempotent job `cms.governed_review.recheck` (a typed platform-queue message, DEC-166; capability-grant revocation does not enqueue it and instead invalidates synchronously in the revoking transaction, AC-204, DEC-207), which selects live reviews through `cms_governed_review_dependencies (review_id, kind, ref_id)` of kind `block`, `pattern`, `content_type` or `canonical_domain`.',
    clauses: [
      {
        text: 'Governed review invalidation producers: the consumers of `cms.block.lifecycle.changed.v1` (a withdrawn block), `cms.schema.activated.v1` (a changed bound policy or type version) and `cms.pattern.activated.v1` enqueue the idempotent job `cms.governed_review.recheck` (a typed platform-queue message, DEC-166; capability-grant revocation does not enqueue it and instead invalidates synchronously in the revoking transaction, AC-204, DEC-207), which selects live reviews through `cms_governed_review_dependencies (review_id, kind, ref_id)` of kind `block`, `pattern`, `content_type` or `canonical_domain`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: no invalidation producers or cms.governed_review.recheck job exist.',
  },
  {
    criterion: 'P2-S12-AC-203',
    text: 'Governed review recheck: the job `cms.governed_review.recheck` (`cms_recheck_governed_reviews(p_request jsonb)`, request `{ eventId, kind, refId, cursor, batch? }`) handles at most 500 reviews per run with a continuation cursor, is idempotent (an already `invalidated` review is skipped), rebuilds the hash, policy basis and identities of each live review and invalidates on any difference with the closed reason `dependency_changed` or `reviewer_authority_changed`, returning the subject to `draft` and, while the subject is `scheduled`, cancelling its schedule (`cancelled`, `approval_invalidated`) in the invalidating transaction; governed review state changes emit no event in Phase 2.',
    clauses: [
      {
        text: 'Governed review recheck: the job `cms.governed_review.recheck` (`cms_recheck_governed_reviews(p_request jsonb)`, request `{ eventId, kind, refId, cursor, batch? }`) handles at most 500 reviews per run with a continuation cursor, is idempotent (an already `invalidated` review is skipped), rebuilds the hash, policy basis and identities of each live review and invalidates on any difference with the closed reason `dependency_changed` or `reviewer_authority_changed`, returning the subject to `draft` and, while the subject is `scheduled`, cancelling its schedule (`cancelled`, `approval_invalidated`) in the invalidating transaction; governed review state changes emit no event in Phase 2.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: cms_recheck_governed_reviews and the recheck job do not exist.',
  },
  {
    criterion: 'P2-S12-AC-204',
    text: "Reviewer authority invalidation: the closed reason `reviewer_authority_changed` is produced, under the 03b Review invalidation rules applied unchanged, when a counted approver's standing capability is revoked (the revoking transaction calls `cms_invalidate_governed_reviews_for_person(person_id, capability)`, a definer function not scoped to the revoker's party that invalidates, in that transaction, every `open` or `approved` review the person counted on under that capability, with the subject returning to `draft`) and when a counted approver's assignment is revoked while the review is `open`.",
    clauses: [
      {
        text: "Reviewer authority invalidation: the closed reason `reviewer_authority_changed` is produced, under the 03b Review invalidation rules applied unchanged, when a counted approver's standing capability is revoked (the revoking transaction calls `cms_invalidate_governed_reviews_for_person(person_id, capability)`, a definer function not scoped to the revoker's party that invalidates, in that transaction, every `open` or `approved` review the person counted on under that capability, with the subject returning to `draft`) and when a counted approver's assignment is revoked while the review is `open`.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: cms_invalidate_governed_reviews_for_person and reviewer_authority_changed handling for governed reviews do not exist.',
  },
  {
    criterion: 'P2-S12-AC-205',
    text: "Immediate activation: `activate` requires the subject `approved` or `blocked` (else 409 `subject_not_activatable`) and in one transaction makes it `active` (`version` + 1, `activated_at`), makes the lineage's previous `active` version `superseded` (`version` + 1), records `activated_at` on the review and advances its `version`, and commits the audit record and exactly one activation event; an activation that loses a race on the lineage is 409 `activation_conflict` and nothing commits.",
    clauses: [
      {
        text: "Immediate activation: `activate` requires the subject `approved` or `blocked` (else 409 `subject_not_activatable`) and in one transaction makes it `active` (`version` + 1, `activated_at`), makes the lineage's previous `active` version `superseded` (`version` + 1), records `activated_at` on the review and advances its `version`, and commits the audit record and exactly one activation event; an activation that loses a race on the lineage is 409 `activation_conflict` and nothing commits.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: governed immediate activation (activate RPC) does not exist.',
  },
  {
    criterion: 'P2-S12-AC-206',
    text: 'Scheduled activation acceptance: `schedule` resolves `activateAt` through the 03b Time authority (E8: pinned tz database, DST rules, 60 s to 366 d horizon), runs the same kind-specific preflight, makes the subject `scheduled`, inserts one `pending` row in `cms_governed_activation_schedules` (a second live schedule for the subject is 409 `schedule_exists`), answers 202 and emits no event.',
    clauses: [
      {
        text: 'Scheduled activation acceptance: `schedule` resolves `activateAt` through the 03b Time authority (E8: pinned tz database, DST rules, 60 s to 366 d horizon), runs the same kind-specific preflight, makes the subject `scheduled`, inserts one `pending` row in `cms_governed_activation_schedules` (a second live schedule for the subject is 409 `schedule_exists`), answers 202 and emits no event.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: governed scheduled activation (schedule RPC, cms_governed_activation_schedules) does not exist.',
  },
  {
    criterion: 'P2-S12-AC-207',
    text: "Retirement: `retire` requires the subject `active` (else 409 `subject_not_retirable`) and needs no new approval or review decision and no dependency, policy, provider or preflight validity (DEC-190) while keeping the `reviewId` addressing, the review-`version` `If-Match`, the unconditional recent MFA and the subject kind's owner capability, makes it `retired`, emits the same event type naming the retired version, and a retired version fails the 03b `template` preflight and the 03a compatibility resolver as `WITHDRAWN`.",
    clauses: [
      {
        text: "Retirement: `retire` requires the subject `active` (else 409 `subject_not_retirable`) and needs no new approval or review decision and no dependency, policy, provider or preflight validity (DEC-190) while keeping the `reviewId` addressing, the review-`version` `If-Match`, the unconditional recent MFA and the subject kind's owner capability, makes it `retired`, emits the same event type naming the retired version, and",
        citations: [],
      },
      {
        text: 'a retired version fails the 03b `template` preflight and the 03a compatibility resolver as `WITHDRAWN`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_dec108_resolver.sql',
            title:
              'a withdrawn template definition is the typed failure WITHDRAWN [P2-S09-AC-705]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a template that is no longer active fails template_not_active (before any compatibility or digest reason) [P2-S11-AC-095]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Approved claim amended; only unchanged clauses retain prior citations. All added or changed obligations remain uncited and unverified; native/SQL/browser gates are not complete.',
  },
  {
    criterion: 'P2-S12-AC-208',
    text: 'Activating or scheduling a `template_version` runs the compatibility resolver for every `compatibleTypeIds` member and recomputes the block digest before the switch.',
    clauses: [
      {
        text: 'Activating or scheduling a `template_version` runs the compatibility resolver for every `compatibleTypeIds` member and recomputes the block digest before the switch.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: template activation/scheduling (CMS-03C-08/09 for templates) with its pre-switch compatibility and digest recheck does not exist.',
  },
  {
    criterion: 'P2-S12-AC-209',
    text: 'Activating or scheduling a `pattern_version` checks the state of every nested pattern and recomputes the block digest before the switch.',
    clauses: [
      {
        text: 'Activating or scheduling a `pattern_version` checks the state of every nested pattern and recomputes the block digest before the switch.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: pattern activation/scheduling and its nested-pattern state check do not exist.',
  },
  {
    criterion: 'P2-S12-AC-210',
    text: 'Activating or scheduling a `taxonomy_version` requires a registered provider for every declared canonical domain, else 422 `canonical_source_unavailable` with `details.domain`.',
    clauses: [
      {
        text: 'Activating or scheduling a `taxonomy_version` requires a registered provider for every declared canonical domain, else 422 `canonical_source_unavailable` with `details.domain`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: taxonomy activation/scheduling and the canonical-domain provider check do not exist.',
  },
  {
    criterion: 'P2-S12-AC-211',
    text: "Pattern graph: a pattern tree is a bounded forest of depth at most 8 and at most 512 nodes after expanding nested pattern references, with unique sibling node `key`s, no cycle through a nested lineage (the visited set is the lineage `pattern_id`) and every nested pattern `active` and listing every `compatibleTypeIds` member of the new pattern; a violation is typed (422 `pattern_depth_exceeded`, `pattern_nodes_exceeded` and `nested_pattern_not_active`; 409 `pattern_cycle`), is refused before save and again before publish, and `node_count` stores the expanded count. For entry publication, the live nested-pin active/compatibility recheck is the pattern provider's `nested_pattern_not_active` failed reason (DEC-199), not a new transport status; nonnull canonical detached snapshots do not reopen provenance pins. Every block node of an expanded tree also satisfies its pinned block version's `allowedChildren` and `slotRules` (DEC-210): a violation at CMS-03C-12 save, CMS-03C-02 placement or CMS-03C-15 accept or detach is 422 `COMPOSITION_VALIDATION_FAILED` with `details.reasonCode` `block_rules_violated` and nothing written, and at publication the pattern provider fails `pattern_block_rules_violated`.",
    clauses: [
      {
        text: 'Pattern graph: a pattern tree is a bounded forest of depth at most 8 and at most 512 nodes after expanding nested pattern references, with unique sibling node `key`s, no cycle through a nested lineage (the visited set is the lineage `pattern_id`) and every nested pattern `active` and listing every `compatibleTypeIds` member of the new pattern; a violation is typed (422 `pattern_depth_exceeded`, `pattern_nodes_exceeded` and `nested_pattern_not_active`; 409 `pattern_cycle`), is refused before save and again before publish, and `node_count` stores the expanded count.',
        citations: [],
      },
      {
        text: "For entry publication, the live nested-pin active/compatibility recheck is the pattern provider's `nested_pattern_not_active` failed reason (DEC-199), not a new transport status;",
        citations: [],
      },
      {
        text: 'nonnull canonical detached snapshots do not reopen provenance pins.',
        citations: [],
      },
      {
        text: "Every block node of an expanded tree also satisfies its pinned block version's `allowedChildren` and `slotRules` (DEC-210): a violation at CMS-03C-12 save, CMS-03C-02 placement or CMS-03C-15 accept or detach is 422 `COMPOSITION_VALIDATION_FAILED` with `details.reasonCode` `block_rules_violated` and nothing written, and at publication the pattern provider fails `pattern_block_rules_violated`.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Approved claim amended; no test is cited for this criterion yet. Native/SQL/browser acceptance remains unverified.',
  },
  {
    criterion: 'P2-S12-AC-212',
    text: 'Linked-update scan: when a pattern version is activated, the idempotent consumer job `cms.pattern.linked_update_scan` (a typed platform-queue message with payload `{ patternId, patternVersionId }`, DEC-166) appends a `pending_diff` row, pinned to the unchanged version and carrying `pending_pattern_version`, for each `linked` instance on a draft revision whose pinned version is older and whose entry type is compatible with the new version, and leaves instances on reviewed or published revisions on their pin as history.',
    clauses: [
      {
        text: 'Linked-update scan: when a pattern version is activated, the idempotent consumer job `cms.pattern.linked_update_scan` (a typed platform-queue message with payload `{ patternId, patternVersionId }`, DEC-166) appends a `pending_diff` row, pinned to the unchanged version and carrying `pending_pattern_version`, for each `linked` instance on a draft revision whose pinned version is older and whose entry type is compatible with the new version, and leaves instances on reviewed or published revisions on their pin as history.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: the cms.pattern.linked_update_scan consumer job does not exist.',
  },
  {
    criterion: 'P2-S12-AC-213',
    text: 'Linked-update scan bounds: `cms.pattern.linked_update_scan` processes at most 500 instances per run with a continuation cursor and is idempotent, so a re-delivered `cms.pattern.activated.v1` appends no duplicate `pending_diff` row and a long instance list continues from the cursor.',
    clauses: [
      {
        text: 'Linked-update scan bounds: `cms.pattern.linked_update_scan` processes at most 500 instances per run with a continuation cursor and is idempotent, so a re-delivered `cms.pattern.activated.v1` appends no duplicate `pending_diff` row and a long instance list continues from the cursor.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Not built: the linked-update scan, its 500-instance bound and idempotency do not exist.',
  },
];
