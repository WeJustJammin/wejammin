import { createHash } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { verifyAc265CandidateProvenance } from '../infra/workflows/ac265-candidate-provenance.ts';
import {
  API_ORIGIN,
  CI_RUN_ATTEMPT,
  CI_RUN_ID,
  DEPLOYMENT_ID,
  REPOSITORY,
  SOURCE_SHA,
  STAGING_ARTIFACT_ID,
  STAGING_RUN_ATTEMPT,
  STAGING_RUN_ID,
  TOKEN,
  WEB_ORIGIN,
  candidateFileText,
  createCandidateFixture,
  createInputs,
  createMockGitHubApi,
  type MockApiOverrides,
} from './ac265-candidate-provenance.test-support.ts';

type CandidateFixture = ReturnType<typeof createCandidateFixture>;
type JsonRecord = Record<string, unknown>;

let fixture: CandidateFixture;

const asRecord = (value: unknown): JsonRecord => value as JsonRecord;

const verify = (
  overrides: MockApiOverrides = {},
  inputPatch: Record<string, unknown> = {},
) => {
  const api = createMockGitHubApi(overrides);
  return {
    api,
    result: verifyAc265CandidateProvenance(
      createInputs(fixture, inputPatch),
      api.fetchImpl,
    ),
  };
};

beforeEach(() => {
  fixture = createCandidateFixture();
});

afterEach(() => {
  fixture.close();
});

