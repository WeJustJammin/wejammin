import { describe, expect, it } from 'vitest';

import { resolveAc265HostedVerificationRunProvenance } from '../../infra/workflows/ac265-hosted-verification-run-provenance.ts';
import {
  DEPLOYMENT_ID,
  REPOSITORY,
  REPOSITORY_ID,
  SOURCE_SHA,
  STAGING_RUN_ATTEMPT,
  STAGING_RUN_ID,
  TOKEN,
  WEB_ORIGIN,
  createMockGitHubApi,
} from '../ac265-candidate-provenance.test-support.ts';

const REPORT_ARTIFACT_NAME = 'ac265-hosted-e2e-report-v3';
const REPORT_ARTIFACT_ID = 987654321;

const reportArtifact = (patch: Record<string, unknown> = {}) => ({
  id: REPORT_ARTIFACT_ID,
  name: REPORT_ARTIFACT_NAME,
  size_in_bytes: 4096,
  url: `https://api.github.com/repos/${REPOSITORY}/actions/artifacts/${REPORT_ARTIFACT_ID}`,
  archive_download_url: `https://api.github.com/repos/${REPOSITORY}/actions/artifacts/${REPORT_ARTIFACT_ID}/zip`,
  expired: false,
  created_at: '2026-09-08T13:25:00.000Z',
  updated_at: '2026-09-08T13:25:00.000Z',
  digest: 'sha256:' + 'd'.repeat(64),
  workflow_run: {
    id: Number(STAGING_RUN_ID),
    repository_id: REPOSITORY_ID,
    head_repository_id: REPOSITORY_ID,
    head_branch: 'main',
    head_sha: SOURCE_SHA,
  },
  ...patch,
});

const input = (patch: Record<string, unknown> = {}) => ({
  repository: REPOSITORY,
  token: TOKEN,
  runId: STAGING_RUN_ID,
  attempt: STAGING_RUN_ATTEMPT,
  stagingWebOrigin: WEB_ORIGIN,
  ...patch,
});

const resolve = (overrides = {}, patch: Record<string, unknown> = {}) =>
  resolveAc265HostedVerificationRunProvenance(
    input(patch),
    createMockGitHubApi({
      stagingArtifacts: [reportArtifact()],
      ...overrides,
    }).fetchImpl,
  );

// Fixture mirroring a real GitHub deployment that records a full state history
// (waiting -> queued -> in_progress -> success) instead of a single synthetic
// success status. GitHub returns deployment statuses newest-first.
const JOB_URL = `https://github.com/${REPOSITORY}/actions/runs/${STAGING_RUN_ID}/job/5001`;
const deploymentStatus = (patch: Record<string, unknown> = {}) => ({
  id: 4100,
  state: 'success',
  environment: 'staging',
  environment_url: WEB_ORIGIN,
  target_url: JOB_URL,
  log_url: JOB_URL,
  creator: { login: 'release-operator' },
  created_at: '2026-09-08T13:09:00.000Z',
  ...patch,
});

