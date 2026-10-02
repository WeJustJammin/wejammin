import {
  ContentSchemaRegistryDetailSchema,
  SchemaDryRunResourceSchema,
  SchemaReviewAssignmentResourceSchema,
  SchemaReviewDecisionResourceSchema,
  SchemaReviewResourceSchema,
  type SchemaActivationPreparation,
  type SchemaDryRunResource,
  type SchemaReviewAssignmentResource,
  type SchemaReviewDecisionResource,
  type SchemaReviewResource,
} from '@wejammin/contracts';
import { vi } from 'vitest';

import { forwardContentSchemaRegistryMutation } from '../../server/content-schema-registry-platform-api';
import type { ContentSchemaRegistryDetail } from '../../server/content-schema-registry-contracts';
import { detail as baseDetail } from './content-schema-registry-server-test-values';
import { emptyActivationPreparation } from './content-schema-registry-activation-preparation.test-support';

/**
 * Shared DEC-108 (Slice 09) web RED support. Identifiers share no prefix or
 * suffix with each other so the island privacy scan can assert on raw, hashed
 * and truncated forms without colliding with legitimate record identifiers.
 */

export const ACTOR_ID = '5a1c9e2b-4d37-7f08-9b6e-c01d2a3f4e51';
export const PARTY_ID = 'b7e402d9-81aa-7c35-a4f0-9d6e18b2c370';
export const REVIEWER_PERSON_ID = 'e93d70f1-26c8-7a4b-8e15-3fa09c7d2b64';
export const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
export const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
export const REVIEW_ID = '3c7a51e8-9f24-7b60-8d13-a5e4c2f09b78';
export const DRY_RUN_ID = '7d2a96c1-3e58-7b04-8f61-d09a4e25c7b3';
export const JOB_ID = '2f8e41b7-d6a3-7c92-9e50-b1c74a08d3f6';
export const ATTEMPT_ID = '9a6b30d4-17ce-7e85-a2f9-48d1b05c6e72';
export const PLAN_ID = '61f5c8a2-b04d-7936-8c7e-e3a290d4f1b5';
export const APPROVE_A_ID = 'a40d7e93-5b18-7c26-9d4f-6e82c1b39f07';
export const APPROVE_B_ID = 'd81f2b60-c95a-7e43-b027-5a3d9f6e1c84';
export const REJECT_ID = 'f26c9d15-7a03-7b81-a6e4-0c58d3b72e19';
export const ASSIGNMENT_ID = '8e5b04f7-2d91-7a6c-b3d8-1f70c4a95e26';
export const REQUEST_ID = '6a3173d9-f113-4aa4-91c3-3fbc137ea258';
export const HASH = 'e'.repeat(64);
export const HASH_B = 'd'.repeat(64);
export const INSTANT = '2026-10-02T12:00:00.000Z';

export const REVIEW_PATH = `/app/cms-content-modeling/schema-reviews/${REVIEW_ID}`;
export const VERSION_PATH = `/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}`;

const meta = (id: string, version = '1') => ({
  id,
  version,
  contentHash: HASH,
  createdAt: INSTANT,
  updatedAt: INSTANT,
});

/** CMS-03A-10 resource, parsed through the generated strict contract. */
export const dryRunResource = (
  overrides: Record<string, unknown> = {},
): SchemaDryRunResource =>
  SchemaDryRunResourceSchema.parse({
    ...meta(DRY_RUN_ID),
    resourceKind: 'schema_dry_run',
    state: 'queued',
    contentTypeVersionId: VERSION_ID,
    classification: 'additive',
    attemptId: ATTEMPT_ID,
    jobId: JOB_ID,
    migrationPlanId: PLAN_ID,
    compilerVersion: 'compiler-1',
    transformKey: null,
    transformVersion: null,
    result: null,
    failureCode: null,
    sourceCount: null,
    targetCount: null,
    rowErrorCount: null,
    sourceHash: null,
    targetHash: null,
    reportHash: null,
    ...overrides,
  });

const frozenEvidence = {
  contentTypeVersionId: VERSION_ID,
  contentTypeVersionNo: '2',
  definitionHash: HASH,
  localeConfigHash: HASH,
  schemaArtifact: {
    id: ATTEMPT_ID,
    state: 'compiled',
    compilerVersion: 'compiler-1',
    zodContractRef: 'cms/release_notes/v2',
    artifactHash: HASH_B,
  },
  dependencyManifestHash: HASH,
  dryRun: {
    id: DRY_RUN_ID,
    state: 'completed',
    result: 'passed',
    reportHash: HASH_B,
  },
} as const;

