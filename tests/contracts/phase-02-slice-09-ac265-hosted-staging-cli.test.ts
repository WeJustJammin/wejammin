import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { AC265_HOSTED_SCOPE_FAILURE } from '../../infra/workflows/content-schema-registry-hosted-staging-scope-verifier.ts';
import {
  parseAc265HostedStagingEnvironment,
  verifyAc265HostedStagingEvidenceCli,
} from '../../infra/workflows/verify-ac265-hosted-staging-evidence.ts';
import { resolveAc265HostedStagingSelector } from '../../infra/workflows/verify-ac265-hosted-staging-evidence.ts';
import type { ContentSchemaRegistryHostedRunnerContract } from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-input.ts';
import {
  DEPLOYMENT_ID,
  REPOSITORY,
  SOURCE_SHA,
  STAGING_RUN_ATTEMPT,
  STAGING_RUN_ID,
  TOKEN,
  WEB_ORIGIN,
  createMockGitHubApi,
} from '../ac265-candidate-provenance.test-support.ts';
import { cleanupArchiveFixtures } from '../ac265-hosted-artifact-archive.test-support.ts';
import { createStagingScopeFixture } from './ac265-staging-scope-verifier-test-support.ts';
import { runnerContract } from './ac265-hosted-test-fixtures.ts';

const roots = new Set<string>();

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.clear();
  cleanupArchiveFixtures();
});
afterAll(() => {
  cleanupArchiveFixtures();
});

const reportArtifact = (patch: Record<string, unknown> = {}) => ({
  id: 4242,
  name: 'ac265-hosted-e2e-report-v3',
  size_in_bytes: 4096,
  url: 'https://api.github.com/repos/' + REPOSITORY + '/actions/artifacts/4242',
  archive_download_url:
    'https://api.github.com/repos/' +
    REPOSITORY +
    '/actions/artifacts/4242/zip',
  expired: false,
  created_at: '2026-09-08T13:25:00.000Z',
  updated_at: '2026-09-08T13:25:00.000Z',
  digest: 'sha256:' + 'd'.repeat(64),
  workflow_run: {
    id: Number(STAGING_RUN_ID),
    repository_id: 2001,
    head_repository_id: 2001,
    head_branch: 'main',
    head_sha: SOURCE_SHA,
  },
  ...patch,
});

const envFor = (archiveDirectory: string) => ({
  AC265_STAGING_RUN_ID: STAGING_RUN_ID,
  AC265_STAGING_RUN_ATTEMPT: STAGING_RUN_ATTEMPT,
  AC265_HOSTED_REPORT_ARCHIVE_DIR: archiveDirectory,
  STAGING_WEB_ORIGIN: WEB_ORIGIN,
  GITHUB_REPOSITORY: REPOSITORY,
  GITHUB_TOKEN: TOKEN,
});

const canonicalRoot = (): string => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ac265-cli-')));
  roots.add(root);
  return root;
};

const manifestPathFor = (workspaceRoot: string): string =>
  join(workspaceRoot, 'ac265-hosted-staging-evidence', 'manifest.json');

/**
 * A complete, genuine CLI invocation: the manifest is bound to the exact
 * report archive bytes and byte length the artifact API reports, so only a
 * real scope fixture can reach the manifest write.
 */
const createHostedEvidenceFixture = () => {
  // The CLI authenticates the run, revision, and deployment against the
  // GitHub API, so the runner contract must describe the run the mock reports.
  const fixture = createStagingScopeFixture({
    contract: runnerContract({
      identity: {
        ...runnerContract().identity,
        stagingRunId: STAGING_RUN_ID,
        stagingRunAttempt: Number(STAGING_RUN_ATTEMPT),
        sourceRevision: SOURCE_SHA,
        deploymentId: DEPLOYMENT_ID,
        webOrigin: WEB_ORIGIN,
      },
    }) satisfies ContentSchemaRegistryHostedRunnerContract,
  });
  const archiveDirectory = mkdtempSync(join(tmpdir(), 'ac265-cli-report-'));
  roots.add(archiveDirectory);
  writeFileSync(
    join(archiveDirectory, 'report.zip'),
    readFileSync(fixture.reportArchivePath),
  );
  const api = createMockGitHubApi({
    stagingArtifacts: [
      reportArtifact({
        size_in_bytes: fixture.reportArchiveBytes,
        digest: 'sha256:' + fixture.reportArchiveSha256,
      }),
    ],
  });
  return {
    fixture,
    archiveDirectory,
    reportArchiveSha256: fixture.reportArchiveSha256,
    api,
    workspaceRoot: canonicalRoot(),
    env: {
      ...envFor(archiveDirectory),
      AC265_HOSTED_VERIFICATION_CONTEXT_BUNDLE_B64: Buffer.from(
        fixture.bundleBytes,
      ).toString('base64'),
    },
  };
};

