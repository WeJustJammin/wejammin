import { createLogger, type LogEvent } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import {
  appendRequest,
  fetchFailing,
  historyPagePayload,
  historyRequest,
  wiredApp,
} from './cms-editorial-production-app.test-support';
import { productionCmsEditorialTelemetry } from './cms-editorial-production-telemetry';
import { json } from './cms-editorial-production.test-support';
import {
  appendedRevisionId,
  resource,
} from './cms-editorial/route-fixtures.test-support';

/**
 * The production logging sink (BE03b:1439-1444) fed by the real route ->
 * production adapter chain: which events a command and a read write, the
 * stages they claim, the alert class by SLO tier, and that the logger accepts
 * every event it is given (a rejected event would be silently dropped in
 * production).
 */

const ok = (value: unknown, headers?: HeadersInit) => () =>
  json(value, 200, headers);

describe('production sink (BE03b:1439-1444)', () => {
  const sinkLines = () => {
    const lines: LogEvent[] = [];
    const rejected: string[] = [];
    const logger = createLogger(
      { environment: 'staging', release: 'slice-10', service: 'wejammin-api' },
      {
        sink: (line) => lines.push(JSON.parse(line) as LogEvent),
        onDiagnostic: (code) => rejected.push(code),
      },
    );
    return {
      lines,
      rejected,
      telemetry: productionCmsEditorialTelemetry(logger),
    };
  };

  it('a successful command logs request, command, rpc and acceptance, and none is rejected by the logger', async () => {
    const { lines, rejected, telemetry } = sinkLines();
    const response = await appendRequest(
      wiredApp(fetchFailing(ok(resource(appendedRevisionId, '2'))), {
        telemetry,
      }),
    );
    expect(response.status).toBe(201);
    await vi.waitFor(() => expect(lines.length).toBe(4));
    expect(lines.map((line) => line.eventName)).toEqual([
      'cms.editorial.request',
      'cms.editorial.command',
      'cms.editorial.rpc',
      'cms.editorial.acceptance',
    ]);
    expect(rejected).toEqual([]);
    expect(lines[0]).toMatchObject({
      operation: 'cms.editorial.CMS-03B-01',
      outcome: 'success',
      retryable: false,
      actingContextClass: 'party',
      entityType: 'cms_entry',
      entityVersion: '2',
    });
    expect(lines[0]).not.toHaveProperty('dependency');
    expect(lines[0]?.attributes).toMatchObject({
      alert_class: 'cms_editorial_tier2',
      runbook: 'cms-editorial',
    });
    expect(lines[0]?.metrics).toMatchObject({
      cms_revision_created_total: 1,
    });
  });

  it('a command refused before the RPC logs no rpc or acceptance event', async () => {
    const { lines, rejected, telemetry } = sinkLines();
    const response = await appendRequest(
      wiredApp(fetchFailing(ok({})), {
        telemetry,
        resolveSession: async () => ({
          ok: false as const,
          status: 401 as const,
          code: 'UNAUTHENTICATED',
          message: 'No session.',
        }),
      }),
    );
    expect(response.status).toBe(401);
    await vi.waitFor(() => expect(lines.length).toBeGreaterThanOrEqual(2));
    expect(lines.map((line) => line.eventName)).toEqual([
      'cms.editorial.request',
      'cms.editorial.command',
    ]);
    expect(rejected).toEqual([]);
  });

  it('a read logs only the request event under the Tier 1 alert class', async () => {
    const { lines, rejected, telemetry } = sinkLines();
    const response = await historyRequest(
      wiredApp(fetchFailing(ok(historyPagePayload)), { telemetry }),
    );
    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(lines.length).toBeGreaterThanOrEqual(1));
    expect(lines.map((line) => line.eventName)).toEqual([
      'cms.editorial.request',
    ]);
    expect(lines[0]?.attributes).toMatchObject({
      alert_class: 'cms_editorial_tier1',
    });
    expect(rejected).toEqual([]);
  });

  it('a dependency failure is retryable and names the dependency class', async () => {
    const { lines, telemetry } = sinkLines();
    const response = await appendRequest(
      wiredApp(
        fetchFailing(() => json({}, 503)),
        { telemetry },
      ),
    );
    expect(response.status).toBe(503);
    await vi.waitFor(() => expect(lines.length).toBeGreaterThanOrEqual(1));
    expect(lines[0]).toMatchObject({
      outcome: 'failure',
      retryable: true,
      dependency: 'cms_editorial',
      errorCode: 'DEPENDENCY_UNAVAILABLE',
    });
  });
});
