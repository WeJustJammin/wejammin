import { cmsEditorialRoutePolicies } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { buildRouteEvent, type RouteFacts } from './route-telemetry';
import type { CmsEditorialError } from './types';

/*
 * BE03b "Observability" for the Slice 11 operations: closed metric labels only
 * (operation, outcome, risk class, decision, action, preflight category and
 * phase), never an identifier, hash, reason text or person.
 */

const policy = (operationId: string) =>
  cmsEditorialRoutePolicies.find(
    (row) => row.operationId === operationId,
  ) as (typeof cmsEditorialRoutePolicies)[number];

const build = (operationId: string, status: number, facts: RouteFacts = {}) =>
  buildRouteEvent(
    {
      request: new Request('https://web.test/x'),
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      policy: policy(operationId),
      startedAt: 100,
      now: 140,
    },
    new Response(null, { status }),
    facts,
  );

const failure = (
  status: CmsEditorialError['status'],
  code: string,
  details: Record<string, unknown> = {},
): CmsEditorialError => ({ ok: false, status, code, message: 'x', details });

const metrics = (
  operationId: string,
  status: number,
  facts: RouteFacts = {},
): Record<string, number> => build(operationId, status, facts).metrics ?? {};

describe('review metrics', () => {
  it('counts a submitted review by risk class and outcome', () => {
    expect(
      metrics('CMS-03B-05', 201, { labels: { riskClass: 'protected' } })[
        'cms_review_submitted_total{outcome="success",risk_class="protected"}'
      ],
    ).toBe(1);
    expect(
      metrics('CMS-03B-05', 409)[
        'cms_review_submitted_total{outcome="conflict",risk_class="unknown"}'
      ],
    ).toBe(1);
  });

  it('counts a decision by decision and outcome', () => {
    expect(
      metrics('CMS-03B-06', 200, { labels: { decision: 'reject' } })[
        'cms_review_decision_total{decision="reject",outcome="success"}'
      ],
    ).toBe(1);
    expect(
      metrics('CMS-03B-06', 401)[
        'cms_review_decision_total{decision="unknown",outcome="denied"}'
      ],
    ).toBe(1);
  });

  it('counts a committed invalidation refused on a decision', () => {
    const published = metrics('CMS-03B-06', 409, {
      error: failure(409, 'CONFLICT', {
        reasonCode: 'dependency_changed',
        dependencyHash: 'a'.repeat(64),
      }),
    });
    expect(
      published['cms_review_invalidated_total{reason="dependency_changed"}'],
    ).toBe(1);
    expect(
      Object.keys(
        metrics('CMS-03B-05', 409, {
          error: failure(409, 'CONFLICT', { reasonCode: 'dependency_changed' }),
        }),
      ).some((key) => key.startsWith('cms_review_invalidated_total')),
    ).toBe(false);
  });

  it('counts an assignment by action and outcome', () => {
    expect(
      metrics('CMS-03B-18', 201, { labels: { assignmentAction: 'create' } })[
        'cms_review_assignment_total{action="create",outcome="success"}'
      ],
    ).toBe(1);
    expect(
      metrics('CMS-03B-18', 429)[
        'cms_review_assignment_total{action="unknown",outcome="rate_limited"}'
      ],
    ).toBe(1);
  });

  it('does not count a revision creation for a review operation', () => {
    for (const id of ['CMS-03B-05', 'CMS-03B-06', 'CMS-03B-09', 'CMS-03B-18'])
      expect(metrics(id, 201).cms_revision_created_total).toBeUndefined();
    expect(metrics('CMS-03B-01', 201).cms_revision_created_total).toBe(1);
  });
});

describe('refusal metrics', () => {
  it('counts a separation-of-duties refusal by operation', () => {
    expect(
      metrics('CMS-03B-09', 403, {
        error: failure(403, 'FORBIDDEN', {
          reasonCode: 'separation_of_duties',
        }),
      })['cms_separation_of_duties_refusal_total{operation="CMS-03B-09"}'],
    ).toBe(1);
    expect(
      Object.keys(
        metrics('CMS-03B-09', 403, {
          error: failure(403, 'FORBIDDEN', {
            reasonCode: 'capability_missing',
          }),
        }),
      ).some((key) => key.startsWith('cms_separation_of_duties')),
    ).toBe(false);
  });

  it('counts a lineage conflict', () => {
    expect(
      metrics('CMS-03B-09', 409, {
        error: failure(409, 'CONFLICT', { reasonCode: 'publication_conflict' }),
      }).cms_publication_lineage_conflict_total,
    ).toBe(1);
  });

  it('counts each refused preflight category by phase', () => {
    const published = metrics('CMS-03B-07', 422, {
      error: failure(422, 'VALIDATION_FAILED', {
        reasonCode: 'preflight_failed',
        preflight: [
          {
            category: 'contract',
            outcome: 'failed',
            reasonCode: 'value_invalid',
          },
          { category: 'accessibility', outcome: 'passed', reasonCode: null },
        ],
      }),
    });
    expect(
      published[
        'cms_preflight_result_total{category="contract",outcome="failed",phase="schedule"}'
      ],
    ).toBe(1);
    expect(
      published[
        'cms_preflight_result_total{category="accessibility",outcome="passed",phase="schedule"}'
      ],
    ).toBe(1);
  });

  it('counts the preflight results a workflow read served', () => {
    const published = metrics('CMS-03B-15', 200, {
      preflight: [
        { category: 'schema', outcome: 'passed' },
        { category: 'media', outcome: 'unavailable' },
      ],
    });
    expect(
      published[
        'cms_preflight_result_total{category="schema",outcome="passed",phase="workflow_read"}'
      ],
    ).toBe(1);
    expect(
      published[
        'cms_preflight_result_total{category="media",outcome="unavailable",phase="workflow_read"}'
      ],
    ).toBe(1);
  });

  it('ignores a preflight member on an operation that evaluates none', () => {
    expect(
      Object.keys(
        metrics('CMS-03B-06', 422, {
          error: failure(422, 'VALIDATION_FAILED', {
            preflight: [{ category: 'contract', outcome: 'failed' }],
          }),
        }),
      ).some((key) => key.startsWith('cms_preflight_result_total')),
    ).toBe(false);
  });

  it('keeps a Slice 10 operation free of Slice 11 metrics', () => {
    expect(
      Object.keys(metrics('CMS-03B-11', 200)).some((key) =>
        /^cms_(review|preflight|separation|publication)/u.test(key),
      ),
    ).toBe(false);
  });
});
