// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import {
  SchemaActivationResourceSchema,
  SchemaReviewAssignmentRequestSchema,
} from '@wejammin/contracts';

import { forwardContentSchemaRegistryMutation } from '../../server/content-schema-registry-platform-api';
import type { ContentSchemaRegistryMutationTarget } from '../../server/content-schema-registry-platform-api';
import {
  CASES,
  closeMounted,
  holder,
  type Case,
} from './content-schema-registry-s09-r4-mapping-forms.test-support';
import {
  assignmentResource,
  decisionResource,
  dryRunResource,
  reviewResource,
} from './content-schema-review-dec108.test-support';
import {
  buttonNamed,
  choose,
  click,
  inputByLabel,
  type,
} from './content-schema-registry-locale-fields.test-support';
import {
  hash,
  sentinelDetail,
  uuid,
} from './content-schema-registry-s09-r4-mapping.test-support';

/**
 * FE03 generated-fixture integration: each real form is filled as a person
 * would fill it, crosses the real facade and must reach the platform as the
 * exact generated request body with the idempotency, CSRF, If-Match and JSON
 * headers; the platform's success answer must pass through unchanged.
 */

afterEach(() => {
  closeMounted();
  vi.unstubAllGlobals();
});

const detail = sentinelDetail();
const activation = SchemaActivationResourceSchema.parse({
  id: uuid(500),
  version: '5',
  contentHash: hash(501),
  createdAt: '2026-10-02T12:00:00.000Z',
  updatedAt: '2026-10-02T12:00:00.000Z',
  state: 'active',
  contentTypeVersionId: uuid(1),
  activatedAt: null,
  migrationPlanId: null,
  localeConfigHash: hash(502),
  activationEvidence: detail.resource.activationEvidence,
  jobId: uuid(503),
  eventType: 'cms.schema.activated.v1',
});

const setField = (form: HTMLFormElement, name: string, value: string): void => {
  const field = form.elements.namedItem(name) as HTMLInputElement | null;
  if (field === null) throw new Error(`no field ${name}`);
  field.value = value;
};
const check = (form: HTMLFormElement, name: string): void => {
  (form.elements.namedItem(name) as HTMLInputElement).checked = true;
};

interface Spec {
  readonly status: number;
  readonly success: unknown;
  readonly fill: (form: HTMLFormElement) => void;
  readonly expected: Record<string, unknown>;
  readonly ifMatch: boolean;
}

const SPECS: Readonly<Record<string, Spec>> = {
  'CMS-03A-01': {
    status: 201,
    success: detail.resource,
    ifMatch: false,
    fill: (form) => {
      const view = holder.mounted!;
      setField(form, 'typeKey', 'release_note');
      setField(form, 'label', 'Release note');
      setField(form, 'ownerCapability', 'cms.schema_designer');
      setField(form, 'workflowKey', 'cms.content.workflow');
      setField(form, 'workflowVersion', '1');
      const tags = inputByLabel(view.container, 'Add a language tag');
      for (const tag of ['en-US', 'fr']) {
        type(tags, tag);
        click(buttonNamed(view.container, 'Add'));
      }
      choose(
        inputByLabel(
          view.container,
          'Source language',
        ) as unknown as HTMLSelectElement,
        'en-US',
      );
      choose(
        inputByLabel(
          view.container,
          'Default language',
        ) as unknown as HTMLSelectElement,
        'en-US',
      );
    },
    expected: {
      typeKey: 'release_note',
      label: 'Release note',
      ownerCapability: 'cms.schema_designer',
      sourceLocale: 'en-US',
      defaultLocale: 'en-US',
      supportedLocales: ['en-US', 'fr'],
      fallbackChains: { fr: ['en-US'] },
      workflowKey: 'cms.content.workflow',
      workflowVersion: '1',
      defaultTemplateVersionId: null,
      fields: [],
      relations: [],
      templateBindings: [],
      capabilityBindings: [],
    },
  },
  'CMS-03A-02': {
    status: 201,
    success: detail.fields[0],
    ifMatch: true,
    fill: (form) => {
      setField(form, 'key', 'title');
      check(form, 'required');
    },
    expected: {
      key: 'title',
      kind: 'short_text',
      constraints: {},
      required: true,
      validatorKey: null,
      validatorVersion: null,
      defaultMode: 'none',
      localizationMode: 'none',
      editorConfig: { label: 'Field', order: 0 },
      lifecycle: 'active',
      migrationPlanId: null,
    },
  },
  'CMS-03A-03': {
    status: 201,
    success: detail.relations[0],
    ifMatch: true,
    fill: (form) => {
      setField(form, 'fieldId', uuid(35));
      setField(form, 'targetType', 'release_note');
      setField(form, 'projectionKey', 'related');
      setField(form, 'cardinality', 'many');
      setField(form, 'min', '0');
      setField(form, 'max', '5');
      check(form, 'ordered');
    },
    expected: {
      fieldId: uuid(35),
      targetKind: 'content',
      targetType: 'release_note',
      projectionKey: 'related',
      cardinality: 'many',
      min: 0,
      max: 5,
      ordered: true,
      onUnavailable: 'omit',
    },
  },
  'CMS-03A-04': {
    status: 202,
    success: activation,
    ifMatch: true,
    fill: (form) => check(form, 'confirmed'),
    expected: {},
  },
  'CMS-03A-09': {
    status: 201,
    success: detail.resource,
    ifMatch: true,
    fill: () => undefined,
    expected: {
      supportedLocales: null,
      fallbackChains: null,
      defaultTemplateVersionId: null,
      templateBindings: null,
    },
  },
  'CMS-03A-10': {
    status: 202,
    success: dryRunResource(),
    ifMatch: true,
    fill: () => undefined,
    expected: { transformKey: null, transformVersion: null },
  },
  'CMS-03A-11': {
    status: 201,
    success: reviewResource(),
    ifMatch: true,
    fill: () => undefined,
    expected: {},
  },
  'CMS-03A-12': {
    status: 201,
    success: decisionResource(),
    ifMatch: true,
    fill: (form) => {
      const approve = [
        ...form.querySelectorAll<HTMLInputElement>('input[name="decision"]'),
      ].find((radio) => radio.value === 'approve');
      if (approve !== undefined) approve.checked = true;
    },
    expected: { decision: 'approve' },
  },
};

