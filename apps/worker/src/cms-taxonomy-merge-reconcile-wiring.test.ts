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
 * DEC-194 wiring in the scheduled handler: the merge convergence recovery sweep runs on every tick beside its siblings
 * (one more settled participant), its failure is surfaced after the governed activation sweep and before the
 * operational alerts, and a manual-review-only failure suppresses the platform retry.
 */

const controller = () => ({
  cron: '* * * * *',
  noRetry: vi.fn(),
  scheduledTime: 1_756_560_000_000,
});

const siblings = () => [
  schedulerMocks.outbox,
  schedulerMocks.runProductionIdempotencyExpirySweep,
  schedulerMocks.runProductionCmsReviewAuthoritySweep,
  schedulerMocks.runProductionCmsEditPresenceSweep,
  schedulerMocks.runProductionCmsPublicationScheduleSweep,
  schedulerMocks.runProductionCmsGovernedActivationSweep,
  schedulerMocks.runProductionOperationalAlerts,
];

beforeEach(() => {
  vi.clearAllMocks();
  schedulerMocks.createProductionAsyncEntrypoint.mockReturnValue({
    scheduled: schedulerMocks.outbox,
  });
  for (const mock of [
    ...siblings(),
    schedulerMocks.runProductionCmsTaxonomyMergeReconcileSweep,
  ])
    mock.mockResolvedValue(undefined);
});

describe('scheduled taxonomy merge convergence recovery sweep wiring', () => {
  it('runs the recovery sweep with the platform bindings on every tick', async () => {
    const env = {} as never;
    await handler.scheduled(controller() as never, env, {} as never);
    await handler.scheduled(controller() as never, env, {} as never);
    expect(
      schedulerMocks.runProductionCmsTaxonomyMergeReconcileSweep,
    ).toHaveBeenCalledTimes(2);
    expect(
      schedulerMocks.runProductionCmsTaxonomyMergeReconcileSweep,
    ).toHaveBeenNthCalledWith(1, env);
  });

  it('still runs every sibling when it fails, and surfaces its failure without a no-retry', async () => {
    const failure = new Error('taxonomy merge reconcile sweep requested retry');
    schedulerMocks.runProductionCmsTaxonomyMergeReconcileSweep.mockRejectedValue(
      failure,
    );
    const c = controller();
    await expect(
      handler.scheduled(c as never, {} as never, {} as never),
    ).rejects.toBe(failure);
    expect(c.noRetry).not.toHaveBeenCalled();
    for (const sibling of siblings()) expect(sibling).toHaveBeenCalledOnce();
  });

  it('does not stop the recovery sweep when a sibling sweep fails', async () => {
    schedulerMocks.runProductionCmsGovernedActivationSweep.mockRejectedValue(
      new Error('governed activation failed'),
    );
    await expect(
      handler.scheduled(controller() as never, {} as never, {} as never),
    ).rejects.toThrow('governed activation failed');
    expect(
      schedulerMocks.runProductionCmsTaxonomyMergeReconcileSweep,
    ).toHaveBeenCalledOnce();
  });

  it('surfaces the governed failure before the recovery one, and an alert failure after both', async () => {
    const governed = new Error('governed activation failed');
    const reconcile = new Error('taxonomy merge reconcile failed');
    const alert = new Error('alert dependency unavailable');
    schedulerMocks.runProductionCmsGovernedActivationSweep.mockRejectedValue(
      governed,
    );
    schedulerMocks.runProductionCmsTaxonomyMergeReconcileSweep.mockRejectedValue(
      reconcile,
    );
    schedulerMocks.runProductionOperationalAlerts.mockRejectedValue(alert);
    await expect(
      handler.scheduled(controller() as never, {} as never, {} as never),
    ).rejects.toBe(governed);
    schedulerMocks.runProductionCmsGovernedActivationSweep.mockResolvedValue(
      undefined,
    );
    await expect(
      handler.scheduled(controller() as never, {} as never, {} as never),
    ).rejects.toBe(reconcile);
    schedulerMocks.runProductionCmsTaxonomyMergeReconcileSweep.mockResolvedValue(
      undefined,
    );
    await expect(
      handler.scheduled(controller() as never, {} as never, {} as never),
    ).rejects.toBe(alert);
  });

  it('suppresses platform retries when only the recovery sweep needs manual review', async () => {
    const manual = new AsyncRpcManualReviewError('malformed_json');
    schedulerMocks.runProductionCmsTaxonomyMergeReconcileSweep.mockRejectedValue(
      manual,
    );
    const c = controller();
    await expect(
      handler.scheduled(c as never, {} as never, {} as never),
    ).rejects.toBe(manual);
    expect(c.noRetry).toHaveBeenCalledOnce();
  });

  it('keeps the platform retry when a retryable failure accompanies the manual-review one', async () => {
    schedulerMocks.runProductionCmsTaxonomyMergeReconcileSweep.mockRejectedValue(
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
