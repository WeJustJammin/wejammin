import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertAc265HostedE2eArtifactBinding,
  resolveAc265HostedE2eArtifactIds,
  validateAc265HostedE2eDownloadedArtifactIds,
} from '../infra/workflows/ac265-hosted-e2e-artifact-binding.ts';
import { runAc265HostedE2eArtifactResolution } from '../infra/workflows/resolve-ac265-hosted-e2e-artifacts.ts';
import {
  API_ORIGIN,
  CI_ARTIFACT_ID,
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
  createCandidateFixture,
  createInputs,
  createMockGitHubApi,
} from './ac265-candidate-provenance.test-support.ts';

type CandidateFixture = ReturnType<typeof createCandidateFixture>;

const entrypointPath = fileURLToPath(
  new URL(
    '../infra/workflows/resolve-ac265-hosted-e2e-artifacts.ts',
    import.meta.url,
  ),
);

let fixture: CandidateFixture;
let runnerTemp: string;
let outputIndex = 0;

const environmentFor = (): Record<string, string | undefined> => {
  const outputPath = join(runnerTemp, `artifact-ids-output-${outputIndex++}`);
  writeFileSync(outputPath, '');
  return {
    GITHUB_REPOSITORY: REPOSITORY,
    GITHUB_TOKEN: TOKEN,
    AC265_SOURCE_SHA: SOURCE_SHA,
    AC265_STAGING_RUN_ID: STAGING_RUN_ID,
    AC265_STAGING_RUN_ATTEMPT: STAGING_RUN_ATTEMPT,
    AC265_CI_RUN_ID: CI_RUN_ID,
    AC265_CI_RUN_ATTEMPT: CI_RUN_ATTEMPT,
    AC265_STAGING_DEPLOYMENT_ID: DEPLOYMENT_ID,
    STAGING_WEB_ORIGIN: WEB_ORIGIN,
    STAGING_API_ORIGIN: API_ORIGIN,
    GITHUB_OUTPUT: outputPath,
  };
};

beforeEach(() => {
  fixture = createCandidateFixture();
  runnerTemp = mkdtempSync(join(tmpdir(), 'ac265-artifact-binding-'));
  outputIndex = 0;
});

afterEach(() => {
  fixture.close();
  rmSync(runnerTemp, { recursive: true, force: true });
});

