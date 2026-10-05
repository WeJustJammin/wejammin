import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AC266_MANUAL_INTAKE_ARTIFACT_NAME,
  AC266_STAGING_CANDIDATE_ARTIFACT_NAME,
  runAc266ManualAccessibilityArtifactResolution,
} from '../infra/workflows/resolve-ac266-manual-accessibility-artifacts.ts';
import {
  executableWorkflow,
  namedStep,
} from './ac266-manual-accessibility-workflow-contract-helpers.ts';

const REPOSITORY = 'WeJustJammin/wejammin';
const SOURCE_SHA = 'a'.repeat(40);
const INTAKE_SHA = 'b'.repeat(40);
const STAGING_RUN_ID = '1201';
const MANUAL_RUN_ID = '3201';
const DEPLOYMENT_ID = '2201';
const CANDIDATE_ARTIFACT_ID = 4501;
const INTAKE_ARTIFACT_ID = 5501;
const CANDIDATE_DIGEST = 'sha256:' + 'e'.repeat(64);
const INTAKE_DIGEST = 'sha256:' + 'f'.repeat(64);
const TOKEN = 'gh-token-must-not-appear-in-output';
const CUTOFF = new Date('2026-09-13T13:00:00.000Z');
const API_PREFIX = '/repos/WeJustJammin/wejammin';

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const stagingRun = (patch: Record<string, unknown> = {}) => ({
  id: Number(STAGING_RUN_ID),
  path: '.github/workflows/deploy-staging.yml',
  event: 'workflow_run',
  status: 'completed',
  conclusion: 'success',
  head_branch: 'main',
  head_sha: SOURCE_SHA,
  run_attempt: 1,
  created_at: '2026-09-13T09:25:00.000Z',
  run_started_at: '2026-09-13T09:30:00.000Z',
  updated_at: '2026-09-13T10:15:00.000Z',
  repository: { id: 77, full_name: REPOSITORY },
  head_repository: { id: 77, full_name: REPOSITORY },
  ...patch,
});

const intakeRun = (patch: Record<string, unknown> = {}) => ({
  id: Number(MANUAL_RUN_ID),
  path: '.github/workflows/intake-ac266-manual-accessibility-reports.yml',
  event: 'workflow_dispatch',
  status: 'completed',
  conclusion: 'success',
  head_branch: 'main',
  head_sha: INTAKE_SHA,
  run_attempt: 1,
  created_at: '2026-09-13T12:00:00.000Z',
  run_started_at: '2026-09-13T12:00:00.000Z',
  updated_at: '2026-09-13T12:10:00.000Z',
  repository: { id: 77, full_name: REPOSITORY },
  head_repository: { id: 77, full_name: REPOSITORY },
  ...patch,
});

const artifact = (params: {
  readonly id: number;
  readonly name: string;
  readonly digest: string;
  readonly createdAt: string;
  readonly workflowRun: Record<string, unknown>;
}) => ({
  id: params.id,
  name: params.name,
  size_in_bytes: 128,
  expired: false,
  digest: params.digest,
  created_at: params.createdAt,
  updated_at: params.createdAt,
  url:
    'https://api.github.com/repos/' +
    REPOSITORY +
    '/actions/artifacts/' +
    String(params.id),
  archive_download_url:
    'https://api.github.com/repos/' +
    REPOSITORY +
    '/actions/artifacts/' +
    String(params.id) +
    '/zip',
  workflow_run: params.workflowRun,
});

const candidateRunRef = (patch: Record<string, unknown> = {}) => ({
  id: Number(STAGING_RUN_ID),
  repository_id: 77,
  head_repository_id: 77,
  head_branch: 'main',
  head_sha: SOURCE_SHA,
  ...patch,
});

const intakeRunRef = (patch: Record<string, unknown> = {}) => ({
  id: Number(MANUAL_RUN_ID),
  repository_id: 77,
  head_repository_id: 77,
  head_branch: 'main',
  head_sha: INTAKE_SHA,
  ...patch,
});

const candidateArtifact = (patch: Record<string, unknown> = {}) => ({
  ...artifact({
    id: CANDIDATE_ARTIFACT_ID,
    name: AC266_STAGING_CANDIDATE_ARTIFACT_NAME,
    digest: CANDIDATE_DIGEST,
    createdAt: '2026-09-13T09:50:00.000Z',
    workflowRun: candidateRunRef(),
  }),
  ...patch,
});