export const approveDecision = (id: string) => ({
  id,
  decision: 'approve' as const,
  capability: 'cms.schema_review',
  decidedAt: INSTANT,
});

export const rejectDecision = (id: string) => ({
  id,
  decision: 'reject' as const,
  capability: 'cms.schema_review',
  decidedAt: INSTANT,
});

/** CMS-03A-13 resource (an open ordinary review unless overridden). */
export const reviewResource = (
  overrides: Record<string, unknown> = {},
): SchemaReviewResource =>
  SchemaReviewResourceSchema.parse({
    ...meta(REVIEW_ID, '3'),
    resourceKind: 'schema_review',
    state: 'open',
    contentTypeId: TYPE_ID,
    contentTypeVersionId: VERSION_ID,
    contentTypeVersionNo: '2',
    riskClass: 'ordinary',
    requiredDecisionCount: 1,
    requiredCapabilities: ['cms.schema_review'],
    distinctApprovalCount: 0,
    recordedDecisionCount: 0,
    frozenEvidence,
    dryRunId: DRY_RUN_ID,
    policyKey: 'cms.standard',
    policyVersion: '1',
    policyHash: HASH,
    approvalEvidenceHash: null,
    submittedAt: INSTANT,
    decidedAt: null,
    decisions: [],
    permittedNextActions: ['record_decision'],
    ...overrides,
  });

/** Approved two-decision (protected) review: approve ids are not typed. */
export const approvedProtectedReview = (): SchemaReviewResource =>
  reviewResource({
    state: 'approved',
    riskClass: 'protected',
    requiredDecisionCount: 2,
    distinctApprovalCount: 2,
    recordedDecisionCount: 2,
    approvalEvidenceHash: HASH_B,
    decidedAt: INSTANT,
    decisions: [approveDecision(APPROVE_A_ID), approveDecision(APPROVE_B_ID)],
    permittedNextActions: ['activate'],
  });

export const decisionResource = (
  decision: 'approve' | 'reject' = 'approve',
): SchemaReviewDecisionResource =>
  SchemaReviewDecisionResourceSchema.parse({
    ...meta(APPROVE_A_ID),
    resourceKind: 'schema_review_decision',
    reviewId: REVIEW_ID,
    decision,
    capability: 'cms.schema_review',
    decidedAt: INSTANT,
  });

export const assignmentResource = (
  state: 'active' | 'revoked' = 'active',
): SchemaReviewAssignmentResource =>
  SchemaReviewAssignmentResourceSchema.parse({
    ...meta(ASSIGNMENT_ID),
    resourceKind: 'schema_review_assignment',
    reviewId: REVIEW_ID,
    state,
    capability: 'cms.schema_review',
    actions: ['read', 'decide'],
    startsAt: INSTANT,
    expiresAt: '2026-10-09T12:00:00.000Z',
    reason: null,
  });

/** A parsed CMS-03A-07 detail for a draft candidate. */
export const draftDetail = (
  preparation: SchemaActivationPreparation = emptyActivationPreparation,
  resourceOverrides: Record<string, unknown> = {},
): ContentSchemaRegistryDetail =>
  ContentSchemaRegistryDetailSchema.parse({
    ...baseDetail,
    resource: {
      ...baseDetail.resource,
      state: 'draft',
      version: '4',
      activationEvidence: null,
      ...resourceOverrides,
    },
    activationPreparation: preparation,
  });

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

const rotr = (value: number, bits: number): number =>
  (value >>> bits) | (value << (32 - bits));

/**
 * Synchronous SHA-256 hex digest. The web test tsconfig has no Node typings
 * (only a `node:fs`/`node:url` shim), so the privacy scan computes the hashed
 * spellings of a private identifier itself; `fixtures.test.ts` pins it to the
 * published test vector.
 */
