import { describe, expect, it } from 'vitest';

import {
  activationHarness,
  activationRequest,
  retireBody,
  scheduleBody,
  scheduleHarness,
} from './governed-activation.test-support';
import { ACTIVATION_TABLE } from './governed-activation-tokens.test-support';
import {
  expectError,
  jsonReply,
  KEY,
} from './governed-review-ops.test-support';

const CONFLICT = 'GOVERNED_REVIEW_VERSION_CONFLICT';

describe('CMS-03C-09 SQL refusals are mapped by token, whatever the action', () => {
  it.each(ACTIVATION_TABLE)(
    'schedule maps %s',
    async (_name, provider, [status, code, details]) => {
      const harness = scheduleHarness({}, () =>
        jsonReply(provider.body, provider.status),
      );
      const error = await expectError(
        await harness.send(activationRequest(scheduleBody())),
        status,
        code,
      );
      expect(error.details).toEqual(details);
      expect(JSON.stringify(error)).not.toMatch(/private|currentVersion|"99"/);
    },
  );

  it.each(ACTIVATION_TABLE)(
    'retire maps %s',
    async (_name, provider, [status, code, details]) => {
      const harness = activationHarness({}, () =>
        jsonReply(provider.body, provider.status),
      );
      const error = await expectError(
        await harness.send(activationRequest(retireBody())),
        status,
        code,
      );
      expect(error.details).toEqual(details);
    },
  );
});

describe('CMS-03C-09 committed refusal envelope (replayable 409, BE03c 1326 step 4)', () => {
  it.each([
    ['activate', undefined],
    ['schedule', scheduleBody()],
  ] as const)(
    'maps a committed dependency_changed envelope of %s to 409 with its reasonCode',
    async (_action, body) => {
      for (const reasonCode of ['dependency_changed']) {
        const envelope = { kind: 'refusal', reasonCode, details: {} };
        const harness = scheduleHarness({}, () => jsonReply(envelope));
        const first = await harness.send(activationRequest(body));
        const error = await expectError(first, 409, CONFLICT);
        expect(error.details).toEqual({ reasonCode });
        expect(first.headers.get('etag')).toBeNull();
        // The stored outcome replays: the same key and request bytes reach the RPC again.
        const replay = await harness.send(activationRequest(body));
        expect(replay.status).toBe(409);
        expect(await replay.json()).toMatchObject({ details: { reasonCode } });
        const calls = harness.fetchImpl.mock.calls.map(([, init]) => init);
        expect(calls).toHaveLength(2);
        expect(calls[1]?.body).toBe(calls[0]?.body);
        expect(new Headers(calls[1]?.headers).get('x-idempotency-key')).toBe(
          KEY,
        );
      }
    },
  );

  it.each([
    ['activate', undefined],
    ['schedule', scheduleBody()],
  ] as const)(
    'answers a committed review_not_open envelope of %s as a local 502: it is not a CMS-03C-09 outcome (BE03c 1262, 1326 step 4)',
    async (_action, body) => {
      const envelope = {
        kind: 'refusal',
        reasonCode: 'review_not_open',
        details: {},
      };
      const harness = scheduleHarness({}, () => jsonReply(envelope));
      const error = await expectError(
        await harness.send(activationRequest(body)),
        502,
        'DEPENDENCY_UNAVAILABLE',
      );
      expect(JSON.stringify(error)).not.toContain('review_not_open');
    },
  );

  it.each([
    ['an unknown token', { kind: 'refusal', reasonCode: 'private_rule' }],
    ['a 403 token', { kind: 'refusal', reasonCode: 'capability_missing' }],
    [
      'a token of another operation',
      { kind: 'refusal', reasonCode: 'assignment_limit' },
    ],
    ['an activation token', { kind: 'refusal', reasonCode: 'schedule_exists' }],
    ['a missing token', { kind: 'refusal' }],
    [
      'an extra member',
      {
        kind: 'refusal',
        reasonCode: 'review_not_open',
        note: 'private provider',
      },
    ],
    [
      'non-object details',
      { kind: 'refusal', reasonCode: 'review_not_open', details: 'x' },
    ],
  ])('answers %s as a local 502, never a caller refusal', async (_n, body) => {
    const harness = activationHarness({}, () => jsonReply(body));
    const error = await expectError(
      await harness.send(activationRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
    expect(JSON.stringify(error)).not.toContain('private');
  });
});
