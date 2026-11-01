import { beforeEach, describe, expect, it, vi } from 'vitest';

const schedulerMocks = vi.hoisted(() => ({
  createProductionAsyncEntrypoint: vi.fn(),
  outbox: vi.fn(),
  runProductionCmsEditPresenceSweep: vi.fn(),
  runProductionCmsGovernedActivationSweep: vi.fn(),
  runProductionCmsPublicationScheduleSweep: vi.fn(),
  runProductionCmsReviewAuthoritySweep: vi.fn(),
  runProductionCmsTaxonomyMergeReconcileSweep: vi.fn(),
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
vi.mock('./cms-governed-activation-sweep', () => ({
  runProductionCmsGovernedActivationSweep:
    schedulerMocks.runProductionCmsGovernedActivationSweep,
}));
// DEC-194: the merge convergence recovery sweep is one more scheduled job, mocked like its siblings;
// its own behaviour is pinned in cms-taxonomy-merge-reconcile-sweep*.
vi.mock('./cms-taxonomy-merge-reconcile-sweep', () => ({
  runProductionCmsTaxonomyMergeReconcileSweep:
    schedulerMocks.runProductionCmsTaxonomyMergeReconcileSweep,
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
 * CMS-03C-19 wiring in the scheduled handler: the governed activation sweep runs on every tick beside its
 * siblings (one more settled participant), its failure is surfaced after the publication schedule sweep and
 * before the operational alerts, and a manual-review-only failure suppresses the platform retry.
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
    schedulerMocks.runProductionCmsGovernedActivationSweep,
    schedulerMocks.runProductionCmsTaxonomyMergeReconcileSweep,
    schedulerMocks.runProductionOperationalAlerts,
  ])
    mock.mockResolvedValue(undefined);
});

describe('scheduled governed activation sweep wiring', () => {
  it('runs the governed activation sweep with the platform bindings on every tick', async () => {
    const env = {} as never;
    await handler.scheduled(controller() as never, env, {} as never);
    expect(
      schedulerMocks.runProductionCmsGovernedActivationSweep,
    ).toHaveBeenCalledExactlyOnceWith(env);
  });

  it('still runs every sibling when it fails, and surfaces its failure without a no-retry', async () => {
    const failure = new Error('governed activation sweep requested retry');
    schedulerMocks.runProductionCmsGovernedActivationSweep.mockRejectedValue(
      failure,
    );
    const c = controller();
    await expect(
      handler.scheduled(c as never, {} as never, {} as never),
    ).rejects.toBe(failure);
    expect(c.noRetry).not.toHaveBeenCalled();
    for (const sibling of [
      schedulerMocks.outbox,
      schedulerMocks.runProductionIdempotencyExpirySweep,
      schedulerMocks.runProductionCmsReviewAuthoritySweep,
      schedulerMocks.runProductionCmsEditPresenceSweep,
      schedulerMocks.runProductionCmsPublicationScheduleSweep,
      schedulerMocks.runProductionOperationalAlerts,
    ])
      expect(sibling).toHaveBeenCalledOnce();
  });

  it('does not stop a sibling from running when a sibling sweep fails', async () => {
    schedulerMocks.runProductionCmsPublicationScheduleSweep.mockRejectedValue(
      new Error('publication schedule failed'),
    );
    await expect(
      handler.scheduled(controller() as never, {} as never, {} as never),
    ).rejects.toThrow('publication schedule failed');
    expect(
      schedulerMocks.runProductionCmsGovernedActivationSweep,
    ).toHaveBeenCalledOnce();
  });

  it('surfaces the publication schedule failure before the governed one, and an alert failure after both', async () => {
    const publication = new Error('publication schedule failed');
    const governed = new Error('governed activation failed');
    const alert = new Error('alert dependency unavailable');
    schedulerMocks.runProductionCmsPublicationScheduleSweep.mockRejectedValue(
      publication,
    );
    schedulerMocks.runProductionCmsGovernedActivationSweep.mockRejectedValue(
      governed,
    );
    schedulerMocks.runProductionOperationalAlerts.mockRejectedValue(alert);
    await expect(
      handler.scheduled(controller() as never, {} as never, {} as never),
    ).rejects.toBe(publication);
    schedulerMocks.runProductionCmsPublicationScheduleSweep.mockResolvedValue(
      undefined,
    );
    await expect(
      handler.scheduled(controller() as never, {} as never, {} as never),
    ).rejects.toBe(governed);
    schedulerMocks.runProductionCmsGovernedActivationSweep.mockResolvedValue(
      undefined,
    );
    await expect(
      handler.scheduled(controller() as never, {} as never, {} as never),
    ).rejects.toBe(alert);
  });

  it('suppresses platform retries when only the governed sweep needs manual review', async () => {
    const manual = new AsyncRpcManualReviewError('malformed_json');
    schedulerMocks.runProductionCmsGovernedActivationSweep.mockRejectedValue(
      manual,
    );
    const c = controller();
    await expect(
      handler.scheduled(c as never, {} as never, {} as never),
    ).rejects.toBe(manual);
    expect(c.noRetry).toHaveBeenCalledOnce();
  });

  it('keeps the platform retry when a retryable failure accompanies the manual-review one', async () => {
    schedulerMocks.runProductionCmsGovernedActivationSweep.mockRejectedValue(
      new AsyncRpcManualReviewError('malformed_json'),
    );
    schedulerMocks.runProductionCmsEditPresenceSweep.mockRejectedValue(
      new Error('edit presence failed'),
    );
    const c = controller();
    await expect(
      handler.scheduled(c as never, {} as never, {} as never),
    ).rejects.toThrow('edit presence failed');
    expect(c.noRetry).not.toHaveBeenCalled();
  });
});