const intakeArtifact = (patch: Record<string, unknown> = {}) => ({
  ...artifact({
    id: INTAKE_ARTIFACT_ID,
    name: AC266_MANUAL_INTAKE_ARTIFACT_NAME,
    digest: INTAKE_DIGEST,
    createdAt: '2026-09-13T12:05:00.000Z',
    workflowRun: intakeRunRef(),
  }),
  ...patch,
});

interface MockApi {
  readonly stagingRun?: Record<string, unknown>;
  readonly stagingArtifacts?: readonly unknown[];
  readonly intakeRun?: Record<string, unknown>;
  readonly intakeArtifacts?: readonly unknown[];
}

const artifactsEnvelope = (artifacts: readonly unknown[]) => ({
  total_count: artifacts.length,
  artifacts: [...artifacts],
});

const createMockFetch = (api: MockApi = {}) =>
  vi.fn<typeof fetch>(async (input) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (url.origin !== 'https://api.github.com')
      return response({ message: 'unexpected origin' }, 404);
    if (url.pathname === API_PREFIX + '/actions/runs/' + STAGING_RUN_ID)
      return response(api.stagingRun ?? stagingRun());
    if (
      url.pathname ===
      API_PREFIX + '/actions/runs/' + STAGING_RUN_ID + '/artifacts'
    )
      return response(
        artifactsEnvelope(api.stagingArtifacts ?? [candidateArtifact()]),
      );
    if (url.pathname === API_PREFIX + '/actions/runs/' + MANUAL_RUN_ID)
      return response(api.intakeRun ?? intakeRun());
    if (
      url.pathname ===
      API_PREFIX + '/actions/runs/' + MANUAL_RUN_ID + '/artifacts'
    )
      return response(
        artifactsEnvelope(api.intakeArtifacts ?? [intakeArtifact()]),
      );
    return response({ message: 'unexpected mocked API path' }, 404);
  });

let runnerTemp: string;
let outputIndex = 0;

beforeEach(() => {
  runnerTemp = mkdtempSync(join(tmpdir(), 'ac266-artifact-resolution-'));
  outputIndex = 0;
});

afterEach(() => {
  rmSync(runnerTemp, { recursive: true, force: true });
});

const environmentFor = (): Record<string, string | undefined> => {
  const outputPath = join(runnerTemp, 'resolution-output-' + outputIndex++);
  writeFileSync(outputPath, '');
  return {
    GITHUB_OUTPUT: outputPath,
    GITHUB_REPOSITORY: REPOSITORY,
    GITHUB_TOKEN: TOKEN,
    AC266_SOURCE_SHA: SOURCE_SHA,
    AC266_STAGING_RUN_ID: STAGING_RUN_ID,
    AC266_STAGING_DEPLOYMENT_ID: DEPLOYMENT_ID,
    AC266_MANUAL_REPORT_RUN_ID: MANUAL_RUN_ID,
  };
};

