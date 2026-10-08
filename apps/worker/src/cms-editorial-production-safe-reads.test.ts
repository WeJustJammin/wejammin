import { describe, it } from 'vitest';
import {
  REVISION_RESTORE_SEAMS,
  type RevisionRestoreVerification,
} from '@wejammin/contracts';

import {
  cmsEditorialResourcePort,
  cmsEditorialRestorePort,
} from './cms-editorial-production-ports';
import { validateCmsEditorialPortInput } from './cms-editorial-production-session-rpc-body';
import type { CmsEditorialPortInput } from './cms-editorial-production-session';
import {
  ENTRY_ID,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
  expect,
  portInput,
  revisionResource,
} from './cms-editorial-production.test-support';

/*
 * BE03b CMS-03B-04 and the Slice 10 safe reads CMS-03B-11..14: the production
 * adapter narrows every private RPC payload before a route can publish it and
 * refuses a port input that names a path, query, body, or validator its
 * operation does not carry. Each refusal is exercised beside the accepted shape
 * so the whole decision chain runs, not just its first disjunct.
 */

const CONFLICT_ID = '40000000-0000-4000-8000-0000000000c1';
const VERSION_ID = '50000000-0000-4000-8000-000000000005';
const CHAIN_ID = '60000000-0000-4000-8000-000000000006';
const SOURCE_SCHEMA_ID = '70000000-0000-4000-8000-000000000007';
const ACTIVE_SCHEMA_ID = '80000000-0000-4000-8000-000000000008';
const signal = (): AbortSignal => new AbortController().signal;

const verification: RevisionRestoreVerification = {
  request: {
    entryId: ENTRY_ID,
    revisionId: REQUEST_ID,
    migrationChainId: CHAIN_ID,
    expectedVersion: '3',
  },
  registry: {
    revisionId: REQUEST_ID,
    migrationChainId: CHAIN_ID,
    sourceSchemaVersionId: SOURCE_SCHEMA_ID,
    activeSchemaVersionId: ACTIVE_SCHEMA_ID,
    chainSchemaVersionIds: [SOURCE_SCHEMA_ID, ACTIVE_SCHEMA_ID],
    entryVersion: '3',
  },
  seams: [...REVISION_RESTORE_SEAMS],
};

describe('production restore port envelope', () => {
  const portFor = (value: unknown) =>
    cmsEditorialRestorePort(async () => ({ ok: true, value }));

  it('publishes the resource only beside its verified restore evidence', async () => {
    const result = await portFor({
      resource: revisionResource,
      restoreVerification: verification,
    })(portInput({ operationId: 'CMS-03B-04' }), signal());
    expect(result).toMatchObject({
      ok: true,
      value: { resource: { id: revisionResource.id } },
    });
  });

  it('passes a dependency failure through untouched', async () => {
    const failure = {
      ok: false as const,
      status: 409 as const,
      code: 'CONFLICT',
      message: 'The CMS editorial resource changed; reload and try again.',
    };
    const port = cmsEditorialRestorePort(async () => failure);
    expect(
      await port(portInput({ operationId: 'CMS-03B-04' }), signal()),
    ).toEqual(failure);
  });

  it.each([
    ['a non-object payload', 'restored'],
    ['an array payload', []],
    ['a payload with no resource', { restoreVerification: verification }],
    ['a payload with no verification', { resource: revisionResource }],
    [
      'a resource that breaks its strict contract',
      {
        resource: { ...revisionResource, surprise: true },
        restoreVerification: verification,
      },
    ],
    [
      'evidence whose chain does not end at the active schema',
      {
        resource: revisionResource,
        restoreVerification: {
          ...verification,
          registry: {
            ...verification.registry,
            chainSchemaVersionIds: [SOURCE_SCHEMA_ID],
          },
        },
      },
    ],
  ])('refuses %s as an invalid dependency response', async (_label, value) => {
    const result = await portFor(value)(
      portInput({ operationId: 'CMS-03B-04' }),
      signal(),
    );
    expect(result).toMatchObject({ ok: false, status: 502 });
  });
});

