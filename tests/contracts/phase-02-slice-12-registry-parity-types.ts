/*
 * Typed fixture shape of the Slice 12 browser route inventory (P2-S12-AC-275).
 *
 * Every operation is transcribed from one row of the BE03c "Route Registry" table
 * (`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`, SHA-256
 * c9bbea77...583d at transcription; row line numbers are cited per operation), its "Route field
 * validation matrix" row (parameters) and its "Contract and error matrix" row (error statuses).
 * The fixture is the spec's executable form: the platform registry, the generated OpenAPI and the
 * discovered Hono routes are all compared to it, never to each other alone.
 */

export type ErrorStatus =
  400 | 401 | 403 | 404 | 409 | 415 | 422 | 429 | 500 | 502 | 503 | 504;

/**
 * How the spec states the ETag of the success response.
 * `strong`: a strong entity tag (`"{version}"`). `page`: "ETag on page version".
 * `none`: the row says "no entity tag". `unstated`: the row is silent (no assertion is made).
 */
export type EtagPolicy = 'strong' | 'page' | 'none' | 'unstated';

export type SpecOperation = Readonly<{
  id: string;
  /** Route Registry row, as `BE03c L<line>`. */
  cite: string;
  method: 'GET' | 'POST';
  /** OpenAPI path form (`{param}`). */
  path: string;
  /** The "Request" column's schema name (a write body or a read query), or null for a path-only read. */
  request: string | null;
  /** The platform registry `requestSchema` that wraps `request` (`headers`, `path`, `query`, `body`). */
  apiRequest: string;
  /** The "success" column's resource schema, as a contracts export name. */
  success: string;
  successStatuses: readonly string[];
  authClass: string;
  capabilities?: readonly string[];
  /** Asserted only for a multi-capability row, where any_of versus all_of is a real difference. */
  capabilityMode?: 'any_of' | 'all_of';
  stepUp: 'none' | 'required';
  csrf: 'required' | 'none';
  idempotency: 'required' | 'none';
  ifMatch: 'required' | 'conditional' | 'none';
  rateClass: string;
  /** Per-minute quota per user and per acting party (Rate column). */
  user: number;
  party: number;
  timeoutMs: 8_000 | 15_000;
  /** SLO tier: Tier 1 p95 < 750 ms, Tier 2 p95 < 1,200 ms (BE00 performance gates). */
  tier: 1 | 2;
  etag: EtagPolicy;
  /** Declared error statuses, from the Contract and error matrix row (all three of 502/503/504 together). */
  errors: readonly ErrorStatus[];
  /** OpenAPI parameter summary `in:name` with `*` when required, in generated order. */
  params: readonly string[];
}>;

/** Contract and error matrix: every row can fail with these (the BE00 error envelope). */
export const ALL_ERRORS: readonly ErrorStatus[] = [
  400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504,
];

/** Bounded read rows: 409 and 422 are "not applicable to bounded read". */
export const BOUNDED_READ_ERRORS: readonly ErrorStatus[] = [
  400, 401, 403, 404, 415, 429, 500, 502, 503, 504,
];

export const OPERATION_PATH_PARAMETER_SAMPLES: Readonly<
  Record<string, string>
> = {
  taxonomyId: 'd1200000-0000-4000-8000-000000000001',
  entryId: 'd2000000-0000-4000-8000-000000000001',
  reviewId: 'd3000000-0000-4000-8000-000000000001',
  instanceId: 'd4000000-0000-4000-8000-000000000001',
  locale: 'fr-FR',
  templateKey: 'profile-header',
  patternKey: 'hero-pattern',
};

/** A concrete request path of an OpenAPI path template. */
export const concretePath = (path: string): string =>
  path.replace(/\{([^}]+)\}/gu, (_whole, name: string) => {
    const sample = OPERATION_PATH_PARAMETER_SAMPLES[name];
    if (sample === undefined) throw new Error(`No sample for {${name}}.`);
    return sample;
  });

/** The Hono form (`:param`) of an OpenAPI path template. */
export const honoPathOf = (path: string): string =>
  path.replace(/\{([^}]+)\}/gu, ':$1');
