import { beforeEach, describe, expect, it, vi } from 'vitest';

const schedulerMocks = vi.hoisted(() => ({
  createProductionAsyncEntrypoint: vi.fn(),
  outbox: vi.fn(),
  runProductionCmsEditPresenceSweep: vi.fn(),
  runProductionCmsPublicationScheduleSweep: vi.fn(),
  runProductionCmsReviewAuthoritySweep: vi.fn(),
  runProductionIdempotencyExpirySweep: vi.fn(),
  runProductionOperationalAlerts: vi.fn(),
}));

vi.mock('./production-async-entrypoint', () => ({
  createProductionAsyncEntrypoint:
    schedulerMocks.createProductionAsyncEntrypoint,
  runProductionOperationalAlerts: schedulerMocks.runProductionOperationalAlerts,
}));
vi.mock('./production-cms-edit-presence-sweep', () => ({
  runProductionCmsEditPresenceSweep:
    schedulerMocks.runProductionCmsEditPresenceSweep,
}));
vi.mock('./cms-publication-schedule-sweep', () => ({
  runProductionCmsPublicationScheduleSweep:
    schedulerMocks.runProductionCmsPublicationScheduleSweep,
}));
vi.mock('./production-cms-review-authority-sweep', () => ({
  runProductionCmsReviewAuthoritySweep:
    schedulerMocks.runProductionCmsReviewAuthoritySweep,
}));
vi.mock('./production-idempotency-expiry-sweep', () => ({
  runProductionIdempotencyExpirySweep:
    schedulerMocks.runProductionIdempotencyExpirySweep,
}));

import { AsyncRpcManualReviewError } from './async-runtime-support';
import handler from './index';

/*
 * CMS-03B-20 wiring in the scheduled handler: the publication schedule sweep
 * runs on every tick beside its siblings, its failure is surfaced after the
 * edit-presence sweep and before the operational alerts, and a manual-review
 * only failure suppresses the platform retry.
 */

const controller = () => ({
  cron: '* * * * *',
  noRetry: vi.fn(),
  scheduledTime: 1_756_560_000_000,
});

beforeEach(() => {
  vi.clearAllMocks();
  schedulerMocks.createProductionAsyncEntrypoint.mockReturnValue({
    scheduled: schedulerMocks.outbox,
  });
  for (const mock of [
    schedulerMocks.outbox,
    schedulerMocks.runProductionIdempotencyExpirySweep,
    schedulerMocks.runProductionCmsReviewAuthoritySweep,
    schedulerMocks.runProductionCmsEditPresenceSweep,
    schedulerMocks.runProductionCmsPublicationScheduleSweep,
    schedulerMocks.runProductionOperationalAlerts,
  ])
    mock.mockResolvedValue(undefined);
});

describe('scheduled publication sweep wiring', () => {
  it('runs the publication schedule sweep with the platform bindings on every tick', async () => {
    const env = {} as never;
    await handler.scheduled(controller() as never, env, {} as never);
    expect(
      schedulerMocks.runProductionCmsPublicationScheduleSweep,
    ).toHaveBeenCalledExactlyOnceWith(env);
  });

  it('surfaces its failure after the edit-presence sweep and still runs the alerts', async () => {
    const failure = new Error('publication schedule sweep requested retry');
    schedulerMocks.runProductionCmsPublicationScheduleSweep.mockRejectedValue(
      failure,
    );
    const c = controller();
    await expect(
      handler.scheduled(c as never, {} as never, {} as never),
    ).rejects.toBe(failure);
    expect(c.noRetry).not.toHaveBeenCalled();
    expect(
      schedulerMocks.runProductionOperationalAlerts,
    ).toHaveBeenCalledOnce();

    const editPresence = new Error('edit presence failed');
    schedulerMocks.runProductionCmsEditPresenceSweep.mockRejectedValue(
      editPresence,
    );
    await expect(
      handler.scheduled(controller() as never, {} as never, {} as never),
    ).rejects.toBe(editPresence);
  });

  it('lets an alert failure surface only after the publication schedule sweep', async () => {
    const alert = new Error('alert dependency unavailable');
    schedulerMocks.runProductionOperationalAlerts.mockRejectedValue(alert);
    await expect(
      handler.scheduled(controller() as never, {} as never, {} as never),
    ).rejects.toBe(alert);
    const failure = new Error('publication schedule sweep requested retry');
    schedulerMocks.runProductionCmsPublicationScheduleSweep.mockRejectedValue(
      failure,
    );
    await expect(
      handler.scheduled(controller() as never, {} as never, {} as never),
    ).rejects.toBe(failure);
  });

  it('suppresses platform retries when only the publication sweep needs manual review', async () => {
    const manual = new AsyncRpcManualReviewError('malformed_json');
    schedulerMocks.runProductionCmsPublicationScheduleSweep.mockRejectedValue(
      manual,
    );
    const c = controller();
    await expect(
      handler.scheduled(c as never, {} as never, {} as never),
    ).rejects.toBe(manual);
    expect(c.noRetry).toHaveBeenCalledOnce();
  });
});
