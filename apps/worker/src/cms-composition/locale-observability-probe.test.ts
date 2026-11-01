import { LogEventDetailsSchema } from '@wejammin/observability/logging';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NOW, recordingTelemetry } from '../event-consumers/test-support';
import {
  CMS_LOCALE_OBSERVABILITY_ALERT_EVENT,
  CMS_LOCALE_OBSERVABILITY_EVENT,
  createLocaleObservabilityProbe,
  LOCALE_OBSERVABILITY_READ_DEADLINE_MS,
  type LocaleObservation,
  type LocaleObservabilityPort,
} from './locale-observability';
import {
  CMS_COMPOSITION_LOG_ATTRIBUTES,
  CMS_COMPOSITION_LOG_FIELDS,
  metricKeyConforms,
} from './observability-registry';

/*
 * [P2-S12-AC-263] [P2-S12-AC-264] the probe: counters, gauge, alert and the swallowed failure (BE03c
 * "Database-side locale observability (DEC-208)"). Window math, parser and port: `locale-observability.test.ts`.
 */

const T = Date.UTC(2026, 9, 22, 12, 5, 0);

const probeWith = (read: LocaleObservabilityPort['read']) => {
  const { logs, telemetry } = recordingTelemetry();
  const reads = vi.fn(read);
  const probe = createLocaleObservabilityProbe({
    port: { read: reads },
    telemetry,
    clock: { now: () => NOW, randomUuid: () => 'unused' },
  });
  return { logs, probe, reads };
};

const observation = (patch: Partial<LocaleObservation> = {}) => ({
  fanoutRows: 0,
  staleFieldsAppended: 0,
  staleLegalFields: 0,
  ...patch,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('[P2-S12-AC-263] the counters and the gauge', () => {
  it('adds fanoutRows and staleFieldsAppended to the two counters and sets the gauge, in one event', async () => {
    const { logs, probe, reads } = probeWith(async () =>
      observation({
        fanoutRows: 3,
        staleFieldsAppended: 7,
        staleLegalFields: 0,
      }),
    );
    await probe.observe(T);
    expect(reads).toHaveBeenCalledWith(
      { start: '2026-10-22T12:02:00.000Z', end: '2026-10-22T12:03:00.000Z' },
      expect.any(AbortSignal),
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: 'info',
      details: {
        eventName: CMS_LOCALE_OBSERVABILITY_EVENT,
        operation: 'sample',
        outcome: 'success',
        dependency: 'database',
        metrics: {
          cms_locale_fanout_total: 3,
          cms_locale_stale_total: 7,
          cms_locale_stale_legal_fields: 0,
        },
      },
      options: { samplingClass: 'always' },
    });
  });

  it('emits zeros on a quiet minute: nothing harmful, the gauge is still sampled afresh', async () => {
    const { logs, probe } = probeWith(async () => observation());
    await probe.observe(T);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.details.metrics).toEqual({
      cms_locale_fanout_total: 0,
      cms_locale_stale_total: 0,
      cms_locale_stale_legal_fields: 0,
    });
  });

  it('carries only registered, label-free metric names (labels never carry a locale)', async () => {
    const { logs, probe } = probeWith(async () =>
      observation({ fanoutRows: 1, staleFieldsAppended: 1 }),
    );
    await probe.observe(T);
    const keys = Object.keys(
      (logs[0]?.details.metrics ?? {}) as Record<string, number>,
    );
    expect(keys.sort()).toEqual([
      'cms_locale_fanout_total',
      'cms_locale_stale_legal_fields',
      'cms_locale_stale_total',
    ]);
    for (const key of keys) expect(metricKeyConforms(key)).toBe(true);
  });

  it('writes only allowlisted, schema-valid log members and no identifier or locale', async () => {
    const { logs, probe } = probeWith(async () =>
      observation({
        fanoutRows: 5,
        staleFieldsAppended: 9,
        staleLegalFields: 4,
      }),
    );
    await probe.observe(T);
    expect(logs.length).toBeGreaterThan(0);
    for (const log of logs) {
      expect(() => LogEventDetailsSchema.parse(log.details)).not.toThrow();
      for (const member of Object.keys(log.details))
        expect(CMS_COMPOSITION_LOG_FIELDS).toContain(member);
      const attributes = (log.details.attributes ?? {}) as Record<
        string,
        unknown
      >;
      for (const member of Object.keys(attributes))
        expect(CMS_COMPOSITION_LOG_ATTRIBUTES).toContain(member);
      expect(JSON.stringify(log.details)).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-|fr-FR|de-DE|en-US|locale"/u,
      );
    }
  });
});