export const sha256 = (value: string): string => {
  const bytes = [...new TextEncoder().encode(value)];
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let shift = 56; shift >= 0; shift -= 8)
    bytes.push(Math.floor(bitLength / 2 ** shift) & 0xff);
  const state = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = new Array<number>(64).fill(0);
    for (let index = 0; index < 16; index += 1)
      words[index] =
        ((bytes[offset + index * 4] ?? 0) << 24) |
        ((bytes[offset + index * 4 + 1] ?? 0) << 16) |
        ((bytes[offset + index * 4 + 2] ?? 0) << 8) |
        (bytes[offset + index * 4 + 3] ?? 0);
    for (let index = 16; index < 64; index += 1) {
      const w15 = words[index - 15] ?? 0;
      const w2 = words[index - 2] ?? 0;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      words[index] =
        ((words[index - 16] ?? 0) + s0 + (words[index - 7] ?? 0) + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = state as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const choose = (e & f) ^ (~e & g);
      const t1 =
        (h + s1 + choose + (SHA256_K[index] ?? 0) + (words[index] ?? 0)) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + majority) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, h].forEach((word, index) => {
      state[index] = ((state[index] ?? 0) + word) | 0;
    });
  }
  return state
    .map((word) => (word >>> 0).toString(16).padStart(8, '0'))
    .join('');
};

/** Typed target for the widened DEC-108 mutation facade (CMS-03A-09..14). */
export type Dec108OperationId =
  | 'CMS-03A-04'
  | 'CMS-03A-09'
  | 'CMS-03A-10'
  | 'CMS-03A-11'
  | 'CMS-03A-12'
  | 'CMS-03A-14';

export interface Dec108Target {
  readonly operationId: Dec108OperationId;
  readonly contentTypeId?: string;
  readonly versionId?: string;
  readonly reviewId?: string;
}

/**
 * The shipped facade type only admits CMS-03A-01..04. DEC-108 widens the
 * target union (version-scoped 09..11, review-scoped 12/14); this is the typed
 * contract the tests require, so the narrowing cast disappears with GREEN.
 */
export const forward = forwardContentSchemaRegistryMutation as unknown as (
  request: Request,
  binding: unknown,
  target: Dec108Target,
) => Promise<Response>;

export const mutationOrigin = 'https://app.test';

export interface FacadeCall {
  readonly target: Dec108Target;
  readonly payload?: unknown;
  readonly form?: Readonly<Record<string, string>>;
  readonly headers?: Readonly<Record<string, string | null>>;
  readonly upstream: {
    readonly status: number;
    readonly body: unknown;
    readonly headers?: Readonly<Record<string, string>>;
  };
}

export interface FacadeResult {
  readonly response: Response;
  readonly fetch: ReturnType<typeof vi.fn>;
  readonly forwarded: Request | null;
  readonly forwardedBody: unknown;
}

const defaultHeaders: Record<string, string> = {
  cookie: 'wj_access=session; wj_csrf=csrf; tracking=omit',
  origin: mutationOrigin,
  'x-request-id': REQUEST_ID,
  'x-csrf-token': 'csrf',
  'idempotency-key': 'cms-operation-12345',
  'if-match': '"4"',
};

/** Drive the browser mutation facade against one scripted private upstream. */
export const callFacade = async (input: FacadeCall): Promise<FacadeResult> => {
  let forwarded: Request | null = null;
  let forwardedBody: unknown = null;
  const fetch = vi.fn(async (value: RequestInfo | URL) => {
    forwarded = value instanceof Request ? value : new Request(value);
    forwardedBody = JSON.parse(await forwarded.clone().text()) as unknown;
    return new Response(JSON.stringify(input.upstream.body), {
      status: input.upstream.status,
      headers: {
        'content-type': 'application/json',
        ...input.upstream.headers,
      },
    });
  });
  const headers = new Headers();
  for (const [name, value] of Object.entries({
    ...defaultHeaders,
    ...input.headers,
  }))
    if (value !== null) headers.set(name, value);
  const json = input.form === undefined;
  headers.set(
    'content-type',
    json ? 'application/json' : 'application/x-www-form-urlencoded',
  );
  const request = new Request(`${mutationOrigin}${VERSION_PATH}`, {
    method: 'POST',
    headers,
    body: json
      ? JSON.stringify(input.payload)
      : new URLSearchParams(input.form as Record<string, string>),
  });
  const response = await forward(request, { fetch }, input.target);
  return { response, fetch, forwarded, forwardedBody };
};

export const versionTarget = (
  operationId: 'CMS-03A-04' | 'CMS-03A-09' | 'CMS-03A-10' | 'CMS-03A-11',
): Dec108Target => ({
  operationId,
  contentTypeId: TYPE_ID,
  versionId: VERSION_ID,
});

export const reviewTarget = (
  operationId: 'CMS-03A-12' | 'CMS-03A-14',
): Dec108Target => ({ operationId, reviewId: REVIEW_ID });

/** A private-service ApiError body, as the platform emits it. */
export const apiError = (code: string, details = {}, message = 'Refused.') =>
  ({ code, details, message, requestId: REQUEST_ID }) as const;
