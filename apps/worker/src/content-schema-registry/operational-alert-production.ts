import { createLogger, type Logger } from '@wejammin/observability/logging';

import { supabaseRpcHeaders } from '../supabase-rpc-headers';
import {
  buildContentSchemaRegistryOperationalSnapshot,
  operationalGaugeMetrics,
} from './operational-alert-metrics';
import { postOperationalProviderJson } from './operational-alert-provider';
import type {
  OperationalAlertDependencies,
  OperationalAlertRunInput,
} from './operational-alert-runtime';

type EmailBinding = Readonly<{
  send: (message: Readonly<Record<string, unknown>>) => Promise<unknown>;
}>;

export type OperationalAlertProductionBindings = Readonly<{
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_OBSERVABILITY_API_TOKEN: string;
  CLOUDFLARE_PLATFORM_DLQ_ID: string;
  PLATFORM_ALERT_EMAIL: EmailBinding;
  SUPABASE_SECRET_KEY: string;
  SUPABASE_URL: string;
}>;

type ProductionOptions = Readonly<{
  logger?: Logger;
  providerTimeoutMs?: number;
  randomUuid?: () => string;
}>;

const ALERT_FROM = 'platform.on-call@alerts.wejamm.in' as const;
const ALERT_TO = 'admin.wejammin@gmail.com' as const;
const PROVIDER_MESSAGE_ID = /^[\x21-\x7e]{1,512}$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const providerMessageId = (value: unknown): string => {
  if (
    !isRecord(value) ||
    typeof value.messageId !== 'string' ||
    !PROVIDER_MESSAGE_ID.test(value.messageId)
  )
    throw new Error('Invalid operational alert delivery response');
  return value.messageId;
};

const supabaseRpc = (
  bindings: OperationalAlertProductionBindings,
  fetchImpl: typeof fetch,
  operation: string,
  request: unknown,
  timeoutMs: number,
): Promise<unknown> =>
  postOperationalProviderJson(
    fetchImpl,
    `${bindings.SUPABASE_URL}/rest/v1/rpc/${operation}`,
    {
      'Accept-Profile': 'platform_api',
      'Content-Profile': 'platform_api',
      ...supabaseRpcHeaders(bindings.SUPABASE_SECRET_KEY),
    },
    { p_request: request },
    timeoutMs,
  );

const cloudflareEvents = async (
  bindings: OperationalAlertProductionBindings,
  fetchImpl: typeof fetch,
  input: OperationalAlertRunInput,
  timeoutMs: number,
): Promise<readonly Readonly<{ source?: unknown }>[]> => {
  const to = Date.parse(input.scheduledAt);
  const payload = await postOperationalProviderJson(
    fetchImpl,
    `https://api.cloudflare.com/client/v4/accounts/${bindings.CLOUDFLARE_ACCOUNT_ID}/workers/observability/telemetry/query`,
    { Authorization: `Bearer ${bindings.CLOUDFLARE_OBSERVABILITY_API_TOKEN}` },
    {
      parameters: {
        datasets: ['cloudflare-workers'],
        limit: 2_000,
        needle: { isRegex: false, value: 'cms.registry.' },
        view: 'events',
      },
      queryId: `wejammin-cms-alerts-${input.release}`,
      timeframe: { from: to - 86_400_000, to },
    },
    timeoutMs,
  );
  if (
    !isRecord(payload) ||
    (Object.hasOwn(payload, 'success') && payload.success !== true) ||
    !isRecord(payload.result)
  )
    throw new Error('Invalid Workers Logs response');
  const eventsContainer = payload.result.events;
  if (eventsContainer === undefined) return [];
  if (!isRecord(eventsContainer))
    throw new Error('Invalid Workers Logs response');
  const events = eventsContainer.events;
  if (events === undefined) return [];
  if (!Array.isArray(events)) throw new Error('Invalid Workers Logs response');
  return events.filter(isRecord);
};

const queueBacklog = async (
  bindings: OperationalAlertProductionBindings,
  fetchImpl: typeof fetch,
  input: OperationalAlertRunInput,
  timeoutMs: number,
): Promise<number | undefined> => {
  const payload = await postOperationalProviderJson(
    fetchImpl,
    'https://api.cloudflare.com/client/v4/graphql',
    { Authorization: `Bearer ${bindings.CLOUDFLARE_OBSERVABILITY_API_TOKEN}` },
    {
      query: `query QueueBacklog($accountTag: string!, $queueId: string!, $datetimeStart: Time!, $datetimeEnd: Time!) { viewer { accounts(filter: { accountTag: $accountTag }) { queueBacklogAdaptiveGroups(limit: 1, filter: { queueId: $queueId, datetime_geq: $datetimeStart, datetime_leq: $datetimeEnd }) { avg { messages } } } } }`,
      variables: {
        accountTag: bindings.CLOUDFLARE_ACCOUNT_ID,
        datetimeEnd: input.scheduledAt,
        datetimeStart: new Date(
          Date.parse(input.scheduledAt) - 300_000,
        ).toISOString(),
        queueId: bindings.CLOUDFLARE_PLATFORM_DLQ_ID,
      },
    },
    timeoutMs,
  );
  if (
    isRecord(payload) &&
    Object.hasOwn(payload, 'errors') &&
    payload.errors !== null &&
    (!Array.isArray(payload.errors) || payload.errors.length > 0)
  )
    throw new Error('Invalid Queue analytics response');
  const data = isRecord(payload) ? payload.data : undefined;
  const viewer = isRecord(data) ? data.viewer : undefined;
  const accounts = isRecord(viewer) ? viewer.accounts : undefined;
  const account = Array.isArray(accounts) ? accounts[0] : undefined;
  const groups = isRecord(account)
    ? account.queueBacklogAdaptiveGroups
    : undefined;
  const group = Array.isArray(groups) ? groups[0] : undefined;
  const avg = isRecord(group) ? group.avg : undefined;
  const messages = isRecord(avg) ? avg.messages : undefined;
  return typeof messages === 'number' && Number.isFinite(messages)
    ? Math.max(0, Math.ceil(messages))
    : undefined;
};

