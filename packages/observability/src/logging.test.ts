import { describe, expect, it, vi } from 'vitest';

import { createLogger, type LogEventDetails } from './logging';

const fixedTime = new Date('2026-08-30T06:30:00.000Z');

const validDetails: LogEventDetails = {
  correlationId: 'corr_setup_01',
  durationMs: 12,
  eventName: 'http.request.completed',
  operation: 'health.read',
  outcome: 'success',
  requestId: 'req_setup_01',
  retryable: false,
  routeTemplate: '/api/v1/health',
};

describe('structured logger', () => {
  it('emits structured objects through the default Cloudflare console sink', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const logger = createLogger({
      environment: 'production',
      release: 'a'.repeat(40),
      service: 'wejammin-api',
    });

    expect(logger.info(validDetails)).toBe('written');
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: 12,
        eventName: 'http.request.completed',
        service: 'wejammin-api',
      }),
    );
    expect(typeof info.mock.calls[0]?.[0]).toBe('object');
    info.mockRestore();
  });

  it('emits one schema-validated NDJSON event with immutable context', () => {
    const lines: string[] = [];
    const logger = createLogger(
      {
        environment: 'staging',
        release: 'a2ec4803',
        service: 'wejammin-api',
      },
      {
        now: () => fixedTime,
        random: () => 0,
        sink: (line) => lines.push(line),
      },
    );

    expect(logger.info(validDetails, { samplingClass: 'public_success' })).toBe(
      'written',
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('\n');
    expect(JSON.parse(lines[0] ?? '')).toEqual({
      correlationId: 'corr_setup_01',
      durationMs: 12,
      environment: 'staging',
      eventName: 'http.request.completed',
      operation: 'health.read',
      outcome: 'success',
      release: 'a2ec4803',
      requestId: 'req_setup_01',
      retryable: false,
      routeTemplate: '/api/v1/health',
      service: 'wejammin-api',
      severity: 'INFO',
      timestamp: '2026-08-30T06:30:00.000Z',
    });
  });

  it('rejects reserved, forbidden, and injected fields without leaking them', () => {
    const diagnostics: string[] = [];
    const lines: string[] = [];
    const logger = createLogger(
      {
        environment: 'staging',
        release: 'a2ec4803',
        service: 'wejammin-api',
      },
      {
        now: () => fixedTime,
        onDiagnostic: (code) => diagnostics.push(code),
        sink: (line) => lines.push(line),
      },
    );
    const malicious = {
      ...validDetails,
      eventName: 'request.completed\n{"service":"owned"}',
      service: 'owned',
      token: 'forbidden-sentinel-token',
    } as unknown as LogEventDetails;

    expect(logger.warn(malicious)).toBe('rejected');
    expect(diagnostics).toEqual(['invalid_log_event']);
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('\n');
    expect(lines[0]).not.toContain('owned');
    expect(lines[0]).not.toContain('forbidden-sentinel-token');
    expect(JSON.parse(lines[0] ?? '')).toEqual({
      environment: 'staging',
      errorCode: 'invalid_log_event',
      eventName: 'observability.event_rejected',
      operation: 'telemetry.write',
      outcome: 'rejected',
      release: 'a2ec4803',
      retryable: false,
      service: 'wejammin-api',
      severity: 'WARN',
      timestamp: '2026-08-30T06:30:00.000Z',
    });
  });

  it('accepts only lowercase sha256 entity digests and rejects raw identifiers', () => {
    const diagnostics: string[] = [];
    const lines: string[] = [];
    const logger = createLogger(
      {
        environment: 'staging',
        release: 'a2ec4803',
        service: 'wejammin-api',
      },
      {
        now: () => fixedTime,
        onDiagnostic: (code) => diagnostics.push(code),
        sink: (line) => lines.push(line),
      },
    );
    const entityIdHash = `sha256:${'a'.repeat(64)}`;

    expect(logger.info({ ...validDetails, entityIdHash })).toBe('written');
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({ entityIdHash });

    expect(
      logger.info({ ...validDetails, entityIdHash: 'usr_01HXYZ1234567890' }),
    ).toBe('rejected');
    expect(
      logger.info({
        ...validDetails,
        entityIdHash: `sha256:${'A'.repeat(64)}`,
      }),
    ).toBe('rejected');
    expect(
      logger.info({
        ...validDetails,
        entityIdHash: `sha256:${'a'.repeat(63)}\n`,
      }),
    ).toBe('rejected');
    expect(diagnostics).toEqual([
      'invalid_log_event',
      'invalid_log_event',
      'invalid_log_event',
    ]);
    expect(lines).toHaveLength(4);
    expect(lines[1]).not.toContain('usr_01HXYZ1234567890');
    expect(lines[2]).not.toContain(`sha256:${'A'.repeat(64)}`);
    expect(lines[3]).not.toContain('\n');
  });

  it('applies locked sampling without ever sampling errors or high-risk work', () => {
    const lines: string[] = [];
    const logger = createLogger(
      {
        environment: 'staging',
        release: 'a2ec4803',
        service: 'wejammin-api',
      },
      {
        now: () => fixedTime,
        random: () => 0.5,
        sink: (line) => lines.push(line),
      },
    );

    expect(logger.info(validDetails, { samplingClass: 'public_success' })).toBe(
      'sampled_out',
    );
    expect(
      logger.info(validDetails, { samplingClass: 'authenticated_success' }),
    ).toBe('sampled_out');
    expect(
      logger.info(validDetails, {
        highRisk: true,
        samplingClass: 'public_success',
      }),
    ).toBe('written');
    expect(
      logger.error({
        ...validDetails,
        errorCode: 'unexpected_failure',
        outcome: 'failure',
      }),
    ).toBe('written');
    expect(logger.debug(validDetails)).toBe('written');
    expect(logger.fatal(validDetails)).toBe('written');
    expect(lines).toHaveLength(4);
  });

  it('does not let a sink or diagnostic failure affect application flow', () => {
    const logger = createLogger(
      {
        environment: 'staging',
        release: 'a2ec4803',
        service: 'wejammin-api',
      },
      {
        onDiagnostic: () => {
          throw new Error('diagnostic unavailable');
        },
        sink: () => {
          throw new Error('sink unavailable');
        },
      },
    );

    expect(logger.error(validDetails)).toBe('sink_failed');
  });

  it('[P2-S09-AC-206] accepts a closed labelled metric key and refuses a key that could carry free text', () => {
    const lines: string[] = [];
    const logger = createLogger(
      { environment: 'staging', release: 'a2ec4803', service: 'wejammin-api' },
      {
        now: () => fixedTime,
        random: () => 0,
        sink: (line) => lines.push(line),
      },
    );
    const labelled =
      'cms_definition_request_total{operation="CMS-03A-01",outcome="success"}';
    expect(
      logger.info({
        ...validDetails,
        metrics: { [labelled]: 1, duration_ms: 3 },
      }),
    ).toBe('written');
    expect(JSON.parse(lines[0] ?? '').metrics[labelled]).toBe(1);
    for (const key of [
      'name{operation="a b"}',
      'name{operation="a"b"}',
      'name{Operation="a"}',
      'name{operation=a}',
      'name{operation="a",}',
      'name{operation=""}',
      'name{operation="a"}\n',
      'name{operation="a{}"}',
      'name{}',
      'name{operation="a"}{x="y"}',
      '{operation="a"}',
      `name{${Array.from({ length: 9 }, (_, i) => `l${i}="v"`).join(',')}}`,
    ])
      expect(
        logger.info({ ...validDetails, metrics: { [key]: 1 } }),
        JSON.stringify(key),
      ).toBe('rejected');
  });
});