describe('AC265 hosted E2E exact artifact-ID binding', () => {
  it('resolves the exact verified artifact IDs through the API alone', async () => {
    const api = createMockGitHubApi();

    const resolution = await resolveAc265HostedE2eArtifactIds(
      createInputs(fixture, {
        workspaceRoot: '/workspace-tree-never-read-by-the-resolver',
      }),
      api.fetchImpl,
    );

    expect(resolution).toEqual({
      ciArtifactId: CI_ARTIFACT_ID,
      stagingArtifactId: STAGING_ARTIFACT_ID,
      ciRunId: CI_RUN_ID,
      stagingRunId: STAGING_RUN_ID,
    });
    expect(api.requests.length).toBeGreaterThan(0);
    expect(
      api.requests.every(
        ({ init }) =>
          new Headers(init.headers).get('authorization') === `Bearer ${TOKEN}`,
      ),
    ).toBe(true);
  });

  it('fails closed on an ambiguous or unverifiable artifact identity', async () => {
    const baseline = createMockGitHubApi();
    const ciArtifact = baseline.values.ciArtifacts[0]!;
    const stagingArtifact = baseline.values.stagingArtifacts[0]!;

    for (const api of [
      createMockGitHubApi({
        ciArtifacts: [ciArtifact, { ...ciArtifact, id: 3999 }],
      }),
      createMockGitHubApi({
        stagingArtifacts: [stagingArtifact, { ...stagingArtifact, id: 3998 }],
      }),
      createMockGitHubApi({ ciArtifacts: [] }),
      createMockGitHubApi({
        stagingArtifacts: [{ ...stagingArtifact, expired: true }],
      }),
    ]) {
      await expect(
        resolveAc265HostedE2eArtifactIds(createInputs(fixture), api.fetchImpl),
      ).rejects.toThrow();
    }
  });

  it('binds the downloaded artifact IDs to the later verified IDs and rejects any mismatch', () => {
    const downloaded = {
      ciArtifactId: CI_ARTIFACT_ID,
      stagingArtifactId: STAGING_ARTIFACT_ID,
    };

    expect(() =>
      assertAc265HostedE2eArtifactBinding(downloaded, downloaded),
    ).not.toThrow();
    for (const verified of [
      { ...downloaded, ciArtifactId: CI_ARTIFACT_ID + 1 },
      { ...downloaded, stagingArtifactId: STAGING_ARTIFACT_ID + 1 },
      { ciArtifactId: STAGING_ARTIFACT_ID, stagingArtifactId: CI_ARTIFACT_ID },
    ])
      expect(() =>
        assertAc265HostedE2eArtifactBinding(downloaded, verified),
      ).toThrow();
  });

  it('requires canonical numeric downloaded artifact IDs from the workflow environment', () => {
    const valid = {
      AC265_DOWNLOADED_CI_ARTIFACT_ID: String(CI_ARTIFACT_ID),
      AC265_DOWNLOADED_STAGING_ARTIFACT_ID: String(STAGING_ARTIFACT_ID),
    };

    expect(validateAc265HostedE2eDownloadedArtifactIds(valid)).toEqual({
      ciArtifactId: CI_ARTIFACT_ID,
      stagingArtifactId: STAGING_ARTIFACT_ID,
    });
    for (const [key, value] of [
      ['AC265_DOWNLOADED_CI_ARTIFACT_ID', undefined],
      ['AC265_DOWNLOADED_CI_ARTIFACT_ID', ''],
      ['AC265_DOWNLOADED_CI_ARTIFACT_ID', ` ${CI_ARTIFACT_ID}`],
      ['AC265_DOWNLOADED_CI_ARTIFACT_ID', `${CI_ARTIFACT_ID}x`],
      ['AC265_DOWNLOADED_CI_ARTIFACT_ID', '0'],
      ['AC265_DOWNLOADED_STAGING_ARTIFACT_ID', '-1'],
      ['AC265_DOWNLOADED_STAGING_ARTIFACT_ID', '1e3'],
      ['AC265_DOWNLOADED_STAGING_ARTIFACT_ID', '99999999999999999999'],
      ['AC265_DOWNLOADED_STAGING_ARTIFACT_ID', undefined],
    ] as const)
      expect(() =>
        validateAc265HostedE2eDownloadedArtifactIds({
          ...valid,
          [key]: value,
        }),
      ).toThrow();
  });

  it('writes both resolved IDs to the workflow output without disclosing the token or digest', async () => {
    const api = createMockGitHubApi();
    const messages: string[] = [];
    const env = environmentFor();

    const resolution = await runAc265HostedE2eArtifactResolution({
      env,
      cwd: fixture.workspaceRoot,
      fetchImpl: api.fetchImpl,
      logger: { log: (message: string) => messages.push(message) },
    });

    expect(resolution).toEqual({
      ciArtifactId: CI_ARTIFACT_ID,
      stagingArtifactId: STAGING_ARTIFACT_ID,
    });
    expect(readFileSync(env.GITHUB_OUTPUT!, 'utf8')).toBe(
      `ci_artifact_id=${CI_ARTIFACT_ID}\nstaging_artifact_id=${STAGING_ARTIFACT_ID}\n`,
    );
    expect(messages).toHaveLength(1);
    const output = messages.join('\n');
    expect(JSON.parse(messages[0]!)).toEqual({
      event: 'ac265_hosted_e2e_artifact_ids_resolved',
      sourceRevision: SOURCE_SHA,
      ciRunId: CI_RUN_ID,
      stagingRunId: STAGING_RUN_ID,
    });
    expect(output).not.toContain(TOKEN);
    expect(output).not.toMatch(/sha256:/u);
  });

  it('rejects a GITHUB_OUTPUT that is not a canonical existing regular file before GitHub access', async () => {
    const canonical = join(runnerTemp, 'canonical-output');
    writeFileSync(canonical, '');
    const linked = join(runnerTemp, 'linked-output');
    symlinkSync(canonical, linked);
    const directory = join(runnerTemp, 'output-directory');
    mkdirSync(directory);

    for (const outputPath of [
      'relative-output',
      `${runnerTemp}/./canonical-output`,
      `${runnerTemp}/../${basename(runnerTemp)}/canonical-output`,
      join(runnerTemp, 'missing-output'),
      linked,
      directory,
      `${runnerTemp}/bad\noutput`,
    ]) {
      const fetchImpl = vi.fn<typeof fetch>();
      const messages: string[] = [];

      await expect(
        runAc265HostedE2eArtifactResolution({
          env: { ...environmentFor(), GITHUB_OUTPUT: outputPath },
          cwd: fixture.workspaceRoot,
          fetchImpl,
          logger: { log: (message: string) => messages.push(message) },
        }),
      ).rejects.toThrow('AC265 hosted E2E artifact resolution failed');

      expect(fetchImpl, outputPath).not.toHaveBeenCalled();
      expect(messages, outputPath).toHaveLength(0);
    }
    expect(readFileSync(canonical, 'utf8')).toBe('');
  });

  it('sets a nonzero exit code and emits only a generic message when run directly with invalid inputs', () => {
    const sentinel = 'do-not-print-this-token';
    const result = spawnSync(
      process.execPath,
      ['--experimental-strip-types', entrypointPath],
      {
        cwd: fixture.workspaceRoot,
        env: {
          PATH: process.env.PATH ?? '/usr/bin:/bin',
          GITHUB_TOKEN: sentinel,
        },
        encoding: 'utf8',
      },
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(output).toContain('AC265 hosted E2E artifact resolution failed');
    expect(output).not.toContain(sentinel);
    expect(output).not.toContain('Error:');
  });
});
