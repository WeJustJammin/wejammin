import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { evaluateAndEmitContentSchemaRegistryAlerts } from '../../infra/observability/content-schema-registry-alert-boundary';
import {
  CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS,
  type ContentSchemaRegistryOperationalSnapshot,
} from '../../infra/observability/content-schema-registry-alert-policy';

const ROOT = resolve(import.meta.dirname, '../..');
const read = (path: string): string =>
  readFileSync(resolve(ROOT, path), 'utf8');

const registryTelemetry = read(
  'apps/worker/src/content-schema-registry/production-telemetry.ts',
);
const migrationTelemetry = read(
  'apps/worker/src/production-worker-runtime-cms.ts',
);
const workerConfig = read('apps/worker/wrangler.jsonc');
const boundaryReadme = read('infra/observability/README.md');
const productionBoundary = read(
  'apps/worker/src/content-schema-registry/operational-alert-production.ts',
);

describe('[P2-S09-AC-209] production alert boundary evidence', () => {
  it('consumes the policy at a provider-free sink boundary without hidden side effects', () => {
    const emitted: string[] = [];
    const snapshot: ContentSchemaRegistryOperationalSnapshot = {
      commandP95Ms: CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS.commandP95Ms,
    };
    const alerts = evaluateAndEmitContentSchemaRegistryAlerts(
      snapshot,
      (alert) => {
        emitted.push(`${alert.code}:${alert.observed}:${alert.threshold}`);
      },
    );

    expect(alerts).toHaveLength(1);
    expect(emitted).toEqual(['command_p95_exceeded:1200:1200']);
    expect(alerts[0]).toMatchObject({
      route: 'platform.on_call',
      runbook: 'content-schema-registry',
    });
  });

  it('proves emitted aggregate measurements reach the native observability boundary', () => {
    expect(registryTelemetry).toContain("eventName: 'cms.registry.request'");
    expect(registryTelemetry).toContain('slo_command_p95_ms');
    expect(registryTelemetry).toContain('slo_protected_rpc_p95_ms');
    expect(registryTelemetry).toContain('slo_acceptance_p99_ms');
    expect(registryTelemetry).toContain('alert_class');
    expect(registryTelemetry).toContain('alert_route');
    expect(registryTelemetry).toContain('runbook');

    expect(migrationTelemetry).toContain("eventName: 'cms.registry.migration'");
    expect(migrationTelemetry).toContain("'cms.migration.retries.total'");
    expect(migrationTelemetry).toContain("'cms.migration.dlq.total'");
    expect(migrationTelemetry).toContain("'retry.alert.after': 3");
    expect(migrationTelemetry).toContain("'dead-letter.alert.threshold': 0");

    expect(workerConfig).toContain('"observability"');
    expect(workerConfig).toContain('"enabled": true');
    expect(workerConfig).toContain('"dead_letter_queue"');
    expect(workerConfig).toContain('"max_retries": 3');
  });

  it('records the configured provider boundary without claiming deployment evidence', () => {
    expect(boundaryReadme).toMatch(/side-effect-free[\s\S]*policy adapter/iu);
    expect(boundaryReadme).toMatch(/Cloudflare Workers Logs/iu);
    expect(boundaryReadme).toMatch(
      /Queue metrics, Cron Triggers, Email Service/iu,
    );
    expect(boundaryReadme).toMatch(/before AC209 closes/iu);
    expect(productionBoundary).toContain('CLOUDFLARE_OBSERVABILITY_API_TOKEN');
    expect(productionBoundary).toContain('cms_claim_operational_alert');
    expect(productionBoundary).toContain('PLATFORM_ALERT_EMAIL.send');
  });
});
