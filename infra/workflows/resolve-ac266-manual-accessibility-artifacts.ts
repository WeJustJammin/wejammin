import { appendFileSync } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { AC266_MANUAL_ACCESSIBILITY_INTAKE_WORKFLOW_PATH } from './materialize-ac266-manual-accessibility-intake.ts';
import {
  failAc266Evidence,
  isAc266Record,
  parseAc266Timestamp,
  requestAc266GitHubApi,
} from './ac266-manual-accessibility-github-api.ts';

const FAILURE = 'AC266 manual accessibility evidence verification failed';
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const SHA_PATTERN = /^[a-f0-9]{40}$/u;
const RUN_ID_PATTERN = /^[1-9][0-9]{0,18}$/u;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const STAGING_WORKFLOW_PATH = '.github/workflows/deploy-staging.yml' as const;

export const AC266_STAGING_CANDIDATE_ARTIFACT_NAME =
  'staging-verified-candidate' as const;
export const AC266_MANUAL_INTAKE_ARTIFACT_NAME =
  'ac266-manual-accessibility-intake' as const;

export interface Ac266ManualAccessibilityArtifactResolutionOptions {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
  readonly logger?: Readonly<Pick<Console, 'log'>>;
}

export interface Ac266ManualAccessibilityArtifactResolution {
  readonly stagingArtifactId: number;
  readonly intakeArtifactId: number;
}

interface Ac266VerifiedRun {
  readonly id: number;
  readonly headSha: string;
  readonly repositoryId: number;
  readonly startedAt: number;
  readonly completedAt: number;
}

interface Ac266VerifiedArtifact {
  readonly id: number;
  readonly digest: string;
}

interface Ac266ArtifactResolutionInputs {
  readonly repository: string;
  readonly token: string;
  readonly sourceSha: string;
  readonly stagingRunId: string;
  readonly deploymentId: string;
  readonly manualRunId: string;
  readonly cutoff: number;
}

const fail = (): never => failAc266Evidence();

const required = (
  env: Readonly<Record<string, string | undefined>>,
  name: string,
): string => {
  const value = env[name];
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim())
    return fail();
  return value;
};

const safeOutputFile = async (value: string | undefined): Promise<string> => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    !isAbsolute(value) ||
    resolve(value) !== value ||
    value.includes('/../') ||
    value.endsWith('/..') ||
    value.includes('\0')
  )
    return fail();
  try {
    const info = await lstat(value);
    if (!info.isFile() || info.isSymbolicLink()) return fail();
  } catch {
    return fail();
  }
  return value;
};

const fixedWorkflowRunPathMatches = (
  value: unknown,
  workflowPath: string,
): boolean =>
  value === workflowPath ||
  value === workflowPath + '@main' ||
  value === workflowPath + '@refs/heads/main';

const requireSafeInteger = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    return fail();
  return value;
};

const requireRunId = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !RUN_ID_PATTERN.test(value) ||
    !Number.isSafeInteger(Number(value))
  )
    return fail();
  return value;
};

const requireDigest = (value: unknown): string => {
  if (typeof value !== 'string' || !DIGEST_PATTERN.test(value)) return fail();
  return value;
};

