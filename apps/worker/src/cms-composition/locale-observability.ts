import { evaluateCmsCompositionAlerts } from '@wejammin/observability/cms-composition-alerts';
import type { CmsCompositionOperationalSnapshot } from '@wejammin/observability/cms-composition-alerts';

import { runWithDeadline } from '../event-consumers/deadline';
import { EVENT_CONSUMER_RPC } from '../event-consumers/rpc-names';
import {
  defaultConsumerClock,
  type ConsumerClock,
  type ConsumerTelemetry,
  type EventConsumerRpc,
} from '../event-consumers/types';

/*
 * BE03c Observability, "Database-side locale observability (DEC-208)": the locale fan-out and the staleness it
 * records happen inside PostgreSQL transactions, so the Worker reads them on its `* * * * *` tick through the
 * service-role RPC `cms_locale_observability_read`. Each tick reads the one minute that ended two minutes before
 * it, so consecutive ticks tile time (a writer transaction shorter than two minutes is never missed; a missed
 * firing leaves its minute uncounted and a repeated one counts it twice: the counters are trend signals). The
 * gauge is sampled afresh on every firing and is the alert input. A failed, timed-out or malformed read is
 * logged with allowlisted fields only and swallowed: observability never fails the scheduled sweep.
 */

export const CMS_LOCALE_OBSERVABILITY_EVENT =
  'cms.locale.observability.sample' as const;
export const CMS_LOCALE_OBSERVABILITY_ALERT_EVENT =
  'cms.locale.observability.alert' as const;

/**
 * The Worker's call deadline for the read (BE03c: the 5 s bound is this deadline, not a database setting); an
 * abort is a failed read.
 */
export const LOCALE_OBSERVABILITY_READ_DEADLINE_MS = 5_000;

const MINUTE_MS = 60_000;
/** The largest instant a JavaScript Date represents. */
const MAX_TIME_MS = 8.64e15;

/** What the database answers: exactly three non-negative integers, no id, locale, field id or text. */
export type LocaleObservation = Readonly<{
  fanoutRows: number;
  staleFieldsAppended: number;
  staleLegalFields: number;
}>;

/** The closed-open window `[start, end)` as the whole-minute instants the RPC accepts. */
export type LocaleObservabilityWindow = Readonly<{
  start: string;
  end: string;
}>;

export type LocaleObservabilityPort = Readonly<{
  read: (
    window: LocaleObservabilityWindow,
    signal: AbortSignal,
  ) => Promise<LocaleObservation>;
}>;

/** [T - 3 min, T - 2 min) for T the scheduled time floored to the minute. */
export const localeObservabilityWindow = (
  scheduledTime: number,
): LocaleObservabilityWindow => {
  if (!Number.isFinite(scheduledTime) || Math.abs(scheduledTime) > MAX_TIME_MS)
    throw new Error('Invalid scheduled time');
  const tick = Math.floor(scheduledTime / MINUTE_MS) * MINUTE_MS;
  const start = tick - 3 * MINUTE_MS;
  const end = tick - 2 * MINUTE_MS;
  if (Math.abs(start) > MAX_TIME_MS || Math.abs(end) > MAX_TIME_MS)
    throw new Error('Invalid scheduled time');
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('Malformed locale observability response');
  return value;
};

export const parseLocaleObservation = (value: unknown): LocaleObservation => {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(',') !==
      'fanoutRows,staleFieldsAppended,staleLegalFields'
  )
    throw new Error('Malformed locale observability response');
  return {
    fanoutRows: count(value.fanoutRows),
    staleFieldsAppended: count(value.staleFieldsAppended),
    staleLegalFields: count(value.staleLegalFields),
  };
};

export const createRpcLocaleObservabilityPort = (
  rpc: EventConsumerRpc,
): LocaleObservabilityPort => ({
  read: async (window, signal) =>
    parseLocaleObservation(
      await rpc<unknown>(
        EVENT_CONSUMER_RPC.readCmsLocaleObservability,
        { p_window_start: window.start, p_window_end: window.end },
        signal,
      ),
    ),
});

/** The redacted aggregate snapshot the composition alert policy evaluates (alert above 0). */
export const localeAlertSnapshot = (
  observation: LocaleObservation,
): CmsCompositionOperationalSnapshot => ({
  staleLocaleLegalFieldCount: observation.staleLegalFields,
});

export const createLocaleObservabilityProbe = (
  dependencies: Readonly<{
    port: LocaleObservabilityPort;
    telemetry: ConsumerTelemetry;
    clock?: ConsumerClock;
  }>,
) => {
  const clock = dependencies.clock ?? defaultConsumerClock;
  return {
    observe: async (scheduledTime: number): Promise<void> => {
      const startedAt = clock.now();
      let observation: LocaleObservation;
      try {
        const window = localeObservabilityWindow(scheduledTime);
        observation = await runWithDeadline(
          (signal) => dependencies.port.read(window, signal),
          LOCALE_OBSERVABILITY_READ_DEADLINE_MS,
        );
      } catch {
        const failedNow = clock.now();
        dependencies.telemetry.warn(
          {
            eventName: CMS_LOCALE_OBSERVABILITY_EVENT,
            operation: 'sample',
            outcome: 'failure',
            errorCode: 'LOCALE_OBSERVABILITY_UNAVAILABLE',
            dependency: 'database',
            durationMs: Math.max(0, failedNow - startedAt),
            retryable: true,
            metrics: { cms_locale_observability_read_failed_total: 1 },
          },
          { samplingClass: 'always', highRisk: true },
        );
        // DEC-220: every failed read raises `locale_observability_unavailable` for this firing. Stateless: scheduled firings
        // need not share an isolate, so the Worker keeps no failure history and delivery dedupes.
        for (const alert of evaluateCmsCompositionAlerts({
          localeObservabilityFailedReads: 1,
        })) {
          dependencies.telemetry.warn(
            {
              eventName: CMS_LOCALE_OBSERVABILITY_ALERT_EVENT,
              operation: 'evaluate',
              outcome: 'failure',
              errorCode: alert.code.toUpperCase(),
              attributes: { runbook: alert.runbook },
            },
            { samplingClass: 'always', highRisk: true },
          );
        }
        return;
      }
      dependencies.telemetry.info(
        {
          eventName: CMS_LOCALE_OBSERVABILITY_EVENT,
          operation: 'sample',
          outcome: 'success',
          dependency: 'database',
          durationMs: Math.max(0, clock.now() - startedAt),
          metrics: {
            cms_locale_fanout_total: observation.fanoutRows,
            cms_locale_stale_total: observation.staleFieldsAppended,
            cms_locale_stale_legal_fields: observation.staleLegalFields,
          },
        },
        { samplingClass: 'always' },
      );
      for (const alert of evaluateCmsCompositionAlerts(
        localeAlertSnapshot(observation),
      )) {
        dependencies.telemetry.warn(
          {
            eventName: CMS_LOCALE_OBSERVABILITY_ALERT_EVENT,
            operation: 'evaluate',
            outcome: 'failure',
            errorCode: alert.code.toUpperCase(),
            attributes: { runbook: alert.runbook },
            metrics: { cms_locale_stale_legal_fields: alert.observed },
          },
          { samplingClass: 'always', highRisk: true },
        );
      }
    },
  };
};