describe('[P2-S12-AC-264] the stale locale legal-field alert', () => {
  const alertLogs = (logs: ReturnType<typeof recordingTelemetry>['logs']) =>
    logs.filter(
      (log) => log.details.eventName === CMS_LOCALE_OBSERVABILITY_ALERT_EVENT,
    );

  it('does not fire at 0', async () => {
    const { logs, probe } = probeWith(async () => observation());
    await probe.observe(T);
    expect(alertLogs(logs)).toHaveLength(0);
  });

  it('fires at 1, with the observed count, the threshold and the runbook, on top of the sample event', async () => {
    const { logs, probe } = probeWith(async () =>
      observation({ staleLegalFields: 1 }),
    );
    await probe.observe(T);
    expect(logs).toHaveLength(2);
    expect(alertLogs(logs)).toHaveLength(1);
    expect(alertLogs(logs)[0]).toMatchObject({
      level: 'warn',
      details: {
        eventName: CMS_LOCALE_OBSERVABILITY_ALERT_EVENT,
        operation: 'evaluate',
        outcome: 'failure',
        errorCode: 'STALE_LOCALE_LEGAL_FIELDS',
        attributes: { runbook: 'cms-composition' },
        metrics: { cms_locale_stale_legal_fields: 1 },
      },
      options: { samplingClass: 'always', highRisk: true },
    });
  });

  it('fires for any positive count and reads the gauge afresh every firing', async () => {
    let gauge = 3;
    const { logs, probe } = probeWith(async () =>
      observation({ staleLegalFields: gauge }),
    );
    await probe.observe(T);
    gauge = 0;
    await probe.observe(T + 60_000);
    expect(alertLogs(logs)).toHaveLength(1);
    expect(alertLogs(logs)[0]?.details.metrics).toEqual({
      cms_locale_stale_legal_fields: 3,
    });
  });

  it('never alerts from the two counters alone', async () => {
    const { logs, probe } = probeWith(async () =>
      observation({ fanoutRows: 32, staleFieldsAppended: 500 }),
    );
    await probe.observe(T);
    expect(alertLogs(logs)).toHaveLength(0);
  });
});