describe('AC265 hosted staging evidence CLI', () => {
  it('resolves the exact report artifact selector for the run', async () => {
    const api = createMockGitHubApi({ stagingArtifacts: [reportArtifact()] });
    const selector = await resolveAc265HostedStagingSelector({
      env: envFor('/nonexistent'),
      fetchImpl: api.fetchImpl,
    });
    expect(selector.artifactId).toBe(4242);
    expect(selector.sourceRevision).toBe(SOURCE_SHA);
    expect(selector.archiveSha256).toBe('d'.repeat(64));
  });

  it('fails closed when the archive directory is not a directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'ac265-cli-'));
    roots.add(root);
    const directory = join(root, 'report-archive');
    writeFileSync(directory, 'not-a-directory');
    expect(() =>
      parseAc265HostedStagingEnvironment(envFor(directory)),
    ).toThrow();
  });

  it('fails closed when the archive directory holds more than one file', () => {
    const root = mkdtempSync(join(tmpdir(), 'ac265-cli-'));
    roots.add(root);
    const directory = join(root, 'report-archive');
    mkdirSync(directory);
    writeFileSync(join(directory, 'one.zip'), 'a');
    writeFileSync(join(directory, 'two.zip'), 'b');
    expect(() =>
      parseAc265HostedStagingEnvironment(envFor(directory)),
    ).toThrow();
  });

  it('fails closed when the run id or attempt is malformed', () => {
    expect(() =>
      parseAc265HostedStagingEnvironment({
        ...envFor('/tmp'),
        AC265_STAGING_RUN_ID: '0',
      }),
    ).toThrow();
    expect(() =>
      parseAc265HostedStagingEnvironment({
        ...envFor('/tmp'),
        AC265_STAGING_RUN_ATTEMPT: 'abc',
      }),
    ).toThrow();
  });

  it('fails closed when the protected bundle secret is absent', async () => {
    const fixture = createStagingScopeFixture();
    const api = createMockGitHubApi({
      stagingArtifacts: [
        reportArtifact({
          size_in_bytes: fixture.reportArchiveBytes,
          digest: 'sha256:' + fixture.reportArchiveSha256,
        }),
      ],
    });
    const root = mkdtempSync(join(tmpdir(), 'ac265-cli-'));
    roots.add(root);
    const directory = join(root, 'report-archive');
    mkdirSync(directory);
    writeFileSync(
      join(directory, 'report.zip'),
      readFileSync(fixture.reportArchivePath),
    );
    await expect(
      verifyAc265HostedStagingEvidenceCli({
        env: envFor(directory),
        workspaceRoot: root,
        fetchImpl: api.fetchImpl,
      }),
    ).rejects.toThrow();
  });

  it('rejects ignored base64 characters in the protected bundle before GitHub access', async () => {
    const api = createMockGitHubApi({ stagingArtifacts: [reportArtifact()] });
    const fixture = createStagingScopeFixture();
    const root = mkdtempSync(join(tmpdir(), 'ac265-cli-'));
    roots.add(root);
    const directory = join(root, 'report-archive');
    mkdirSync(directory);
    writeFileSync(join(directory, 'report.zip'), 'archive');
    await expect(
      verifyAc265HostedStagingEvidenceCli({
        env: {
          ...envFor(directory),
          AC265_HOSTED_VERIFICATION_CONTEXT_BUNDLE_B64:
            Buffer.from(fixture.bundleBytes).toString('base64') + '!',
        },
        workspaceRoot: root,
        fetchImpl: api.fetchImpl,
      }),
    ).rejects.toThrow(AC265_HOSTED_SCOPE_FAILURE);
    expect(api.requests).toEqual([]);
  });

  it('reports no caller workspace root from the environment parser', () => {
    const root = mkdtempSync(join(tmpdir(), 'ac265-cli-'));
    roots.add(root);
    const directory = join(root, 'report-archive');
    mkdirSync(directory);
    writeFileSync(join(directory, 'report.zip'), 'archive');
    const inputs = parseAc265HostedStagingEnvironment(envFor(directory));
    // The workspace root is the caller's, so the parser cannot source it from
    // process.cwd(): a second, unvalidated root is how the write target
    // drifted away from the validated one.
    expect('workspaceRoot' in inputs).toBe(false);
    expect(inputs.runId).toBe(STAGING_RUN_ID);
    expect(inputs.runAttempt).toBe(STAGING_RUN_ATTEMPT);
    expect(inputs.reportArchivePath).toBe(
      join(root, 'report-archive', 'report.zip'),
    );
    expect(inputs.stagingWebOrigin).toBe(WEB_ORIGIN);
  });

  it('refuses a caller workspace root that is absolute but not canonical', async () => {
    const api = createMockGitHubApi({ stagingArtifacts: [reportArtifact()] });
    const root = mkdtempSync(join(tmpdir(), 'ac265-cli-'));
    roots.add(root);
    const directory = join(root, 'report-archive');
    mkdirSync(directory);
    writeFileSync(join(directory, 'report.zip'), 'archive');
    // resolve() removes the trailing separator, so this input differs from
    // its canonical form and must not reach the manifest write.
    const noncanonicalRoot = root + '/';
    await expect(
      verifyAc265HostedStagingEvidenceCli({
        env: envFor(directory),
        workspaceRoot: noncanonicalRoot,
        fetchImpl: api.fetchImpl,
      }),
    ).rejects.toThrow(AC265_HOSTED_SCOPE_FAILURE);
    expect(api.requests).toEqual([]);
    expect(
      existsSync(join(root, 'ac265-hosted-staging-evidence', 'manifest.json')),
    ).toBe(false);
  });

  it.each(['relative', 'NUL-bearing'] as const)(
    'refuses a %s workspace root before the GitHub fetch and before any manifest write',
    async (kind) => {
      const api = createMockGitHubApi({ stagingArtifacts: [reportArtifact()] });
      const root = mkdtempSync(join(tmpdir(), 'ac265-cli-'));
      roots.add(root);
      const directory = join(root, 'report-archive');
      mkdirSync(directory);
      writeFileSync(join(directory, 'report.zip'), 'archive');
      const workspaceRoot =
        kind === 'relative'
          ? relative(process.cwd(), root)
          : `${root}\u0000suffix`;
      await expect(
        verifyAc265HostedStagingEvidenceCli({
          env: envFor(directory),
          workspaceRoot,
          fetchImpl: api.fetchImpl,
        }),
      ).rejects.toThrow(AC265_HOSTED_SCOPE_FAILURE);
      expect(api.requests).toEqual([]);
      expect(
        existsSync(
          join(root, 'ac265-hosted-staging-evidence', 'manifest.json'),
        ),
      ).toBe(false);
    },
  );

  it('writes the evidence manifest for a genuine canonical workspace root', async () => {
    const {
      api,
      reportArchiveSha256,
      workspaceRoot,
      env: genuineEnv,
    } = createHostedEvidenceFixture();
    const manifest = await verifyAc265HostedStagingEvidenceCli({
      env: genuineEnv,
      workspaceRoot,
      fetchImpl: api.fetchImpl,
    });
    expect(manifest.status).toBe('verified');
    expect(manifest.scope).toBe('staging');
    expect(api.requests.length).toBeGreaterThan(0);
    const written = JSON.parse(
      readFileSync(manifestPathFor(workspaceRoot), 'utf8'),
    ) as Record<string, unknown>;
    expect(written['status']).toBe('verified');
    expect(written['reportArchiveSha256']).toBe(reportArchiveSha256);
  });

  it('refuses a workspace root that is a symlink to the real directory, without fetching or writing through the link', async () => {
    const {
      api,
      workspaceRoot,
      env: genuineEnv,
    } = createHostedEvidenceFixture();
    // The link lives in a private directory unrelated to the archive
    // directory, which must keep holding exactly the one archive.
    const link = join(canonicalRoot(), 'workspace-link');
    symlinkSync(workspaceRoot, link);
    await expect(
      verifyAc265HostedStagingEvidenceCli({
        env: genuineEnv,
        workspaceRoot: link,
        fetchImpl: api.fetchImpl,
      }),
    ).rejects.toThrow(AC265_HOSTED_SCOPE_FAILURE);
    expect(api.requests).toEqual([]);
    expect(existsSync(manifestPathFor(workspaceRoot))).toBe(false);
    expect(existsSync(manifestPathFor(link))).toBe(false);
  });

  it('refuses a workspace root reached through a symlinked ancestor directory', async () => {
    const {
      api,
      workspaceRoot,
      env: genuineEnv,
    } = createHostedEvidenceFixture();
    // The final component is a real directory reached through a link: the
    // root path itself is not a link, so only a walk over every existing
    // component can refuse it.
    const linkParent = join(workspaceRoot, 'linked-parent');
    mkdirSync(linkParent);
    const realOuter = join(linkParent, 'real-outer');
    mkdirSync(realOuter);
    const realChild = join(realOuter, 'real-child');
    mkdirSync(realChild);
    const ancestorLink = join(linkParent, 'ancestor-link');
    symlinkSync(realOuter, ancestorLink);
    await expect(
      verifyAc265HostedStagingEvidenceCli({
        env: genuineEnv,
        workspaceRoot: join(ancestorLink, 'real-child'),
        fetchImpl: api.fetchImpl,
      }),
    ).rejects.toThrow(AC265_HOSTED_SCOPE_FAILURE);
    expect(api.requests).toEqual([]);
    expect(existsSync(manifestPathFor(workspaceRoot))).toBe(false);
    expect(existsSync(manifestPathFor(realChild))).toBe(false);
  });

  it('fails closed on a raw errno when the workspace root does not exist', async () => {
    const {
      api,
      workspaceRoot,
      env: genuineEnv,
    } = createHostedEvidenceFixture();
    const missingRoot = join(workspaceRoot, 'missing-root');
    const failure = await verifyAc265HostedStagingEvidenceCli({
      env: genuineEnv,
      workspaceRoot: missingRoot,
      fetchImpl: api.fetchImpl,
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe(AC265_HOSTED_SCOPE_FAILURE);
    expect((failure as Error).message).not.toMatch(/ENOENT/u);
    expect(api.requests).toEqual([]);
    expect(existsSync(manifestPathFor(workspaceRoot))).toBe(false);
    expect(existsSync(missingRoot)).toBe(false);
  });

  it('fails closed on a regular file workspace root', async () => {
    const {
      api,
      workspaceRoot,
      env: genuineEnv,
    } = createHostedEvidenceFixture();
    const fileRoot = join(workspaceRoot, 'workspace-root-file');
    writeFileSync(fileRoot, 'not-a-directory');
    const failure = await verifyAc265HostedStagingEvidenceCli({
      env: genuineEnv,
      workspaceRoot: fileRoot,
      fetchImpl: api.fetchImpl,
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe(AC265_HOSTED_SCOPE_FAILURE);
    expect((failure as Error).message).not.toMatch(/ENOTDIR|ENOENT/u);
    expect(api.requests).toEqual([]);
    expect(existsSync(manifestPathFor(workspaceRoot))).toBe(false);
  });

  it('refuses a symlinked evidence directory instead of writing through it', async () => {
    const {
      api,
      workspaceRoot,
      env: genuineEnv,
    } = createHostedEvidenceFixture();
    const outside = mkdtempSync(join(tmpdir(), 'ac265-cli-outside-'));
    roots.add(outside);
    symlinkSync(outside, join(workspaceRoot, 'ac265-hosted-staging-evidence'));
    await expect(
      verifyAc265HostedStagingEvidenceCli({
        env: genuineEnv,
        workspaceRoot,
        fetchImpl: api.fetchImpl,
      }),
    ).rejects.toThrow(AC265_HOSTED_SCOPE_FAILURE);
    // A genuine invocation reaches the write step, so this refusal is the
    // evidence-directory check and not an earlier failure.
    expect(api.requests.length).toBeGreaterThan(0);
    expect(existsSync(join(outside, 'manifest.json'))).toBe(false);
    expect(existsSync(manifestPathFor(outside))).toBe(false);
  });
});
