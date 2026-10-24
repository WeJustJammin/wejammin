import { describe, expect, it } from 'vitest';

import { failure } from './pattern-instance-contracts';
import { createPatternUpdateHarness } from './pattern-update-routes.test-support';
import { KEY, post } from './pattern-update-post.test-support';
import {
  acceptBody,
  detachBody,
  detachResource,
  PU_ENTRY_ETAG,
  puDiffPath,
  PU_SELECTOR_PATH,
  PU_TYPE_ID,
} from './pattern-update.test-support';
import { metricKeyConforms } from './observability-registry';
import type { CompositionObservation } from './observability-observation';

/*
 * [P2-S12-AC-263] [P2-S12-AC-264] CMS-03C-15 counts `cms_pattern_update_total{action,outcome}` (the decoded
 * action, never the instance ids or choices) and every pattern-update request lists the stages it really entered.
 */

const observationOf = (harness: {
  telemetry: { mock: { calls: unknown[][] } };
}): CompositionObservation => {
  const event = harness.telemetry.mock.calls[0]?.[0] as {
    observation?: CompositionObservation;
  };
  expect(event.observation).toBeDefined();
  return event.observation as CompositionObservation;
};

describe('CMS-03C-15 emits cms_pattern_update_total', () => {
  it('counts an accept once under the success outcome', async () => {
    const harness = createPatternUpdateHarness();
    expect((await post(harness)).status).toBe(200);
    expect(observationOf(harness).metrics).toEqual({
      'cms_pattern_update_total{action="accept",outcome="success"}': 1,
    });
  });

  it('counts a detach once under the success outcome', async () => {
    const harness = createPatternUpdateHarness({
      applyUpdate: async () => ({
        ok: true,
        value: detachResource(2),
        etag: PU_ENTRY_ETAG,
      }),
    });
    expect((await post(harness, { body: detachBody(2) })).status).toBe(200);
    expect(observationOf(harness).metrics).toEqual({
      'cms_pattern_update_total{action="detach",outcome="success"}': 1,
    });
  });

  it.each([
    [409, 'diff_has_collisions', 'conflict'],
    [409, 'revision_not_editable', 'conflict'],
    [422, 'pattern_version_not_active', 'invalid'],
    [403, 'capability_missing', 'denied'],
  ] as const)(
    'counts an accept refused %i %s under the outcome %s',
    async (status, token, outcome) => {
      const harness = createPatternUpdateHarness({
        applyUpdate: async () => failure(status, { reasonCode: token }),
      });
      expect((await post(harness)).status).toBe(status);
      expect(observationOf(harness).metrics).toEqual({
        [`cms_pattern_update_total{action="accept",outcome="${outcome}"}`]: 1,
      });
    },
  );

  it('counts a provider outage as failed and a rate refusal as rate_limited', async () => {
    const outage = createPatternUpdateHarness({
      applyUpdate: async () => failure(503, {}, 15),
    });
    expect((await post(outage)).status).toBe(503);
    expect(observationOf(outage).metrics).toEqual({
      'cms_pattern_update_total{action="accept",outcome="failed"}': 1,
    });
    const limited = createPatternUpdateHarness({
      rateLimit: async (input) => ({
        ok: true,
        value: {
          allowed: false,
          limit: input.limit,
          remaining: 0,
          resetAt: 2_000,
        },
      }),
    });
    expect((await post(limited)).status).toBe(429);
    expect(observationOf(limited).metrics).toEqual({
      'cms_pattern_update_total{action="accept",outcome="rate_limited"}': 1,
    });
  });

  it('counts nothing for a request whose body never decoded', async () => {
    const harness = createPatternUpdateHarness();
    expect((await post(harness, { body: { action: 'merge' } })).status).toBe(
      422,
    );
    expect(observationOf(harness).metrics).toEqual({});
  });

  it('counts neither the diff read nor the selector read', async () => {
    const diff = createPatternUpdateHarness();
    expect((await diff.request(puDiffPath())).status).toBe(200);
    expect(observationOf(diff).metrics).toEqual({});
    const selector = createPatternUpdateHarness();
    expect(
      (
        await selector.request(
          `${PU_SELECTOR_PATH}?contentTypeId=${PU_TYPE_ID}`,
        )
      ).status,
    ).toBe(200);
    expect(observationOf(selector).metrics).toEqual({});
  });

  it('only ever emits registered keys and never an id, hash or choice path', async () => {
    const harness = createPatternUpdateHarness();
    await post(harness, {
      body: {
        ...acceptBody(1),
        instances: [
          {
            instanceId: acceptBody(1).instances[0]?.instanceId,
            expectedVersion: '3',
            choices: [{ path: '/hero', choice: 'yours' }],
          },
        ],
      },
    });
    const observation = observationOf(harness);
    for (const key of Object.keys(observation.metrics))
      expect(metricKeyConforms(key)).toBe(true);
    const text = JSON.stringify(observation);
    expect(text).not.toContain('c0000000-0000-4000-8000');
    expect(text).not.toContain('/hero');
    expect(text).not.toContain(KEY);
  });
});

describe('CMS-03C-14/15 request traces', () => {
  it('lists validation, principal, idempotency, RPC and audit/outbox for a committed command', async () => {
    const harness = createPatternUpdateHarness();
    await post(harness);
    expect(observationOf(harness).traceSteps).toEqual([
      'cms.composition.validation',
      'cms.composition.principal',
      'cms.composition.idempotency',
      'cms.composition.rpc',
      'cms.composition.audit_outbox',
    ]);
  });

  it('lists no audit/outbox for a refused command and no idempotency for a read', async () => {
    const refused = createPatternUpdateHarness({
      applyUpdate: async () =>
        failure(409, { reasonCode: 'diff_has_collisions' }),
    });
    await post(refused);
    expect(observationOf(refused).traceSteps).toEqual([
      'cms.composition.validation',
      'cms.composition.principal',
      'cms.composition.idempotency',
      'cms.composition.rpc',
    ]);
    const read = createPatternUpdateHarness();
    await read.request(puDiffPath());
    expect(observationOf(read).traceSteps).toEqual([
      'cms.composition.validation',
      'cms.composition.principal',
      'cms.composition.rpc',
    ]);
  });

  it('lists only validation when the origin is refused before any seam', async () => {
    const harness = createPatternUpdateHarness();
    await post(harness, { headers: { origin: 'https://evil.example.test' } });
    expect(observationOf(harness).traceSteps).toEqual([
      'cms.composition.validation',
    ]);
    expect(harness.resolveSession).not.toHaveBeenCalled();
  });

  it('carries the published code and dependency class of a refused request', async () => {
    const harness = createPatternUpdateHarness({
      applyUpdate: async () => failure(503, {}, 15),
    });
    await post(harness);
    expect(observationOf(harness)).toMatchObject({
      errorCode: 'DEPENDENCY_UNAVAILABLE',
      retryable: true,
      dependency: 'cms_composition',
      actingContextClass: 'party',
    });
  });
});
