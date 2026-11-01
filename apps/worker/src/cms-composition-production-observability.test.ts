import { createLogger, type Logger } from '@wejammin/observability/logging';
import type { CmsEditorialProductionOptions } from './cms-editorial-production-types';
import { describe, expect, it, vi } from 'vitest';

import { createProductionCmsGovernedReviewDependencies } from './cms-composition-production-governed-review';
import { createProductionCmsLocaleDependencies } from './cms-composition-production-locale';
import { createProductionCmsPatternDefinitionDependencies } from './cms-composition-production-pattern-definition';
import { createProductionCmsPatternInstanceDependencies } from './cms-composition-production-pattern';
import { createProductionCmsPatternUpdateDependencies } from './cms-composition-production-pattern-update';
import { createProductionCmsRelatedContentDependencies } from './cms-composition-production-related';
import { createProductionCmsTaxonomyDefinitionDependencies } from './cms-composition-production-taxonomy-definition';
import { createProductionCmsTaxonomyDependencies } from './cms-composition-production-taxonomy';
import { createProductionCmsTemplateDependencies } from './cms-composition-production';
import {
  noteFacts,
  noteRefusal,
  noteStage,
} from './cms-composition/observability-facts';
import { observeRequest } from './cms-composition/observability-observation';
import {
  CMS_COMPOSITION_LOG_ATTRIBUTES,
  CMS_COMPOSITION_LOG_FIELDS,
  metricKeyConforms,
} from './cms-composition/observability-registry';
import {
  environment,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from './cms-editorial-production.test-support';

/*
 * [P2-S12-AC-263] [P2-S12-AC-264] Every Slice 12 production telemetry closure writes its request event through the
 * one allowlisted builder: the same eventName and operation as before, plus the trace, error code, retryability,
 * dependency class, acting-context class and counters of the request's observation.
 */

type Row = Readonly<{
  family: string;
  create: (options: CmsEditorialProductionOptions) => {
    telemetry: (event: never) => void;
  };
  operationId: string;
  eventName: string;
  operation: string;
}>;

const ROWS: readonly Row[] = [
  {
    family: 'governed review',
    create: createProductionCmsGovernedReviewDependencies,
    operationId: 'CMS-03C-07',
    eventName: 'cms.composition.governed_review.request',
    operation: 'cms.composition.governed_review.decide',
  },
  {
    family: 'locale write',
    create: createProductionCmsLocaleDependencies,
    operationId: 'CMS-03C-04',
    eventName: 'cms.composition.locale.request',
    operation: 'cms.composition.locale.author',
  },
  {
    family: 'locale read',
    create: createProductionCmsLocaleDependencies,
    operationId: 'cmsLocaleVariantRead',
    eventName: 'cms.composition.locale.request',
    operation: 'cms.composition.locale.read',
  },
  {
    family: 'related content',
    create: createProductionCmsRelatedContentDependencies,
    operationId: 'CMS-03C-05',
    eventName: 'cms.composition.related_content.request',
    operation: 'cms.composition.related_content.act',
  },
  {
    family: 'pattern update',
    create: createProductionCmsPatternUpdateDependencies,
    operationId: 'CMS-03C-15',
    eventName: 'cms.composition.pattern.request',
    operation: 'cms.composition.pattern.update',
  },
  {
    family: 'pattern definition',
    create: createProductionCmsPatternDefinitionDependencies,
    operationId: 'CMS-03C-12',
    eventName: 'cms.composition.pattern.request',
    operation: 'cms.composition.pattern.define',
  },
  {
    family: 'pattern instance',
    create: createProductionCmsPatternInstanceDependencies,
    operationId: 'CMS-03C-02',
    eventName: 'cms.composition.pattern.request',
    operation: 'cms.composition.pattern.insert',
  },
  {
    family: 'taxonomy term action',
    create: createProductionCmsTaxonomyDependencies,
    operationId: 'CMS-03C-03',
    eventName: 'cms.composition.taxonomy.request',
    operation: 'cms.composition.taxonomy.act',
  },
  {
    family: 'taxonomy definition',
    create: createProductionCmsTaxonomyDefinitionDependencies,
    operationId: 'CMS-03C-16',
    eventName: 'cms.composition.taxonomy_definition.request',
    operation: 'cms.composition.taxonomy.define',
  },
  {
    family: 'template',
    create: createProductionCmsTemplateDependencies,
    operationId: 'CMS-03C-01',
    eventName: 'cms.composition.template.request',
    operation: 'cms.composition.template.define',
  },
];

const capture = () => {
  const lines: string[] = [];
  const logger = createLogger(
    { environment: 'staging', release: 'slice-12', service: 'wejammin-api' },
    { sink: (line) => lines.push(line) },
  );
  return { lines, logger };
};

const options = (logger: Logger): CmsEditorialProductionOptions => ({
  environment,
  fetchImpl: vi.fn(),
  humanOrigins: ['https://cms.example.test'],
  resolveSession: async () => ({
    ok: true,
    value: {
      userId: USER_ID,
      actingPartyId: PARTY_ID,
      capabilities: ['cms.author'],
      mfaFresh: true,
    },
  }),
  logger,
});

const observed = (operationId: string) => {
  const request = new Request('https://api.example.test/x', {
    headers: { 'x-correlation-id': 'corr-0001' },
  });
  noteFacts(request, { actingContext: 'party' });
  noteStage(request, 'principal_assignment');
  noteStage(request, 'idempotency');
  noteStage(request, 'rpc');
  noteRefusal(request, 503, {}, 'DEPENDENCY_UNAVAILABLE');
  return observeRequest(request, REQUEST_ID, operationId, 503);
};

describe.each(ROWS)('$family production telemetry closure', (row) => {
  it('keeps its event name and operation and writes the request observation', () => {
    const { lines, logger } = capture();
    row.create(options(logger)).telemetry({
      operationId: row.operationId,
      requestId: REQUEST_ID,
      status: 503,
      outcome: 'failure',
      actorClass: 'human',
      durationMs: 9,
      observation: observed(row.operationId),
    } as never);
    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0] as string) as Record<string, unknown>;
    expect(line).toMatchObject({
      eventName: row.eventName,
      operation: row.operation,
      requestId: REQUEST_ID,
      correlationId: 'corr-0001',
      outcome: 'failure',
      durationMs: 9,
      errorCode: 'DEPENDENCY_UNAVAILABLE',
      retryable: true,
      dependency: 'cms_composition',
      actingContextClass: 'party',
      attributes: {
        actor_class: 'human',
        status: 503,
        runbook: 'cms-composition',
      },
      traceSteps: [
        'cms.composition.validation',
        'cms.composition.principal',
        'cms.composition.idempotency',
        'cms.composition.rpc',
      ],
    });
    for (const key of Object.keys(line))
      expect(CMS_COMPOSITION_LOG_FIELDS).toContain(key);
    expect(Object.keys(line.attributes as object).sort()).toEqual(
      [...CMS_COMPOSITION_LOG_ATTRIBUTES].sort(),
    );
  });

  it('writes the same event without an observation for a caller that supplies none', () => {
    const { lines, logger } = capture();
    row.create(options(logger)).telemetry({
      operationId: row.operationId,
      requestId: REQUEST_ID,
      status: 200,
      outcome: 'success',
      actorClass: 'human',
      durationMs: 3,
    } as never);
    const line = JSON.parse(lines[0] as string) as Record<string, unknown>;
    expect(line).toMatchObject({
      eventName: row.eventName,
      operation: row.operation,
      attributes: { status: 200 },
    });
    expect(line.metrics).toBeUndefined();
    expect(line.traceSteps).toBeUndefined();
  });

  it('writes the counters of the observation as registered metric keys', () => {
    const { lines, logger } = capture();
    const request = new Request('https://api.example.test/x');
    noteFacts(request, {
      subjectKind: 'template_version',
      decision: 'approve',
      updateAction: 'accept',
    });
    const observation = observeRequest(
      request,
      REQUEST_ID,
      row.operationId,
      200,
    );
    row.create(options(logger)).telemetry({
      operationId: row.operationId,
      requestId: REQUEST_ID,
      status: 200,
      outcome: 'success',
      actorClass: 'human',
      durationMs: 1,
      observation,
    } as never);
    const metrics = (
      JSON.parse(lines[0] as string) as { metrics?: Record<string, number> }
    ).metrics;
    for (const key of Object.keys(metrics ?? {}))
      expect(metricKeyConforms(key)).toBe(true);
    const counted: Readonly<Record<string, string>> = {
      'CMS-03C-07':
        'cms_governed_decision_total{decision="approve",outcome="success"}',
      'CMS-03C-15':
        'cms_pattern_update_total{action="accept",outcome="success"}',
    };
    const expected = counted[row.operationId];
    if (expected !== undefined) expect(metrics).toEqual({ [expected]: 1 });
    else expect(metrics).toBeUndefined();
  });
});