describe('[P2-S12-AC-263] a failed read never fails the sweep', () => {
  const failureLog = (logs: ReturnType<typeof recordingTelemetry>['logs']) =>
    logs.find((log) => log.level === 'warn');

  it('logs a rejected read with allowlisted fields and resolves', async () => {
    const { logs, probe } = probeWith(async () => {
      throw new Error('connection refused to db.internal for fr-FR');
    });
    await expect(probe.observe(T)).resolves.toBeUndefined();
    // the failed sample plus the DEC-220 `locale_observability_unavailable` alert of this firing
    expect(logs).toHaveLength(2);
    expect(failureLog(logs)).toMatchObject({
      level: 'warn',
      details: {
        eventName: CMS_LOCALE_OBSERVABILITY_EVENT,
        operation: 'sample',
        outcome: 'failure',
        errorCode: 'LOCALE_OBSERVABILITY_UNAVAILABLE',
        dependency: 'database',
        retryable: true,
      },
      options: { samplingClass: 'always', highRisk: true },
    });
    expect(JSON.stringify(logs)).not.toMatch(/refused|db\.internal|fr-FR/u);
    expect(() =>
      LogEventDetailsSchema.parse(failureLog(logs)?.details),
    ).not.toThrow();
    // DEC-219: a failed read is counted (and only counted: no fan-out counter, no gauge).
    expect(failureLog(logs)?.details.metrics).toEqual({
      cms_locale_observability_read_failed_total: 1,
    });
  });

  it('treats a malformed answer as a failed read: it counts the failure and emits no fan-out counter or gauge', async () => {
    const { logs, probe } = probeWith(async () => {
      throw new Error('Malformed locale observability response');
    });
    await expect(probe.observe(T)).resolves.toBeUndefined();
    expect(logs).toHaveLength(2);
    expect(logs[0]?.details.metrics).toEqual({
      cms_locale_observability_read_failed_total: 1,
    });
  });

  it('swallows an invalid scheduled time', async () => {
    const { logs, probe, reads } = probeWith(async () => observation());
    await expect(probe.observe(Number.NaN)).resolves.toBeUndefined();
    expect(reads).not.toHaveBeenCalled();
    expect(failureLog(logs)?.details.errorCode).toBe(
      'LOCALE_OBSERVABILITY_UNAVAILABLE',
    );
  });

  it('aborts a read that does not answer within its deadline and swallows it', async () => {
    vi.useFakeTimers();
    const { logs, probe } = probeWith(
      (_window, signal) =>
        new Promise<LocaleObservation>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const pending = probe.observe(T);
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(pending).resolves.toBeUndefined();
    expect(failureLog(logs)?.details.errorCode).toBe(
      'LOCALE_OBSERVABILITY_UNAVAILABLE',
    );
  });

  // BE03c "Database-side locale observability (DEC-208)": the 5 s bound is the Worker's 5,000 ms call deadline.
  describe('the 5,000 ms read deadline', () => {
    /** A transport-like read: answers after `ms`, but rejects the moment the deadline aborts it. */
    const answersAfter = (ms: number, answer: LocaleObservation) =>
      ((_window, signal) =>
        new Promise<LocaleObservation>((resolve, reject) => {
          const timer = setTimeout(() => resolve(answer), ms);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('aborted'));
          });
        })) satisfies LocaleObservabilityPort['read'];

    it('names the deadline 5,000 ms', () => {
      expect(LOCALE_OBSERVABILITY_READ_DEADLINE_MS).toBe(5_000);
    });

    it('uses a read that resolves at 4,999 ms', async () => {
      vi.useFakeTimers();
      const { logs, probe } = probeWith(
        answersAfter(
          4_999,
          observation({ fanoutRows: 2, staleLegalFields: 1 }),
        ),
      );
      const pending = probe.observe(T);
      await vi.advanceTimersByTimeAsync(4_999);
      await expect(pending).resolves.toBeUndefined();
      expect(logs[0]).toMatchObject({
        level: 'info',
        details: {
          outcome: 'success',
          metrics: {
            cms_locale_fanout_total: 2,
            cms_locale_stale_legal_fields: 1,
          },
        },
      });
    });

    it('reports a read that would resolve at 5,001 ms as a failed read: allowlisted fields, the failure counted, no fan-out counter, no gauge, no stale alert, swallowed', async () => {
      vi.useFakeTimers();
      const { logs, probe } = probeWith(
        answersAfter(
          5_001,
          observation({ fanoutRows: 9, staleLegalFields: 4 }),
        ),
      );
      const pending = probe.observe(T);
      await vi.advanceTimersByTimeAsync(5_001);
      await expect(pending).resolves.toBeUndefined();
      expect(logs).toHaveLength(2);
      expect(logs[0]).toMatchObject({
        level: 'warn',
        details: {
          eventName: CMS_LOCALE_OBSERVABILITY_EVENT,
          outcome: 'failure',
          errorCode: 'LOCALE_OBSERVABILITY_UNAVAILABLE',
          dependency: 'database',
          retryable: true,
        },
      });
      expect(logs[0]?.details.metrics).toEqual({
        cms_locale_observability_read_failed_total: 1,
      });
      expect(() => LogEventDetailsSchema.parse(logs[0]?.details)).not.toThrow();
    });
  });

  it('does not raise the stale legal-field alert on a failed read: the last gauge is not carried over (only the unavailable alert)', async () => {
    const { logs, probe } = probeWith(async () => {
      throw new Error('down');
    });
    await probe.observe(T);
    const raised = logs.filter(
      (log) => log.details.eventName === CMS_LOCALE_OBSERVABILITY_ALERT_EVENT,
    );
    expect(raised.map((log) => log.details.errorCode)).toEqual([
      'LOCALE_OBSERVABILITY_UNAVAILABLE',
    ]);
  });
});
