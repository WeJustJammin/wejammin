import { describe, expect, it } from 'vitest';

import { lifecycleMetrics } from './route-lifecycle-metrics';
import type {
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistryResult,
} from './types';

const NOW = Date.parse('2026-10-02T12:00:00.000Z');

const success = (value: unknown): ContentSchemaRegistryResult<unknown> => ({
  ok: true,
  value,
});
const failure = (status: number): ContentSchemaRegistryResult<unknown> =>
  ({
    ok: false,
    status,
    code: 'ERROR',
    message: 'failed',
    details: {},
  }) as never;

const metrics = (
  operationId: ContentSchemaRegistryOperationId,
  result: ContentSchemaRegistryResult<unknown>,
  body?: unknown,
) => lifecycleMetrics(operationId, { body } as never, result, NOW);

describe('lifecycleMetrics: dry run (CMS-03A-10)', () => {
  it('counts a closed state and classification pair', () => {
    expect(
      metrics(
        'CMS-03A-10',
        success({ state: 'completed', classification: 'breaking' }),
      ),
    ).toEqual({
      'cms_schema_dry_run_total{classification="breaking",state="completed"}': 1,
    });
  });

  it.each([
    ['an unknown state', { state: 'weird', classification: 'additive' }],
    ['an unknown classification', { state: 'queued', classification: 'x' }],
    ['a missing state', { classification: 'additive' }],
    ['a non-string classification', { state: 'queued', classification: 7 }],
    ['a non-object value', 'completed'],
    ['a null value', null],
  ])('emits nothing for %s', (_label, value) => {
    expect(metrics('CMS-03A-10', success(value))).toEqual({});
  });

  it('emits nothing for a failed dry run', () => {
    expect(metrics('CMS-03A-10', failure(500))).toEqual({});
  });
});

describe('lifecycleMetrics: review queue and decision', () => {
  it('counts a pending review by closed risk class only', () => {
    expect(metrics('CMS-03A-11', success({ riskClass: 'protected' }))).toEqual({
      'cms_schema_review_pending_total{riskClass="protected"}': 1,
    });
    expect(metrics('CMS-03A-11', success({ riskClass: 'secret' }))).toEqual({});
    expect(metrics('CMS-03A-11', failure(503))).toEqual({});
  });

  it('counts a decision only for approve or reject', () => {
    expect(metrics('CMS-03A-12', success({ decision: 'reject' }))).toEqual({
      'cms_schema_review_decision_total{decision="reject"}': 1,
    });
    expect(metrics('CMS-03A-12', success({ decision: 'maybe' }))).toEqual({});
    expect(metrics('CMS-03A-12', success({}))).toEqual({});
    expect(metrics('CMS-03A-12', failure(409))).toEqual({});
  });
});

describe('lifecycleMetrics: review age (CMS-03A-13)', () => {
  it('reports the age in seconds of an open review', () => {
    expect(
      metrics(
        'CMS-03A-13',
        success({ state: 'open', submittedAt: '2026-10-02T11:59:00.000Z' }),
      ),
    ).toEqual({ cms_schema_review_age: 60 });
  });

  it('never reports a negative age', () => {
    expect(
      metrics(
        'CMS-03A-13',
        success({ state: 'open', submittedAt: '2026-10-02T12:05:00.000Z' }),
      ),
    ).toEqual({ cms_schema_review_age: 0 });
  });

  it.each([
    [
      'a closed review',
      { state: 'decided', submittedAt: '2026-10-02T11:00:00.000Z' },
    ],
    ['a missing submittedAt', { state: 'open' }],
    ['an unparsable submittedAt', { state: 'open', submittedAt: 'yesterday' }],
  ])('emits nothing for %s', (_label, value) => {
    expect(metrics('CMS-03A-13', success(value))).toEqual({});
  });

  it('emits nothing for a failed read', () => {
    expect(metrics('CMS-03A-13', failure(404))).toEqual({});
  });
});

describe('lifecycleMetrics: assignment and grant commands', () => {
  it.each([
    [success({}), 'success'],
    [failure(401), 'denied'],
    [failure(403), 'denied'],
    [failure(404), 'denied'],
    [failure(409), 'conflict'],
    [failure(422), 'failed'],
    [failure(500), 'failed'],
  ])('labels the assignment outcome for %j as %s', (result, outcome) => {
    expect(metrics('CMS-03A-14', result, { action: 'create' })).toEqual({
      [`cms_schema_review_assignment_total{action="create",outcome="${outcome}"}`]: 1,
    });
  });

  it('emits no assignment metric for an unknown or absent action', () => {
    expect(metrics('CMS-03A-14', success({}), { action: 'delete' })).toEqual(
      {},
    );
    expect(metrics('CMS-03A-14', success({}), 'revoke')).toEqual({});
    expect(metrics('CMS-03A-14', success({}), { action: 7 })).toEqual({});
    expect(metrics('CMS-03A-14', success({}), undefined)).toEqual({});
  });

  it.each([
    ['CMS-03A-15', 'granted'],
    ['CMS-03A-16', 'renewed'],
    ['CMS-03A-17', 'revoked'],
  ] as const)('counts %s as a %s grant command', (operationId, action) => {
    expect(metrics(operationId, success({}))).toEqual({
      [`cms_capability_grant_total{action="${action}",outcome="success"}`]: 1,
    });
    expect(metrics(operationId, failure(409))).toEqual({
      [`cms_capability_grant_total{action="${action}",outcome="conflict"}`]: 1,
    });
  });

  it('emits nothing for an operation without lifecycle metrics', () => {
    expect(metrics('CMS-03A-01', success({}))).toEqual({});
  });
});