describe('AC265 hosted verification run provenance', () => {
  it('derives run, revision, deployment, and report archive identity from GitHub', async () => {
    const provenance = await resolve();
    expect(provenance).toMatchObject({
      repository: REPOSITORY,
      runId: STAGING_RUN_ID,
      runAttempt: STAGING_RUN_ATTEMPT,
      sourceRevision: SOURCE_SHA,
      reportArtifactName: REPORT_ARTIFACT_NAME,
      reportArtifactId: REPORT_ARTIFACT_ID,
      deploymentWebOrigin: WEB_ORIGIN,
    });
    expect(provenance.sourceRevision).not.toBe(input()['sourceRevision']);
  });

  it.each<[string, Record<string, unknown>]>([
    ['a token', { token: '' }],
    ['a run id', { runId: 'not-a-run' }],
    ['a run attempt', { attempt: '0' }],
    ['a run attempt that does not match the completed run', { attempt: '9' }],
    ['the repository', { repository: 'attacker/repo' }],
    ['a non-origin web origin', { stagingWebOrigin: 'https://x.test/path' }],
    ['an http web origin', { stagingWebOrigin: 'http://x.test' }],
  ])('rejects a spoofed or malformed %s', async (_label, patch) => {
    await expect(resolve({}, patch)).rejects.toThrow();
  });

  it('rejects a run whose completed revision does not match the deployment', async () => {
    await expect(
      resolve({
        deployments: [
          {
            id: 3483,
            environment: 'staging',
            production_environment: false,
            transient_environment: false,
            sha: 'e'.repeat(40),
            ref: 'main',
            task: 'deploy',
            creator: { login: 'release-operator' },
            created_at: '2026-09-08T13:08:00.000Z',
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects a deployment that is not bound to the verified run actor', async () => {
    await expect(
      resolve({
        deployments: [
          {
            id: 3483,
            environment: 'staging',
            production_environment: false,
            transient_environment: false,
            sha: SOURCE_SHA,
            ref: 'main',
            task: 'deploy',
            creator: { login: 'someone-else' },
            created_at: '2026-09-08T13:08:00.000Z',
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects a report artifact whose name is not the pinned report artifact', async () => {
    await expect(
      resolve({ stagingArtifacts: [reportArtifact({ name: 'other' })] }),
    ).rejects.toThrow();
  });

  it('rejects a report artifact that belongs to a different run', async () => {
    await expect(
      resolve({
        stagingArtifacts: [
          reportArtifact({
            workflow_run: {
              id: 999999,
              repository_id: REPOSITORY_ID,
              head_repository_id: REPOSITORY_ID,
              head_branch: 'main',
              head_sha: SOURCE_SHA,
            },
          }),
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects a report artifact whose digest is not a sha256 digest', async () => {
    await expect(
      resolve({ stagingArtifacts: [reportArtifact({ digest: 'md5:abc' })] }),
    ).rejects.toThrow();
  });

  it('carries the exact declared archive size through provenance', async () => {
    const provenance = await resolve({
      stagingArtifacts: [reportArtifact({ size_in_bytes: 4096 })],
    });
    expect(provenance.reportArchiveBytes).toBe(4096);
  });

  it('rejects a declared archive size that is not a positive integer', async () => {
    await expect(
      resolve({ stagingArtifacts: [reportArtifact({ size_in_bytes: 0 })] }),
    ).rejects.toThrow();
  });

  it('rejects a report artifact size above the bounded archive ceiling', async () => {
    await expect(
      resolve({
        stagingArtifacts: [
          reportArtifact({ size_in_bytes: 1024 * 1024 * 1024 }),
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects a report artifact whose download URL is not canonical', async () => {
    await expect(
      resolve({
        stagingArtifacts: [
          reportArtifact({
            archive_download_url: 'https://evil.test/report.zip',
          }),
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects an expired report artifact', async () => {
    await expect(
      resolve({ stagingArtifacts: [reportArtifact({ expired: true })] }),
    ).rejects.toThrow();
  });

  it('rejects a stale report artifact created before the verified attempt', async () => {
    await expect(
      resolve({
        stagingArtifacts: [
          reportArtifact({ created_at: '2026-09-08T12:00:00.000Z' }),
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects a report artifact updated after the verified attempt completed', async () => {
    await expect(
      resolve({
        stagingArtifacts: [
          reportArtifact({
            created_at: '2026-09-08T13:25:00.000Z',
            updated_at: '2026-09-08T14:30:00.000Z',
          }),
        ],
      }),
    ).rejects.toThrow();
  });

  it.each([
    ['absent', undefined],
    ['null', null],
  ])(
    'rejects a report artifact with %s updated_at',
    async (_label, updatedAt) => {
      await expect(
        resolve({
          stagingArtifacts: [reportArtifact({ updated_at: updatedAt })],
        }),
      ).rejects.toThrow();
    },
  );

  it('rejects a parseable but noncanonical report artifact timestamp', async () => {
    await expect(
      resolve({
        stagingArtifacts: [
          reportArtifact({
            created_at: 'Tue, 08 Sep 2026 13:25:00 GMT',
            updated_at: '2026-09-08T13:25:00.000Z',
          }),
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects a parseable but noncanonical completed-run timestamp', async () => {
    const baseline = createMockGitHubApi();
    const stagingRun = baseline.values.stagingRun as Record<string, unknown>;
    await expect(
      resolve({
        stagingRun: {
          ...stagingRun,
          updated_at: 'Tue, 08 Sep 2026 13:30:00 GMT',
        },
      }),
    ).rejects.toThrow();
  });

  it('accepts an artifact created inside the verified attempt window', async () => {
    const provenance = await resolve({
      stagingArtifacts: [
        reportArtifact({
          created_at: '2026-09-08T13:06:00.000Z',
          updated_at: '2026-09-08T13:07:00.000Z',
        }),
      ],
    });
    expect(provenance.reportArtifactId).toBe(REPORT_ARTIFACT_ID);
  });

  it('accepts GitHub RFC3339 timestamps without fractional seconds', async () => {
    const provenance = await resolve({
      stagingArtifacts: [
        reportArtifact({
          created_at: '2026-09-08T13:25:00Z',
          updated_at: '2026-09-08T13:25:00Z',
        }),
      ],
    });
    expect(provenance.reportArtifactId).toBe(REPORT_ARTIFACT_ID);
  });

  it('rejects a failed deployment status', async () => {
    await expect(
      resolve({
        deploymentStatuses: [
          {
            id: 4001,
            state: 'failure',
            environment: 'staging',
            environment_url: WEB_ORIGIN,
            target_url: `https://github.com/${REPOSITORY}/actions/runs/${STAGING_RUN_ID}/job/5001`,
            log_url: `https://github.com/${REPOSITORY}/actions/runs/${STAGING_RUN_ID}/job/5001`,
            creator: { login: 'release-operator' },
            created_at: '2026-09-08T13:09:00.000Z',
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects a status whose job URL points at a different run', async () => {
    await expect(
      resolve({
        deploymentStatuses: [
          {
            id: 4001,
            state: 'success',
            environment: 'staging',
            environment_url: WEB_ORIGIN,
            target_url:
              'https://github.com/' +
              REPOSITORY +
              '/actions/runs/999999/job/5001',
            log_url:
              'https://github.com/' +
              REPOSITORY +
              '/actions/runs/999999/job/5001',
            creator: { login: 'release-operator' },
            created_at: '2026-09-08T13:09:00.000Z',
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects a status whose target URL is not a run-scoped job URL', async () => {
    await expect(
      resolve({
        deploymentStatuses: [
          {
            id: 4001,
            state: 'success',
            environment: 'staging',
            environment_url: WEB_ORIGIN,
            target_url: 'https://github.com/' + REPOSITORY + '/actions',
            log_url:
              'https://github.com/' +
              REPOSITORY +
              '/actions/runs/' +
              STAGING_RUN_ID +
              '/job/5001',
            creator: { login: 'release-operator' },
            created_at: '2026-09-08T13:09:00.000Z',
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('accepts a real deployment status history and selects the terminal success', async () => {
    const provenance = await resolve({
      deploymentStatuses: [
        deploymentStatus({ id: 4104 }),
        deploymentStatus({
          id: 4103,
          state: 'in_progress',
          environment_url: '',
          created_at: '2026-09-08T13:08:12.000Z',
        }),
        deploymentStatus({
          id: 4102,
          state: 'queued',
          environment_url: '',
          created_at: '2026-09-08T13:08:11.000Z',
        }),
        deploymentStatus({
          id: 4101,
          state: 'waiting',
          environment_url: '',
          created_at: '2026-09-08T13:08:10.000Z',
        }),
      ],
    });
    expect(provenance.deploymentId).toBe(DEPLOYMENT_ID);
    expect(provenance.deploymentWebOrigin).toBe(WEB_ORIGIN);
  });

  it('rejects a newer terminal failure that supersedes an earlier success', async () => {
    await expect(
      resolve({
        deploymentStatuses: [
          deploymentStatus({
            id: 4105,
            state: 'failure',
            environment_url: '',
            created_at: '2026-09-08T13:10:00.000Z',
          }),
          deploymentStatus({
            id: 4104,
            state: 'success',
            created_at: '2026-09-08T13:09:00.000Z',
          }),
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects a non-terminal status that is newer than the success', async () => {
    await expect(
      resolve({
        deploymentStatuses: [
          deploymentStatus({
            id: 4105,
            state: 'in_progress',
            environment_url: '',
            created_at: '2026-09-08T13:10:00.000Z',
          }),
          deploymentStatus({
            id: 4104,
            state: 'success',
            created_at: '2026-09-08T13:09:00.000Z',
          }),
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects an ambiguous status history with a tied latest timestamp', async () => {
    await expect(
      resolve({
        deploymentStatuses: [
          deploymentStatus({ id: 4105 }),
          deploymentStatus({ id: 4104 }),
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects a status history whose earlier entry has a wrong actor', async () => {
    await expect(
      resolve({
        deploymentStatuses: [
          deploymentStatus({ id: 4104 }),
          deploymentStatus({
            id: 4101,
            state: 'waiting',
            environment_url: '',
            creator: { login: 'someone-else' },
            created_at: '2026-09-08T13:08:10.000Z',
          }),
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects a status history whose earlier entry has a wrong job URL', async () => {
    await expect(
      resolve({
        deploymentStatuses: [
          deploymentStatus({ id: 4104 }),
          deploymentStatus({
            id: 4101,
            state: 'queued',
            environment_url: '',
            target_url:
              'https://github.com/' +
              REPOSITORY +
              '/actions/runs/999999/job/5001',
            created_at: '2026-09-08T13:08:10.000Z',
          }),
        ],
      }),
    ).rejects.toThrow();
  });
});
