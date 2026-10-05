/**
 * BE03a CMS-03A-09..18 success-path evidence: the registry success status, the
 * strict contract resource, the mutation response headers and the absence of
 * private identifiers, through the real Hono app with faked ports.
 */
import {
  CmsCapabilityGrantListPageSchema,
  CmsCapabilityGrantResourceSchema,
  ContentTypeVersionResourceSchema,
  SchemaDryRunResourceSchema,
  SchemaReviewAssignmentResourceSchema,
  SchemaReviewDecisionResourceSchema,
  SchemaReviewResourceSchema,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  PARTY_ID,
  REQUEST_ID,
  TYPE_ID,
  USER_ID,
  ok,
} from './phase-02-slice-09-test-values';
import {
  ACTING_CONTEXT_ID,
  REVIEWER_PERSON_ID,
  assignmentRevoked,
} from './phase-02-slice-09-dec108-test-values';
import {
  calledPorts,
  harnessFor,
  opFor,
  requestFor,
  type EvidenceOperationId,
} from './phase-02-slice-09-be03a-evidence-support';

type Schema = Readonly<{ parse: (value: unknown) => unknown }>;
type HappyCase = Readonly<{
  marker: string;
  operationId: EvidenceOperationId;
  title: string;
  status: number;
  schema: Schema;
  state?: string;
  body?: Record<string, unknown>;
  output?: unknown;
}>;

const HAPPY: readonly HappyCase[] = [
  {
    marker: '[P2-S09-AC-284]',
    operationId: 'CMS-03A-09',
    title:
      'accepts SchemaSuccessorRequest and returns 201 ContentTypeVersionResource for a fresh draft',
    status: 201,
    schema: ContentTypeVersionResourceSchema,
    state: 'draft',
  },
  {
    marker: '[P2-S09-AC-316]',
    operationId: 'CMS-03A-10',
    title:
      'accepts SchemaDryRunRequest and returns 202 SchemaDryRunResource in a queued state with a job reference',
    status: 202,
    schema: SchemaDryRunResourceSchema,
    state: 'queued',
  },
  {
    marker: '[P2-S09-AC-362] [P2-S09-AC-375]',
    operationId: 'CMS-03A-11',
    title:
      'accepts SchemaReviewSubmissionRequest and returns 201 SchemaReviewResource in state open',
    status: 201,
    schema: SchemaReviewResourceSchema,
    state: 'open',
  },
  {
    marker: '[P2-S09-AC-404]',
    operationId: 'CMS-03A-12',
    title:
      'accepts SchemaReviewDecisionRequest and returns 201 SchemaReviewDecisionResource',
    status: 201,
    schema: SchemaReviewDecisionResourceSchema,
  },
  {
    marker: '[P2-S09-AC-442]',
    operationId: 'CMS-03A-13',
    title: 'returns 200 SchemaReviewResource with Cache-Control no-store',
    status: 200,
    schema: SchemaReviewResourceSchema,
  },
  {
    marker: '[P2-S09-AC-464]',
    operationId: 'CMS-03A-14',
    title:
      'action create returns 201 SchemaReviewAssignmentResource for a bounded read and decide assignment',
    status: 201,
    schema: SchemaReviewAssignmentResourceSchema,
    state: 'active',
  },
  {
    marker: '[P2-S09-AC-465]',
    operationId: 'CMS-03A-14',
    title:
      'action revoke returns 200 SchemaReviewAssignmentResource for an existing assignment',
    status: 200,
    schema: SchemaReviewAssignmentResourceSchema,
    state: 'revoked',
    body: {
      action: 'revoke',
      expectedVersion: '1',
      assignmentId: 'a2000000-0000-4000-8000-0000000000a2',
    },
    output: assignmentRevoked,
  },
  {
    marker: '[P2-S09-AC-504]',
    operationId: 'CMS-03A-15',
    title:
      'returns 201 CmsCapabilityGrantResource for one subject and one capability',
    status: 201,
    schema: CmsCapabilityGrantResourceSchema,
    state: 'active',
  },
  {
    marker: '[P2-S09-AC-546]',
    operationId: 'CMS-03A-16',
    title: 'returns 200 CmsCapabilityGrantResource with a restarted term',
    status: 200,
    schema: CmsCapabilityGrantResourceSchema,
    state: 'active',
  },
  {
    marker: '[P2-S09-AC-575]',
    operationId: 'CMS-03A-17',
    title: 'returns 200 CmsCapabilityGrantResource in state revoked',
    status: 200,
    schema: CmsCapabilityGrantResourceSchema,
    state: 'revoked',
  },
  {
    marker: '[P2-S09-AC-603]',
    operationId: 'CMS-03A-18',
    title: 'returns 200 CmsCapabilityGrantListPage with Cache-Control no-store',
    status: 200,
    schema: CmsCapabilityGrantListPageSchema,
  },
];

