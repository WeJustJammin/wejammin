import { describe, expect, it } from 'vitest';

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
  TYPE_ID,
  VERSION_ID,
  field,
  ok,
  validField,
} from './phase-02-slice-09-test-values';

const A02 = 'CMS-03A-02' as const;
const PLAN = 'c0000000-0000-4000-8000-000000000099';
const fieldWith = (patch: Record<string, unknown>) => ({
  ...validField,
  ...patch,
});
const withoutMember = (member: string): Record<string, unknown> => {
  const rest: Record<string, unknown> = { ...validField };
  delete rest[member];
  return rest;
};
const KINDS = [
  'short_text',
  'long_text',
  'rich_text',
  'boolean',
  'integer',
  'decimal',
  'date',
  'datetime',
  'enum',
  'taxonomy',
  'relation',
  'media',
  'object',
  'list',
] as const;

describe('CMS-03A-02 field schema change through the real route', () => {
  it('[P2-S09-AC-056] is a strict object of the exact field members plus a required migrationPlanId and refuses unknown keys', async () => {
    const accepted = await freshAccepted(A02, {
      stableFieldId: FIELD_ID,
      ...validField,
      defaultMode: 'literal',
      defaultValue: 'x',
    });
    expect(Object.keys(accepted).sort()).toEqual([
      'constraints',
      'defaultMode',
      'defaultValue',
      'editorConfig',
      'key',
      'kind',
      'lifecycle',
      'localizationMode',
      'migrationPlanId',
      'required',
      'stableFieldId',
      'validatorKey',
      'validatorVersion',
    ]);
    await freshInvalid(A02, fieldWith({ surprise: true }), '/surprise');
    await freshInvalid(A02, fieldWith({ ownerId: FIELD_ID }), '/ownerId');
    for (const member of Object.keys(validField))
      await freshInvalid(A02, withoutMember(member), `/${member}`);
  });

  it('[P2-S09-AC-057] refuses a malformed path ID with 400 before body, session or port and relays a type/version mismatch as a concealed 404', async () => {
    const harness = makeHarness();
    const bad = await harness.app.request(
      jsonRequest(
        '/api/v1/cms/content-types/not-a-uuid/versions/' +
          VERSION_ID +
          '/fields',
        validField,
        {
          'if-match': '"1"',
        },
      ),
    );
    expect(bad.status).toBe(400);
    expect((await bodyOf(bad)).code).toBe('INVALID_REQUEST');
    const badVersion = await harness.app.request(
      jsonRequest(
        `/api/v1/cms/content-types/${TYPE_ID}/versions/42/fields`,
        validField,
        { 'if-match': '"1"' },
      ),
    );
    expect(badVersion.status).toBe(400);
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.ports.addFieldDefinition).not.toHaveBeenCalled();
    const mismatch = makeHarness();
    mismatch.ports.addFieldDefinition.mockResolvedValueOnce({
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
      message: 'version does not belong to type',
      details: { leaked: 'secret' },
    });
    const response = await sendHuman(mismatch, A02, validField);
    expect(response.status).toBe(404);
    expect((await bodyOf(response)).details).toEqual({});
    const input = mismatch.ports.addFieldDefinition.mock.calls[0]?.[0] as {
      path: Record<string, string>;
    };
    expect(input.path).toEqual({
      contentTypeId: TYPE_ID,
      versionId: VERSION_ID,
    });
  });

  it('[P2-S09-AC-058] accepts stableFieldId only as a UUID and lets a new field omit it', async () => {
    const created = await freshAccepted(A02, validField);
    expect(created).not.toHaveProperty('stableFieldId');
    const changed = await freshAccepted(
      A02,
      fieldWith({ stableFieldId: FIELD_ID }),
    );
    expect(changed.stableFieldId).toBe(FIELD_ID);
    for (const stableFieldId of ['title', '', 5, null, FIELD_ID.slice(1)])
      await freshInvalid(A02, fieldWith({ stableFieldId }), '/stableFieldId');
  });

  it('[P2-S09-AC-059] matches the key grammar and relays an immutable-identity or reuse conflict', async () => {
    for (const key of ['ab', 'a_1', `a${'b'.repeat(63)}`])
      await freshAccepted(A02, fieldWith({ key }));
    for (const key of [
      'a',
      'Ab',
      '1ab',
      'a-b',
      'a b',
      `a${'b'.repeat(64)}`,
      '',
    ])
      await freshInvalid(A02, fieldWith({ key }), '/key');
    const harness = makeHarness();
    harness.ports.addFieldDefinition.mockResolvedValueOnce({
      ok: false,
      status: 409,
      code: 'CONFLICT',
      message: 'immutable identity',
      details: { conflict: 'INVALID_TRANSITION' },
    });
    const response = await sendHuman(
      harness,
      A02,
      fieldWith({ stableFieldId: FIELD_ID, key: 'renamed' }),
    );
    expect(response.status).toBe(409);
    expect((await bodyOf(response)).details.conflict).toBe(
      'INVALID_TRANSITION',
    );
  });

  it('[P2-S09-AC-060] accepts exactly the fourteen field kinds', async () => {
    for (const kind of KINDS) await freshAccepted(A02, fieldWith({ kind }));
    for (const kind of [
      'string',
      'text',
      'SHORT_TEXT',
      'number',
      'markdown',
      '',
      null,
    ])
      await freshInvalid(A02, fieldWith({ kind }), '/kind');
  });

  it('[P2-S09-AC-061] constrains with a strict closed key set, min <= max and at most 8 KiB of constraints', async () => {
    const accepted = await freshAccepted(
      A02,
      fieldWith({
        constraints: {
          minLength: 1,
          maxLength: 80,
          minimum: -5,
          maximum: 5,
          enumValues: ['a', 'b'],
          itemKind: 'short_text',
        },
      }),
    );
    expect(Object.keys(accepted.constraints as object).sort()).toEqual([
      'enumValues',
      'itemKind',
      'maxLength',
      'maximum',
      'minLength',
      'minimum',
    ]);
    for (const constraints of [
      { pattern: '^a' },
      { regex: 'a' },
      { expression: '1+1' },
      { code: 'x' },
      { minLength: -1 },
      { maxLength: 100001 },
      { minLength: 1.5 },
      { minimum: Number.NaN },
      { enumValues: ['x'.repeat(161)] },
      { itemKind: 'nope' },
      [],
      'x',
      null,
    ])
      await freshInvalid(A02, fieldWith({ constraints }), '/constraints');
    await freshInvalid(
      A02,
      fieldWith({ constraints: { minLength: 9, maxLength: 3 } }),
      '/constraints',
    );
    await freshInvalid(
      A02,
      fieldWith({ constraints: { minimum: 9, maximum: 3 } }),
      '/constraints',
    );
    await freshInvalid(
      A02,
      fieldWith({
        constraints: {
          enumValues: Array.from({ length: 257 }, (_, i) => `v${i}`),
        },
      }),
      '/constraints',
    );
    const big = Array.from({ length: 100 }, (_, i) => `${i}`.padEnd(160, 'x'));
    expect(JSON.stringify({ enumValues: big }).length).toBeGreaterThan(8192);
    await freshInvalid(
      A02,
      fieldWith({ kind: 'enum', constraints: { enumValues: big } }),
      '/constraints',
    );
    const atLimit = Array.from({ length: 50 }, (_, i) =>
      `${i}`.padEnd(160, 'x'),
    );
    expect(JSON.stringify({ enumValues: atLimit }).length).toBeLessThanOrEqual(
      8192,
    );
    await freshAccepted(
      A02,
      fieldWith({ kind: 'enum', constraints: { enumValues: atLimit } }),
    );
  });

  it('[P2-S09-AC-062] requires validatorKey and validatorVersion both null or both protected references and refuses executable validators', async () => {
    await freshAccepted(
      A02,
      fieldWith({ validatorKey: 'slug.safe', validatorVersion: '1' }),
    );
    await freshInvalid(
      A02,
      fieldWith({ validatorKey: 'slug.safe', validatorVersion: null }),
      '/validatorKey',
    );
    await freshInvalid(
      A02,
      fieldWith({ validatorKey: null, validatorVersion: '1' }),
      '/validatorKey',
    );
    for (const validatorKey of [
      'Slug',
      '^[a-z]+$',
      'x; drop table',
      '/* code */',
      'a'.repeat(129),
      '',
    ])
      await freshInvalid(
        A02,
        fieldWith({ validatorKey, validatorVersion: '1' }),
        '/validatorKey',
      );
    for (const executable of [
      { pattern: '^[a-z]+$' },
      { expression: 'value.length > 3' },
      { script: 'return true' },
    ])
      await freshInvalid(
        A02,
        fieldWith({ constraints: executable }),
        '/constraints',
      );
    await freshInvalid(
      A02,
      fieldWith({
        validatorKey: 'slug.safe',
        validatorVersion: '1',
        validator: 'function(){}',
      }),
      '/validator',
    );
    const harness = makeHarness();
    harness.ports.addFieldDefinition.mockResolvedValueOnce({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'unregistered validator',
      details: {
        violations: [
          { path: '/validatorKey', message: 'not a protected validator' },
        ],
      },
    });
    const refused = await sendHuman(
      harness,
      A02,
      fieldWith({ validatorKey: 'not.registered', validatorVersion: '1' }),
    );
    expect(refused.status).toBe(422);
  });

  it('[P2-S09-AC-063] requires a boolean required flag and relays the conflict for a required addition over populated data', async () => {
    for (const required of ['true', 1, null, undefined])
      await freshInvalid(A02, fieldWith({ required }), '/required');
    await freshAccepted(A02, fieldWith({ required: false }));
    const harness = makeHarness();
    harness.ports.addFieldDefinition.mockResolvedValueOnce({
      ok: false,
      status: 409,
      code: 'CONFLICT',
      message: 'required over data needs a proven migration',
      details: { conflict: 'INVALID_TRANSITION' },
    });
    const response = await sendHuman(
      harness,
      A02,
      fieldWith({
        stableFieldId: FIELD_ID,
        required: true,
        migrationPlanId: null,
      }),
    );
    expect(response.status).toBe(409);
    expect(response.headers.get('etag')).toBeNull();
  });

  it('[P2-S09-AC-064] keeps defaultMode none, literal or inherited with the missing/null distinction', async () => {
    const literalNull = await freshAccepted(
      A02,
      fieldWith({ defaultMode: 'literal', defaultValue: null }),
    );
    expect(Object.hasOwn(literalNull, 'defaultValue')).toBe(true);
    expect(literalNull.defaultValue).toBeNull();
    const literal = await freshAccepted(
      A02,
      fieldWith({ defaultMode: 'literal', defaultValue: { a: [1] } }),
    );
    expect(literal.defaultValue).toEqual({ a: [1] });
    const none = await freshAccepted(A02, fieldWith({ defaultMode: 'none' }));
    expect(Object.hasOwn(none, 'defaultValue')).toBe(false);
    await freshAccepted(A02, fieldWith({ defaultMode: 'inherited' }));
    await freshInvalid(
      A02,
      fieldWith({ defaultMode: 'literal' }),
      '/defaultValue',
    );
    for (const defaultMode of ['none', 'inherited'])
      for (const defaultValue of [null, 'x', 0])
        await freshInvalid(
          A02,
          fieldWith({ defaultMode, defaultValue }),
          '/defaultValue',
        );
    await freshInvalid(
      A02,
      fieldWith({ defaultMode: 'fixed' }),
      '/defaultMode',
    );
  });

  it('[P2-S09-AC-065] accepts exactly none, localized or no_fallback and never infers localizationMode', async () => {
    for (const localizationMode of ['none', 'localized', 'no_fallback']) {
      const body = await freshAccepted(A02, fieldWith({ localizationMode }));
      expect(body.localizationMode).toBe(localizationMode);
    }
    for (const localizationMode of ['fallback', 'auto', 'LOCALIZED', '', null])
      await freshInvalid(
        A02,
        fieldWith({ localizationMode }),
        '/localizationMode',
      );
    await freshInvalid(
      A02,
      withoutMember('localizationMode'),
      '/localizationMode',
    );
    await freshInvalid(
      A02,
      fieldWith({ defaultLocale: 'en-US' }),
      '/defaultLocale',
    );
  });

  it('[P2-S09-AC-066] keeps editorConfig strict: label 1-120, helpText at most 500, order integer 0-10000', async () => {
    await freshAccepted(
      A02,
      fieldWith({
        editorConfig: {
          label: 'a'.repeat(120),
          helpText: 'h'.repeat(500),
          order: 10000,
        },
      }),
    );
    await freshAccepted(
      A02,
      fieldWith({ editorConfig: { label: 'a', order: 0 } }),
    );
    for (const editorConfig of [
      { label: '', order: 0 },
      { label: '   ', order: 0 },
      { label: 'a'.repeat(121), order: 0 },
      { label: 'a', helpText: 'h'.repeat(501), order: 0 },
      { label: 'a', order: -1 },
      { label: 'a', order: 10001 },
      { label: 'a', order: 1.5 },
      { label: 'a' },
      { order: 0 },
      { label: 'a', order: 0, extra: 1 },
      'label',
      null,
    ])
      await freshInvalid(A02, fieldWith({ editorConfig }), '/editorConfig');
  });

  it('[P2-S09-AC-067] allows only the active, deprecated and retired lifecycle and exposes no deletion route', async () => {
    for (const lifecycle of ['active', 'deprecated', 'retired'])
      await freshAccepted(A02, fieldWith({ lifecycle }));
    for (const lifecycle of [
      'deleted',
      'archived',
      'draft',
      'ACTIVE',
      '',
      null,
    ])
      await freshInvalid(A02, fieldWith({ lifecycle }), '/lifecycle');
    const harness = makeHarness();
    for (const method of ['DELETE', 'PUT', 'PATCH']) {
      const response = await harness.app.request(
        new Request(`https://api.example.test${mutationPath.field}`, {
          method,
          headers: {
            origin: 'https://cms-console.example.test',
            authorization: 'Bearer x',
          },
        }),
      );
      expect(response.status).toBe(404);
    }
    expect(harness.ports.addFieldDefinition).not.toHaveBeenCalled();
    expect(harness.resolveSession).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-068] requires migrationPlanId as a nullable UUID and relays the compatibility refusal', async () => {
    const withPlan = await freshAccepted(
      A02,
      fieldWith({ migrationPlanId: PLAN }),
    );
    expect(withPlan.migrationPlanId).toBe(PLAN);
    const nulled = await freshAccepted(
      A02,
      fieldWith({ migrationPlanId: null }),
    );
    expect(nulled.migrationPlanId).toBeNull();
    await freshInvalid(
      A02,
      withoutMember('migrationPlanId'),
      '/migrationPlanId',
    );
    for (const migrationPlanId of ['plan', '', 7, PLAN.slice(2)])
      await freshInvalid(
        A02,
        fieldWith({ migrationPlanId }),
        '/migrationPlanId',
      );
    const harness = makeHarness();
    harness.ports.addFieldDefinition.mockResolvedValueOnce({
      ok: false,
      status: 409,
      code: 'CONFLICT',
      message: 'a conditional change needs a plan',
      details: { conflict: 'INVALID_TRANSITION' },
    });
    expect(
      (await sendHuman(harness, A02, fieldWith({ migrationPlanId: null })))
        .status,
    ).toBe(409);
  });

  it('[P2-S09-AC-069] writes under an exact strong If-Match and relays a stale-version conflict without a success body', async () => {
    const harness = makeHarness();
    const ok201 = await sendHuman(harness, A02, validField, {
      'if-match': '"7"',
    });
    expect(ok201.status).toBe(201);
    expect(
      (
        harness.ports.addFieldDefinition.mock.calls[0]?.[0] as {
          ifMatch: string;
        }
      ).ifMatch,
    ).toBe('7');
    for (const header of [
      'W/"1"',
      '1',
      '"0"',
      '"01"',
      '""',
      '"1","2"',
      '"9223372036854775808"',
    ]) {
      const refused = makeHarness();
      const response = await sendHuman(refused, A02, validField, {
        'if-match': header,
      });
      expect(response.status, header).toBe(400);
      expect(refused.ports.addFieldDefinition).not.toHaveBeenCalled();
    }
    const missing = makeHarness();
    const noHeader = await missing.app.request(
      jsonRequest(mutationPath.field, validField),
    );
    expect(noHeader.status).toBe(400);
    expect(missing.ports.addFieldDefinition).not.toHaveBeenCalled();
    const stale = makeHarness();
    stale.ports.addFieldDefinition.mockResolvedValueOnce({
      ok: false,
      status: 409,
      code: 'CONFLICT',
      message: 'stale',
      details: {
        conflict: 'VERSION_MISMATCH',
        expectedVersion: '1',
        currentVersion: '3',
      },
    });
    const response = await sendHuman(stale, A02, validField);
    expect(response.status).toBe(409);
    const body = await bodyOf(response);
    expect(body.details).toMatchObject({
      conflict: 'VERSION_MISMATCH',
      recoveryAction: 'reload',
      expectedVersion: '1',
      currentVersion: '3',
    });
    expect(response.headers.get('etag')).toBeNull();
    expect(stale.ports.addFieldDefinition).toHaveBeenCalledTimes(1);
  });

  it('[P2-S09-AC-070] writes nothing when validation, authority or persistence fails: no port call before the RPC and no retry or partial write after it', async () => {
    const invalid = makeHarness();
    await sendHuman(invalid, A02, fieldWith({ kind: 'nope' }));
    const forbidden = makeHarness({
      session: ok({
        userId: field.id,
        actingPartyId: null,
        capabilities: [],
        mfaFresh: true,
      }),
    });
    expect((await sendHuman(forbidden, A02, validField)).status).toBe(403);
    for (const harness of [invalid, forbidden])
      expect(harness.ports.addFieldDefinition).not.toHaveBeenCalled();
    const failing = makeHarness();
    failing.ports.addFieldDefinition.mockResolvedValueOnce({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'down',
      details: {},
    });
    const response = await sendHuman(failing, A02, validField);
    expect(response.status).toBe(503);
    expect(response.headers.get('etag')).toBeNull();
    expect(response.headers.get('location')).toBeNull();
    expect(failing.ports.addFieldDefinition).toHaveBeenCalledTimes(1);
  });

  it('[P2-S09-AC-071] returns a strict 201 FieldDefinitionVersionResource with identity, kind, validator, default, localization, lifecycle, version, hash and plan', async () => {
    const harness = makeHarness();
    const response = await sendHuman(harness, A02, validField);
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    for (const member of [
      'stableFieldId',
      'key',
      'kind',
      'validatorKey',
      'validatorVersion',
      'defaultMode',
      'localizationMode',
      'lifecycle',
      'version',
      'contentHash',
      'migrationPlanId',
    ])
      expect(body, member).toHaveProperty(member);
    expect(response.headers.get('etag')).toBe('"1"');
    const extra = makeHarness();
    extra.ports.addFieldDefinition.mockResolvedValueOnce(
      ok({ ...field, ownerId: FIELD_ID }),
    );
    const refused = await sendHuman(extra, A02, validField);
    expect(refused.status).toBe(502);
    expect(JSON.stringify(await refused.json())).not.toContain(FIELD_ID);
    const missing = makeHarness();
    const partial = Object.fromEntries(
      Object.entries(field).filter(([key]) => key !== 'lifecycle'),
    );
    missing.ports.addFieldDefinition.mockResolvedValueOnce(ok(partial));
    expect((await sendHuman(missing, A02, validField)).status).toBe(502);
  });
});