describe('AC266 manual accessibility exact artifact resolution', () => {
  it('resolves the exact staging candidate and manual intake artifact IDs through the authenticated API', async () => {
    const api = createMockFetch();
    const env = environmentFor();
    const messages: string[] = [];

    const resolution = await runAc266ManualAccessibilityArtifactResolution({
      env,
      fetchImpl: api,
      now: () => CUTOFF,
      logger: { log: (message: string) => messages.push(message) },
    });

    expect(resolution).toEqual({
      stagingArtifactId: CANDIDATE_ARTIFACT_ID,
      intakeArtifactId: INTAKE_ARTIFACT_ID,
    });
    expect(readFileSync(env.GITHUB_OUTPUT!, 'utf8')).toBe(
      'staging_artifact_id=' +
        CANDIDATE_ARTIFACT_ID +
        '\nintake_artifact_id=' +
        INTAKE_ARTIFACT_ID +
        '\n',
    );
    expect(api.mock.calls.length).toBeGreaterThan(0);
    for (const [input, init] of api.mock.calls) {
      const url = new URL(
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      expect(url.origin).toBe('https://api.github.com');
      expect(new Headers(init?.headers).get('authorization')).toBe(
        'Bearer ' + TOKEN,
      );
    }
    expect(messages).toHaveLength(1);
    expect(JSON.parse(messages[0]!)).toEqual({
      event: 'ac266_manual_accessibility_artifact_ids_resolved',
      sourceRevision: SOURCE_SHA,
      stagingRunId: STAGING_RUN_ID,
      stagingDeploymentId: DEPLOYMENT_ID,
      manualRunId: MANUAL_RUN_ID,
    });
    const output = messages.join('\n');
    expect(output).not.toContain(TOKEN);
    expect(output).not.toMatch(/sha256:/u);
  });

  it('fails closed on ambiguous, mismatched, or unverifiable artifact identities', async () => {
    for (const api of [
      createMockFetch({
        stagingArtifacts: [
          candidateArtifact(),
          candidateArtifact({ id: 4599 }),
        ],
      }),
      createMockFetch({ stagingArtifacts: [] }),
      createMockFetch({ stagingArtifacts: [intakeArtifact()] }),
      createMockFetch({
        intakeArtifacts: [intakeArtifact(), intakeArtifact({ id: 5599 })],
      }),
      createMockFetch({ intakeArtifacts: [] }),
      createMockFetch({
        stagingArtifacts: [candidateArtifact({ expired: true })],
      }),
      createMockFetch({
        intakeArtifacts: [intakeArtifact({ expired: true })],
      }),
      createMockFetch({
        stagingArtifacts: [candidateArtifact({ digest: 'e'.repeat(64) })],
      }),
      createMockFetch({
        stagingArtifacts: [candidateArtifact({ digest: 'sha256:abc' })],
      }),
      createMockFetch({
        stagingArtifacts: [
          candidateArtifact({ digest: 'sha256:' + 'E'.repeat(64) }),
        ],
      }),
      createMockFetch({
        stagingArtifacts: [
          candidateArtifact({ workflow_run: candidateRunRef({ id: 999 }) }),
        ],
      }),
      createMockFetch({
        stagingArtifacts: [
          candidateArtifact({
            workflow_run: candidateRunRef({ head_sha: INTAKE_SHA }),
          }),
        ],
      }),
      createMockFetch({
        stagingArtifacts: [
          candidateArtifact({
            workflow_run: candidateRunRef({ head_branch: 'develop' }),
          }),
        ],
      }),
      createMockFetch({
        stagingArtifacts: [
          candidateArtifact({
            workflow_run: candidateRunRef({ repository_id: 78 }),
          }),
        ],
      }),
      createMockFetch({
        stagingArtifacts: [
          candidateArtifact({ url: 'https://evil.example.com/artifact' }),
        ],
      }),
      createMockFetch({
        stagingArtifacts: [
          candidateArtifact({
            archive_download_url: 'https://evil.example.com/artifact.zip',
          }),
        ],
      }),
      createMockFetch({
        stagingArtifacts: [
          candidateArtifact({ created_at: '2026-09-13T11:00:00.000Z' }),
        ],
      }),
      createMockFetch({
        intakeArtifacts: [
          intakeArtifact({ workflow_run: intakeRunRef({ id: 999 }) }),
        ],
      }),
      createMockFetch({
        stagingRun: stagingRun({
          path: '.github/workflows/other-staging.yml',
        }),
      }),
      createMockFetch({ stagingRun: stagingRun({ event: 'push' }) }),
      createMockFetch({ stagingRun: stagingRun({ conclusion: 'failure' }) }),
      createMockFetch({ stagingRun: stagingRun({ head_branch: 'develop' }) }),
      createMockFetch({ stagingRun: stagingRun({ head_sha: INTAKE_SHA }) }),
      createMockFetch({ stagingRun: stagingRun({ run_attempt: 0 }) }),
      createMockFetch({
        stagingRun: stagingRun({
          repository: { id: 77, full_name: 'WeJustJammin/other' },
        }),
      }),
      createMockFetch({
        stagingRun: stagingRun({ updated_at: '2026-09-13T14:00:00.000Z' }),
      }),
      createMockFetch({
        intakeRun: intakeRun({
          path: '.github/workflows/other-intake.yml',
        }),
      }),
      createMockFetch({ intakeRun: intakeRun({ event: 'push' }) }),
      createMockFetch({
        intakeRun: intakeRun({
          head_repository: { id: 77, full_name: 'WeJustJammin/other' },
        }),
      }),
    ]) {
      await expect(
        runAc266ManualAccessibilityArtifactResolution({
          env: environmentFor(),
          fetchImpl: api,
          now: () => CUTOFF,
        }),
      ).rejects.toThrow();
    }
  });

  it('rejects non-canonical identities before any GitHub access', async () => {
    const invalidInputs: readonly (readonly [string, string | undefined])[] = [
      ['AC266_SOURCE_SHA', SOURCE_SHA.toUpperCase()],
      ['AC266_SOURCE_SHA', SOURCE_SHA.slice(0, 39)],
      ['AC266_STAGING_RUN_ID', '0'],
      ['AC266_STAGING_RUN_ID', ' ' + STAGING_RUN_ID],
      ['AC266_STAGING_RUN_ID', 'not-a-run'],
      ['AC266_STAGING_DEPLOYMENT_ID', ''],
      ['AC266_STAGING_DEPLOYMENT_ID', '1e3'],
      ['AC266_MANUAL_REPORT_RUN_ID', '-1'],
      ['GITHUB_REPOSITORY', 'wejammin'],
      ['GITHUB_REPOSITORY', 'WeJustJammin/../wejammin'],
      ['GITHUB_TOKEN', ''],
    ];
    for (const [key, value] of invalidInputs) {
      const api = createMockFetch();
      await expect(
        runAc266ManualAccessibilityArtifactResolution({
          env: { ...environmentFor(), [key]: value },
          fetchImpl: api,
          now: () => CUTOFF,
        }),
      ).rejects.toThrow();
      expect(api.mock.calls).toHaveLength(0);
    }
  });

  it('rejects a GITHUB_OUTPUT that is not a canonical regular file before any GitHub access', async () => {
    const canonical = join(runnerTemp, 'canonical-output');
    writeFileSync(canonical, '');
    const linked = join(runnerTemp, 'linked-output');
    symlinkSync(canonical, linked);
    const directory = join(runnerTemp, 'output-directory');
    mkdirSync(directory);

    for (const outputPath of [
      undefined,
      '',
      'relative-output',
      linked,
      directory,
    ]) {
      const api = createMockFetch();
      await expect(
        runAc266ManualAccessibilityArtifactResolution({
          env: { ...environmentFor(), GITHUB_OUTPUT: outputPath },
          fetchImpl: api,
          now: () => CUTOFF,
        }),
      ).rejects.toThrow();
      expect(api.mock.calls).toHaveLength(0);
    }
  });
});

describe('AC266 manual accessibility collector artifact wiring', () => {
  it('resolves both artifact IDs before download and never selects an artifact by name', () => {
    const resolution = namedStep(
      executableWorkflow,
      'Resolve exact staging candidate and intake artifact IDs',
    );
    expect(resolution).toMatch(/^ {8}id: resolve$/mu);
    expect(resolution).toMatch(/^ {8}shell: bash$/mu);
    expect(resolution).toContain(
      'node --experimental-strip-types infra/workflows/resolve-ac266-manual-accessibility-artifacts.ts',
    );
    for (const mapping of [
      'AC266_SOURCE_SHA: ${{ inputs.source_sha }}',
      'AC266_STAGING_RUN_ID: ${{ inputs.staging_run_id }}',
      'AC266_STAGING_DEPLOYMENT_ID: ${{ inputs.staging_deployment_id }}',
      'AC266_MANUAL_REPORT_RUN_ID: ${{ inputs.manual_report_run_id }}',
      'GITHUB_REPOSITORY: ${{ github.repository }}',
      'GITHUB_TOKEN: ${{ github.token }}',
    ])
      expect(resolution, mapping).toContain(mapping);
    expect(resolution).not.toMatch(/\$\{\{\s*(?:secrets|vars)\./u);

    const candidateDownload = namedStep(
      executableWorkflow,
      'Download the requested staging candidate',
    );
    const intakeDownload = namedStep(
      executableWorkflow,
      'Download the sanitized manual intake manifest',
    );
    expect(candidateDownload).toContain(
      'artifact-ids: ${{ steps.resolve.outputs.staging_artifact_id }}',
    );
    expect(intakeDownload).toContain(
      'artifact-ids: ${{ steps.resolve.outputs.intake_artifact_id }}',
    );
    for (const download of [candidateDownload, intakeDownload]) {
      expect(download).toMatch(/^ {10}digest-mismatch: error$/mu);
      expect(download).not.toMatch(/^ {10}name:/mu);
      expect(download).toContain('repository: ${{ github.repository }}');
      expect(download).toContain('github-token: ${{ github.token }}');
    }
    expect(candidateDownload).toContain('run-id: ${{ inputs.staging_run_id }}');
    expect(intakeDownload).toContain(
      'run-id: ${{ inputs.manual_report_run_id }}',
    );
    expect(candidateDownload).toContain('path: candidate');
    expect(intakeDownload).toContain('path: manual-intake');

    const resolutionIndex = executableWorkflow.indexOf(resolution);
    expect(resolutionIndex).toBeGreaterThanOrEqual(0);
    expect(resolutionIndex).toBeLessThan(
      executableWorkflow.indexOf(candidateDownload),
    );
    expect(resolutionIndex).toBeLessThan(
      executableWorkflow.indexOf(intakeDownload),
    );

    expect(executableWorkflow).not.toContain('staging-verified-candidate');
    expect(executableWorkflow).not.toContain(
      'ac266-manual-accessibility-intake',
    );
  });
});