const fieldValue = (form: HTMLFormElement, name: string): string | null => {
  const field = form.elements.namedItem(name) as HTMLInputElement | null;
  return field === null ? null : field.value;
};

const forward = async (
  form: HTMLFormElement,
  operationId: string,
  spec: Spec,
) => {
  const params = new URLSearchParams();
  for (const [name, value] of new FormData(form).entries())
    if (typeof value === 'string') params.append(name, value);
  const csrf = fieldValue(form, 'csrf') ?? '';
  const target: ContentSchemaRegistryMutationTarget = {
    operationId:
      operationId as ContentSchemaRegistryMutationTarget['operationId'],
    ...(fieldValue(form, 'versionId') === null
      ? {}
      : {
          contentTypeId: fieldValue(form, 'contentTypeId') ?? '',
          versionId: fieldValue(form, 'versionId') ?? '',
        }),
    ...(fieldValue(form, 'reviewId') === null
      ? {}
      : { reviewId: fieldValue(form, 'reviewId') ?? '' }),
  };
  let upstream: Request | null = null;
  const binding = {
    fetch: vi.fn(async (input: RequestInfo | URL) => {
      upstream = input instanceof Request ? input : new Request(input);
      return new Response(JSON.stringify(spec.success), {
        status: spec.status,
        headers: { 'content-type': 'application/json', etag: '"9"' },
      });
    }),
  };
  const response = await forwardContentSchemaRegistryMutation(
    new Request('https://app.test/app/cms-content-modeling', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `wj_access=session; wj_csrf=${csrf}`,
        origin: 'https://app.test',
      },
      body: params,
    }),
    binding,
    target,
  );
  return { response, upstream: upstream as Request | null, binding };
};