describe('production safe-read resource ports', () => {
  it.each(['CMS-03B-12', 'CMS-03B-13', 'CMS-03B-14'] as const)(
    'narrows %s to a JSON object envelope',
    async (operationId) => {
      const envelope = { marker: operationId };
      const accepted = cmsEditorialResourcePort<typeof envelope>(
        async () => ({ ok: true, value: envelope }),
        operationId,
      );
      expect(await accepted(portInput({ operationId }), signal())).toEqual({
        ok: true,
        value: envelope,
      });
      for (const value of [null, 'text', 7, ['not', 'an', 'object']]) {
        const refused = cmsEditorialResourcePort<typeof envelope>(
          async () => ({ ok: true, value }),
          operationId,
        );
        expect(
          await refused(portInput({ operationId }), signal()),
        ).toMatchObject({ ok: false, status: 502 });
      }
    },
  );
});

const readInput = (
  operationId: CmsEditorialPortInput['operationId'],
  overrides: Record<string, unknown> = {},
): CmsEditorialPortInput =>
  ({
    operationId,
    requestId: REQUEST_ID,
    request: new Request('https://api.example.test/api/v1/cms/entries', {
      method: 'GET',
    }),
    session: {
      userId: USER_ID,
      actingPartyId: PARTY_ID,
      capabilities: ['cms.author'],
      mfaFresh: true,
    },
    ...overrides,
  }) as CmsEditorialPortInput;

const reasonOf = (result: ReturnType<typeof validateCmsEditorialPortInput>) =>
  result === null || result.ok !== false
    ? null
    : (result.details?.reasonCode ?? null);

describe('production port-input admission for the safe reads', () => {
  const cases = [
    {
      operationId: 'CMS-03B-11',
      reason: 'draft_read_precondition_invalid',
      valid: {
        path: { entryId: ENTRY_ID },
        query: { entryId: ENTRY_ID },
      },
      invalid: { path: { entryId: 'not-a-uuid' }, query: {} },
    },
    {
      operationId: 'CMS-03B-12',
      reason: 'conflict_detail_precondition_invalid',
      valid: { path: { entryId: ENTRY_ID, conflictId: CONFLICT_ID } },
      invalid: { path: { entryId: ENTRY_ID } },
    },
    {
      operationId: 'CMS-03B-13',
      reason: 'entry_list_precondition_invalid',
      valid: { query: { limit: 25 } },
      invalid: { path: { entryId: ENTRY_ID } },
    },
    {
      operationId: 'CMS-03B-14',
      reason: 'authoring_context_precondition_invalid',
      valid: { query: { contentTypeVersionId: VERSION_ID } },
      invalid: { path: { entryId: ENTRY_ID } },
    },
  ] as const;

  it.each(cases)(
    'admits a well-formed $operationId read and names its refusal',
    ({ operationId, reason, valid, invalid }) => {
      expect(
        validateCmsEditorialPortInput(
          readInput(operationId, valid),
          operationId,
        ),
      ).toBeNull();
      expect(
        reasonOf(
          validateCmsEditorialPortInput(
            readInput(operationId, invalid),
            operationId,
          ),
        ),
      ).toBe(reason);
    },
  );

  it.each(cases)(
    'refuses a write header, body, or non-GET method on $operationId',
    ({ operationId, reason, valid }) => {
      for (const extra of [
        { idempotencyKey: 'a-key' },
        { ifMatch: '1' },
        { body: { surprise: true } },
        {
          request: new Request('https://api.example.test/api/v1/cms/entries', {
            method: 'POST',
            body: '{}',
          }),
        },
      ])
        expect(
          reasonOf(
            validateCmsEditorialPortInput(
              readInput(operationId, { ...valid, ...extra }),
              operationId,
            ),
          ),
        ).toBe(reason);
    },
  );

  it('refuses an operation mismatch before any shape check', () => {
    expect(
      reasonOf(
        validateCmsEditorialPortInput(readInput('CMS-03B-13'), 'CMS-03B-14'),
      ),
    ).toBe('operation_mismatch');
  });
});