const snapshotEnv = (
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined> => {
  if (!isAc266Record(env)) return fail();
  return Object.fromEntries(Object.entries(env));
};

const assertRun = (
  value: unknown,
  expected: {
    readonly runId: string;
    readonly workflowPath: string;
    readonly event: 'workflow_run' | 'workflow_dispatch';
    readonly sourceSha?: string;
    readonly repository: string;
    readonly cutoff: number;
  },
): Ac266VerifiedRun => {
  if (!isAc266Record(value)) return fail();
  const repository = isAc266Record(value.repository)
    ? value.repository
    : undefined;
  const headRepository = isAc266Record(value.head_repository)
    ? value.head_repository
    : undefined;
  const runId = requireSafeInteger(value.id);
  const repositoryId = requireSafeInteger(repository?.id);
  const headRepositoryId = requireSafeInteger(headRepository?.id);
  if (
    typeof value.run_attempt !== 'number' ||
    !Number.isSafeInteger(value.run_attempt) ||
    value.run_attempt < 1 ||
    value.run_attempt > 100000
  )
    return fail();
  if (
    String(runId) !== expected.runId ||
    !fixedWorkflowRunPathMatches(value.path, expected.workflowPath) ||
    value.event !== expected.event ||
    value.status !== 'completed' ||
    value.conclusion !== 'success' ||
    value.head_branch !== 'main' ||
    (expected.sourceSha !== undefined &&
      value.head_sha !== expected.sourceSha) ||
    repository?.full_name !== expected.repository ||
    headRepository?.full_name !== expected.repository ||
    repositoryId !== headRepositoryId
  )
    return fail();
  const createdAt = parseAc266Timestamp(value.created_at);
  const startedAt = parseAc266Timestamp(value.run_started_at);
  const completedAt = parseAc266Timestamp(value.updated_at);
  if (
    createdAt > startedAt ||
    startedAt > completedAt ||
    completedAt > expected.cutoff
  )
    return fail();
  const headSha =
    typeof value.head_sha === 'string' && SHA_PATTERN.test(value.head_sha)
      ? value.head_sha
      : fail();
  return { id: runId, headSha, repositoryId, startedAt, completedAt };
};

const collectPages = async (
  path: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<unknown[]> => {
  const output: unknown[] = [];
  let totalCount: number | undefined;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const value = await requestAc266GitHubApi(
      path + separator + 'per_page=' + PAGE_SIZE + '&page=' + page,
      fetchImpl,
      token,
    );
    if (Array.isArray(value)) {
      if (value.length > PAGE_SIZE) return fail();
      output.push(...value);
      if (value.length < PAGE_SIZE) return output;
      continue;
    }
    if (!isAc266Record(value) || !Array.isArray(value.artifacts)) return fail();
    const count = value.total_count;
    if (
      typeof count !== 'number' ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      (totalCount !== undefined && totalCount !== count) ||
      value.artifacts.length > PAGE_SIZE
    )
      return fail();
    totalCount = count;
    output.push(...value.artifacts);
    if (value.artifacts.length < PAGE_SIZE) {
      if (output.length !== totalCount) return fail();
      return output;
    }
  }
  return fail();
};

const safeGitHubUrl = (candidate: string, expectedPath: string): boolean => {
  try {
    const parsed = new URL(candidate);
    return (
      parsed.protocol === 'https:' &&
      parsed.origin === 'https://api.github.com' &&
      parsed.username === '' &&
      parsed.password === '' &&
      parsed.pathname === expectedPath &&
      parsed.search === '' &&
      parsed.hash === ''
    );
  } catch {
    return false;
  }
};

const verifyArtifact = (
  value: unknown,
  options: {
    readonly artifactName: string;
    readonly run: Ac266VerifiedRun;
    readonly repository: string;
  },
): Ac266VerifiedArtifact => {
  if (!isAc266Record(value)) return fail();
  const id = requireSafeInteger(value.id);
  const origin = isAc266Record(value.workflow_run)
    ? value.workflow_run
    : undefined;
  if (
    value.name !== options.artifactName ||
    value.expired !== false ||
    requireSafeInteger(value.size_in_bytes) > 1024 * 1024 * 1024
  )
    return fail();
  const digest = requireDigest(value.digest);
  if (
    origin?.id !== options.run.id ||
    origin?.repository_id !== options.run.repositoryId ||
    origin?.head_repository_id !== options.run.repositoryId ||
    origin?.head_branch !== 'main' ||
    origin?.head_sha !== options.run.headSha
  )
    return fail();
  const encodedRepository = options.repository
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  const expectedPath =
    '/repos/' + encodedRepository + '/actions/artifacts/' + String(id);
  const url = typeof value.url === 'string' ? value.url : '';
  const archiveUrl =
    typeof value.archive_download_url === 'string'
      ? value.archive_download_url
      : '';
  if (
    !safeGitHubUrl(url, expectedPath) ||
    !safeGitHubUrl(archiveUrl, expectedPath + '/zip')
  )
    return fail();
  const createdAt = parseAc266Timestamp(value.created_at);
  if (createdAt < options.run.startedAt || createdAt > options.run.completedAt)
    return fail();
  return { id, digest };
};

const findArtifact = async (
  input: Ac266ArtifactResolutionInputs,
  run: Ac266VerifiedRun,
  artifactName: string,
  fetchImpl: typeof fetch,
): Promise<Ac266VerifiedArtifact> => {
  const encodedRepository = input.repository
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  const path =
    '/repos/' +
    encodedRepository +
    '/actions/runs/' +
    String(run.id) +
    '/artifacts';
  const artifacts = await collectPages(path, input.token, fetchImpl);
  const matches = artifacts.filter(
    (artifact) => isAc266Record(artifact) && artifact.name === artifactName,
  );
  if (matches.length !== 1) return fail();
  return verifyArtifact(matches[0], {
    artifactName,
    run,
    repository: input.repository,
  });
};

export const runAc266ManualAccessibilityArtifactResolution = async (
  options: Ac266ManualAccessibilityArtifactResolutionOptions,
): Promise<Ac266ManualAccessibilityArtifactResolution> => {
  const env = snapshotEnv(options.env);
  const outputPath = await safeOutputFile(env['GITHUB_OUTPUT']);
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const logger = options.logger ?? console;
  if (typeof fetchImpl !== 'function' || typeof now !== 'function')
    return fail();

  const repository = required(env, 'GITHUB_REPOSITORY');
  const token = required(env, 'GITHUB_TOKEN');
  const sourceSha = required(env, 'AC266_SOURCE_SHA');
  const stagingRunId = requireRunId(required(env, 'AC266_STAGING_RUN_ID'));
  const deploymentId = requireRunId(
    required(env, 'AC266_STAGING_DEPLOYMENT_ID'),
  );
  const manualRunId = requireRunId(required(env, 'AC266_MANUAL_REPORT_RUN_ID'));
  if (
    !REPOSITORY_PATTERN.test(repository) ||
    repository
      .split('/')
      .some((segment) => segment === '.' || segment === '..') ||
    token.length > 4096 ||
    /\s/u.test(token) ||
    !SHA_PATTERN.test(sourceSha)
  )
    return fail();
  const cutoff = now().getTime();
  if (!Number.isFinite(cutoff)) return fail();

  const input: Ac266ArtifactResolutionInputs = {
    repository,
    token,
    sourceSha,
    stagingRunId,
    deploymentId,
    manualRunId,
    cutoff,
  };
  const encodedRepository = repository
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  const stagingRun = assertRun(
    await requestAc266GitHubApi(
      '/repos/' + encodedRepository + '/actions/runs/' + stagingRunId,
      fetchImpl,
      token,
    ),
    {
      runId: stagingRunId,
      workflowPath: STAGING_WORKFLOW_PATH,
      event: 'workflow_run',
      sourceSha,
      repository,
      cutoff,
    },
  );
  const intakeRun = assertRun(
    await requestAc266GitHubApi(
      '/repos/' + encodedRepository + '/actions/runs/' + manualRunId,
      fetchImpl,
      token,
    ),
    {
      runId: manualRunId,
      workflowPath: AC266_MANUAL_ACCESSIBILITY_INTAKE_WORKFLOW_PATH,
      event: 'workflow_dispatch',
      repository,
      cutoff,
    },
  );
  const [stagingArtifact, intakeArtifact] = [
    await findArtifact(
      input,
      stagingRun,
      AC266_STAGING_CANDIDATE_ARTIFACT_NAME,
      fetchImpl,
    ),
    await findArtifact(
      input,
      intakeRun,
      AC266_MANUAL_INTAKE_ARTIFACT_NAME,
      fetchImpl,
    ),
  ];

  appendFileSync(
    outputPath,
    [
      'staging_artifact_id=' + String(stagingArtifact.id),
      'intake_artifact_id=' + String(intakeArtifact.id),
      '',
    ].join('\n'),
    { encoding: 'utf8' },
  );
  logger.log(
    JSON.stringify({
      event: 'ac266_manual_accessibility_artifact_ids_resolved',
      sourceRevision: sourceSha,
      stagingRunId,
      stagingDeploymentId: deploymentId,
      manualRunId,
    }),
  );
  return {
    stagingArtifactId: stagingArtifact.id,
    intakeArtifactId: intakeArtifact.id,
  };
};

const isDirectExecution = (): boolean => {
  const entrypoint = process.argv[1];
  return (
    typeof entrypoint === 'string' &&
    pathToFileURL(resolve(entrypoint)).href === import.meta.url
  );
};

if (isDirectExecution()) {
  try {
    await runAc266ManualAccessibilityArtifactResolution({ env: process.env });
  } catch {
    console.error(FAILURE);
    process.exitCode = 1;
  }
}