describe('BE03a success status and strict contract resource', () => {
  it.each(HAPPY)(
    '$marker $operationId $title',
    async ({ operationId, status, schema, state, body, output }) => {
      const op = opFor(operationId);
      const harness = harnessFor(
        op,
        output === undefined ? {} : { port: ok(output) },
      );
      const response = await harness.app.request(
        requestFor(op, body === undefined ? {} : { body }),
      );
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
      const payload = (await response.json()) as Record<string, unknown>;
      expect(schema.parse(payload)).toEqual(payload);
      if (state !== undefined) expect(payload.state).toBe(state);
      expect(harness.ports[op.portName]).toHaveBeenCalledTimes(1);
      expect(harness.ports[op.portName]).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId,
          path: op.pathParams,
          ...(op.method === 'POST'
            ? {
                body: body ?? op.body,
                idempotencyKey:
                  'cms-' +
                  (op.family === 'review'
                    ? 'dec108-key-001'
                    : 'grant-key-0001'),
              }
            : {}),
        }),
        expect.any(AbortSignal),
      );
    },
  );
});

describe('BE03a CMS-03A-09 success headers', () => {
  it('[P2-S09-AC-293] CMS-03A-09 success returns ETag "<positive decimal version>", Location of the new draft, X-Request-Id and Cache-Control no-store', async () => {
    const op = opFor('CMS-03A-09');
    const draft = {
      ...(op.output as Record<string, unknown>),
      id: 'c0000000-0000-4000-8000-0000000000c0',
      version: '7',
    };
    const harness = harnessFor(op, {
      port: ok(ContentTypeVersionResourceSchema.parse(draft)),
    });
    const response = await harness.app.request(requestFor(op));
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"7"');
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/content-types/${TYPE_ID}/versions/c0000000-0000-4000-8000-0000000000c0`,
    );
    expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

const PRIVATE_IDS = [USER_ID, PARTY_ID, ACTING_CONTEXT_ID, REVIEWER_PERSON_ID];

describe('BE03a CMS-03A-09 response carries no private identifiers', () => {
  it('[P2-S09-AC-297] CMS-03A-09 response carries no actor, person, party or private acting-context binding identifier', async () => {
    const op = opFor('CMS-03A-09');
    const harness = harnessFor(op);
    const response = await harness.app.request(requestFor(op));
    const text = await response.text();
    for (const id of PRIVATE_IDS) expect(text).not.toContain(id);
    for (const [name, value] of response.headers.entries())
      for (const id of PRIVATE_IDS)
        expect(`${name}:${value}`).not.toContain(id);
    // A port that leaks an actor or binding identifier is refused, never forwarded.
    for (const leak of [
      { actorId: USER_ID },
      { actingPartyId: PARTY_ID },
      { actingContextId: ACTING_CONTEXT_ID },
      { ownerId: USER_ID },
    ]) {
      const leaking = harnessFor(op, {
        port: ok({ ...(op.output as object), ...leak }),
      });
      const refused = await leaking.app.request(requestFor(op));
      expect(refused.status).toBe(502);
      const leaked = await refused.text();
      for (const id of PRIVATE_IDS) expect(leaked).not.toContain(id);
      expect(calledPorts(leaking.ports)).toBe(1);
    }
  });
});
