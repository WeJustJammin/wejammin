import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runAc265HostedE2ePreflight } from '../infra/workflows/collect-ac265-hosted-e2e-preflight.ts';
import { AC265_STAGING_HOSTING_PROJECT_ID } from '../packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-candidate-enrollment.ts';
import { AC265_STAGING_API_ORIGIN } from '../packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-control-plane.ts';
import {
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
  createMockGitHubApi,
} from './ac265-candidate-provenance.test-support.ts';

type CandidateFixture = ReturnType<typeof createCandidateFixture>;
type TestEnvironment = Record<string, string | undefined>;

const SUPABASE_PROJECT_REF = 'abcdef1234567890abcd';
const SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;

const requiredEnvironmentKeys = [
  'GITHUB_REPOSITORY',
  'GITHUB_TOKEN',
  'AC265_SOURCE_SHA',
  'AC265_STAGING_RUN_ID',
  'AC265_STAGING_RUN_ATTEMPT',
  'AC265_CI_RUN_ID',
  'AC265_CI_RUN_ATTEMPT',
  'AC265_STAGING_DEPLOYMENT_ID',
  'AC265_DOWNLOADED_CI_ARTIFACT_ID',
  'AC265_DOWNLOADED_STAGING_ARTIFACT_ID',
  'STAGING_WEB_ORIGIN',
  'STAGING_API_ORIGIN',
  'CLOUDFLARE_ACCOUNT_ID',
  'SUPABASE_PROJECT_REF',
  'SUPABASE_URL',
  'RUNNER_TEMP',
  'GITHUB_OUTPUT',
] as const;

const entrypointPath = fileURLToPath(
  new URL(
    '../infra/workflows/collect-ac265-hosted-e2e-preflight.ts',
    import.meta.url,
  ),
);

const artifactTreeDigest = (root: string): string => {
  const entries: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const relativePath = path.slice(root.length);
      if (entry.isDirectory()) {
        entries.push(`${relativePath}:directory`);
        visit(path);
      } else if (entry.isFile()) {
        entries.push(
          `${relativePath}:${createHash('sha256').update(readFileSync(path)).digest('hex')}`,
        );
      } else entries.push(`${relativePath}:non-file`);
    }
  };
  visit(root);
  return entries.sort().join('\n');
};

let fixture: CandidateFixture;
let runnerTemp: string;
let outputIndex = 0;

const environmentFor = (): TestEnvironment => {
  const outputPath = join(runnerTemp, `github-output-${outputIndex++}`);
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
    AC265_DOWNLOADED_CI_ARTIFACT_ID: String(CI_ARTIFACT_ID),
    AC265_DOWNLOADED_STAGING_ARTIFACT_ID: String(STAGING_ARTIFACT_ID),
    STAGING_WEB_ORIGIN: WEB_ORIGIN,
    STAGING_API_ORIGIN: AC265_STAGING_API_ORIGIN,
    CLOUDFLARE_ACCOUNT_ID: 'f'.repeat(32),
    SUPABASE_PROJECT_REF,
    SUPABASE_URL,
    RUNNER_TEMP: runnerTemp,
    GITHUB_OUTPUT: outputPath,
  };
};

beforeEach(() => {
  fixture = createCandidateFixture();
  runnerTemp = mkdtempSync(join(tmpdir(), 'ac265-enrollment-test-'));
  outputIndex = 0;
});

afterEach(() => {
  fixture.close();
  rmSync(runnerTemp, { recursive: true, force: true });
});