describe('every browser command crosses the facade as its generated request', () => {
  it.each(Object.keys(SPECS))(
    '[P2-S09-AC-222] [P2-S09-AC-225] [P2-S09-AC-259] [P2-S09-AC-264] %s sends the exact body, headers and passes the authoritative answer through',
    async (operationId) => {
      const spec = SPECS[operationId] as Spec;
      const c = CASES.find((candidate) => candidate.id === operationId) as Case;
      const form = c.form();
      spec.fill(form);
      const { response, upstream, binding } = await forward(
        form,
        operationId,
        spec,
      );
      expect(binding.fetch).toHaveBeenCalledTimes(1);
      const request = upstream as unknown as Request;
      expect(request.method).toBe('POST');
      expect(request.headers.get('content-type')).toBe('application/json');
      expect(request.headers.get('idempotency-key')).toBe(
        fieldValue(form, 'idempotency-key'),
      );
      expect(request.headers.get('x-csrf-token')).toBe(
        fieldValue(form, 'csrf'),
      );
      expect(request.headers.get('if-match')).toBe(
        spec.ifMatch ? fieldValue(form, 'if-match') : null,
      );
      const body = (await request.clone().json()) as Record<string, unknown>;
      // The strict generated schema accepts exactly what was sent.
      expect((c.schema as z.ZodType).safeParse(body).success).toBe(true);
      expect(Object.keys(body)).not.toContain('operationId');
      expect(Object.keys(body)).not.toContain('csrf');
      expect(body).toMatchObject(spec.expected);
      expect(response.status).toBe(spec.status);
      expect(await response.clone().json()).toStrictEqual(
        JSON.parse(JSON.stringify(spec.success)),
      );
    },
  );

  it('[P2-S09-AC-225] the activation form carries the prefilled approvals and dry run, the confirmation and the expected version', async () => {
    const c = CASES.find((candidate) => candidate.id === 'CMS-03A-04') as Case;
    const form = c.form();
    const spec = SPECS['CMS-03A-04'] as Spec;
    spec.fill(form);
    const { upstream } = await forward(form, 'CMS-03A-04', spec);
    const body = (await (upstream as unknown as Request)
      .clone()
      .json()) as Record<string, unknown>;
    expect(body.dryRunId).toBe(fieldValue(form, 'dryRunId'));
    expect(body.expectedVersion).toBe(fieldValue(form, 'expectedVersion'));
    expect((body.approvalIds as string[]).length).toBe(2);
    expect(body.migrationPlanId).toBeNull();
    expect(Object.keys(body)).not.toContain('confirmed');
  });

  it('[P2-S09-AC-225] without the confirmation the activation is refused locally and never forwarded', async () => {
    const c = CASES.find((candidate) => candidate.id === 'CMS-03A-04') as Case;
    const form = c.form();
    const { response, binding } = await forward(
      form,
      'CMS-03A-04',
      SPECS['CMS-03A-04'] as Spec,
    );
    expect(response.status).toBe(403);
    expect(binding.fetch).not.toHaveBeenCalled();
  });
});

describe('CMS-03A-14 create and revoke', () => {
  const assignmentSpec = (
    status: number,
    fill: (form: HTMLFormElement) => void,
  ): Spec => ({
    status,
    success: assignmentResource(status === 200 ? 'revoked' : 'active'),
    ifMatch: true,
    fill,
    expected: {},
  });

  it('[P2-S09-AC-259] [P2-S09-AC-264] the create form sends the reviewer reference, expiry and reason as the create variant', async () => {
    const c = CASES.find(
      (candidate) => candidate.id === 'CMS-03A-14' && candidate.variant === 0,
    ) as Case;
    const form = c.form();
    const spec = assignmentSpec(201, (target) => {
      setField(target, 'reviewerPersonId', uuid(600));
      setField(target, 'expiresAt', '2026-10-05T12:00:00.000Z');
      setField(target, 'reason', 'Review the legal fields');
    });
    spec.fill(form);
    const { upstream, response } = await forward(form, 'CMS-03A-14', spec);
    const body = await (upstream as unknown as Request).clone().json();
    expect(SchemaReviewAssignmentRequestSchema.safeParse(body).success).toBe(
      true,
    );
    expect(body).toMatchObject({
      action: 'create',
      reviewerPersonId: uuid(600),
      expiresAt: '2026-10-05T12:00:00.000Z',
      reason: 'Review the legal fields',
    });
    expect(response.status).toBe(201);
  });

  it('[P2-S09-AC-259] [P2-S09-AC-264] the revoke form sends the assignment reference as the revoke variant', async () => {
    const c = CASES.find(
      (candidate) => candidate.id === 'CMS-03A-14' && candidate.variant === 1,
    ) as Case;
    const form = c.form();
    const spec = assignmentSpec(200, () => undefined);
    const { upstream, response } = await forward(form, 'CMS-03A-14', spec);
    const body = (await (upstream as unknown as Request)
      .clone()
      .json()) as Record<string, unknown>;
    expect(SchemaReviewAssignmentRequestSchema.safeParse(body).success).toBe(
      true,
    );
    expect(body).toMatchObject({
      action: 'revoke',
      assignmentId: fieldValue(form, 'assignmentId'),
    });
    expect(Object.keys(body)).not.toContain('reviewerPersonId');
    expect(response.status).toBe(200);
  });
});
