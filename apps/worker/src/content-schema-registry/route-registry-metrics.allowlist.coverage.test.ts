import { describe, expect, it } from 'vitest';

import { registryMetrics } from './route-registry-metrics';
import { error } from './phase-02-slice-09-test-values';

const ALLOWLIST_METRIC =
  'cms_registry_allowlist_reject_total{operation="CMS-03A-05"}';

const rejected = (details: Record<string, unknown>) =>
  registryMetrics(
    'CMS-03A-05',
    error(
      422,
      'VALIDATION_FAILED',
      'The request body failed validation.',
      details,
    ),
    4,
  );

describe('the allowlist-reject counter fires only for a protected member', () => {
  it('counts a violation whose first path segment is a protected block member', () => {
    expect(
      rejected({ violations: [{ path: '/propsSchemaRef' }] }),
    ).toHaveProperty([ALLOWLIST_METRIC], 1);
    expect(
      rejected({
        violations: [{ path: '/unrelated' }, { path: '/rendererRef/inner' }],
      }),
    ).toHaveProperty([ALLOWLIST_METRIC], 1);
  });

  it('does not count a violation outside the protected members', () => {
    expect(rejected({ violations: [{ path: '/title' }] })).not.toHaveProperty([
      ALLOWLIST_METRIC,
    ]);
  });

  it('does not count a path with no member segment', () => {
    expect(
      rejected({ violations: [{ path: 'propsSchemaRef' }] }),
    ).not.toHaveProperty([ALLOWLIST_METRIC]);
    expect(rejected({ violations: [{ path: '' }] })).not.toHaveProperty([
      ALLOWLIST_METRIC,
    ]);
  });

  it('does not count a violation whose path is absent, not a string, or whose entry is null', () => {
    for (const violation of [{}, { path: 7 }, { path: null }, null])
      expect(rejected({ violations: [violation] })).not.toHaveProperty([
        ALLOWLIST_METRIC,
      ]);
  });

  it('does not count a missing, empty or non-array violations value', () => {
    for (const details of [{}, { violations: [] }, { violations: 'x' }])
      expect(rejected(details)).not.toHaveProperty([ALLOWLIST_METRIC]);
    expect(
      registryMetrics(
        'CMS-03A-05',
        { ok: false, status: 422, code: 'VALIDATION_FAILED', message: 'm' },
        4,
      ),
    ).not.toHaveProperty([ALLOWLIST_METRIC]);
  });
});
