import { describe, expect, it, vi } from 'vitest';

import {
  createAsyncEntrypoint,
  type AsyncExecutionContext,
  type AsyncWorkerBindings,
} from './async-entrypoint';

/*
 * [P2-S12-AC-263] BE03c "Database-side locale observability (DEC-208)": the scheduled outbox-sweep tick also
 * runs the locale probe. It is observability only: a rejection is contained and never fails or skips the sweep.
 */

const bindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'local',
  PLATFORM_JOBS: { send: vi.fn() },
  SUPABASE_SECRET_KEY: 'server-secret',
  SUPABASE_URL: 'https://staging.example.supabase.co',
} as unknown as AsyncWorkerBindings;
const executionContext = { waitUntil: vi.fn() } satisfies AsyncExecutionContext;
const controller = { cron: '* * * * *', scheduledTime: 1_756_560_000_000 };

describe('async entrypoint scheduled locale observability sample', () => {
  it('samples on every outbox sweep tick with the controller (the window comes from its scheduled time)', async () => {
    const observeCmsLocaleActivity = vi.fn(async () => undefined);
    const sweepOutbox = vi.fn(async () => 'completed' as const);
    await createAsyncEntrypoint({
      observeCmsLocaleActivity,
      sweepOutbox,
    }).scheduled(controller, bindings, executionContext);
    expect(sweepOutbox).toHaveBeenCalledOnce();
    expect(observeCmsLocaleActivity).toHaveBeenCalledWith({
      controller,
      env: bindings,
      executionContext,
    });
  });

  it('runs beside the reconciling-age sample: both fire, neither replaces the other', async () => {
    const observeCmsLocaleActivity = vi.fn(async () => undefined);
    const observeReconcilingAge = vi.fn(async () => undefined);
    await createAsyncEntrypoint({
      observeCmsLocaleActivity,
      observeReconcilingAge,
      sweepOutbox: async () => 'completed' as const,
    }).scheduled(controller, bindings, executionContext);
    expect(observeCmsLocaleActivity).toHaveBeenCalledOnce();
    expect(observeReconcilingAge).toHaveBeenCalledOnce();
  });

  it('a failing sample never fails or skips the sweep, and the reconciling-age sample still runs', async () => {
    const sweepOutbox = vi.fn(async () => 'completed' as const);
    const observeReconcilingAge = vi.fn(async () => undefined);
    await expect(
      createAsyncEntrypoint({
        observeCmsLocaleActivity: async () => {
          throw new Error('probe');
        },
        observeReconcilingAge,
        sweepOutbox,
      }).scheduled(controller, bindings, executionContext),
    ).resolves.toBeUndefined();
    expect(sweepOutbox).toHaveBeenCalledOnce();
    expect(observeReconcilingAge).toHaveBeenCalledOnce();
  });

  it('a synchronously throwing sample is contained too', async () => {
    const sweepOutbox = vi.fn(async () => 'completed' as const);
    await expect(
      createAsyncEntrypoint({
        observeCmsLocaleActivity: () => {
          throw new Error('probe');
        },
        sweepOutbox,
      }).scheduled(controller, bindings, executionContext),
    ).resolves.toBeUndefined();
    expect(sweepOutbox).toHaveBeenCalledOnce();
  });

  it('still samples when the sweep requests a retry, and the retry still surfaces', async () => {
    const observeCmsLocaleActivity = vi.fn(async () => undefined);
    await expect(
      createAsyncEntrypoint({
        observeCmsLocaleActivity,
        sweepOutbox: async () => 'retry' as const,
      }).scheduled(controller, bindings, executionContext),
    ).rejects.toThrow('Outbox sweep requested retry');
    expect(observeCmsLocaleActivity).toHaveBeenCalledOnce();
  });

  it('waits for the sample before the tick settles', async () => {
    const order: string[] = [];
    await createAsyncEntrypoint({
      observeCmsLocaleActivity: async () => {
        await Promise.resolve();
        order.push('sample');
      },
      sweepOutbox: async () => {
        order.push('sweep');
        return 'completed' as const;
      },
    }).scheduled(controller, bindings, executionContext);
    expect(order.sort()).toEqual(['sample', 'sweep']);
  });

  it('does not sample on a cron the sweep does not own', async () => {
    const observeCmsLocaleActivity = vi.fn(async () => undefined);
    await expect(
      createAsyncEntrypoint({
        observeCmsLocaleActivity,
        sweepOutbox: async () => 'completed' as const,
      }).scheduled(
        { ...controller, cron: '0 * * * *' },
        bindings,
        executionContext,
      ),
    ).rejects.toThrow('Outbox sweep dependency unavailable');
    expect(observeCmsLocaleActivity).not.toHaveBeenCalled();
  });
});