describe('AC265 read-only staging candidate provenance verifier', () => {
  it('binds successful CI and staging attempts, artifacts, deployment, and candidate digests', async () => {
    const { api, result } = verify();
    const provenance = await result;

    expect(provenance).toMatchObject({
      status: 'candidate_provenance_verified',
      repository: REPOSITORY,
      sourceRevision: SOURCE_SHA,
      ci: {
        runId: CI_RUN_ID,
        runAttempt: CI_RUN_ATTEMPT,
        workflowPath: '.github/workflows/ci.yml',
        artifactName: `workspace-build-${SOURCE_SHA}`,
        artifactId: 3001,
        artifactDigest: `sha256:${'b'.repeat(64)}`,
      },
      staging: {
        runId: STAGING_RUN_ID,
        runAttempt: STAGING_RUN_ATTEMPT,
        workflowPath: '.github/workflows/deploy-staging.yml',
        artifactName: 'staging-verified-candidate',
        artifactId: STAGING_ARTIFACT_ID,
        artifactDigest: `sha256:${'c'.repeat(64)}`,
        deploymentId: DEPLOYMENT_ID,
        environment: 'staging',
        webOrigin: WEB_ORIGIN,
        apiOrigin: API_ORIGIN,
        artifactBytes: 128,
      },
      artifact: {
        artifactDigest: fixture.identity.artifactDigest,
        axeReportSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        buildId: `ci-${CI_RUN_ID}`,
        migrationVersion: fixture.identity.migrationVersion,
      },
    });
    expect(provenance).not.toHaveProperty('acceptance');
    expect(provenance).not.toHaveProperty('report');
    expect(JSON.stringify(provenance)).not.toContain(TOKEN);
    expect(api.requests.length).toBeGreaterThanOrEqual(8);
    for (const { url, init } of api.requests) {
      expect(url.origin).toBe('https://api.github.com');
      expect(init.method).toBe('GET');
      expect(init.redirect).toBe('error');
      expect(new Headers(init.headers).get('authorization')).toBe(
        `Bearer ${TOKEN}`,
      );
    }
    expect(
      api.requests.some(({ url }) => url.pathname.endsWith('/deployments')),
    ).toBe(true);
  });

  it('allows only bounded GitHub created/start timestamp skew', async () => {
    const base = createMockGitHubApi();
    const ciRun = asRecord(base.values.ciRun);

    await expect(
      verify({
        ciRun: {
          ...ciRun,
          created_at: '2026-09-08T12:01:05.000Z',
        },
      }).result,
    ).resolves.toMatchObject({ status: 'candidate_provenance_verified' });

    await expect(
      verify({
        ciRun: {
          ...ciRun,
          created_at: '2026-09-08T12:01:06.000Z',
        },
      }).result,
    ).rejects.toThrow();
  });

  it('rejects malformed dispatch fields before making any GitHub request', async () => {
    for (const patch of [
      { repository: 'https://github.com/WeJustJammin/wejammin' },
      { token: 'token with spaces' },
      { ciRunId: '0' },
      { ciRunId: '1/attempts/2' },
      { ciRunAttempt: '0' },
      { ciRunAttempt: '1.5' },
      { stagingRunId: '999999999999999999999999' },
      { stagingRunAttempt: '01' },
      { sourceSha: SOURCE_SHA.toUpperCase() },
      { stagingDeploymentId: '1?environment=production' },
      { stagingWebOrigin: 'http://staging.wejamm.in' },
      { stagingWebOrigin: 'https://staging.wejamm.in/private' },
      { stagingApiOrigin: 'https://user:pass@staging-api.wejamm.in' },
      { workspaceRoot: '../workspace' },
      { unexpectedField: 'not part of the dispatch contract' },
    ]) {
      const api = createMockGitHubApi();
      await expect(
        verifyAc265CandidateProvenance(
          createInputs(fixture, patch),
          api.fetchImpl,
        ),
      ).rejects.toThrow();
      expect(api.requests).toHaveLength(0);
    }

    const input = createInputs(fixture);
    let getterInvoked = false;
    Object.defineProperty(input, 'token', {
      configurable: true,
      enumerable: true,
      get: () => {
        getterInvoked = true;
        return TOKEN;
      },
    });
    const api = createMockGitHubApi();
    await expect(
      verifyAc265CandidateProvenance(input, api.fetchImpl),
    ).rejects.toThrow();
    expect(getterInvoked).toBe(false);
    expect(api.requests).toHaveLength(0);
  });

  it('rejects dispatch run IDs or attempts that do not match exact API attempts', async () => {
    for (const [key, value] of [
      ['ciRunId', '7001999'],
      ['ciRunAttempt', '1'],
      ['stagingRunId', '7001998'],
      ['stagingRunAttempt', '2'],
    ] as const) {
      await expect(verify({}, { [key]: value }).result).rejects.toThrow();
    }
  });

  it('rejects incorrect workflow identities and unsuccessful or mismatched run attempts', async () => {
    const base = createMockGitHubApi();
    const ciRun = asRecord(base.values.ciRun);
    const stagingRun = asRecord(base.values.stagingRun);
    const ciWorkflow = asRecord(base.values.ciWorkflow);
    const stagingWorkflow = asRecord(base.values.stagingWorkflow);
    const invalid: MockApiOverrides[] = [
      { ciWorkflow: { ...ciWorkflow, name: 'Lookalike CI' } },
      {
        stagingWorkflow: {
          ...stagingWorkflow,
          path: '.github/workflows/lookalike.yml',
        },
      },
      { ciRun: { ...ciRun, workflow_id: 9999 } },
      { ciRun: { ...ciRun, path: '.github/workflows/other.yml@main' } },
      { ciRun: { ...ciRun, event: 'pull_request' } },
      { ciRun: { ...ciRun, status: 'in_progress' } },
      { ciRun: { ...ciRun, conclusion: 'failure' } },
      { ciRun: { ...ciRun, head_branch: 'feature' } },
      { ciRun: { ...ciRun, head_sha: 'e'.repeat(40) } },
      { ciRun: { ...ciRun, run_attempt: 1 } },
      {
        stagingRun: {
          ...stagingRun,
          path: '.github/workflows/other.yml@main',
        },
      },
      { stagingRun: { ...stagingRun, event: 'workflow_dispatch' } },
      { stagingRun: { ...stagingRun, status: 'in_progress' } },
      { stagingRun: { ...stagingRun, conclusion: 'cancelled' } },
      { stagingRun: { ...stagingRun, head_branch: 'release' } },
      { stagingRun: { ...stagingRun, head_sha: 'f'.repeat(40) } },
      { stagingRun: { ...stagingRun, run_attempt: 1 } },
      {
        stagingRun: {
          ...stagingRun,
          repository: { id: 99, full_name: 'attacker/repo' },
        },
      },
      {
        stagingRun: {
          ...stagingRun,
          head_repository: { id: 99, full_name: 'fork/nevrite-music' },
        },
      },
      {
        stagingRun: {
          ...stagingRun,
          run_started_at: '2026-09-08T12:31:00.000Z',
        },
      },
    ];

    for (const overrides of invalid) {
      await expect(verify(overrides).result).rejects.toThrow();
    }
  });

  it('requires unique, live artifacts with exact GitHub run origins and valid archive digests', async () => {
    const base = createMockGitHubApi();
    const ciArtifact = asRecord(base.values.ciArtifacts[0]);
    const stagingArtifact = asRecord(base.values.stagingArtifacts[0]);
    const invalid: MockApiOverrides[] = [
      { ciArtifacts: [{ ...ciArtifact, expired: true }] },
      { ciArtifacts: [{ ...ciArtifact, digest: 'sha512:abc' }] },
      {
        ciArtifacts: [
          {
            ...ciArtifact,
            workflow_run: { ...asRecord(ciArtifact.workflow_run), id: 99 },
          },
        ],
      },
      {
        ciArtifacts: [
          {
            ...ciArtifact,
            workflow_run: {
              ...asRecord(ciArtifact.workflow_run),
              head_sha: 'e'.repeat(40),
            },
          },
        ],
      },
      { ciArtifacts: [ciArtifact, { ...ciArtifact, id: 3999 }] },
      { stagingArtifacts: [{ ...stagingArtifact, name: 'staging-candidate' }] },
      { stagingArtifacts: [{ ...stagingArtifact, digest: 'sha256:bad' }] },
      {
        stagingArtifacts: [
          {
            ...stagingArtifact,
            workflow_run: {
              ...asRecord(stagingArtifact.workflow_run),
              repository_id: 999,
            },
          },
        ],
      },
      {
        stagingArtifacts: [
          {
            ...stagingArtifact,
            workflow_run: {
              ...asRecord(stagingArtifact.workflow_run),
              head_branch: 'feature',
            },
          },
        ],
      },
      {
        stagingArtifacts: [
          { ...stagingArtifact, created_at: '2026-09-08T13:04:59.000Z' },
        ],
      },
      { stagingArtifacts: [stagingArtifact, { ...stagingArtifact, id: 3998 }] },
    ];

    for (const overrides of invalid) {
      await expect(verify(overrides).result).rejects.toThrow();
    }
  });

  it('binds the staging deployment ID, successful environment status, and candidate web/API origins', async () => {
    const base = createMockGitHubApi();
    const deployment = asRecord(base.values.deployments[0]);
    const status = asRecord(base.values.deploymentStatuses[0]);
    const invalid: MockApiOverrides[] = [
      { deployments: [{ ...deployment, environment: 'production' }] },
      { deployments: [{ ...deployment, sha: 'e'.repeat(40) }] },
      { deployments: [{ ...deployment, ref: 'feature' }] },
      { deployments: [{ ...deployment, task: 'deploy:production' }] },
      {
        deployments: [
          { ...deployment, created_at: '2026-09-08T13:31:00.000Z' },
        ],
      },
      { deploymentStatuses: [{ ...status, state: 'failure' }] },
      { deploymentStatuses: [{ ...status, environment: 'production' }] },
      {
        deploymentStatuses: [
          { ...status, environment_url: 'https://other.example.com' },
        ],
      },
      {
        deploymentStatuses: [
          {
            ...status,
            log_url: 'https://github.com/other/repo/actions/runs/7001002/job/1',
          },
        ],
      },
      {
        deploymentStatuses: [
          {
            ...status,
            target_url:
              'https://github.com/other/repo/actions/runs/7001002/job/1',
          },
        ],
      },
    ];
    for (const overrides of invalid) {
      await expect(verify(overrides).result).rejects.toThrow();
    }

    fixture.writeCandidateJson('api-p95-smoke.json', {
      ...JSON.parse(candidateFileText(fixture, 'api-p95-smoke.json')),
      origin: 'https://other-api.example.com',
    });
    await expect(verify().result).rejects.toThrow();

    fixture = createCandidateFixture();
    fixture.writeCandidateJson('accessibility/axe.json', {
      ...fixture.accessibilityReport,
      deploymentId: '7001009',
    });
    await expect(verify().result).rejects.toThrow();
  });

  it('rejects duplicate JSON members, candidate-side identity drift, file tampering, and symlinks', async () => {
    const metadata = candidateFileText(fixture, 'promotion-metadata.json');
    fixture.writeCandidateBytes(
      'promotion-metadata.json',
      metadata.replace(
        '"environment":"production"',
        '"environment":"production","environment":"production"',
      ),
    );
    await expect(verify().result).rejects.toThrow();

    fixture.close();
    fixture = createCandidateFixture();
    fixture.writeCandidateJson('staging-run-identity.json', {
      schemaVersion: 'ac266-staging-run-identity-v1',
      repository: REPOSITORY,
      workflowPath: '.github/workflows/deploy-staging.yml',
      runId: STAGING_RUN_ID,
      runAttempt: '2',
      headSha: SOURCE_SHA,
    });
    await expect(verify().result).rejects.toThrow();

    fixture.close();
    fixture = createCandidateFixture();
    fixture.writeCandidateBytes(
      'artifacts/apps/worker/dist/index.js',
      'tampered worker\n',
    );
    await expect(verify().result).rejects.toThrow();

    fixture.close();
    fixture = createCandidateFixture();
    fixture.symlinkCandidatePath(
      'promotion-metadata.json',
      'staging-artifact-identity.json',
    );
    await expect(verify().result).rejects.toThrow();
  });

  it('binds the staging archive byte length from the authenticated artifact payload only', async () => {
    const { result } = verify();
    const provenance = await result;

    // The value is the authenticated GitHub artifact length, reported as a
    // bounded positive integer. It is a length, never a digest claim.
    expect(provenance.staging.artifactBytes).toBe(128);
    expect(Number.isSafeInteger(provenance.staging.artifactBytes)).toBe(true);
    expect(typeof provenance.staging.artifactBytes).toBe('number');
  });

  it('preserves the accepted archive length bound of one gibibyte', async () => {
    const base = createMockGitHubApi();
    const stagingArtifact = asRecord(base.values.stagingArtifacts[0]);
    const boundary = 1024 * 1024 * 1024;

    await expect(
      verify({
        stagingArtifacts: [{ ...stagingArtifact, size_in_bytes: boundary }],
      }).result,
    ).resolves.toMatchObject({ staging: { artifactBytes: boundary } });
  });

  it('rejects missing, non-integer, non-positive, oversized, or non-number archive lengths', async () => {
    const base = createMockGitHubApi();
    const stagingArtifact = asRecord(base.values.stagingArtifacts[0]);
    const invalid = [
      undefined,
      null,
      '128',
      128.5,
      0,
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      1024 * 1024 * 1024 + 1,
    ];

    for (const size of invalid) {
      await expect(
        verify({
          stagingArtifacts: [{ ...stagingArtifact, size_in_bytes: size }],
        }).result,
      ).rejects.toThrow();
    }
  });

  it('binds the axe report digest to the validated candidate axe bytes, distinct from archive digests', async () => {
    const expectedDigest = createHash('sha256')
      .update(candidateFileText(fixture, 'accessibility/axe.json'), 'utf8')
      .digest('hex');
    const provenance = await verify().result;

    expect(provenance.artifact.axeReportSha256).toBe(expectedDigest);
    // The axe report digest is the report file's digest; it is not the CI
    // (ZIP) artifact digest and not the staging artifact digest.
    expect(provenance.artifact.axeReportSha256).not.toBe(
      provenance.artifact.artifactDigest,
    );
    expect(provenance.artifact.axeReportSha256).not.toBe(
      provenance.staging.artifactDigest.slice('sha256:'.length),
    );
  });

  it('re-derives the axe digest from re-validated bytes and rejects axe tampering without a matching sidecar', async () => {
    const tampered = {
      ...fixture.accessibilityReport,
      browser: {
        ...fixture.accessibilityReport.browser,
        version: '124.0.0.0',
      },
    };
    const tamperedBytes = Buffer.from(`${JSON.stringify(tampered)}\n`);
    fixture.writeCandidateBytes('accessibility/axe.json', tamperedBytes);

    // The unchanged sidecar still pins the original digest: fail closed.
    await expect(verify().result).rejects.toThrow();

    fixture.close();
    fixture = createCandidateFixture();
    const replacement = {
      ...fixture.accessibilityReport,
      browser: {
        ...fixture.accessibilityReport.browser,
        version: '124.0.0.0',
      },
    };
    const replacementBytes = Buffer.from(`${JSON.stringify(replacement)}\n`);
    const replacementDigest = createHash('sha256')
      .update(replacementBytes)
      .digest('hex');
    fixture.writeCandidateBytes('accessibility/axe.json', replacementBytes);
    fixture.writeCandidateBytes(
      'accessibility/axe.sha256',
      `${replacementDigest}  accessibility/axe.json\n`,
    );

    const provenance = await verify().result;
    expect(provenance.artifact.axeReportSha256).toBe(replacementDigest);
  });

  it('returns a deeply frozen branded result so post-verification mutation cannot drift bindings', async () => {
    const provenance = await verify().result;

    expect(Object.isFrozen(provenance)).toBe(true);
    expect(Object.isFrozen(provenance.staging)).toBe(true);
    expect(Object.isFrozen(provenance.artifact)).toBe(true);
    expect(Object.isFrozen(provenance.migration)).toBe(true);
    expect(Object.isFrozen(provenance.provider)).toBe(true);
    expect(Object.isFrozen(provenance.provider.workers)).toBe(true);
    expect(Object.isFrozen(provenance.provider.workers[0])).toBe(true);

    const archiveLength = provenance.staging.artifactBytes;
    const axeDigest = provenance.artifact.axeReportSha256;
    expect(() => {
      (provenance.staging as { artifactBytes: number }).artifactBytes = 1;
    }).toThrow(TypeError);
    expect(() => {
      (provenance.artifact as { axeReportSha256: string }).axeReportSha256 =
        'f'.repeat(64);
    }).toThrow(TypeError);
    expect(provenance.staging.artifactBytes).toBe(archiveLength);
    expect(provenance.artifact.axeReportSha256).toBe(axeDigest);
  });
});
