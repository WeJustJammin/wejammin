import { describe, expect, it } from 'vitest';

import {
  activatedResource,
  activationHarness,
  activationRequest,
  retireBody,
  retiredResource,
  scheduleBody,
  scheduleHarness,
  scheduledResource,
} from './governed-activation.test-support';
import {
  expectError,
  jsonReply,
  without,
} from './governed-review-ops.test-support';

/*
 * DEC-191: GovernedActivationResource.supersededVersion is a required nullable positive integer, set
 * only on an immediate activation. The Worker relays a strict-valid answer unchanged and answers a
 * 200 or 202 that lacks the member, types it wrongly or names it on a schedule or retirement as the
 * local 502 of every invalid dependency answer.
 */
const BAD_GATEWAY = ['DEPENDENCY_UNAVAILABLE'] as const;

describe('CMS-03C-09 supersededVersion (DEC-191)', () => {
  it.each([
    [
      'names the superseded version',
      activatedResource({ supersededVersion: 7 }),
    ],
    [
      'carries null for a first activation',
      activatedResource({ supersededVersion: null }),
    ],
  ])('relays an activation that %s unchanged', async (_name, resource) => {
    const harness = activationHarness({}, () => jsonReply(resource));
    const response = await harness.send(activationRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(resource);
  });

  it('relays null for a retirement and for a scheduled acceptance', async () => {
    const retire = await activationHarness({}, () =>
      jsonReply(retiredResource()),
    ).send(activationRequest(retireBody()));
    expect(retire.status).toBe(200);
    expect(
      ((await retire.json()) as { supersededVersion: unknown })
        .supersededVersion,
    ).toBeNull();
    const schedule = await scheduleHarness({}, () =>
      jsonReply(scheduledResource()),
    ).send(activationRequest(scheduleBody()));
    expect(schedule.status).toBe(202);
    expect(
      ((await schedule.json()) as { supersededVersion: unknown })
        .supersededVersion,
    ).toBeNull();
  });

  it('answers a 200 without the member as a local 502', async () => {
    const harness = activationHarness({}, () =>
      jsonReply(without(activatedResource(), 'supersededVersion')),
    );
    const error = await expectError(
      await harness.send(activationRequest()),
      502,
      ...BAD_GATEWAY,
    );
    expect(error.details).toEqual({
      dependencyClass: 'cms_composition',
      retryable: true,
    });
  });

  it.each([
    ['a string', '2'],
    ['zero', 0],
    ['a negative number', -1],
    ['a fraction', 1.5],
    ['a boolean', true],
    ['an object', { version: 2 }],
  ])(
    'answers a supersededVersion that is %s as a local 502',
    async (_name, bad) => {
      const harness = activationHarness({}, () =>
        jsonReply({ ...activatedResource(), supersededVersion: bad }),
      );
      await expectError(
        await harness.send(activationRequest()),
        502,
        ...BAD_GATEWAY,
      );
    },
  );

  it('answers a retirement that names a superseded version as a local 502', async () => {
    const harness = activationHarness({}, () =>
      jsonReply({ ...retiredResource(), supersededVersion: 1 }),
    );
    await expectError(
      await harness.send(activationRequest(retireBody())),
      502,
      ...BAD_GATEWAY,
    );
  });

  it('answers a scheduled acceptance that names a superseded version, or omits the member, as a local 502', async () => {
    for (const answer of [
      { ...scheduledResource(), supersededVersion: 1 },
      without(scheduledResource(), 'supersededVersion'),
    ]) {
      const harness = scheduleHarness({}, () => jsonReply(answer));
      await expectError(
        await harness.send(activationRequest(scheduleBody())),
        502,
        ...BAD_GATEWAY,
      );
    }
  });
});
