import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  appendFileSync,
  lstatSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';

import { buildAc265CandidateEnrollment } from './ac265-candidate-enrollment.ts';
import { verifyAc265CandidateProvenance } from './ac265-candidate-provenance.ts';
import type { Ac265Fetch } from './ac265-candidate-provenance-common.ts';
import {
  assertAc265HostedE2eArtifactBinding,
  validateAc265HostedE2eDownloadedArtifactIds,
} from './ac265-hosted-e2e-artifact-binding.ts';

const FAILURE = 'AC265 hosted E2E candidate preflight failed';

export interface Ac265HostedE2ePreflightOptions {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly fetchImpl?: Ac265Fetch;
  readonly logger?: Readonly<Pick<Console, 'log'>>;
}

export interface Ac265HostedE2ePreflightResult {
  readonly enrollmentRequestPath: string;
}

const required = (
  env: Readonly<Record<string, string | undefined>>,
  name: string,
): string => {
  const value = env[name];
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim())
    throw new Error(FAILURE);
  return value;
};

const safeWorkspaceRoot = (cwd: string): string => {
  if (
    typeof cwd !== 'string' ||
    !isAbsolute(cwd) ||
    resolve(cwd) !== cwd ||
    cwd.includes('\0')
  )
    throw new Error(FAILURE);
  return cwd;
};

const safeRunnerTemp = (path: string): string => {
  if (
    typeof path !== 'string' ||
    !isAbsolute(path) ||
    resolve(path) !== path ||
    path.includes('\0') ||
    realpathSync(path) !== path ||
    !lstatSync(path).isDirectory() ||
    statSync(path).isSymbolicLink()
  )
    throw new Error(FAILURE);
  return path;
};

const safeWorkflowFile = (path: string): string => {
  if (
    typeof path !== 'string' ||
    !isAbsolute(path) ||
    resolve(path) !== path ||
    path.includes('\0') ||
    path.includes('\n') ||
    path.includes('\r') ||
    realpathSync(path) !== path ||
    !lstatSync(path).isFile()
  )
    throw new Error(FAILURE);
  return path;
};

export const runAc265HostedE2ePreflight = async ({
  env,
  cwd,
  fetchImpl = fetch,
  logger = console,
}: Ac265HostedE2ePreflightOptions): Promise<Ac265HostedE2ePreflightResult> => {
  const runnerTemp = safeRunnerTemp(required(env, 'RUNNER_TEMP'));
  const outputPath = safeWorkflowFile(required(env, 'GITHUB_OUTPUT'));
  const repository = required(env, 'GITHUB_REPOSITORY');
  const token = required(env, 'GITHUB_TOKEN');
  const sourceSha = required(env, 'AC265_SOURCE_SHA');
  const stagingRunId = required(env, 'AC265_STAGING_RUN_ID');
  const stagingRunAttempt = required(env, 'AC265_STAGING_RUN_ATTEMPT');
  const ciRunId = required(env, 'AC265_CI_RUN_ID');
  const ciRunAttempt = required(env, 'AC265_CI_RUN_ATTEMPT');
  const stagingDeploymentId = required(env, 'AC265_STAGING_DEPLOYMENT_ID');
  const protectedConfig = {
    hostingAccountId: required(env, 'CLOUDFLARE_ACCOUNT_ID'),
    stagingWebOrigin: required(env, 'STAGING_WEB_ORIGIN'),
    stagingApiOrigin: required(env, 'STAGING_API_ORIGIN'),
    supabaseProjectRef: required(env, 'SUPABASE_PROJECT_REF'),
    supabaseOrigin: required(env, 'SUPABASE_URL'),
  };
  const downloadedArtifactIds =
    validateAc265HostedE2eDownloadedArtifactIds(env);
  const provenance = await verifyAc265CandidateProvenance(
    {
      repository,
      token,
      sourceSha,
      stagingRunId,
      stagingRunAttempt,
      ciRunId,
      ciRunAttempt,
      stagingDeploymentId,
      stagingWebOrigin: protectedConfig.stagingWebOrigin,
      stagingApiOrigin: protectedConfig.stagingApiOrigin,
      workspaceRoot: safeWorkspaceRoot(cwd),
    },
    fetchImpl,
  );
  assertAc265HostedE2eArtifactBinding(downloadedArtifactIds, {
    ciArtifactId: provenance.ci.artifactId,
    stagingArtifactId: provenance.staging.artifactId,
  });

  const enrollmentRequest = await buildAc265CandidateEnrollment(
    provenance,
    protectedConfig,
  );

  const enrollmentRequestPath = resolve(
    runnerTemp,
    'ac265-candidate-enrollment-request.json',
  );
  if (
    !enrollmentRequestPath.startsWith(`${runnerTemp}/`) ||
    enrollmentRequestPath === outputPath
  )
    throw new Error(FAILURE);

  writeFileSync(
    enrollmentRequestPath,
    `${JSON.stringify(enrollmentRequest)}\n`,
    {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    },
  );
  appendFileSync(
    outputPath,
    `enrollment_request_path=${enrollmentRequestPath}\n`,
    { encoding: 'utf8' },
  );

  logger.log(
    JSON.stringify({
      event: provenance.status,
      repository: provenance.repository,
      sourceRevision: provenance.sourceRevision,
      ciRunId: provenance.ci.runId,
      ciRunAttempt: provenance.ci.runAttempt,
      stagingRunId: provenance.staging.runId,
      stagingRunAttempt: provenance.staging.runAttempt,
      stagingDeploymentId: provenance.staging.deploymentId,
      stagingWebOrigin: provenance.staging.webOrigin,
    }),
  );

  return { enrollmentRequestPath };
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
    await runAc265HostedE2ePreflight({
      env: process.env,
      cwd: process.cwd(),
    });
  } catch {
    console.error(FAILURE);
    process.exitCode = 1;
  }
}