const databaseSnapshot = async (
  bindings: OperationalAlertProductionBindings,
  fetchImpl: typeof fetch,
  input: OperationalAlertRunInput,
  timeoutMs: number,
): Promise<
  Readonly<{
    activationBlockedMs?: number;
    outboxAgeMs?: number;
    reviewOpenAgeMs?: number;
  }>
> => {
  const value = await supabaseRpc(
    bindings,
    fetchImpl,
    'cms_get_operational_state_snapshot',
    { observedAt: input.scheduledAt },
    timeoutMs,
  );
  if (!isRecord(value)) throw new Error('Invalid operational snapshot');
  return {
    ...(typeof value.activationBlockedMs === 'number'
      ? { activationBlockedMs: value.activationBlockedMs }
      : {}),
    ...(typeof value.outboxAgeMs === 'number'
      ? { outboxAgeMs: value.outboxAgeMs }
      : {}),
    ...(typeof value.reviewOpenAgeMs === 'number'
      ? { reviewOpenAgeMs: value.reviewOpenAgeMs }
      : {}),
  };
};

export const createProductionOperationalAlertDependencies = (
  bindings: OperationalAlertProductionBindings,
  fetchImpl: typeof fetch = globalThis.fetch,
  options: ProductionOptions = {},
): OperationalAlertDependencies => {
  const randomUuid = options.randomUuid ?? crypto.randomUUID.bind(crypto);
  const providerTimeoutMs =
    Number.isSafeInteger(options.providerTimeoutMs) &&
    (options.providerTimeoutMs as number) > 0
      ? (options.providerTimeoutMs as number)
      : 15_000;
  return {
    loadSnapshot: async (input) => {
      const database = await databaseSnapshot(
        bindings,
        fetchImpl,
        input,
        providerTimeoutMs,
      );
      const dlqDepth = await queueBacklog(
        bindings,
        fetchImpl,
        input,
        providerTimeoutMs,
      );
      const events = await cloudflareEvents(
        bindings,
        fetchImpl,
        input,
        providerTimeoutMs,
      );
      const snapshot = buildContentSchemaRegistryOperationalSnapshot({
        database,
        ...(dlqDepth === undefined ? {} : { dlqDepth }),
        events,
        now: Date.parse(input.scheduledAt),
      });
      const gauges = operationalGaugeMetrics(snapshot);
      if (Object.keys(gauges).length > 0)
        (
          options.logger ??
          createLogger({
            environment: input.environment,
            release: input.release,
            service: 'wejammin-api',
          })
        ).info(
          {
            eventName: 'cms.registry.operational_state',
            operation: 'operational.snapshot',
            outcome: 'success',
            metrics: gauges,
          },
          { samplingClass: 'always' },
        );
      return snapshot;
    },
    claim: async (alert, input) => {
      const claimToken = randomUuid();
      const value = await supabaseRpc(
        bindings,
        fetchImpl,
        'cms_claim_operational_alert',
        {
          alertCode: alert.code,
          claimToken,
          release: input.release,
          scheduledAt: input.scheduledAt,
        },
        providerTimeoutMs,
      );
      if (!isRecord(value) || value.claimed !== true) return { claimed: false };
      if (typeof value.claimId !== 'string')
        throw new Error('Invalid operational alert claim');
      return { claimed: true, claimId: value.claimId, claimToken };
    },
    deliver: async (delivery) => {
      const receiptId = randomUuid();
      let result: unknown;
      try {
        result = await bindings.PLATFORM_ALERT_EMAIL.send({
          from: ALERT_FROM,
          subject: `[WeJammin] ${delivery.alert.code}`,
          text: [
            'route=platform.on_call',
            'runbook=content-schema-registry',
            `alert=${delivery.alert.code}`,
            `observed=${delivery.alert.observed}`,
            `threshold=${delivery.alert.threshold}`,
            `release=${delivery.release}`,
            `scheduled_at=${delivery.scheduledAt}`,
            'redacted=true',
          ].join('\n'),
          to: ALERT_TO,
        });
      } catch {
        throw new Error('Operational alert delivery failed');
      }
      return { receiptId, providerMessageId: providerMessageId(result) };
    },
    complete: async ({
      alert,
      claimId,
      claimToken,
      deliveredAt,
      providerMessageId,
      receiptId,
    }) => {
      const value = await supabaseRpc(
        bindings,
        fetchImpl,
        'cms_complete_operational_alert',
        {
          alertCode: alert.code,
          claimId,
          claimToken,
          deliveredAt,
          providerMessageId,
          receiptId,
        },
        providerTimeoutMs,
      );
      if (value !== true)
        throw new Error('Operational alert completion failed');
    },
  };
};
