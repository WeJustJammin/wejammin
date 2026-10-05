import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  AC209_ALERT_CONDITION_THRESHOLDS,
  AC209_REQUIRED_BINDINGS,
  Ac209ProviderStateSchema,
  collectContentSchemaRegistryAlertConfiguration,
} from '../infra/workflows/collect-content-schema-registry-alert-configuration.ts';
import { CONTENT_SCHEMA_REGISTRY_ALERT_CONDITIONS } from '../packages/contracts/src/content-schema-registry/operational-release-evidence-common.ts';
import { CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS } from '../packages/observability/src/content-schema-registry-alert-thresholds.ts';
import {
  deploymentId,
  input,
  providerState,
  sourceRevision,
  versionId,
} from './ac209-alert-configuration-test-fixtures.ts';

describe('AC209 protected alert configuration collector', () => {
  it('captures exact production identity, provider state, all locked conditions, and thresholds', async () => {
    const testInput = input();
    const result =
      await collectContentSchemaRegistryAlertConfiguration(testInput);

    expect(testInput.readProviderState).toHaveBeenCalledTimes(1);

    expect(result.report).toMatchObject({
      sourceRevision,
      environment: 'production',
      provider: 'approved_scheduled_boundary',
      configurationId: 'ac209-config-20260910',
      configurationReference: 'change:ac209-20260910',
      worker: {
        name: 'wejammin-api',
        deploymentId,
        versionId,
        trafficPercent: 100,
        sourceRevision,
        versionTriggeredBy: 'version_upload',
        versionTag: sourceRevision,
        versionMessage: `sourceRevision=${sourceRevision};githubRunId=34515738514`,
      },
      schedule: { cron: '* * * * *' },
      route: 'platform.on_call',
      runbook: 'content-schema-registry',
    });
    expect(result.report.configuredConditions).toEqual([
      ...CONTENT_SCHEMA_REGISTRY_ALERT_CONDITIONS,
    ]);
    expect(result.report.thresholds).toEqual({
      ...CONTENT_SCHEMA_REGISTRY_ALERT_THRESHOLDS,
    });
    expect(result.report.conditionThresholds).toEqual(
      AC209_ALERT_CONDITION_THRESHOLDS,
    );
    expect(result.report.conditionThresholds).toHaveLength(16);
    expect(
      result.report.conditionThresholds
        .slice(12)
        .map(({ name, rule }) => [name, rule]),
    ).toEqual([
      ['review_open_past_window', 'reviewOpenAgeMs > 604800000'],
      ['decision_denial_spike', 'decisionDenialRate > decisionDenialBaseline'],
      [
        'assignment_denial_spike',
        'assignmentDenialRate > assignmentDenialBaseline',
      ],
      [
        'capability_grant_denial_spike',
        'capabilityGrantDenialRate > capabilityGrantDenialBaseline',
      ],
    ]);
    expect(result.report.bindings).toEqual(AC209_REQUIRED_BINDINGS);
    expect(result.report).not.toHaveProperty('providerPayload');
  });

  it('fails closed when the protected execution identity is not exact main/prod', async () => {
    await expect(
      collectContentSchemaRegistryAlertConfiguration(
        input({
          execution: {
            environment: 'staging',
            ref: 'refs/heads/main',
            checkedOutSha: sourceRevision,
          },
        }),
      ),
    ).rejects.toThrow('protected production execution');
  });

  it('fails closed on deployment, version, schedule, release, or binding drift', async () => {
    await expect(
      collectContentSchemaRegistryAlertConfiguration(
        input({
          readProviderState: vi.fn(async () => ({
            ...providerState(),
            schedules: [{ cron: '*/5 * * * *' }],
          })),
        }),
      ),
    ).rejects.toThrow('schedule');

    await expect(
      collectContentSchemaRegistryAlertConfiguration(
        input({
          readProviderState: vi.fn(async () => ({
            ...providerState(),
            settings: {
              ...providerState().settings,
              appRelease: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            },
          })),
        }),
      ),
    ).rejects.toThrow('APP_RELEASE');

    await expect(
      collectContentSchemaRegistryAlertConfiguration(
        input({
          readProviderState: vi.fn(async () => ({
            ...providerState(),
            settings: {
              ...providerState().settings,
              versionAnnotations: {
                ...providerState().settings.versionAnnotations,
                tag: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              },
            },
          })),
        }),
      ),
    ).rejects.toThrow('workers/tag');

    await expect(
      collectContentSchemaRegistryAlertConfiguration(
        input({
          readProviderState: vi.fn(async () => ({
            ...providerState(),
            settings: {
              ...providerState().settings,
              versionAnnotations: {
                ...providerState().settings.versionAnnotations,
                message: `sourceRevision=${sourceRevision};githubRunId=0`,
              },
            },
          })),
        }),
      ),
    ).rejects.toThrow('workers/message');

    await expect(
      collectContentSchemaRegistryAlertConfiguration(
        input({
          readProviderState: vi.fn(async () => ({
            ...providerState(),
            deployments: [
              {
                ...providerState().deployments[0],
                versions: [{ id: versionId, percentage: 50 }],
              },
            ],
          })),
        }),
      ),
    ).rejects.toThrow(/100%|active deployment/iu);

    await expect(
      collectContentSchemaRegistryAlertConfiguration(
        input({
          readProviderState: vi.fn(async () => ({
            ...providerState(),
            settings: {
              ...providerState().settings,
              queueName: 'platform-jobs-staging',
            },
          })),
        }),
      ),
    ).rejects.toThrow('queue');
  });

  it('derives the active deployment from the requested version in one provider snapshot', async () => {
    const testInput = input();
    const result =
      await collectContentSchemaRegistryAlertConfiguration(testInput);

    expect(result.report.worker.deploymentId).toBe(deploymentId);
    expect(testInput.readProviderState).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the requested version is only in a historical deployment', async () => {
    const historicalVersionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const historicalDeploymentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const readProviderState = vi.fn(async () => ({
      ...providerState(),
      deployments: [
        {
          ...providerState().deployments[0],
          id: historicalDeploymentId,
          versions: [{ id: historicalVersionId, percentage: 100 }],
        },
        {
          ...providerState().deployments[0],
          id: deploymentId,
          versions: [{ id: versionId, percentage: 100 }],
        },
      ],
    }));

    await expect(
      collectContentSchemaRegistryAlertConfiguration(
        input({ readProviderState }),
      ),
    ).rejects.toThrow('requested version is not the current active deployment');
    expect(readProviderState).toHaveBeenCalledTimes(1);
  });

  it('fails closed when no deployment contains the requested version', async () => {
    const readProviderState = vi.fn(async () => ({
      ...providerState(),
      deployments: [],
    }));

    await expect(
      collectContentSchemaRegistryAlertConfiguration(
        input({ readProviderState }),
      ),
    ).rejects.toThrow(
      /provider configuration response is malformed|requested version|active deployment/iu,
    );
    expect(readProviderState).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the requested version maps to multiple deployments', async () => {
    const duplicateDeploymentId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const readProviderState = vi.fn(async () => ({
      ...providerState(),
      deployments: [
        providerState().deployments[0],
        {
          ...providerState().deployments[0],
          id: duplicateDeploymentId,
        },
      ],
    }));

    await expect(
      collectContentSchemaRegistryAlertConfiguration(
        input({ readProviderState }),
      ),
    ).rejects.toThrow('requested version maps to multiple deployments');
    expect(readProviderState).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the active deployment does not route the requested version at 100%', async () => {
    const readProviderState = vi.fn(async () => ({
      ...providerState(),
      deployments: [
        {
          ...providerState().deployments[0],
          versions: [{ id: versionId, percentage: 50 }],
        },
      ],
    }));

    await expect(
      collectContentSchemaRegistryAlertConfiguration(
        input({ readProviderState }),
      ),
    ).rejects.toThrow('active deployment is not the exact 100% version');
    expect(readProviderState).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the active deployment routes more than one version', async () => {
    const secondVersionId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const readProviderState = vi.fn(async () => ({
      ...providerState(),
      deployments: [
        {
          ...providerState().deployments[0],
          versions: [
            { id: versionId, percentage: 50 },
            { id: secondVersionId, percentage: 50 },
          ],
        },
      ],
    }));

    await expect(
      collectContentSchemaRegistryAlertConfiguration(
        input({ readProviderState }),
      ),
    ).rejects.toThrow(
      'active deployment must contain only the requested version',
    );
    expect(readProviderState).toHaveBeenCalledTimes(1);
  });

  it('never emits either token or raw provider payload and can write one redacted artifact', async () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'ac209-collector-'));
    const outputPath = join(workspaceRoot, 'alerts', 'configuration.json');
    const rawProviderPayload = {
      secret_text: 'must-not-be-copied',
      destination_address: 'private@example.invalid',
      nested: { token: 'provider-raw-token' },
    };
    const result = await collectContentSchemaRegistryAlertConfiguration(
      input({
        outputPath,
        workspaceRoot,
        readProviderState: vi.fn(async () => providerState()),
      }),
    );
    const artifact = readFileSync(outputPath, 'utf8');

    expect(result.outputPath).toBe(outputPath);
    expect(artifact).toContain('ac209-config-20260910');
    expect(artifact).not.toContain(
      'observability-token-that-must-never-be-emitted',
    );
    expect(artifact).not.toContain('provider-token-that-must-never-be-emitted');
    expect(artifact).not.toContain(JSON.stringify(rawProviderPayload));
    expect(artifact).not.toContain('private@example.invalid');

    await expect(
      collectContentSchemaRegistryAlertConfiguration(
        input({ outputPath, workspaceRoot }),
      ),
    ).rejects.toThrow();
  });

  it('requires observability permission verification before provider reads', async () => {
    const verifyObservability = vi.fn(async () => {
      throw new Error('permission check failed');
    });
    const readProviderState = vi.fn(async () => providerState());

    await expect(
      collectContentSchemaRegistryAlertConfiguration(
        input({ verifyObservability, readProviderState }),
      ),
    ).rejects.toThrow('permission check failed');
    expect(readProviderState).not.toHaveBeenCalled();
    expect(verifyObservability).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'b1c05c00f04130a0d100adbca6696e6e',
        token: 'observability-token-that-must-never-be-emitted',
      }),
    );
  });

  it('keeps the normalized provider-state input strict', () => {
    expect(
      Ac209ProviderStateSchema.safeParse({
        ...providerState(),
        raw: { response: 'do not accept' },
      }).success,
    ).toBe(false);
  });

  it('defines a protected read-only main workflow with redacted artifact output', () => {
    const workflow = readFileSync(
      join(process.cwd(), '.github/workflows/collect-production-ac209.yml'),
      'utf8',
    );

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('production_version_id:');
    expect(workflow).not.toContain('production_deployment_id:');
    expect(workflow).not.toContain('PRODUCTION_DEPLOYMENT_ID');
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain('name: production');
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('CLOUDFLARE_OBSERVABILITY_API_TOKEN');
    const jobEnvironment = workflow.match(
      /\n {4}env:\n([\s\S]*?)\n {4}steps:/u,
    )?.[1];
    const collectorEnvironment = workflow.match(
      /- name: Collect redacted AC209 configuration\n {8}env:\n([\s\S]*?)\n {8}run:/u,
    )?.[1];
    expect(jobEnvironment).not.toContain('CLOUDFLARE_API_TOKEN');
    expect(jobEnvironment).not.toContain('CLOUDFLARE_OBSERVABILITY_API_TOKEN');
    expect(collectorEnvironment).toContain(
      'CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}',
    );
    expect(collectorEnvironment).toContain(
      'CLOUDFLARE_OBSERVABILITY_API_TOKEN: ${{ secrets.CLOUDFLARE_OBSERVABILITY_API_TOKEN }}',
    );
    expect(workflow).toContain('EXPECTED_SUPABASE_URL');
    expect(workflow).toContain('EXPECTED_ALERT_EMAIL_SHA256');
    expect(workflow).toContain('git rev-parse HEAD');
    expect(workflow).toContain(
      'infra/workflows/collect-content-schema-registry-alert-configuration.ts',
    );
    expect(workflow).toContain('ac209-reports/alerts/configuration.json');
    expect(workflow).not.toMatch(/echo\s+.*(?:TOKEN|secret)/iu);
    expect(workflow).not.toMatch(/cat\s+.*(?:TOKEN|secret)/iu);
    expect(workflow).not.toContain('wrangler deploy');
  });
});
