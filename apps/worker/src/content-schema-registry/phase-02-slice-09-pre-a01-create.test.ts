import { describe, expect, it } from 'vitest';

import {
  bodyOf,
  freshAccepted,
  freshInvalid,
  makeHarness,
  sendHuman,
} from './phase-02-slice-09-pre-support';
import {
  FIELD_ID,
  REQUEST_ID,
  USER_ID,
  VERSION_ID,
  ok,
  session,
  validDraft,
  validField,
} from './phase-02-slice-09-test-values';

const A01 = 'CMS-03A-01' as const;
const FIELD = { stableFieldId: FIELD_ID, ...validField };
const FIELD_INPUT = Object.fromEntries(
  Object.entries(FIELD).filter(([key]) => key !== 'migrationPlanId'),
);
const RELATION = {
  fieldId: FIELD_ID,
  targetKind: 'content',
  targetType: 'artist',
  projectionKey: 'public.summary',
  cardinality: 'many',
  min: 0,
  max: 8,
  ordered: false,
  onUnavailable: 'omit',
};
const draftWith = (patch: Record<string, unknown>) => ({
  ...validDraft,
  ...patch,
});

describe('CMS-03A-01 request fields through the real route', () => {
  it('[P2-S09-AC-040] accepts only a lowercase ASCII typeKey matching ^[a-z][a-z0-9_]{1,63}$', async () => {
    for (const typeKey of ['ab', 'a1', 'a_b', `a${'b'.repeat(63)}`]) {
      const body = await freshAccepted(A01, draftWith({ typeKey }));
      expect(body.typeKey).toBe(typeKey);
    }
    for (const typeKey of [
      'a',
      'Ab',
      '1ab',
      '_ab',
      'a-b',
      'a b',
      'a.b',
      `a${'b'.repeat(64)}`,
      'ünï',
      '',
    ])
      await freshInvalid(A01, draftWith({ typeKey }), '/typeKey');
  });

  it('[P2-S09-AC-040] hands a built-in, reserved, retired or already-used typeKey to the RPC and relays its refusal without a success body', async () => {
    const harness = makeHarness();
    harness.ports.createTypeDraft.mockResolvedValueOnce({
      ok: false,
      status: 409,
      code: 'CONFLICT',
      message: 'type key already used',
      details: { conflict: 'INVALID_TRANSITION' },
    });
    const response = await sendHuman(
      harness,
      A01,
      draftWith({ typeKey: 'page' }),
    );
    expect(response.status).toBe(409);
    const body = await bodyOf(response);
    expect(body.code).toBe('CONFLICT');
    expect(body.details.conflict).toBe('INVALID_TRANSITION');
    expect(response.headers.get('etag')).toBeNull();
    expect(harness.ports.createTypeDraft).toHaveBeenCalledTimes(1);
  });

  it('[P2-S09-AC-041] counts the label as 2-120 Unicode characters after NFC and delivers the NFC form', async () => {
    const composed = 'é'.repeat(120);
    expect(composed.length).toBe(240);
    const accepted = await freshAccepted(A01, draftWith({ label: composed }));
    expect(accepted.label).toBe('é'.repeat(120));
    expect(String(accepted.label).normalize('NFC')).toBe(accepted.label);
    const emoji = await freshAccepted(
      A01,
      draftWith({ label: '\u{1F600}'.repeat(120) }),
    );
    expect(Array.from(String(emoji.label)).length).toBe(120);
    await freshAccepted(A01, draftWith({ label: 'ab' }));
    await freshInvalid(A01, draftWith({ label: 'é'.repeat(121) }), '/label');
    await freshInvalid(A01, draftWith({ label: 'a' }), '/label');
    await freshInvalid(A01, draftWith({ label: '' }), '/label');
    await freshInvalid(
      A01,
      draftWith({ label: '\u{1F600}'.repeat(121) }),
      '/label',
    );
  });

  it('[P2-S09-AC-042] bounds ownerCapability to 1-128 characters of the capability-key grammar', async () => {
    await freshAccepted(A01, draftWith({ ownerCapability: 'a' }));
    await freshAccepted(
      A01,
      draftWith({ ownerCapability: `c${'x'.repeat(127)}` }),
    );
    for (const ownerCapability of [
      '',
      `c${'x'.repeat(128)}`,
      'Cms.Content',
      '1cap',
      'cms content',
      7,
      null,
    ])
      await freshInvalid(
        A01,
        draftWith({ ownerCapability }),
        '/ownerCapability',
      );
  });

  it('[P2-S09-AC-042] [P2-S09-AC-006] relays a refusal for an unregistered capability or workflow reference and never lets a caller string create authority', async () => {
    const harness = makeHarness({
      session: ok({ ...session, capabilities: ['cms.schema_registry.read'] }),
    });
    const forged = await sendHuman(
      harness,
      A01,
      draftWith({
        ownerCapability: 'cms.schema_designer',
        workflowKey: 'cms.schema_designer',
      }),
    );
    expect(forged.status).toBe(403);
    expect(harness.ports.createTypeDraft).not.toHaveBeenCalled();
    const registry = makeHarness();
    registry.ports.createTypeDraft.mockResolvedValueOnce({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'unregistered',
      details: {
        violations: [
          { path: '/ownerCapability', message: 'not a registry member' },
        ],
      },
    });
    const response = await sendHuman(
      registry,
      A01,
      draftWith({ ownerCapability: 'cms.unregistered' }),
    );
    expect(response.status).toBe(422);
    expect((await bodyOf(response)).details.violations?.[0]?.path).toBe(
      '/ownerCapability',
    );
  });

  it('[P2-S09-AC-044] requires a lowercase workflowKey grammar and a positive decimal workflowVersion', async () => {
    await freshAccepted(
      A01,
      draftWith({ workflowKey: 'editorial.default', workflowVersion: '12' }),
    );
    for (const workflowKey of [
      '',
      'Editorial',
      '1ed',
      'ed itorial',
      `w${'x'.repeat(128)}`,
      3,
    ])
      await freshInvalid(A01, draftWith({ workflowKey }), '/workflowKey');
    for (const workflowVersion of [
      '0',
      '01',
      '-1',
      '1.5',
      'v1',
      '',
      1,
      '9223372036854775808',
    ])
      await freshInvalid(
        A01,
        draftWith({ workflowVersion }),
        '/workflowVersion',
      );
  });

  it('[P2-S09-AC-045] accepts only a null defaultTemplateVersionId at creation (DEC-123) and refuses any reference before the RPC', async () => {
    await freshAccepted(A01, draftWith({ defaultTemplateVersionId: null }));
    // A new type has no template yet: a compatible template names the type id,
    // which exists only after this command, so the default is bound later
    // through a successor version.
    for (const defaultTemplateVersionId of [
      VERSION_ID,
      'not-a-uuid',
      '',
      5,
      undefined,
    ])
      await freshInvalid(
        A01,
        draftWith({ defaultTemplateVersionId }),
        '/defaultTemplateVersionId',
      );
    const refused = makeHarness();
    const response = await sendHuman(
      refused,
      A01,
      draftWith({ defaultTemplateVersionId: VERSION_ID }),
    );
    expect(response.status).toBe(422);
    expect((await bodyOf(response)).code).toBe('VALIDATION_FAILED');
    expect(refused.ports.createTypeDraft).not.toHaveBeenCalled();
    // A database refusal for any other clause is still relayed unchanged.
    const harness = makeHarness();
    harness.ports.createTypeDraft.mockResolvedValueOnce({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'type refused',
      details: {
        violations: [{ path: '/typeKey', message: 'type key refused' }],
      },
    });
    expect((await sendHuman(harness, A01, validDraft)).status).toBe(422);
  });

  it('[P2-S09-AC-046] bounds fields to 0-128 strict FieldDefinitionInput values and refuses the whole aggregate when any one is invalid', async () => {
    await freshAccepted(A01, draftWith({ fields: [] }));
    const many = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        ...FIELD_INPUT,
        stableFieldId: `5000000${index % 10}-0000-4000-8000-${String(index).padStart(12, '0')}`,
        key: `field_${index}`,
      }));
    const accepted = await freshAccepted(A01, draftWith({ fields: many(128) }));
    expect((accepted.fields as unknown[]).length).toBe(128);
    await freshInvalid(A01, draftWith({ fields: many(129) }), '/fields');
    const partial = [...many(3), { ...FIELD_INPUT, key: 'Bad-Key' }];
    const harness = makeHarness();
    await sendHuman(harness, A01, draftWith({ fields: partial }));
    expect(harness.ports.createTypeDraft).not.toHaveBeenCalled();
    await freshInvalid(
      A01,
      draftWith({ fields: [{ ...FIELD_INPUT, surprise: true }] }),
      '/fields/0',
    );
    await freshInvalid(A01, draftWith({ fields: 'nope' }), '/fields');
  });

  it('[P2-S09-AC-047] requires every initial-field member: stableFieldId, key, closed kind, constraints, validator pair, default, localization, editorConfig and lifecycle', async () => {
    const required = [
      'stableFieldId',
      'key',
      'kind',
      'constraints',
      'required',
      'validatorKey',
      'validatorVersion',
      'defaultMode',
      'localizationMode',
      'editorConfig',
      'lifecycle',
    ];
    for (const member of required) {
      const rest: Record<string, unknown> = { ...FIELD_INPUT };
      delete rest[member];
      await freshInvalid(
        A01,
        draftWith({ fields: [rest] }),
        `/fields/0/${member}`,
      );
    }
    await freshInvalid(
      A01,
      draftWith({ fields: [{ ...FIELD_INPUT, kind: 'markdown' }] }),
      '/fields/0/kind',
    );
    await freshInvalid(
      A01,
      draftWith({
        fields: [
          { ...FIELD_INPUT, validatorKey: 'a.b', validatorVersion: null },
        ],
      }),
      '/fields/0',
    );
    await freshInvalid(
      A01,
      draftWith({ fields: [{ ...FIELD_INPUT, defaultMode: 'literal' }] }),
      '/fields/0',
    );
    await freshInvalid(
      A01,
      draftWith({ fields: [{ ...FIELD_INPUT, localizationMode: 'auto' }] }),
      '/fields/0/localizationMode',
    );
    await freshInvalid(
      A01,
      draftWith({ fields: [{ ...FIELD_INPUT, lifecycle: 'archived' }] }),
      '/fields/0/lifecycle',
    );
    const body = await freshAccepted(A01, draftWith({ fields: [FIELD_INPUT] }));
    expect(
      Object.keys(
        (body.fields as Record<string, unknown>[])[0] as object,
      ).sort(),
    ).toEqual([...required].sort().filter((key) => key !== 'defaultValue'));
  });

  it('[P2-S09-AC-048] bounds relations to 128 complete allowlisted RelationBindingInput values', async () => {
    await freshAccepted(A01, draftWith({ relations: [RELATION] }));
    const accepted = await freshAccepted(
      A01,
      draftWith({ relations: Array.from({ length: 128 }, () => RELATION) }),
    );
    expect((accepted.relations as unknown[]).length).toBe(128);
    await freshInvalid(
      A01,
      draftWith({ relations: Array.from({ length: 129 }, () => RELATION) }),
      '/relations',
    );
    for (const member of Object.keys(RELATION)) {
      const rest: Record<string, unknown> = { ...RELATION };
      delete rest[member];
      await freshInvalid(
        A01,
        draftWith({ relations: [rest] }),
        `/relations/0/${member}`,
      );
    }
    await freshInvalid(
      A01,
      draftWith({ relations: [{ ...RELATION, targetKind: 'table' }] }),
      '/relations/0/targetKind',
    );
    await freshInvalid(
      A01,
      draftWith({
        relations: [{ ...RELATION, projectionKey: 'public; drop table x' }],
      }),
      '/relations/0/projectionKey',
    );
  });

  it('[P2-S09-AC-049] accepts only an empty templateBindings array at creation (DEC-123) and refuses any binding before the RPC', async () => {
    const binding = (index: number) => ({
      templateVersionId: `a0000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    });
    const accepted = await freshAccepted(
      A01,
      draftWith({ templateBindings: [] }),
    );
    expect(accepted.templateBindings).toEqual([]);
    for (const count of [1, 32, 33])
      await freshInvalid(
        A01,
        draftWith({
          templateBindings: Array.from({ length: count }, (_, i) => binding(i)),
        }),
        '/templateBindings',
      );
    for (const templateBindings of [
      [{ templateVersionId: 'latest' }],
      [{ templateVersionId: VERSION_ID, label: 'x' }],
      [VERSION_ID],
      null,
      {},
    ])
      await freshInvalid(
        A01,
        draftWith({ templateBindings }),
        '/templateBindings',
      );
    const refused = makeHarness();
    const response = await sendHuman(
      refused,
      A01,
      draftWith({ templateBindings: [{ templateVersionId: VERSION_ID }] }),
    );
    expect(response.status).toBe(422);
    expect(refused.ports.createTypeDraft).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-050] bounds capabilityBindings to at most 32 protected key/version references', async () => {
    const binding = (index: number) => ({
      capabilityKey: `cms.capability_${index}`,
      capabilityVersion: '1',
    });
    const accepted = await freshAccepted(
      A01,
      draftWith({
        capabilityBindings: Array.from({ length: 32 }, (_, i) => binding(i)),
      }),
    );
    expect((accepted.capabilityBindings as unknown[]).length).toBe(32);
    await freshInvalid(
      A01,
      draftWith({
        capabilityBindings: Array.from({ length: 33 }, (_, i) => binding(i)),
      }),
      '/capabilityBindings',
    );
    await freshInvalid(
      A01,
      draftWith({ capabilityBindings: [{ capabilityKey: 'cms.x' }] }),
      '/capabilityBindings/0/capabilityVersion',
    );
    await freshInvalid(
      A01,
      draftWith({
        capabilityBindings: [
          { capabilityKey: 'CMS.X', capabilityVersion: '1' },
        ],
      }),
      '/capabilityBindings/0/capabilityKey',
    );
  });

  it('[P2-S09-AC-051] never lets a capability binding named in the body authorize the request', async () => {
    const harness = makeHarness({
      session: ok({ ...session, capabilities: ['cms.schema_registry.read'] }),
    });
    const response = await sendHuman(
      harness,
      A01,
      draftWith({
        capabilityBindings: [
          { capabilityKey: 'cms.schema_designer', capabilityVersion: '1' },
        ],
      }),
      { 'x-capability': 'cms.schema_designer' },
    );
    expect(response.status).toBe(403);
    expect((await bodyOf(response)).details.reasonCode).toBe(
      'CAPABILITY_REQUIRED',
    );
    expect(harness.ports.createTypeDraft).not.toHaveBeenCalled();
    const granted = makeHarness();
    await sendHuman(
      granted,
      A01,
      draftWith({
        capabilityBindings: [
          { capabilityKey: 'cms.something_else', capabilityVersion: '1' },
        ],
      }),
    );
    const input = granted.ports.createTypeDraft.mock.calls[0]?.[0] as {
      session: { capabilities: string[] };
    };
    expect(input.session.capabilities).toEqual(session.capabilities);
  });
});

describe('CMS-03A-01 aggregate command and response', () => {
  it('[P2-S09-AC-003] carries type, fields, relations, capability and locale/workflow references and no template in one RPC call with the idempotency key', async () => {
    const harness = makeHarness();
    const full = draftWith({
      fields: [FIELD_INPUT],
      relations: [RELATION],
      templateBindings: [],
      capabilityBindings: [
        { capabilityKey: 'cms.content.article', capabilityVersion: '1' },
      ],
    });
    const response = await sendHuman(harness, A01, full);
    expect(response.status).toBe(201);
    expect(harness.ports.createTypeDraft).toHaveBeenCalledTimes(1);
    for (const other of [
      'addFieldDefinition',
      'bindRelation',
      'activateSchema',
    ] as const)
      expect(harness.ports[other]).not.toHaveBeenCalled();
    const input = harness.ports.createTypeDraft.mock.calls[0]?.[0] as {
      idempotencyKey: string;
      body: Record<string, unknown>;
    };
    expect(input.idempotencyKey).toBe('cms-test-key-001');
    // DEC-123: the aggregate commits no template; it is bound by a successor.
    expect(input.body.defaultTemplateVersionId).toBeNull();
    expect(input.body.templateBindings).toEqual([]);
    expect(Object.keys(input.body).sort()).toEqual([
      'capabilityBindings',
      'defaultLocale',
      'defaultTemplateVersionId',
      'fallbackChains',
      'fields',
      'label',
      'ownerCapability',
      'relations',
      'sourceLocale',
      'supportedLocales',
      'templateBindings',
      'typeKey',
      'workflowKey',
      'workflowVersion',
    ]);
  });

  it('[P2-S09-AC-052] has no parent path and refuses an If-Match create precondition', async () => {
    const harness = makeHarness();
    const response = await sendHuman(harness, A01, validDraft, {
      'if-match': '"1"',
    });
    expect(response.status).toBe(400);
    expect((await bodyOf(response)).code).toBe('INVALID_REQUEST');
    expect(harness.ports.createTypeDraft).not.toHaveBeenCalled();
    const ok201 = await sendHuman(makeHarness(), A01, validDraft);
    expect(ok201.status).toBe(201);
  });

  it('[P2-S09-AC-055] derives owner and creator server-side and returns ETag, Location, X-Request-Id and no-store without private fields', async () => {
    const harness = makeHarness();
    const response = await sendHuman(harness, A01, validDraft, {
      'x-owner-id': 'forged',
      'x-created-by': 'forged',
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('location')).toBe('/api/v1/cms/content-types');
    expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const text = JSON.stringify(await response.json());
    expect(text).not.toMatch(/ownerId|owner_id|createdBy|forged/u);
    const input = harness.ports.createTypeDraft.mock.calls[0]?.[0] as {
      session: { userId: string };
      body: Record<string, unknown>;
    };
    expect(input.session.userId).toBe(USER_ID);
    expect(input.body).not.toHaveProperty('ownerId');
    await freshInvalid(A01, draftWith({ ownerId: USER_ID }));
    await freshInvalid(A01, draftWith({ createdBy: USER_ID }));
  });
});
