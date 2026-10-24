import { LogEventDetailsSchema } from '@wejammin/observability/logging';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NOW, recordingTelemetry } from '../event-consumers/test-support';
import {
  CMS_LOCALE_OBSERVABILITY_ALERT_EVENT,
  CMS_LOCALE_OBSERVABILITY_EVENT,
  createLocaleObservabilityProbe,
  type LocaleObservation,
  type LocaleObservabilityPort,
} from './locale-observability';
import {
  CMS_COMPOSITION_LOG_ATTRIBUTES,
  CMS_COMPOSITION_LOG_FIELDS,
  metricKeyConforms,
} from './observability-registry';

/*
 * [P2-S12-AC-264] DEC-219 / DEC-220 (BE03c "Database-side locale observability (DEC-208)"): "Each failed, timed-out or
 * malformed read increments `cms_locale_observability_read_failed_total` (no labels) and raises the alert
 * `locale_observability_unavailable`" for that firing, because the stale legal-field alert input would otherwise
 * disappear silently. The alert is stateless: scheduled firings need not share an isolate, so the Worker keeps no failure
 * history and delivery dedupes. The decisive case is two consecutive failures in two separate probe instances.
 */

const T = Date.UTC(2026, 9, 23, 12, 5, 0);

const healthy: LocaleObservation = {
  fanoutRows: 0,
  staleFieldsAppended: 0,
  staleLegalFields: 0,
};

const failing =
  (message: string): LocaleObservabilityPort['read'] =>
  async () => {
    throw new Error(message);
  };

/** A fresh probe instance (a fresh isolate) over the shared recording telemetry. */
const instance = (
  telemetry: ReturnType<typeof recordingTelemetry>['telemetry'],
  read: LocaleObservabilityPort['read'],
) =>
  createLocaleObservabilityProbe({
    port: { read },
    telemetry,
    clock: { now: () => NOW, randomUuid: () => 'unused' },
  });

const alerts = (logs: ReturnType<typeof recordingTelemetry>['logs']) =>
  logs.filter(
    (log) => log.details.eventName === CMS_LOCALE_OBSERVABILITY_ALERT_EVENT,
  );

afterEach(() => {
  vi.useRealTimers();
});

describe('[P2-S12-AC-264] the failed-read counter', () => {
  it('increments cms_locale_observability_read_failed_total once per failed read, a registered label-free metric', async () => {
    const { logs, telemetry } = recordingTelemetry();
    await instance(telemetry, failing('down')).observe(T);
    await instance(telemetry, failing('down')).observe(T + 60_000);
    const samples = logs.filter(
      (log) => log.details.eventName === CMS_LOCALE_OBSERVABILITY_EVENT,
    );
    expect(samples).toHaveLength(2);
    for (const sample of samples) {
      expect(sample.level).toBe('warn');
      expect(sample.details.metrics).toEqual({
        cms_locale_observability_read_failed_total: 1,
      });
    }
    expect(
      metricKeyConforms('cms_locale_observability_read_failed_total'),
    ).toBe(true);
    expect(
      metricKeyConforms(
        'cms_locale_observability_read_failed_total{locale="fr-FR"}',
      ),
    ).toBe(false);
  });

  it('does not count a successful read', async () => {
    const { logs, telemetry } = recordingTelemetry();
    await instance(telemetry, async () => healthy).observe(T);
    expect(JSON.stringify(logs)).not.toContain(
      'cms_locale_observability_read_failed_total',
    );
  });
});

describe('[P2-S12-AC-264] a failed read raises locale_observability_unavailable for its own firing', () => {
  it('one failed read raises exactly one alert, with allowlisted schema-valid members', async () => {
    const { logs, telemetry } = recordingTelemetry();
    await instance(telemetry, failing('down')).observe(T);
    expect(alerts(logs)).toHaveLength(1);
    const alert = alerts(logs)[0];
    expect(alert).toMatchObject({
      level: 'warn',
      details: {
        eventName: CMS_LOCALE_OBSERVABILITY_ALERT_EVENT,
        operation: 'evaluate',
        outcome: 'failure',
        errorCode: 'LOCALE_OBSERVABILITY_UNAVAILABLE',
        attributes: { runbook: 'cms-composition' },
      },
      options: { samplingClass: 'always', highRisk: true },
    });
    expect(() => LogEventDetailsSchema.parse(alert?.details)).not.toThrow();
    for (const member of Object.keys(alert?.details ?? {}))
      expect(CMS_COMPOSITION_LOG_FIELDS).toContain(member);
    for (const member of Object.keys(
      (alert?.details.attributes ?? {}) as Record<string, unknown>,
    ))
      expect(CMS_COMPOSITION_LOG_ATTRIBUTES).toContain(member);
    // The alert event does not repeat the counter (it would double count the failure).
    expect(alert?.details.metrics).toBeUndefined();
  });

  it('a successful read raises no alert', async () => {
    const { logs, telemetry } = recordingTelemetry();
    await instance(telemetry, async () => healthy).observe(T);
    expect(alerts(logs)).toHaveLength(0);
  });

  it('two consecutive failures in two separate probe instances (two isolates) alert each time', async () => {
    const { logs, telemetry } = recordingTelemetry();
    await instance(telemetry, failing('down')).observe(T);
    await instance(telemetry, failing('down')).observe(T + 60_000);
    expect(alerts(logs)).toHaveLength(2);
  });

  it('the same instance failing repeatedly alerts every time: the Worker keeps no history and does not dedupe', async () => {
    const { logs, telemetry } = recordingTelemetry();
    const probe = instance(telemetry, failing('down'));
    for (let n = 0; n < 4; n += 1) await probe.observe(T + n * 60_000);
    expect(alerts(logs)).toHaveLength(4);
  });

  it('a failure after a success still alerts (nothing is carried over)', async () => {
    const { logs, telemetry } = recordingTelemetry();
    await instance(telemetry, async () => healthy).observe(T);
    await instance(telemetry, failing('down')).observe(T + 60_000);
    expect(alerts(logs)).toHaveLength(1);
  });

  it('a malformed answer alerts', async () => {
    const { logs, telemetry } = recordingTelemetry();
    await instance(
      telemetry,
      failing('Malformed locale observability response'),
    ).observe(T);
    expect(alerts(logs)).toHaveLength(1);
  });

  it('a read that exceeds the 5,000 ms deadline (a timeout) alerts', async () => {
    vi.useFakeTimers();
    const { logs, telemetry } = recordingTelemetry();
    const pending = instance(
      telemetry,
      (_window, signal) =>
        new Promise<LocaleObservation>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    ).observe(T);
    await vi.advanceTimersByTimeAsync(5_000);
    await pending;
    expect(alerts(logs)).toHaveLength(1);
  });

  it('an invalid scheduled time (a read that could not be made) alerts', async () => {
    const { logs, telemetry } = recordingTelemetry();
    await instance(telemetry, async () => healthy).observe(Number.NaN);
    expect(alerts(logs)).toHaveLength(1);
  });
});
