import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 12 evidence ledger, criteria AC143-AC213. Aggregated by
// tests/contracts/phase-02-slice-12-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-12-evidence-guard.test.ts.
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-147',
    text: 'CMS-03C-19 performs the `activate` switch for a due schedule, sets the schedule `completed` with `actual_at_utc` and `deviation_seconds`, and commits one activation event, the audit record and the schedule CAS atomically as CMS-03B-20 does; verification covers execution with only a revocation and grant-end recheck, worker lease expiry, the retry ladder and every `reasonCode`, a late run and a repeated run, and the absence of both RPCs from browser routes and generated OpenAPI.',
    clauses: [
      {
        text: 'CMS-03C-19 performs the `activate` switch for a due schedule, sets the schedule `completed` with `actual_at_utc` and `deviation_seconds`, and commits one activation event, the audit record and the schedule CAS atomically as CMS-03B-20 does;',
        citations: [],
      },
      {
        text: 'verification covers execution with only a revocation and grant-end recheck, worker lease expiry, the retry ladder and every `reasonCode`, a late run and a repeated run, and the absence of both RPCs from browser routes and generated OpenAPI.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-148',
    text: 'CMS-03C-20 is the database RPC `platform_private.cms_resolve_locale_field(p_entry_id uuid, p_locale text, p_field_id uuid)` returning the strict `LocaleFieldResolution` (`fieldId`, `locale`, `mode` `none`, `localized` or `no_fallback`, `outcome` `resolved` or `missing`, `provenance` `authored`, `localized_fallback` or `missing`, `resolvedFromLocale`, `stale`, `blocking`, and `reasonCode` `no_fallback_missing`, `no_fallback_stale` or null) and the registered preflight provider `cms.locale.no_fallback_gate`; it is the one resolver used by the 03b `locale` preflight provider, the Shard 04 delivery projection and editorial reads, and it has no browser route.',
    clauses: [
      {
        text: 'CMS-03C-20 is the database RPC `platform_private.cms_resolve_locale_field(p_entry_id uuid, p_locale text, p_field_id uuid)` returning the strict `LocaleFieldResolution` (`fieldId`, `locale`, `mode` `none`, `localized` or `no_fallback`, `outcome` `resolved` or `missing`, `provenance` `authored`, `localized_fallback` or `missing`, `resolvedFromLocale`, `stale`, `blocking`, and `reasonCode` `no_fallback_missing`, `no_fallback_stale` or null) and the registered preflight provider `cms.locale.no_fallback_gate`;',
        citations: [],
      },
      {
        text: 'it is the one resolver used by the 03b `locale` preflight provider, the Shard 04 delivery projection and editorial reads, and it has no browser route.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-149',
    text: "CMS-03C-20 resolves a field by its `localizationMode`: with `none` the value is the source-locale value, and with `localized` (fallback permitted) it is the field in the target locale's own revision when present, otherwise the first locale of the active version's `fallbackChains[locale]` (ordered, at most 16, ending at the default locale) that has a value, recording `resolvedFromLocale` and provenance `localized_fallback`, otherwise `missing`; the `no_fallback` and stale clauses are owned by AC051 and AC052.",
    clauses: [
      {
        text: "CMS-03C-20 resolves a field by its `localizationMode`: with `none` the value is the source-locale value, and with `localized` (fallback permitted) it is the field in the target locale's own revision when present, otherwise the first locale of the active version's `fallbackChains[locale]` (ordered, at most 16, ending at the default locale) that has a value, recording `resolvedFromLocale` and provenance `localized_fallback`, otherwise `missing`;",
        citations: [],
      },
      {
        text: 'the `no_fallback` and stale clauses are owned by AC051 and AC052.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-152',
    text: 'CMS-03C-20 is consumed by the 03b `locale` preflight provider, by the Shard 04 delivery projection (which adds no resolution rule of its own) and by `CmsLocaleVariantForm` per-field resolution, so a field blocked at publication is never resolved differently at delivery; verification covers the resolver for each `localizationMode`, the fallback chain walk and `resolvedFromLocale`, and the absence of the RPC from browser routes.',
    clauses: [
      {
        text: 'CMS-03C-20 is consumed by the 03b `locale` preflight provider, by the Shard 04 delivery projection (which adds no resolution rule of its own) and by `CmsLocaleVariantForm` per-field resolution, so a field blocked at publication is never resolved differently at delivery;',
        citations: [],
      },
      {
        text: 'verification covers the resolver for each `localizationMode`, the fallback chain walk and `resolvedFromLocale`, and the absence of the RPC from browser routes.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-153',
    text: 'CMS-03C-21 is the database RPC `platform_private.cms_related_content_public_targets(p_source_entry_id uuid, p_locale text, p_audience text)` returning an ordered array of at most 128 strict `RelatedPublicTarget` records (`entryId`, `source` `pin` or `derived`, a nullable `reasonCode` and `position` 0-127); it has no browser route and is absent from the browser route inventory.',
    clauses: [
      {
        text: 'CMS-03C-21 is the database RPC `platform_private.cms_related_content_public_targets(p_source_entry_id uuid, p_locale text, p_audience text)` returning an ordered array of at most 128 strict `RelatedPublicTarget` records (`entryId`, `source` `pin` or `derived`, a nullable `reasonCode` and `position` 0-127);',
        citations: [],
      },
      {
        text: 'it has no browser route and is absent from the browser route inventory.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-158',
    text: 'CMS-03C-21 is consumed by the Shard 04 delivery projection (which re-implements neither resolution nor eligibility) and by the Slice 11 related-content recheck; verification covers pins-first ordering, the deterministic `shared-terms` and `same-type-recent` ranking and tie-breaks, the 128-target bound, refill only from eligible derived candidates, recomputation at every projection, and the absence of the RPC from browser routes.',
    clauses: [
      {
        text: 'CMS-03C-21 is consumed by the Shard 04 delivery projection (which re-implements neither resolution nor eligibility) and by the Slice 11 related-content recheck;',
        citations: [],
      },
      {
        text: 'verification covers pins-first ordering, the deterministic `shared-terms` and `same-type-recent` ranking and tie-breaks, the 128-target bound, refill only from eligible derived candidates, recomputation at every projection, and the absence of the RPC from browser routes.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-159',
    text: 'cmsTemplateContextRead registers GET /api/v1/cms/templates/context with an empty request and returns the strict `TemplateDesignerContext`: at most 64 owned active compiled content-type selectors (`id`, `typeKey`, `activeVersionId`, `activeVersion`, `sourceLocale`) and at most 128 owned registered, currently supported block selectors (`blockKey`, `blockVersion`), excluding owner IDs, grant records, renderer refs, manifests and policy internals; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'cmsTemplateContextRead registers GET /api/v1/cms/templates/context with an empty request and returns the strict `TemplateDesignerContext`: at most 64 owned active compiled content-type selectors (`id`, `typeKey`, `activeVersionId`, `activeVersion`, `sourceLocale`) and at most 128 owned registered, currently supported block selectors (`blockKey`, `blockVersion`), excluding owner IDs, grant records, renderer refs, manifests and policy internals;',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-160',
    text: 'cmsTemplateContextRead accepts an empty request only: no request body, no CSRF requirement, no `Idempotency-Key`, no `If-Match` and no owner selector, with the owner and acting context derived server-side, and an invalid query is 400.',
    clauses: [
      {
        text: 'cmsTemplateContextRead accepts an empty request only: no request body, no CSRF requirement, no `Idempotency-Key`, no `If-Match` and no owner selector, with the owner and acting context derived server-side, and an invalid query is 400.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-161',
    text: 'cmsTemplateContextRead serves only an authenticated human with confirmed acting-party membership and an active `cms.template_designer` grant, rechecks the actor, acting party, confirmed membership and current designer grant on every read in a private RPC that the browser and authenticated database roles cannot call or read through its source tables, answers a denied read as 403, and never reserves permission for a later write.',
    clauses: [
      {
        text: 'cmsTemplateContextRead serves only an authenticated human with confirmed acting-party membership and an active `cms.template_designer` grant, rechecks the actor, acting party, confirmed membership and current designer grant on every read in a private RPC that the browser and authenticated database roles cannot call or read through its source tables, answers a denied read as 403, and never reserves permission for a later write.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-162',
    text: 'cmsTemplateContextRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match` and enforces read buckets of 60/min/user and 60/min/party, a 15,000 ms deadline and the Tier 2 target.',
    clauses: [
      {
        text: 'cmsTemplateContextRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match` and enforces read buckets of 60/min/user and 60/min/party, a 15,000 ms deadline and the Tier 2 target.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-163',
    text: 'cmsTemplateContextRead answers a denied read as 403, an invalid query as 400, a malformed provider projection as 502 and a dependency or deadline failure as 503 or 504 with a typed ApiError, and the POST independently rechecks all authority and compatibility so a stale context never authorizes a write.',
    clauses: [
      {
        text: 'cmsTemplateContextRead answers a denied read as 403, an invalid query as 400, a malformed provider projection as 502 and a dependency or deadline failure as 503 or 504 with a typed ApiError, and the POST independently rechecks all authority and compatibility so a stale context never authorizes a write.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-164',
    text: 'cmsTemplateContextRead is consumed by the protected `CmsTemplateDesigner`, `CmsTemplateEditDesigner` and `CmsPatternVersionDesigner`, which load their picker options (active content types and supported blocks) from this same-origin no-store GET before enabling the form, disable submission with the corresponding sign-in, capability, rate-wait or retry state when the context is missing, denied or degraded, and neither extend the general auth-session resource nor grant designer authority in the browser; verification covers each denied or degraded state and that the POST revalidates authority.',
    clauses: [
      {
        text: 'cmsTemplateContextRead is consumed by the protected `CmsTemplateDesigner`, `CmsTemplateEditDesigner` and `CmsPatternVersionDesigner`, which load their picker options (active content types and supported blocks) from this same-origin no-store GET before enabling the form, disable submission with the corresponding sign-in, capability, rate-wait or retry state when the context is missing, denied or degraded, and neither extend the general auth-session resource nor grant designer authority in the browser;',
        citations: [],
      },
      {
        text: 'verification covers each denied or degraded state and that the POST revalidates authority.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-165',
    text: "cmsTemplateLatestRead registers GET /api/v1/cms/templates/{templateKey} with `TemplateLatestQuery` (path) and returns the strict `TemplateVersionDetail` of the caller owner's latest version of the key: the `TemplateVersionResource` plus `slots`, `bindings`, `locale` and `audience`, with no owner or authority field; generated OpenAPI and the discovered Hono route match the registry row.",
    clauses: [
      {
        text: "cmsTemplateLatestRead registers GET /api/v1/cms/templates/{templateKey} with `TemplateLatestQuery` (path) and returns the strict `TemplateVersionDetail` of the caller owner's latest version of the key: the `TemplateVersionResource` plus `slots`, `bindings`, `locale` and `audience`, with no owner or authority field;",
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-166',
    text: "cmsTemplateLatestRead accepts only a path `templateKey` that matches the template grammar and is not a reserved key (`context`, `versions`, `new`), resolves it only within the caller's owner scope, rejects a body, `Idempotency-Key` and `If-Match`, and answers a hidden or absent key with the same 404.",
    clauses: [
      {
        text: "cmsTemplateLatestRead accepts only a path `templateKey` that matches the template grammar and is not a reserved key (`context`, `versions`, `new`), resolves it only within the caller's owner scope, rejects a body, `Idempotency-Key` and `If-Match`, and answers a hidden or absent key with the same 404.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-167',
    text: "cmsTemplateLatestRead serves only `cms.template_designer` in the caller's owner scope (a caller without the capability is 403), resolves the key only within that scope so that a key held by another owner is the same 404 as an unused key, and serializes no owner or authority field.",
    clauses: [
      {
        text: "cmsTemplateLatestRead serves only `cms.template_designer` in the caller's owner scope (a caller without the capability is 403), resolves the key only within that scope so that a key held by another owner is the same 404 as an unused key, and serializes no owner or authority field.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-168',
    text: 'cmsTemplateLatestRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match`, carries the strong ETag `"{version}"` of the returned version, and enforces read buckets of 60/min/user and 60/min/party, a 15,000 ms deadline and the Tier 2 target.',
    clauses: [
      {
        text: 'cmsTemplateLatestRead is a no-store, read-only call that accepts neither `Idempotency-Key` nor `If-Match`, carries the strong ETag `"{version}"` of the returned version, and enforces read buckets of 60/min/user and 60/min/party, a 15,000 ms deadline and the Tier 2 target.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-169',
    text: 'cmsTemplateLatestRead maps a malformed path (400 `INVALID_REQUEST`), a missing session (401), a missing capability (403 `TEMPLATE_FORBIDDEN`), a hidden or absent key (404 `TEMPLATE_NOT_FOUND`), an unsupported body (415), the read limit (429), a dependency failure (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.template.v1`, and as a safe read retries at most three times at 15 s, 60 s and 300 s with jitter.',
    clauses: [
      {
        text: 'cmsTemplateLatestRead maps a malformed path (400 `INVALID_REQUEST`), a missing session (401), a missing capability (403 `TEMPLATE_FORBIDDEN`), a hidden or absent key (404 `TEMPLATE_NOT_FOUND`), an unsupported body (415), the read limit (429), a dependency failure (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.template.v1`, and as a safe read retries at most three times at 15 s, 60 s and 300 s with jitter.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-170',
    text: "cmsTemplateLatestRead is consumed by the protected `CmsTemplateEditDesigner` at `/app/cms-content-modeling/templates/:templateKey`, which prefills the form from the owner's latest version, sends its `version` as `expectedVersion` to create a successor through CMS-03C-01, reconciles a 409 by refetching this read, reuses the idempotency key for an unchanged uncertain attempt, and never resolves `context`, `versions` or `new` as a template key; verification covers the prefill, the successor `expectedVersion`, the 409 reconciliation and the 403/404 split.",
    clauses: [
      {
        text: "cmsTemplateLatestRead is consumed by the protected `CmsTemplateEditDesigner` at `/app/cms-content-modeling/templates/:templateKey`, which prefills the form from the owner's latest version, sends its `version` as `expectedVersion` to create a successor through CMS-03C-01, reconciles a 409 by refetching this read, reuses the idempotency key for an unchanged uncertain attempt, and never resolves `context`, `versions` or `new` as a template key;",
        citations: [],
      },
      {
        text: 'verification covers the prefill, the successor `expectedVersion`, the 409 reconciliation and the 403/404 split.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-171',
    text: "cmsPatternLatestRead registers GET /api/v1/cms/patterns/{patternKey} with `PatternLatestQuery` (path) and returns the strict `PatternVersionDetail` of the caller owner's latest version of the key in any state: the `PatternVersionResource` plus the `blockTree` of 1-32 root nodes; generated OpenAPI and the discovered Hono route match the registry row.",
    clauses: [
      {
        text: "cmsPatternLatestRead registers GET /api/v1/cms/patterns/{patternKey} with `PatternLatestQuery` (path) and returns the strict `PatternVersionDetail` of the caller owner's latest version of the key in any state: the `PatternVersionResource` plus the `blockTree` of 1-32 root nodes;",
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-176',
    text: "cmsPatternLatestRead is consumed by the protected `CmsPatternVersionDesigner` and `CmsGovernedReviewPanel` at `/app/cms-content-modeling/patterns/:patternKey`, which address the owner's latest version by key, prefill the node list from it, send the read version as `expectedVersion` for a successor and show the version's lifecycle; verification covers the prefill, the successor `expectedVersion`, the 403/404 split and that the reserved keys never resolve as `:patternKey`.",
    clauses: [
      {
        text: "cmsPatternLatestRead is consumed by the protected `CmsPatternVersionDesigner` and `CmsGovernedReviewPanel` at `/app/cms-content-modeling/patterns/:patternKey`, which address the owner's latest version by key, prefill the node list from it, send the read version as `expectedVersion` for a successor and show the version's lifecycle;",
        citations: [],
      },
      {
        text: 'verification covers the prefill, the successor `expectedVersion`, the 403/404 split and that the reserved keys never resolve as `:patternKey`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-177',
    text: 'cmsTaxonomyVersionsRead registers GET /api/v1/cms/taxonomies/{taxonomyId}/versions with `TaxonomyVersionsQuery` (path) and returns the strict `TaxonomyVersionsPage` of at most 50 `TaxonomyVersionResource` items, newest first, and `pageVersion`; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'cmsTaxonomyVersionsRead registers GET /api/v1/cms/taxonomies/{taxonomyId}/versions with `TaxonomyVersionsQuery` (path) and returns the strict `TaxonomyVersionsPage` of at most 50 `TaxonomyVersionResource` items, newest first, and `pageVersion`;',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-182',
    text: "cmsTaxonomyVersionsRead is consumed by the protected `CmsTaxonomyVersionDesigner` and `CmsGovernedReviewPanel` at `/app/cms-content-modeling/taxonomies/:taxonomyId`, which read the vocabulary's versions (newest first, at most 50) to show each version's lifecycle, review summary and permitted actions, while term actions render only against an `active` version and `taxonomy_not_active` links to the vocabulary's governed review; verification covers the 403/404 split, the 50-version bound and the active-version gating of term actions.",
    clauses: [
      {
        text: "cmsTaxonomyVersionsRead is consumed by the protected `CmsTaxonomyVersionDesigner` and `CmsGovernedReviewPanel` at `/app/cms-content-modeling/taxonomies/:taxonomyId`, which read the vocabulary's versions (newest first, at most 50) to show each version's lifecycle, review summary and permitted actions, while term actions render only against an `active` version and `taxonomy_not_active` links to the vocabulary's governed review;",
        citations: [],
      },
      {
        text: 'verification covers the 403/404 split, the 50-version bound and the active-version gating of term actions.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-188',
    text: "cmsTaxonomyTermsRead is consumed by the protected `CmsTaxonomyTermForm`, which lists the vocabulary's terms with their lifecycle, keeps the term list cursor as URL state without serializing a protected value, shows a merged term's survivor redirect, renders `canonical_overlap` as \"This matches a canonical {domain} record. Reference the canonical record instead\" with the canonical id as copyable text and never creates the term, and links `taxonomy_not_active` to the vocabulary's governed review; verification covers term keyset order, cursor binding and merged terms listed with their successor.",
    clauses: [
      {
        text: "cmsTaxonomyTermsRead is consumed by the protected `CmsTaxonomyTermForm`, which lists the vocabulary's terms with their lifecycle, keeps the term list cursor as URL state without serializing a protected value, shows a merged term's survivor redirect, renders `canonical_overlap` as \"This matches a canonical {domain} record.",
        citations: [],
      },
      {
        text: 'Reference the canonical record instead" with the canonical id as copyable text and never creates the term, and links `taxonomy_not_active` to the vocabulary\'s governed review;',
        citations: [],
      },
      {
        text: 'verification covers term keyset order, cursor binding and merged terms listed with their successor.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-191',
    text: "Lineage ids: `templateId`, `patternId` and `taxonomyId` are the stable lineage ids of (owner, key), the `id` of the version-1 row carried on every successor row as `template_id`, `pattern_id` and `taxonomy_id`; a version number is unique within its lineage, a successor names its parent through `supersedes_id`, and a partial unique index on each lineage id `WHERE state = 'active'` allows one active version per lineage.",
    clauses: [
      {
        text: 'Lineage ids: `templateId`, `patternId` and `taxonomyId` are the stable lineage ids of (owner, key), the `id` of the version-1 row carried on every successor row as `template_id`, `pattern_id` and `taxonomy_id`;',
        citations: [],
      },
      {
        text: "a version number is unique within its lineage, a successor names its parent through `supersedes_id`, and a partial unique index on each lineage id `WHERE state = 'active'` allows one active version per lineage.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-193',
    text: 'blockRegistryDigest: the server resolves every reachable block from the 03a safe registry and computes the lowercase SHA-256 of the RFC 8785/JCS array of the reachable, deduplicated `{blockKey,blockVersion,releaseDigest,propsSchemaHash,rendererRef,lifecycle}` tuples sorted by the UTF-8 bytes of `blockKey` and then numeric `blockVersion`; a client-supplied digest is only an equality expectation, compared with the server result and never stored in place of it, so the recomputed server digest is authoritative; and the server recomputes the digest at template create, template activate, pattern create, pattern activate and 03b publication preflight.',
    clauses: [
      {
        text: 'blockRegistryDigest: the server resolves every reachable block from the 03a safe registry and computes the lowercase SHA-256 of the RFC 8785/JCS array of the reachable, deduplicated `{blockKey,blockVersion,releaseDigest,propsSchemaHash,rendererRef,lifecycle}` tuples sorted by the UTF-8 bytes of `blockKey` and then numeric `blockVersion`;',
        citations: [],
      },
      {
        text: 'a client-supplied digest is only an equality expectation, compared with the server result and never stored in place of it, so the recomputed server digest is authoritative;',
        citations: [],
      },
      {
        text: 'and the server recomputes the digest at template create, template activate, pattern create, pattern activate and 03b publication preflight.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-196',
    text: 'Governed review tables: CMS-03C-06 to CMS-03C-11 serve the closed, code-owned `subject_kind` set (`template_version`, `pattern_version`, `taxonomy_version`) through one set of private tables keyed by `(subject_kind, subject_id)` (`cms_governed_reviews`, `cms_governed_review_decisions`, `cms_governed_review_assignments`, `cms_governed_review_dependencies` and, for scheduled activation, `cms_governed_activation_schedules`) so that slot semantics, MFA, assignment, strictest-policy counting and invalidation have one implementation; a later subject kind is added only by forward migration; and the 03a `cms_schema_reviews` set and the 03b editorial review tables keep their own tables and operations.',
    clauses: [
      {
        text: 'Governed review tables: CMS-03C-06 to CMS-03C-11 serve the closed, code-owned `subject_kind` set (`template_version`, `pattern_version`, `taxonomy_version`) through one set of private tables keyed by `(subject_kind, subject_id)` (`cms_governed_reviews`, `cms_governed_review_decisions`, `cms_governed_review_assignments`, `cms_governed_review_dependencies` and, for scheduled activation, `cms_governed_activation_schedules`) so that slot semantics, MFA, assignment, strictest-policy counting and invalidation have one implementation;',
        citations: [],
      },
      {
        text: 'a later subject kind is added only by forward migration;',
        citations: [],
      },
      {
        text: 'and the 03a `cms_schema_reviews` set and the 03b editorial review tables keep their own tables and operations.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-197',
    text: 'Subject state machine: `draft` becomes `review` at submission and `review` becomes `approved` when the last required approval lands; a rejection or invalidation returns the subject from `review` (or from `approved`, `scheduled` or `blocked`) to `draft` through an audited transition while the review stays `rejected` or `invalidated`; `approved` becomes `active` or `scheduled`; `scheduled` becomes `active` at execution or `blocked` when execution fails terminally; `blocked` becomes `active` or `scheduled` through a new activation command while its review is still `approved` and current; `active` becomes `superseded` in the transaction that activates a newer version of the lineage, or `retired`; `superseded` and `retired` are terminal; and the review states are `open` to `approved`, `rejected` or `invalidated` and `approved` to `invalidated`, with assignment create and revoke never changing the review state.',
    clauses: [
      {
        text: 'Subject state machine: `draft` becomes `review` at submission and `review` becomes `approved` when the last required approval lands;',
        citations: [],
      },
      {
        text: 'a rejection or invalidation returns the subject from `review` (or from `approved`, `scheduled` or `blocked`) to `draft` through an audited transition while the review stays `rejected` or `invalidated`;',
        citations: [],
      },
      { text: '`approved` becomes `active` or `scheduled`;', citations: [] },
      {
        text: '`scheduled` becomes `active` at execution or `blocked` when execution fails terminally;',
        citations: [],
      },
      {
        text: '`blocked` becomes `active` or `scheduled` through a new activation command while its review is still `approved` and current;',
        citations: [],
      },
      {
        text: '`active` becomes `superseded` in the transaction that activates a newer version of the lineage, or `retired`;',
        citations: [],
      },
      { text: '`superseded` and `retired` are terminal;', citations: [] },
      {
        text: 'and the review states are `open` to `approved`, `rejected` or `invalidated` and `approved` to `invalidated`, with assignment create and revoke never changing the review state.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-198',
    text: "Governed policy basis: the review count and slots are the strictest DEC-110 workflow policy among the content types the subject is bound to (a template or pattern version's `compatibleTypeIds`; for a taxonomy version the content types of the caller's owner scope whose keys appear in `allowedTypeKeys`), each resolved through the fail-closed `cms_editorial_workflow_policy_evidence` seam; the basis is the array of `{ contentTypeId, policyKey, policyVersion, policyHash }` sorted by `(policyKey, policyVersion, contentTypeId)`; `risk_class` is `protected` if any member is protected, `required_decision_count` is the largest member count and `required_capabilities` is the base slot `cms.reviewer` followed by each specialist capability in order of first appearance (at most 16); a subject with no resolvable bound type uses the registry member `editorial.default` version 1 (`CMS_GOVERNED_DEFAULT_POLICY`); and `policy_basis_hash` is the lowercase SHA-256 of the JCS basis array.",
    clauses: [
      {
        text: "Governed policy basis: the review count and slots are the strictest DEC-110 workflow policy among the content types the subject is bound to (a template or pattern version's `compatibleTypeIds`; for a taxonomy version the content types of the caller's owner scope whose keys appear in `allowedTypeKeys`), each resolved through the fail-closed `cms_editorial_workflow_policy_evidence` seam;",
        citations: [],
      },
      {
        text: 'the basis is the array of `{ contentTypeId, policyKey, policyVersion, policyHash }` sorted by `(policyKey, policyVersion, contentTypeId)`;',
        citations: [],
      },
      {
        text: '`risk_class` is `protected` if any member is protected, `required_decision_count` is the largest member count and `required_capabilities` is the base slot `cms.reviewer` followed by each specialist capability in order of first appearance (at most 16);',
        citations: [],
      },
      {
        text: 'a subject with no resolvable bound type uses the registry member `editorial.default` version 1 (`CMS_GOVERNED_DEFAULT_POLICY`);',
        citations: [],
      },
      {
        text: 'and `policy_basis_hash` is the lowercase SHA-256 of the JCS basis array.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-202',
    text: 'Governed review invalidation producers: the consumers of `cms.block.lifecycle.changed.v1` (a withdrawn block), `cms.schema.activated.v1` (a changed bound policy or type version) and `cms.pattern.activated.v1`, and the capability-grant revocation transaction, enqueue the idempotent job `cms.governed_review.recheck` (a typed platform-queue message, DEC-166), which selects live reviews through `cms_governed_review_dependencies (review_id, kind, ref_id)` of kind `block`, `pattern`, `content_type` or `canonical_domain`.',
    clauses: [
      {
        text: 'Governed review invalidation producers: the consumers of `cms.block.lifecycle.changed.v1` (a withdrawn block), `cms.schema.activated.v1` (a changed bound policy or type version) and `cms.pattern.activated.v1`, and the capability-grant revocation transaction, enqueue the idempotent job `cms.governed_review.recheck` (a typed platform-queue message, DEC-166), which selects live reviews through `cms_governed_review_dependencies (review_id, kind, ref_id)` of kind `block`, `pattern`, `content_type` or `canonical_domain`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-203',
    text: 'Governed review recheck: the job `cms.governed_review.recheck` (`cms_recheck_governed_reviews(kind, ref_id, batch)`) handles at most 500 reviews per run with a continuation cursor, is idempotent (an already `invalidated` review is skipped), rebuilds the hash, policy basis and identities of each live review and invalidates on any difference with the closed reason `dependency_changed` or `reviewer_authority_changed`, returning the subject to `draft` and, while the subject is `scheduled`, cancelling its schedule (`cancelled`, `approval_invalidated`) in the invalidating transaction; governed review state changes emit no event in Phase 2.',
    clauses: [
      {
        text: 'Governed review recheck: the job `cms.governed_review.recheck` (`cms_recheck_governed_reviews(kind, ref_id, batch)`) handles at most 500 reviews per run with a continuation cursor, is idempotent (an already `invalidated` review is skipped), rebuilds the hash, policy basis and identities of each live review and invalidates on any difference with the closed reason `dependency_changed` or `reviewer_authority_changed`, returning the subject to `draft` and, while the subject is `scheduled`, cancelling its schedule (`cancelled`, `approval_invalidated`) in the invalidating transaction;',
        citations: [],
      },
      {
        text: 'governed review state changes emit no event in Phase 2.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-205',
    text: "Immediate activation: `activate` requires the subject `approved` or `blocked` (else 409 `subject_not_activatable`) and in one transaction makes it `active` (`version` + 1, `activated_at`), makes the lineage's previous `active` version `superseded` (`version` + 1), records `activated_at` on the review and advances its `version`, and commits the audit record and exactly one activation event; an activation that loses a race on the lineage is 409 `activation_conflict` and nothing commits.",
    clauses: [
      {
        text: "Immediate activation: `activate` requires the subject `approved` or `blocked` (else 409 `subject_not_activatable`) and in one transaction makes it `active` (`version` + 1, `activated_at`), makes the lineage's previous `active` version `superseded` (`version` + 1), records `activated_at` on the review and advances its `version`, and commits the audit record and exactly one activation event;",
        citations: [],
      },
      {
        text: 'an activation that loses a race on the lineage is 409 `activation_conflict` and nothing commits.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-207',
    text: 'Retirement: `retire` requires the subject `active` (else 409 `subject_not_retirable`) and needs no review, makes it `retired`, emits the same event type naming the retired version, and a retired version fails the 03b `template` preflight and the 03a compatibility resolver as `WITHDRAWN`.',
    clauses: [
      {
        text: 'Retirement: `retire` requires the subject `active` (else 409 `subject_not_retirable`) and needs no review, makes it `retired`, emits the same event type naming the retired version, and a retired version fails the 03b `template` preflight and the 03a compatibility resolver as `WITHDRAWN`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-211',
    text: 'Pattern graph: a pattern tree is a bounded forest of depth at most 8 and at most 512 nodes after expanding nested pattern references, with unique sibling node `key`s, no cycle through a nested lineage (the visited set is the lineage `pattern_id`) and every nested pattern `active` and listing every `compatibleTypeIds` member of the new pattern; a violation is typed (422 `pattern_depth_exceeded`, `pattern_nodes_exceeded` and `nested_pattern_not_active`; 409 `pattern_cycle`), is refused before save and again before publish, and `node_count` stores the expanded count.',
    clauses: [
      {
        text: 'Pattern graph: a pattern tree is a bounded forest of depth at most 8 and at most 512 nodes after expanding nested pattern references, with unique sibling node `key`s, no cycle through a nested lineage (the visited set is the lineage `pattern_id`) and every nested pattern `active` and listing every `compatibleTypeIds` member of the new pattern;',
        citations: [],
      },
      {
        text: 'a violation is typed (422 `pattern_depth_exceeded`, `pattern_nodes_exceeded` and `nested_pattern_not_active`; 409 `pattern_cycle`), is refused before save and again before publish, and `node_count` stores the expanded count.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
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
    limitation: 'No test is cited for this criterion yet.',
  },
];
