import { describe, expect, it } from 'vitest';

import {
  OpaqueRelationPlaceholderSchema,
  RelationBindingRequestSchema,
} from './contracts';
import {
  bodyOf,
  freshAccepted,
  freshInvalid,
  jsonRequest,
  makeHarness,
  mutationPath,
  sendHuman,
} from './phase-02-slice-09-pre-support';
import {
  FIELD_ID,
  ok,
  relation,
  session,
  validRelation,
} from './phase-02-slice-09-test-values';

const A03 = 'CMS-03A-03' as const;
const rel = (patch: Record<string, unknown>) => ({
  ...validRelation,
  ...patch,
});
const without = (member: string): Record<string, unknown> => {
  const rest: Record<string, unknown> = { ...validRelation };
  delete rest[member];
  return rest;
};

describe('CMS-03A-03 relation binding through the real route', () => {
  it('[P2-S09-AC-072] is a strict object of exactly the nine relation members', async () => {
    const body = await freshAccepted(A03, validRelation);
    expect(Object.keys(body).sort()).toEqual([
      'cardinality',
      'fieldId',
      'max',
      'min',
      'onUnavailable',
      'ordered',
      'projectionKey',
      'targetKind',
      'targetType',
    ]);
    for (const member of Object.keys(validRelation))
      await freshInvalid(A03, without(member), `/${member}`);
    await freshInvalid(A03, rel({ extra: true }), '/extra');
    await freshInvalid(
      A03,
      rel({ contentTypeVersionId: FIELD_ID }),
      '/contentTypeVersionId',
    );
  });

  it('[P2-S09-AC-073] requires fieldId as a UUID and relays the refusal for a field that is not a relation field of this version', async () => {
    for (const fieldId of ['field', '', 3, null])
      await freshInvalid(A03, rel({ fieldId }), '/fieldId');
    const harness = makeHarness();
    harness.ports.bindRelation.mockResolvedValueOnce({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'not a relation field',
      details: {
        violations: [
          {
            path: '/fieldId',
            message: 'The field is not a relation field of this version.',
          },
        ],
      },
    });
    const response = await sendHuman(harness, A03, validRelation);
    expect(response.status).toBe(422);
    expect((await bodyOf(response)).details.violations?.[0]?.path).toBe(
      '/fieldId',
    );
  });

  it('[P2-S09-AC-074] accepts targetKind content or domain and a lowercase targetType of 1-96 characters', async () => {
    for (const targetKind of ['content', 'domain'])
      await freshAccepted(A03, rel({ targetKind }));
    for (const targetKind of ['table', 'Content', '', 'content,domain', null])
      await freshInvalid(A03, rel({ targetKind }), '/targetKind');
    await freshAccepted(A03, rel({ targetType: 'a' }));
    await freshAccepted(A03, rel({ targetType: `a${'b'.repeat(95)}` }));
    for (const targetType of [
      '',
      `a${'b'.repeat(96)}`,
      'Artist',
      '1artist',
      'artist type',
      'artist;drop',
      '../artist',
      4,
    ])
      await freshInvalid(A03, rel({ targetType }), '/targetType');
  });

  it('[P2-S09-AC-075] accepts only a named projectionKey of 1-128 characters and refuses SQL, table names and dynamic projections', async () => {
    await freshAccepted(A03, rel({ projectionKey: 'a' }));
    await freshAccepted(A03, rel({ projectionKey: `a${'b'.repeat(127)}` }));
    for (const projectionKey of [
      '',
      `a${'b'.repeat(128)}`,
      'select * from cms_entries',
      'public.summary; drop table x',
      "a' or '1'='1",
      'a--b c',
      'Public.Summary',
      '(select 1)',
      'a b',
      '{"sql":"x"}',
      '${table}',
      '../etc/passwd',
      'a/b',
      1,
    ])
      await freshInvalid(A03, rel({ projectionKey }), '/projectionKey');
    const harness = makeHarness();
    harness.ports.bindRelation.mockResolvedValueOnce({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'not allowlisted',
      details: {
        violations: [
          {
            path: '/projectionKey',
            message: 'The projection is not allowlisted.',
          },
        ],
      },
    });
    expect(
      (
        await sendHuman(
          harness,
          A03,
          rel({ projectionKey: 'unlisted.projection' }),
        )
      ).status,
    ).toBe(422);
  });

  it('[P2-S09-AC-076] accepts cardinality one or many and returns it as declared relation metadata', async () => {
    for (const [cardinality, min, max] of [
      ['one', 0, 1],
      ['many', 0, 8],
    ] as const) {
      const body = await freshAccepted(A03, rel({ cardinality, min, max }));
      expect(body.cardinality).toBe(cardinality);
    }
    for (const cardinality of ['few', 'One', '', 1, null])
      await freshInvalid(A03, rel({ cardinality }), '/cardinality');
    const response = await sendHuman(makeHarness(), A03, validRelation);
    expect(
      ((await response.json()) as { cardinality: string }).cardinality,
    ).toBe(relation.cardinality);
  });

  it('[P2-S09-AC-077] bounds min to an integer 0-128 and max to a finite non-null integer 1-128 with min <= max', async () => {
    for (const [min, max] of [
      [0, 1],
      [0, 128],
      [128, 128],
      [5, 5],
    ])
      await freshAccepted(A03, rel({ cardinality: 'many', min, max }));
    for (const min of [-1, 129, 1.5, '1', null, undefined])
      await freshInvalid(
        A03,
        rel({ cardinality: 'many', min, max: 128 }),
        '/min',
      );
    for (const max of [0, 129, 2.5, '8', null, undefined])
      await freshInvalid(
        A03,
        rel({ cardinality: 'many', min: 0, max }),
        '/max',
      );
    await freshInvalid(
      A03,
      rel({ cardinality: 'many', min: 9, max: 8 }),
      '/min',
    );
    expect(
      RelationBindingRequestSchema.safeParse(
        rel({ min: Number.POSITIVE_INFINITY }),
      ).success,
    ).toBe(false);
    expect(
      RelationBindingRequestSchema.safeParse(rel({ max: Number.NaN })).success,
    ).toBe(false);
  });

  it('[P2-S09-AC-078] [P2-S09-AC-011] requires one to carry min 0 or 1 and max 1 and many to carry explicit finite bounds', async () => {
    await freshAccepted(A03, rel({ cardinality: 'one', min: 0, max: 1 }));
    await freshAccepted(A03, rel({ cardinality: 'one', min: 1, max: 1 }));
    await freshInvalid(
      A03,
      rel({ cardinality: 'one', min: 2, max: 1 }),
      '/min',
    );
    await freshInvalid(
      A03,
      rel({ cardinality: 'one', min: 0, max: 2 }),
      '/max',
    );
    await freshInvalid(
      A03,
      rel({ cardinality: 'one', min: 1, max: 8 }),
      '/max',
    );
    await freshAccepted(A03, rel({ cardinality: 'many', min: 2, max: 8 }));
    for (const member of ['min', 'max'])
      await freshInvalid(
        A03,
        rel({ cardinality: 'many', [member]: undefined }),
        `/${member}`,
      );
    for (const max of [Number.POSITIVE_INFINITY, null])
      await freshInvalid(
        A03,
        rel({ cardinality: 'many', min: 0, max }),
        '/max',
      );
  });

  it('[P2-S09-AC-079] requires ordered as a boolean and carries the declared order semantics to the RPC and the resource', async () => {
    for (const ordered of [true, false]) {
      const body = await freshAccepted(A03, rel({ ordered }));
      expect(body.ordered).toBe(ordered);
    }
    for (const ordered of ['true', 0, 1, null, undefined])
      await freshInvalid(A03, rel({ ordered }), '/ordered');
    expect(
      typeof (
        (await (await sendHuman(makeHarness(), A03, validRelation)).json()) as {
          ordered: unknown;
        }
      ).ordered,
    ).toBe('boolean');
  });

  it('[P2-S09-AC-080] requires onUnavailable to be omit, block or placeholder and never treats a missing value as omit', async () => {
    for (const onUnavailable of ['omit', 'block', 'placeholder'])
      expect(
        (await freshAccepted(A03, rel({ onUnavailable }))).onUnavailable,
      ).toBe(onUnavailable);
    await freshInvalid(A03, without('onUnavailable'), '/onUnavailable');
    for (const onUnavailable of ['hide', 'Omit', '', null])
      await freshInvalid(A03, rel({ onUnavailable }), '/onUnavailable');
    const harness = makeHarness();
    await sendHuman(harness, A03, without('onUnavailable'));
    expect(harness.ports.bindRelation).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-081] fixes the placeholder fallback to exactly unavailable/unavailable with no target identifier, type, key, title, data or existence distinction', () => {
    expect(
      OpaqueRelationPlaceholderSchema.parse({
        status: 'unavailable',
        reason: 'unavailable',
      }),
    ).toEqual({ status: 'unavailable', reason: 'unavailable' });
    for (const member of [
      'id',
      'targetId',
      'type',
      'targetType',
      'key',
      'title',
      'data',
      'exists',
    ])
      expect(
        OpaqueRelationPlaceholderSchema.safeParse({
          status: 'unavailable',
          reason: 'unavailable',
          [member]: 'x',
        }).success,
        member,
      ).toBe(false);
    for (const reason of [
      'not_found',
      'forbidden',
      'withdrawn',
      'hidden',
      'missing',
    ])
      expect(
        OpaqueRelationPlaceholderSchema.safeParse({
          status: 'unavailable',
          reason,
        }).success,
        reason,
      ).toBe(false);
    expect(
      OpaqueRelationPlaceholderSchema.safeParse({
        status: 'missing',
        reason: 'unavailable',
      }).success,
    ).toBe(false);
    expect(
      OpaqueRelationPlaceholderSchema.safeParse({ status: 'unavailable' })
        .success,
    ).toBe(false);
  });

  it('[P2-S09-AC-082] never lets a relation binding grant authority: the session alone authorizes and the response carries no target authority', async () => {
    const harness = makeHarness({
      session: ok({ ...session, capabilities: ['cms.schema_registry.read'] }),
    });
    const forbidden = await sendHuman(
      harness,
      A03,
      rel({
        targetKind: 'domain',
        targetType: 'rights',
        projectionKey: 'rights.admin',
      }),
    );
    expect(forbidden.status).toBe(403);
    expect(harness.ports.bindRelation).not.toHaveBeenCalled();
    const allowed = await sendHuman(makeHarness(), A03, validRelation);
    expect(JSON.stringify(await allowed.json())).not.toMatch(
      /capabilit|authority|grant|ownerId/iu,
    );
  });

  it('[P2-S09-AC-083] writes under an exact strong If-Match, relays a duplicate or stale conflict and mutates nothing on invalid bounds', async () => {
    const harness = makeHarness();
    const noHeader = await harness.app.request(
      jsonRequest(mutationPath.relation, validRelation),
    );
    expect(noHeader.status).toBe(400);
    for (const header of ['W/"1"', '1', '"0"']) {
      const refused = await sendHuman(harness, A03, validRelation, {
        'if-match': header,
      });
      expect(refused.status, header).toBe(400);
    }
    await sendHuman(harness, A03, rel({ cardinality: 'one', min: 0, max: 9 }));
    expect(harness.ports.bindRelation).not.toHaveBeenCalled();
    for (const conflict of ['VERSION_MISMATCH', 'INVALID_TRANSITION']) {
      const conflicting = makeHarness();
      conflicting.ports.bindRelation.mockResolvedValueOnce({
        ok: false,
        status: 409,
        code: 'CONFLICT',
        message: 'x',
        details: { conflict },
      });
      const response = await sendHuman(conflicting, A03, validRelation);
      expect(response.status).toBe(409);
      expect((await bodyOf(response)).details.conflict).toBe(conflict);
      expect(response.headers.get('etag')).toBeNull();
    }
  });

  it('[P2-S09-AC-084] returns a strict 201 RelationDefinitionResource with target, projection, cardinality, bounds, ordering and unavailable behaviour', async () => {
    const response = await sendHuman(makeHarness(), A03, validRelation);
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    for (const member of [
      'targetKind',
      'targetType',
      'projectionKey',
      'cardinality',
      'min',
      'max',
      'ordered',
      'onUnavailable',
    ])
      expect(body, member).toHaveProperty(member);
    const extra = makeHarness();
    extra.ports.bindRelation.mockResolvedValueOnce(
      ok({ ...relation, ownerId: FIELD_ID }),
    );
    expect((await sendHuman(extra, A03, validRelation)).status).toBe(502);
    const loose = makeHarness();
    loose.ports.bindRelation.mockResolvedValueOnce(
      ok({ ...relation, cardinality: 'one', max: 5 }),
    );
    expect((await sendHuman(loose, A03, validRelation)).status).toBe(502);
  });
});
