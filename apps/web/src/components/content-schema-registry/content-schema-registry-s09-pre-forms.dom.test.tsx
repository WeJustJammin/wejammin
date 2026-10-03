// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  FieldSchemaChangeRequestSchema,
  RelationBindingRequestSchema,
} from '@wejammin/contracts';

import {
  TYPE_ID,
  VERSION_ID,
  callFacade,
  forward,
  mutationOrigin,
} from './content-schema-review-dec108.test-support';
import {
  fieldRecord,
  renderDocument,
  requireForm,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';
import { completeContentSchemaRegistryMutation } from './content-schema-registry-runtime-dom-mutation-complete';
import { executeContentSchemaRegistryMutation } from './content-schema-registry-runtime';
import type { Dec108Target } from './content-schema-review-dec108.test-support';

/**
 * FE03 CMS-03A-02 and CMS-03A-03 forms, driven the way a browser drives them:
 * the rendered native form is submitted to the real mutation facade and the
 * private upstream sees the generated request, its path ids and its headers.
 */

const FIELD_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const targetFor = (operationId: 'CMS-03A-02' | 'CMS-03A-03'): Dec108Target => ({
  operationId: operationId as never,
  contentTypeId: TYPE_ID,
  versionId: VERSION_ID,
});
const fieldResource = {
  resourceKind: 'field_definition_version',
  id: FIELD_ID,
  version: '5',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-10-02T12:00:00.000Z',
  updatedAt: '2026-10-02T12:00:00.000Z',
  contentTypeVersionId: VERSION_ID,
  stableFieldId: FIELD_ID,
  key: 'headline',
  kind: 'short_text',
  required: true,
  validatorKey: null,
  validatorVersion: null,
  defaultMode: 'none',
  localizationMode: 'localized',
  lifecycle: 'active',
  migrationPlanId: null,
};
const relationResource = {
  resourceKind: 'relation_definition',
  id: FIELD_ID,
  version: '5',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-10-02T12:00:00.000Z',
  updatedAt: '2026-10-02T12:00:00.000Z',
  state: 'draft',
  contentTypeVersionId: VERSION_ID,
  fieldId: FIELD_ID,
  targetKind: 'content',
  targetType: 'artist',
  projectionKey: 'public.summary',
  cardinality: 'many',
  min: 0,
  max: 8,
  ordered: false,
  onUnavailable: 'placeholder',
};
const COOKIE = {
  cookie: 'wj_access=session; wj_csrf=csrf-token',
  'x-csrf-token': null,
  'idempotency-key': null,
  'if-match': null,
} as const;

const OMIT = '__omit__';
const submit = async (
  operationId: 'CMS-03A-02' | 'CMS-03A-03',
  edit: Readonly<Record<string, string>>,
  upstream: { status: number; body: unknown },
  headers: Readonly<Record<string, string | null>> = COOKIE,
) => {
  const form = requireForm(renderDocument(versionPageProps()), operationId);
  const fields: Record<string, string> = { ...fieldRecord(form), ...edit };
  for (const [name, value] of Object.entries(edit))
    if (value === OMIT) delete fields[name];
  const result = await callFacade({
    target: targetFor(operationId),
    form: fields,
    headers,
    upstream,
  });
  return { ...result, fields, form };
};

const FIELD_EDIT = {
  key: 'headline',
  kind: 'short_text',
  constraints: '{"minLength":1,"maxLength":80}',
  required: 'on',
  localizationMode: 'localized',
  editorConfig:
    '{"label":"Headline","helpText":"Shown above the story","order":1}',
};
const RELATION_EDIT = {
  fieldId: FIELD_ID,
  targetKind: 'content',
  targetType: 'artist',
  projectionKey: 'public.summary',
  cardinality: 'many',
  min: '0',
  max: '8',
  ordered: 'on',
  onUnavailable: 'placeholder',
};

describe('[P2-S09-AC-223] the CMS-03A-02 form', () => {
  it('sends the exact path ids, a FieldSchemaChangeRequest with the required nullable migrationPlanId and the idempotency, If-Match, JSON and CSRF contract', async () => {
    const { response, forwarded, forwardedBody, fields } = await submit(
      'CMS-03A-02',
      FIELD_EDIT,
      { status: 201, body: fieldResource },
    );
    expect(response.status).toBe(201);
    expect(new URL(forwarded?.url ?? '').pathname).toBe(
      `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}/fields`,
    );
    expect(forwardedBody).toStrictEqual({
      key: 'headline',
      kind: 'short_text',
      constraints: { minLength: 1, maxLength: 80 },
      required: true,
      validatorKey: null,
      validatorVersion: null,
      defaultMode: 'none',
      localizationMode: 'localized',
      editorConfig: {
        label: 'Headline',
        helpText: 'Shown above the story',
        order: 1,
      },
      lifecycle: 'active',
      migrationPlanId: null,
    });
    expect(
      FieldSchemaChangeRequestSchema.safeParse(forwardedBody).success,
    ).toBe(true);
    expect(Object.hasOwn(forwardedBody as object, 'migrationPlanId')).toBe(
      true,
    );
    expect(forwarded?.headers.get('idempotency-key')).toBe(
      fields['idempotency-key'],
    );
    expect(fields['idempotency-key']?.length).toBeGreaterThanOrEqual(8);
    expect(forwarded?.headers.get('if-match')).toBe('"4"');
    expect(forwarded?.headers.get('content-type')).toMatch(
      /^application\/json/u,
    );
    expect(forwarded?.method).toBe('POST');
  });

  it('forwards a real migration plan id verbatim and refuses a malformed one locally', async () => {
    const plan = '61f5c8a2-b04d-7936-8c7e-e3a290d4f1b5';
    const ok = await submit(
      'CMS-03A-02',
      { ...FIELD_EDIT, migrationPlanId: plan },
      { status: 201, body: fieldResource },
    );
    expect(
      (ok.forwardedBody as { migrationPlanId: string }).migrationPlanId,
    ).toBe(plan);
    const bad = await submit(
      'CMS-03A-02',
      { ...FIELD_EDIT, migrationPlanId: 'not-a-plan' },
      { status: 201, body: fieldResource },
    );
    expect(bad.response.status).toBe(422);
    expect(bad.fetch).not.toHaveBeenCalled();
  });

  it('is refused locally, with no upstream call, for a missing CSRF cookie, a mismatched CSRF value, a missing key or a missing or weak ETag', async () => {
    for (const [name, edit, headers, status] of [
      ['no csrf cookie', {}, { ...COOKIE, cookie: 'wj_access=session' }, 403],
      ['mismatched csrf', { csrf: 'other-token' }, COOKIE, 403],
      ['short idempotency key', { 'idempotency-key': 'short' }, COOKIE, 400],
      ['missing if-match', { 'if-match': '' }, COOKIE, 400],
      ['weak if-match', { 'if-match': 'W/"4"' }, COOKIE, 400],
      ['other operation id', { operationId: 'CMS-03A-03' }, COOKIE, 400],
    ] as const) {
      const result = await submit(
        'CMS-03A-02',
        { ...FIELD_EDIT, ...edit },
        { status: 201, body: fieldResource },
        headers,
      );
      expect(result.response.status, name).toBe(status);
      expect(result.fetch, name).not.toHaveBeenCalled();
    }
  });

  it('is refused locally for a path id that is not a UUID and for an unknown member, and never forwards a caller-supplied path', async () => {
    const wrongPath = await callFacade({
      target: {
        operationId: 'CMS-03A-02' as never,
        contentTypeId: 'not-a-uuid',
        versionId: VERSION_ID,
      },
      form: {
        ...fieldRecord(
          requireForm(renderDocument(versionPageProps()), 'CMS-03A-02'),
        ),
        ...FIELD_EDIT,
      },
      headers: COOKIE,
      upstream: { status: 201, body: fieldResource },
    });
    expect(wrongPath.response.status).toBeGreaterThanOrEqual(400);
    expect(wrongPath.fetch).not.toHaveBeenCalled();
    const extra = await submit(
      'CMS-03A-02',
      { ...FIELD_EDIT, ownerId: TYPE_ID, contentTypeId: FIELD_ID },
      { status: 201, body: fieldResource },
    );
    expect(extra.fetch).not.toHaveBeenCalled();
    expect(extra.response.status).toBeGreaterThanOrEqual(400);
  });

  it('announces the 201 field resource as saved and shows it in the canonical detail the page refetches', async () => {
    const { form } = await submit('CMS-03A-02', FIELD_EDIT, {
      status: 201,
      body: fieldResource,
    });
    document.body.appendChild(form);
    completeContentSchemaRegistryMutation(
      form,
      {
        outcome: 'success',
        resource: fieldResource,
        location: null,
        formData: new FormData(form),
      } as never,
      window,
      new Set(),
    );
    const status = form.querySelector('[role="status"]');
    expect(status?.textContent).toMatch(/accepted/iu);
    form.remove();
    const doc = renderDocument(
      versionPageProps({
        initialDetail: {
          status: 'success',
          version: '5',
          stale: false,
          data: {
            ...(versionPageProps().initialDetail as { data: object }).data,
            fields: [fieldResource],
          } as never,
        } as never,
      }),
    );
    const text = doc.body.textContent ?? '';
    expect(text).toContain('headline');
    expect(text).toContain('short_text');
  });
});

describe('[P2-S09-AC-224] the CMS-03A-03 form', () => {
  it('sends the exact path ids, a RelationBindingRequest and the idempotency, If-Match, JSON and CSRF contract', async () => {
    const { response, forwarded, forwardedBody, fields } = await submit(
      'CMS-03A-03',
      RELATION_EDIT,
      { status: 201, body: relationResource },
    );
    expect(response.status).toBe(201);
    expect(new URL(forwarded?.url ?? '').pathname).toBe(
      `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}/relations`,
    );
    expect(forwardedBody).toStrictEqual({
      fieldId: FIELD_ID,
      targetKind: 'content',
      targetType: 'artist',
      projectionKey: 'public.summary',
      cardinality: 'many',
      min: 0,
      max: 8,
      ordered: true,
      onUnavailable: 'placeholder',
    });
    expect(RelationBindingRequestSchema.safeParse(forwardedBody).success).toBe(
      true,
    );
    expect(forwarded?.headers.get('idempotency-key')).toBe(
      fields['idempotency-key'],
    );
    expect(forwarded?.headers.get('if-match')).toBe('"4"');
    expect(forwarded?.headers.get('content-type')).toMatch(
      /^application\/json/u,
    );
    // The CSRF token reaches the Worker as the X-CSRF-Token header (the
    // façade forwards the session-bound value the form carried).
    expect(fields.csrf).toBe('csrf-token');
    expect(forwarded?.headers.get('x-csrf-token')).toBe(fields.csrf);
  });

  it('serializes unchecked ordered as false and numbers as numbers, and refuses an out-of-bounds relation locally', async () => {
    const { forwardedBody } = await submit(
      'CMS-03A-03',
      { ...RELATION_EDIT, ordered: OMIT },
      { status: 201, body: relationResource },
    );
    expect(
      (forwardedBody as { ordered: unknown; min: unknown; max: unknown })
        .ordered,
    ).toBe(false);
    expect(typeof (forwardedBody as { min: unknown }).min).toBe('number');
    for (const edit of [
      { cardinality: 'one', min: '0', max: '5' },
      { min: '9', max: '8' },
      { max: '129' },
      { projectionKey: 'a; drop table x' },
      { targetKind: 'table' },
    ]) {
      const refused = await submit(
        'CMS-03A-03',
        { ...RELATION_EDIT, ...edit },
        { status: 201, body: relationResource },
      );
      expect(refused.fetch, JSON.stringify(edit)).not.toHaveBeenCalled();
      expect(refused.response.status).toBeGreaterThanOrEqual(400);
    }
  });

  it('is refused locally for a missing CSRF cookie, a mismatched CSRF value, a short key and a missing ETag', async () => {
    for (const [edit, headers, status] of [
      [{}, { ...COOKIE, cookie: 'wj_access=session' }, 403],
      [{ csrf: 'other' }, COOKIE, 403],
      [{ 'idempotency-key': 'short' }, COOKIE, 400],
      [{ 'if-match': '' }, COOKIE, 400],
    ] as const) {
      const result = await submit(
        'CMS-03A-03',
        { ...RELATION_EDIT, ...edit },
        { status: 201, body: relationResource },
        headers,
      );
      expect(result.response.status).toBe(status);
      expect(result.fetch).not.toHaveBeenCalled();
    }
  });

  it('announces the 201 relation resource the facade returned, read by the real browser client, and shows that resource in the canonical detail', async () => {
    const { form, response, fields } = await submit(
      'CMS-03A-03',
      RELATION_EDIT,
      { status: 201, body: relationResource },
    );
    expect(response.status).toBe(201);
    const formData = new FormData();
    for (const [name, value] of Object.entries(fields))
      formData.set(name, value);
    // The real client reads the real facade response: nothing here hand-builds
    // the outcome or the resource the page then renders.
    const result = await executeContentSchemaRegistryMutation({
      action: form.getAttribute('action') ?? '',
      operationId: 'CMS-03A-03',
      formData,
      fetcher: async () => response.clone(),
    });
    expect(result.outcome).toBe('success');
    expect(result.status).toBe(201);
    // The client reads the resource only for activation; every other command
    // shows the canonical server projection after the refetch. The projection
    // below is the body the facade really returned, not a test constant.
    const created: unknown = await response.clone().json();
    expect(created).toMatchObject({
      resourceKind: 'relation_definition',
      targetType: 'artist',
      projectionKey: 'public.summary',
    });
    document.body.appendChild(form);
    completeContentSchemaRegistryMutation(form, result, window, new Set());
    expect(form.querySelector('[role="status"]')?.textContent).toMatch(
      /accepted/iu,
    );
    form.remove();
    const doc = renderDocument(
      versionPageProps({
        initialDetail: {
          status: 'success',
          version: '5',
          stale: false,
          data: {
            ...(versionPageProps().initialDetail as { data: object }).data,
            relations: [created],
          } as never,
        } as never,
      }),
    );
    const text = doc.body.textContent ?? '';
    expect(text).toContain('artist');
    expect(text).toContain('public.summary');
  });
});

describe('the facade admits no release operation', () => {
  it('refuses CMS-03A-05 and CMS-03A-08 as browser mutation targets before any upstream call', async () => {
    for (const operationId of ['CMS-03A-05', 'CMS-03A-08']) {
      const result = await callFacade({
        target: {
          operationId,
          contentTypeId: TYPE_ID,
          versionId: VERSION_ID,
        } as never,
        payload: {},
        headers: COOKIE,
        upstream: { status: 201, body: {} },
      });
      expect(result.response.status, operationId).toBeGreaterThanOrEqual(400);
      expect(result.fetch, operationId).not.toHaveBeenCalled();
    }
    expect(forward).toBeDefined();
    expect(mutationOrigin).toContain('https://');
  });
});