describe('AC265 hosted E2E candidate provenance preflight entrypoint', () => {
  it('verifies provenance before persisting a strict enrollment request from protected configuration', async () => {
    const api = createMockGitHubApi();
    const messages: string[] = [];
    const before = artifactTreeDigest(fixture.workspaceRoot);
    const env = {
      ...environmentFor(),
      SOURCE_SHA: 'e'.repeat(40),
      STAGING_RUN_ID: '999999999999',
      AC265_STAGING_WEB_ORIGIN: 'https://attacker.example',
      AC265_STAGING_API_ORIGIN: 'https://attacker.example',
      UNRELATED_GITHUB_ENV: 'workflow metadata',
    };

    const { enrollmentRequestPath } = await runAc265HostedE2ePreflight({
      env,
      cwd: fixture.workspaceRoot,
      fetchImpl: api.fetchImpl,
      logger: { log: (message: string) => messages.push(message) },
    });

    expect(messages).toHaveLength(1);
    expect(JSON.parse(messages[0]!)).toEqual({
      event: 'candidate_provenance_verified',
      repository: REPOSITORY,
      sourceRevision: SOURCE_SHA,
      ciRunId: CI_RUN_ID,
      ciRunAttempt: CI_RUN_ATTEMPT,
      stagingRunId: STAGING_RUN_ID,
      stagingRunAttempt: STAGING_RUN_ATTEMPT,
      stagingDeploymentId: DEPLOYMENT_ID,
      stagingWebOrigin: WEB_ORIGIN,
    });
    expect(messages.join('\n')).not.toContain(TOKEN);
    expect(messages.join('\n')).not.toMatch(
      /acceptance|report|receipt|evidence/iu,
    );
    expect(api.requests.length).toBeGreaterThan(0);
    expect(
      api.requests.every(
        ({ init }) =>
          new Headers(init.headers).get('authorization') === `Bearer ${TOKEN}`,
      ),
    ).toBe(true);

    const enrollmentRequest = JSON.parse(
      readFileSync(enrollmentRequestPath, 'utf8'),
    ) as Record<string, unknown>;
    expect(enrollmentRequest).toMatchObject({
      criterion: 'P2-S09-AC-265',
      schemaVersion: 'ac265-candidate-enrollment-v1',
      identity: {
        sourceRevision: SOURCE_SHA,
        deploymentId: DEPLOYMENT_ID,
        webOrigin: WEB_ORIGIN,
        apiOrigin: AC265_STAGING_API_ORIGIN,
        hostingProjectId: AC265_STAGING_HOSTING_PROJECT_ID,
        supabaseProjectRef: SUPABASE_PROJECT_REF,
        supabaseOrigin: SUPABASE_URL,
      },
      provenance: {
        sourceRevision: SOURCE_SHA,
        repository: REPOSITORY,
      },
    });
    expect(JSON.stringify(enrollmentRequest)).not.toContain(TOKEN);
    expect(JSON.stringify(enrollmentRequest)).not.toContain(
      'SUPABASE_SECRET_KEY',
    );
    expect(readFileSync(env.GITHUB_OUTPUT!, 'utf8')).toBe(
      `enrollment_request_path=${enrollmentRequestPath}\n`,
    );
    expect(artifactTreeDigest(fixture.workspaceRoot)).toBe(before);
  });

  it('rejects each missing or empty required value before GitHub access or logging', async () => {
    for (const key of requiredEnvironmentKeys) {
      for (const value of [undefined, '']) {
        const env = environmentFor();
        env[key] = value;
        const fetchImpl = vi.fn<typeof fetch>();
        const messages: string[] = [];

        await expect(
          runAc265HostedE2ePreflight({
            env,
            cwd: fixture.workspaceRoot,
            fetchImpl,
            logger: { log: (message: string) => messages.push(message) },
          }),
        ).rejects.toThrow();

        expect(fetchImpl).not.toHaveBeenCalled();
        expect(messages).toHaveLength(0);
      }
    }
  });

  it('rejects whitespace-only or padded protected values without disclosing them', async () => {
    const secretLikeValue = '  private-token-value  ';
    for (const [key, value] of [
      ['GITHUB_TOKEN', secretLikeValue],
      ['GITHUB_REPOSITORY', '   '],
      ['STAGING_API_ORIGIN', ` ${AC265_STAGING_API_ORIGIN}`],
      ['SUPABASE_PROJECT_REF', ` ${SUPABASE_PROJECT_REF} `],
    ] as const) {
      const env = { ...environmentFor(), [key]: value };
      const fetchImpl = vi.fn<typeof fetch>();
      const messages: string[] = [];

      await expect(
        runAc265HostedE2ePreflight({
          env,
          cwd: fixture.workspaceRoot,
          fetchImpl,
          logger: { log: (message: string) => messages.push(message) },
        }),
      ).rejects.toThrow();

      expect(fetchImpl).not.toHaveBeenCalled();
      expect(messages.join('\n')).not.toContain(secretLikeValue);
    }
  });

  it('requires cwd to be an absolute canonical workspace root before GitHub access', async () => {
    for (const cwd of ['relative-workspace', `${fixture.workspaceRoot}/..`]) {
      const fetchImpl = vi.fn<typeof fetch>();

      await expect(
        runAc265HostedE2ePreflight({
          env: environmentFor(),
          cwd,
          fetchImpl,
          logger: { log: vi.fn() },
        }),
      ).rejects.toThrow();

      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it('rejects a protected Supabase target that differs from verified migration evidence after verification', async () => {
    const api = createMockGitHubApi();
    const env = {
      ...environmentFor(),
      SUPABASE_PROJECT_REF: 'zyxwvutsrqponmlkjihg',
      SUPABASE_URL: 'https://zyxwvutsrqponmlkjihg.supabase.co',
    };

    await expect(
      runAc265HostedE2ePreflight({
        env,
        cwd: fixture.workspaceRoot,
        fetchImpl: api.fetchImpl,
        logger: { log: vi.fn() },
      }),
    ).rejects.toThrow();

    expect(api.requests.length).toBeGreaterThan(0);
    expect(readFileSync(env.GITHUB_OUTPUT!, 'utf8')).toBe('');
  });

  it('fails closed when a downloaded artifact ID differs from the verified GitHub artifact ID', async () => {
    for (const [key, value] of [
      ['AC265_DOWNLOADED_CI_ARTIFACT_ID', String(CI_ARTIFACT_ID + 1)],
      ['AC265_DOWNLOADED_STAGING_ARTIFACT_ID', String(STAGING_ARTIFACT_ID + 1)],
      ['AC265_DOWNLOADED_STAGING_ARTIFACT_ID', String(CI_ARTIFACT_ID)],
    ] as const) {
      const api = createMockGitHubApi();
      const messages: string[] = [];
      const env = { ...environmentFor(), [key]: value };
      const before = artifactTreeDigest(fixture.workspaceRoot);

      await expect(
        runAc265HostedE2ePreflight({
          env,
          cwd: fixture.workspaceRoot,
          fetchImpl: api.fetchImpl,
          logger: { log: (message: string) => messages.push(message) },
        }),
      ).rejects.toThrow();

      expect(api.requests.length).toBeGreaterThan(0);
      expect(messages).toHaveLength(0);
      expect(readFileSync(env.GITHUB_OUTPUT!, 'utf8')).toBe('');
      for (const entry of readdirSync(runnerTemp))
        expect(readFileSync(join(runnerTemp, entry), 'utf8'), entry).toBe('');
      expect(artifactTreeDigest(fixture.workspaceRoot)).toBe(before);
    }
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
    expect(output).toContain('AC265 hosted E2E candidate preflight failed');
    expect(output).not.toContain(sentinel);
    expect(output).not.toContain('Error:');
  });
});
