import { describe, expect, it, vi } from 'vitest';

import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryError,
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistryPortInput,
  TelemetryEvent,
} from './types';
import type { FeatureContext } from './route-types';
import {
  CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER,
  CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER,
  CONTENT_SCHEMA_REGISTRY_PRIVATE_SERVICE_HOST,
  CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER,
} from '@wejammin/contracts';
import {
  corsOriginsFor,
  errorResponse,
  etagFor,
  isContentSchemaRegistryPrivateServiceRequest,
  isReleasePath,
  policyFor,
  presentationVariantForSession,
  requestIdFor,
  runTelemetry,
  setContentSchemaRegistryCapabilityHeader,
  setRateHeaders,
  successStatusFor,
  validatePortInput,
} from './route-response';

const VALID_ID = '10000000-0000-4000-8000-000000000001';
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const operationId: ContentSchemaRegistryOperationId = 'CMS-03A-01';

const dependencies = (
  telemetry?: ContentSchemaRegistryDependencies['telemetry'],
): Pick<ContentSchemaRegistryDependencies, 'telemetry'> =>
  telemetry === undefined ? {} : { telemetry };

const responseContext = () => {
  const headers = new Map<string, string>();
  const context = {
    get: vi.fn(() => undefined),
    header: vi.fn((name: string, value: string) => headers.set(name, value)),
    json: vi.fn(
      (body: unknown, status: number) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  } as unknown as FeatureContext;
  return { context, headers };
};

const failure = (
  status: ContentSchemaRegistryError['status'],
  code = 'BAD_REQUEST',
  message = 'safe message',
  details?: Readonly<Record<string, unknown>>,
  retryAfterSeconds?: number,
): ContentSchemaRegistryError => ({
  ok: false,
  status,
  code,
  message,
  ...(details === undefined ? {} : { details }),
  ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});

describe('content schema registry route response helpers', () => {
  it('maps success statuses, policies, paths, origins, and rate headers', () => {
    expect(successStatusFor('CMS-03A-04', { jobId: null })).toBe(200);
    expect(successStatusFor('CMS-03A-04', { jobId: 'job-1' })).toBe(202);
    expect(successStatusFor('CMS-03A-04', null)).toBe(202);
    expect(successStatusFor('CMS-03A-01', 'primitive')).toBe(201);
    expect(policyFor(operationId).operationId).toBe(operationId);
    expect(() =>
      policyFor('CMS-03A-01-invalid' as ContentSchemaRegistryOperationId),
    ).toThrow('Content registry route policy missing.');

    expect(isReleasePath('/api/v1/cms/blocks/versions')).toBe(true);
    expect(isReleasePath('/api/v1/cms/blocks/versions/7')).toBe(true);
    expect(isReleasePath('/api/v1/cms/blocks')).toBe(false);
    const dependencies = {
      releaseOrigins: ['https://release.test'],
      humanOrigins: ['https://human.test'],
    } as never;
    expect(corsOriginsFor('/api/v1/cms/blocks/versions', dependencies)).toEqual(
      ['https://release.test'],
    );
    expect(corsOriginsFor('/api/v1/cms/blocks', dependencies)).toEqual([
      'https://human.test',
    ]);

    const { context, headers } = responseContext();
    setRateHeaders(context, { limit: 10, remaining: 8, resetAt: 123 });
    expect(headers).toEqual(
      new Map([
        ['ratelimit-limit', '10'],
        ['ratelimit-remaining', '8'],
        ['ratelimit-reset', '123'],
      ]),
    );
  });

  it('accepts only the private service origin and trusted capability context', () => {
    expect(
      isContentSchemaRegistryPrivateServiceRequest(
        new Request(
          `https://${CONTENT_SCHEMA_REGISTRY_PRIVATE_SERVICE_HOST}/path`,
        ),
      ),
    ).toBe(true);
    expect(
      isContentSchemaRegistryPrivateServiceRequest(
        new Request('http://cms-internal.wejammin.internal/path'),
      ),
    ).toBe(false);
    expect(
      isContentSchemaRegistryPrivateServiceRequest(
        new Request('https://other.wejammin.internal/path'),
      ),
    ).toBe(false);
    expect(
      isContentSchemaRegistryPrivateServiceRequest({
        url: 'not a URL',
      } as Request),
    ).toBe(false);

    const { context, headers } = responseContext();
    setContentSchemaRegistryCapabilityHeader(
      context,
      ['cms.schema_registry.read', 'untrusted', 'cms.schema_registry.read'],
      'ownerFull',
      VALID_ID,
      VALID_ID,
    );
    expect(headers).toEqual(
      new Map([
        [CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER, 'cms.schema_registry.read'],
        [CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER, 'ownerFull'],
        [CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER, VALID_ID],
        [CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER, VALID_ID],
      ]),
    );

    const empty = responseContext();
    setContentSchemaRegistryCapabilityHeader(
      empty.context,
      ['untrusted'],
      'unknown',
      'not-a-uuid',
      null,
    );
    expect(empty.headers).toEqual(new Map());
    setContentSchemaRegistryCapabilityHeader(
      empty.context,
      [],
      undefined,
      undefined,
      undefined,
    );
    expect(empty.headers).toEqual(new Map());
  });

  it('selects the least-privileged valid presentation variant', () => {
    expect(
      presentationVariantForSession({
        capabilities: [],
        presentationVariant: 'ownerFull',
      }),
    ).toBe('ownerFull');
    expect(
      presentationVariantForSession({
        capabilities: ['cms.schema_designer'],
        presentationVariant: 'unknown',
      }),
    ).toBe('ownerFull');
    expect(
      presentationVariantForSession({
        capabilities: ['cms.schema_registry.read'],
      }),
    ).toBe('entitledRead');
    expect(presentationVariantForSession({ capabilities: [] })).toBeUndefined();
  });

  it('sanitizes error responses and emits retry metadata', async () => {
    const cases: Array<[ContentSchemaRegistryError, string]> = [
      [
        failure(500, 'INTERNAL_ERROR', 'private'),
        'An unexpected error occurred.',
      ],
      [
        failure(504, 'DEPENDENCY_DEADLINE_EXCEEDED', 'private'),
        'The CMS registry dependency exceeded its deadline.',
      ],
      [
        failure(502, 'DEPENDENCY_INVALID_RESPONSE', 'private', {
          retryable: true,
        }),
        'The CMS registry dependency returned an invalid response.',
      ],
      [
        failure(503, 'OTHER_DEPENDENCY', 'private'),
        'The CMS registry dependency is temporarily unavailable.',
      ],
      [failure(400, 'PUBLIC_CODE', 'client'), 'client'],
      [failure(400, 'bad code', 'client'), 'client'],
    ];
    for (const [result, message] of cases) {
      const { context, headers } = responseContext();
      const response = errorResponse(context, result, REQUEST_ID);
      expect(response.status).toBe(result.status);
      expect(context.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code:
            result.code === 'bad code'
              ? 'INTERNAL_ERROR'
              : result.status >= 502 && result.status <= 504
                ? 'DEPENDENCY_UNAVAILABLE'
                : result.code,
          message,
          requestId: REQUEST_ID,
        }),
        result.status,
      );
      expect(headers.get('cache-control')).toBe('no-store');
    }
    const retry = responseContext();
    errorResponse(
      retry.context,
      failure(503, 'BAD', 'private', { retryable: false }, 7),
      REQUEST_ID,
    );
    expect(retry.headers.get(CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER)).toBe(
      'true',
    );
    expect(retry.headers.get('retry-after')).toBe('7');
    for (const status of [502, 504] as const) {
      const { context, headers } = responseContext();
      errorResponse(
        context,
        failure(status, 'BAD', 'private', { retryable: true }),
        REQUEST_ID,
      );
      expect(headers.get(CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER)).toBe(
        'true',
      );
      expect(headers.has('retry-after')).toBe(false);
    }
    const noRetryHeader = responseContext();
    errorResponse(noRetryHeader.context, failure(409), REQUEST_ID);
    expect(noRetryHeader.headers.has('x-cms-retryable')).toBe(false);
    expect(noRetryHeader.headers.has('retry-after')).toBe(false);
    await expect(Promise.resolve()).resolves.toBeUndefined();
  });

  it('normalizes request ids, ETags, port input, and telemetry failures', async () => {
    expect(
      requestIdFor(
        new Request('https://api.test', {
          headers: { 'x-request-id': REQUEST_ID },
        }),
      ),
    ).toBe(REQUEST_ID);
    const generated = requestIdFor(new Request('https://api.test'));
    expect(generated).toMatch(/^[0-9a-f-]{36}$/u);
    expect(
      requestIdFor(
        new Request('https://api.test', {
          headers: { 'x-request-id': 'invalid' },
        }),
      ),
    ).toMatch(/^[0-9a-f-]{36}$/u);
    expect(etagFor(null)).toBeNull();
    expect(etagFor('primitive')).toBeNull();
    expect(etagFor({ version: '7' })).toBe('"7"');
    expect(etagFor({ version: '0' })).toBeNull();
    expect(etagFor({ version: 7 })).toBeNull();
    const input: ContentSchemaRegistryPortInput = {
      operationId,
      request: new Request('https://api.test'),
      requestId: REQUEST_ID,
    };
    expect(validatePortInput('CMS-03A-06', input)).toMatchObject({
      request: input.request,
      requestId: input.requestId,
      operationId: 'CMS-03A-06',
    });

    const event: TelemetryEvent = {
      operationId,
      requestId: REQUEST_ID,
      outcome: 'success',
      status: 200,
      durationMs: 1,
      actorClass: 'human',
    };
    await expect(runTelemetry(dependencies(), event)).resolves.toBeUndefined();
    const telemetry = vi.fn(async () => undefined);
    await expect(
      runTelemetry(dependencies(telemetry), event),
    ).resolves.toBeUndefined();
    const broken = vi.fn(async () => {
      throw new Error('telemetry unavailable');
    });
    await expect(
      runTelemetry(dependencies(broken), event),
    ).resolves.toBeUndefined();
    expect(telemetry).toHaveBeenCalledWith(event);
    expect(broken).toHaveBeenCalledWith(event);
  });
});
