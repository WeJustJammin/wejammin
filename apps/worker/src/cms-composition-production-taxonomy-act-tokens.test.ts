import { afterEach, describe, expect, it, vi } from 'vitest';
import { CmsCompositionRefusalDetailsSchema } from '@wejammin/contracts';

import { createActHarness } from './cms-composition-production-taxonomy-act.test-support';
import { PROVIDER_FAULTS } from './cms-composition-production-provider-fault.test-support';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const canonicalId = '99999999-9999-4999-8999-999999999999';
const raised = (message: string, details?: string, status = 400): Response =>
  Response.json(
    { code: 'P0001', message, ...(details === undefined ? {} : { details }) },
    { status },
  );

describe('CMS-03C-03 production port: token mapping (BE03c 1290, 1298-1306, 1375)', () => {
  const rows: readonly [
    string,
    () => Response,
    number,
    string,
    Record<string, unknown>,
  ][] = [
    [
      'capability_missing',
      () => raised('capability_missing'),
      403,
      'TAXONOMY_FORBIDDEN',
      { reasonCode: 'capability_missing' },
    ],
    [
      'taxonomy_not_active',
      () => raised('taxonomy_not_active'),
      409,
      'TAXONOMY_VERSION_CONFLICT',
      { reasonCode: 'taxonomy_not_active' },
    ],
    [
      'canonical_overlap',
      () =>
        raised(
          'canonical_overlap',
          JSON.stringify({ domain: 'role', canonicalId }),
        ),
      422,
      'TAXONOMY_VALIDATION_FAILED',
      { reasonCode: 'canonical_overlap', domain: 'role', canonicalId },
    ],
    [
      'canonical_source_unavailable',
      () =>
        raised(
          'canonical_source_unavailable',
          JSON.stringify({ domain: 'role' }),
        ),
      422,
      'TAXONOMY_VALIDATION_FAILED',
      { reasonCode: 'canonical_source_unavailable', domain: 'role' },
    ],
    ['NOT_FOUND', () => raised('NOT_FOUND'), 404, 'TAXONOMY_NOT_FOUND', {}],
    [
      'CONFLICT (stale operand, term exists, merged term)',
      () => raised('CONFLICT'),
      409,
      'TAXONOMY_VERSION_CONFLICT',
      {},
    ],
    [
      'IDEMPOTENCY_MISMATCH',
      () => raised('IDEMPOTENCY_MISMATCH'),
      409,
      'TAXONOMY_VERSION_CONFLICT',
      {},
    ],
    [
      'VERSION_MISMATCH (40001)',
      () =>
        Response.json(
          { code: '40001', message: 'VERSION_MISMATCH' },
          { status: 409 },
        ),
      409,
      'TAXONOMY_VERSION_CONFLICT',
      {},
    ],
    [
      'VALIDATION_FAILED with a pointer',
      () => raised('VALIDATION_FAILED', '["/parentId"]'),
      422,
      'TAXONOMY_VALIDATION_FAILED',
      {
        violations: [
          {
            path: '/parentId',
            code: 'invalid',
            message: 'The value is invalid.',
          },
        ],
      },
    ],
    [
      'INVALID_REQUEST',
      () => raised('INVALID_REQUEST'),
      400,
      'INVALID_REQUEST',
      {},
    ],
    [
      'UNAUTHENTICATED',
      () => raised('UNAUTHENTICATED'),
      401,
      'UNAUTHENTICATED',
      { recoveryAction: 'reauthenticate' },
    ],
    [
      'DEPENDENCY_UNAVAILABLE raised by the canonical provider',
      () => raised('DEPENDENCY_UNAVAILABLE'),
      503,
      'DEPENDENCY_UNAVAILABLE',
      { dependencyClass: 'cms_composition', retryable: true },
    ],
    [
      'INTERNAL_ERROR',
      () => raised('INTERNAL_ERROR'),
      500,
      'INTERNAL_ERROR',
      {},
    ],
    [
      'a provider 5xx',
      () => Response.json({ message: 'boom' }, { status: 500 }),
      503,
      'DEPENDENCY_UNAVAILABLE',
      { dependencyClass: 'cms_composition', retryable: true },
    ],
  ];
  it.each(rows)('%s', async (_name, answer, status, code, details) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => answer());
    const response = await createActHarness(fetchImpl).request();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(status);
    const body = (await response.json()) as {
      code: string;
      details: unknown;
    };
    expect(body.code).toBe(code);
    expect(body.details).toEqual(details);
    if (status === 403 || status === 409 || status === 422)
      expect(
        'reasonCode' in (body.details as object)
          ? CmsCompositionRefusalDetailsSchema.safeParse(body.details).success
          : true,
      ).toBe(true);
  });

  it.each([
    ['canonical_overlap', undefined],
    ['canonical_overlap', JSON.stringify({ domain: 'role' })],
    ['canonical_overlap', JSON.stringify({ domain: 'nope', canonicalId })],
    ['canonical_overlap', 'not json'],
    ['canonical_overlap', JSON.stringify(['domain', 'role'])],
    ['canonical_source_unavailable', undefined],
    ['canonical_source_unavailable', JSON.stringify({ domain: 'nope' })],
    ['canonical_source_unavailable', JSON.stringify({ domain: 7 })],
  ] as const)(
    'a %s refusal without its mandatory member (%s) is an invalid dependency answer, 502',
    async (token, details) => {
      const fetchImpl = vi.fn<typeof fetch>(async () => raised(token, details));
      const response = await createActHarness(fetchImpl).request();
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({
        code: 'DEPENDENCY_UNAVAILABLE',
        details: { dependencyClass: 'cms_composition', retryable: true },
      });
    },
  );

  it.each([
    'revision_not_editable',
    'separation_of_duties',
    'key_reserved',
    'review_not_open',
    'FALLBACK_CHAIN_MISMATCH',
    'locale_limit_reached',
  ])('the token %s of another operation is a scrubbed 500', async (token) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => raised(token));
    const response = await createActHarness(fetchImpl).request();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(token);
  });

  it('prose and DETAIL never choose a refusal', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      raised(
        'NOT_FOUND: taxonomy_not_active canonical_overlap',
        JSON.stringify({ reasonCode: 'taxonomy_not_active', domain: 'role' }),
      ),
    );
    const response = await createActHarness(fetchImpl).request();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toMatch(/taxonomy_not_active|overlap/);
  });

  it.each(PROVIDER_FAULTS)(
    'scrubs the provider fault %s to 500 INTERNAL_ERROR',
    async (_name, status, payload) => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        Response.json(payload, { status }),
      );
      const response = await createActHarness(fetchImpl).request();
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toContain('INTERNAL_ERROR');
      expect(text).not.toMatch(/PGRST|42702|actor_id|42501/);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );
});
