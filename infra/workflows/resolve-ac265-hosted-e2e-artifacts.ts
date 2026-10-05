import { appendFileSync, lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  type Ac265Fetch,
  AC265_REPOSITORY,
  safeOrigin,
} from './ac265-candidate-provenance-common.ts';
import { resolveAc265HostedE2eArtifactIds } from './ac265-hosted-e2e-artifact-binding.ts';
import { AC265_STAGING_API_ORIGIN } from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-hosted-control-plane.ts';

const FAILURE = 'AC265 hosted E2E artifact resolution failed';

export interface Ac265HostedE2eArtifactResolutionOptions {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly fetchImpl?: Ac265Fetch;
  readonly logger?: Readonly<Pick<Console, 'log'>>;
}

export interface Ac265HostedE2eArtifactResolution {
  readonly ciArtifactId: number;
  readonly stagingArtifactId: number;
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
    !cwd.startsWith('/') ||
    resolve(cwd) !== cwd ||
    cwd.includes('\0')
  )
    throw new Error(FAILURE);
  return cwd;
};

const safeOutputFile = (path: string | undefined): string => {
  if (
    typeof path !== 'string' ||
    !isAbsolute(path) ||
    resolve(path) !== path ||
    path.includes('\0') ||
    path.includes('\n') ||
    path.includes('\r')
  )
    throw new Error(FAILURE);
  try {
    if (realpathSync(path) !== path || !lstatSync(path).isFile())
      throw new Error(FAILURE);
  } catch {
    throw new Error(FAILURE);
  }
  return path;
};

export const runAc265HostedE2eArtifactResolution = async ({
  env,
  cwd,
  fetchImpl = fetch,
  logger = console,
}: Ac265HostedE2eArtifactResolutionOptions): Promise<Ac265HostedE2eArtifactResolution> => {
  const outputPath = safeOutputFile(required(env, 'GITHUB_OUTPUT'));
  const workspaceRoot = safeWorkspaceRoot(cwd);
  const repository = required(env, 'GITHUB_REPOSITORY');
  const token = required(env, 'GITHUB_TOKEN');
  const sourceSha = required(env, 'AC265_SOURCE_SHA');
  const stagingRunId = required(env, 'AC265_STAGING_RUN_ID');
  const stagingRunAttempt = required(env, 'AC265_STAGING_RUN_ATTEMPT');
  const ciRunId = required(env, 'AC265_CI_RUN_ID');
  const ciRunAttempt = required(env, 'AC265_CI_RUN_ATTEMPT');
  const stagingDeploymentId = required(env, 'AC265_STAGING_DEPLOYMENT_ID');
  const stagingWebOrigin = safeOrigin(required(env, 'STAGING_WEB_ORIGIN'));
  if (
    safeOrigin(required(env, 'STAGING_API_ORIGIN')) !== AC265_STAGING_API_ORIGIN
  )
    throw new Error(FAILURE);
  if (repository !== AC265_REPOSITORY) throw new Error(FAILURE);

  const resolution = await resolveAc265HostedE2eArtifactIds(
    {
      repository,
      token,
      ciRunId,
      ciRunAttempt,
      stagingRunId,
      stagingRunAttempt,
      sourceSha,
      stagingDeploymentId,
      stagingWebOrigin,
      stagingApiOrigin: AC265_STAGING_API_ORIGIN,
      workspaceRoot,
    },
    fetchImpl,
  );
  appendFileSync(
    outputPath,
    [
      'ci_artifact_id=' + String(resolution.ciArtifactId),
      'staging_artifact_id=' + String(resolution.stagingArtifactId),
      '',
    ].join('\n'),
    { encoding: 'utf8' },
  );
  logger.log(
    JSON.stringify({
      event: 'ac265_hosted_e2e_artifact_ids_resolved',
      sourceRevision: sourceSha,
      ciRunId: resolution.ciRunId,
      stagingRunId: resolution.stagingRunId,
    }),
  );
  return {
    ciArtifactId: resolution.ciArtifactId,
    stagingArtifactId: resolution.stagingArtifactId,
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
    await runAc265HostedE2eArtifactResolution({
      env: process.env,
      cwd: process.cwd(),
    });
  } catch {
    console.error(FAILURE);
    process.exitCode = 1;
  }
}
