import { createLogger } from '@wejammin/observability/logging';
import { describe, expect, it } from 'vitest';

import {
  activationHarness,
  activationRequest,
  activatedResource,
  activateBody,
  retireBody,
  retiredResource,
  scheduleBody,
  scheduleHarness,
  scheduledResource,
} from './governed-activation.test-support';
import {
  jsonReply,
  KEY,
  PARTY_ID,
  REVIEW_ID,
  sqlRefusal,
  USER_ID,
} from './governed-review-ops.test-support';

/*
 * BE03c Observability: `cms_governed_activation_total{subject_kind,action,outcome}` is emitted by the
 * CMS-03C-09 route (the only producer of the request actions activate, schedule and retire). `outcome`
 * is the closed vocabulary every Slice 10-12 route metric shares (`success`, `rate_limited`, `denied`,
 * `conflict`, `invalid`, `failed`); the subject kind is known only from a verified success.
 */

const METRIC = 'cms_governed_activation_total';

const capture = () => {
  const lines: string[] = [];
  const logger = createLogger(
    { environment: 'staging', release: 'slice-12', service: 'wejammin-api' },
    { sink: (line) => lines.push(line) },
  );
  const requestEvents = (): Record<string, unknown>[] =>
    lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter(
        (line) => line.eventName === 'cms.composition.governed_review.request',
      );
  const metrics = (): Record<string, number>[] =>
    requestEvents()
      .map((event) => event.metrics as Record<string, number> | undefined)
      .filter((value): value is Record<string, number> => value !== undefined);
  return { logger, requestEvents, metrics };
};

const key = (labels: Readonly<Record<string, string>>): string =>
  `${METRIC}{${Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}="${value}"`)
    .join(',')}}`;

describe('CMS-03C-09 emits cms_governed_activation_total with the spec labels', () => {
  it.each([
    [
      'activate',
      activateBody(),
      () => jsonReply(activatedResource()),
      'activate',
    ],
    ['retire', retireBody(), () => jsonReply(retiredResource()), 'retire'],
  ] as const)(
    'counts a verified %s success once, with its subject kind',
    async (_name, body, reply, action) => {
      const seen = capture();
      const harness = activationHarness(
        { tuning: { logger: seen.logger } },
        reply,
      );
      expect((await harness.send(activationRequest(body))).status).toBe(200);
      expect(seen.metrics()).toEqual([
        {
          [key({
            action,
            outcome: 'success',
            subject_kind: 'template_version',
          })]: 1,
        },
      ]);
    },
  );

  it('counts a verified schedule acceptance (202) as action schedule', async () => {
    const seen = capture();
    const harness = scheduleHarness({ tuning: { logger: seen.logger } }, () =>
      jsonReply(scheduledResource()),
    );
    expect((await harness.send(activationRequest(scheduleBody()))).status).toBe(
      202,
    );
    expect(seen.metrics()).toEqual([
      {
        [key({
          action: 'schedule',
          outcome: 'success',
          subject_kind: 'template_version',
        })]: 1,
      },
    ]);
  });

  it.each([
    [
      'a committed dependency_changed refusal',
      () =>
        jsonReply({
          kind: 'refusal',
          reasonCode: 'dependency_changed',
          details: {},
        }),
      'conflict',
    ],
    [
      'a stale review version',
      () =>
        sqlRefusal(
          'VERSION_MISMATCH',
          '{"expectedVersion":"3","currentVersion":"99"}',
        ),
      'conflict',
    ],
    [
      'a missing capability',
      () => sqlRefusal('capability_missing', undefined),
      'denied',
    ],
    [
      'a provider outage',
      () => Promise.resolve(new Response('x', { status: 503 })),
      'failed',
    ],
  ] as const)(
    'counts %s under its closed outcome with the subject kind unknown (no verified resource)',
    async (_name, reply, outcome) => {
      const seen = capture();
      const harness = activationHarness(
        { tuning: { logger: seen.logger } },
        reply,
      );
      await harness.send(activationRequest(activateBody()));
      expect(seen.metrics()).toEqual([
        { [key({ action: 'activate', outcome, subject_kind: 'unknown' })]: 1 },
      ]);
    },
  );

  it('counts a 422 refusal that follows the body decode under the action the caller asked for', async () => {
    const seen = capture();
    const harness = scheduleHarness({ tuning: { logger: seen.logger } });
    const body = scheduleBody({
      activateAt: { ...scheduleBody().activateAt, tzdbVersion: '1999a' },
    });
    expect((await harness.send(activationRequest(body))).status).toBe(422);
    expect(seen.metrics()).toEqual([
      {
        [key({
          action: 'schedule',
          outcome: 'invalid',
          subject_kind: 'unknown',
        })]: 1,
      },
    ]);
  });

  it('counts nothing for a request refused before its action is known, and carries no identifier', async () => {
    const seen = capture();
    const harness = activationHarness({ tuning: { logger: seen.logger } });
    const refused = await harness.send(
      activationRequest(activateBody(), {
        headers: { origin: 'https://evil.example' },
      }),
    );
    expect(refused.status).toBe(403);
    expect(seen.metrics()).toEqual([]);
    expect(seen.requestEvents()).toHaveLength(1);
  });

  it('keeps every label closed: no key, user, party or review id reaches the metric', async () => {
    const seen = capture();
    const harness = activationHarness({ tuning: { logger: seen.logger } });
    await harness.send(activationRequest(activateBody()));
    const serialized = JSON.stringify(seen.metrics());
    for (const secret of [KEY, USER_ID, PARTY_ID, REVIEW_ID])
      expect(serialized).not.toContain(secret);
  });
});
