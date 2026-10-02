import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const workflowPath = fileURLToPath(
  new URL(
    '../.github/workflows/preflight-ac265-hosted-e2e.yml',
    import.meta.url,
  ),
);
const workflow = existsSync(workflowPath)
  ? readFileSync(workflowPath, 'utf8')
  : '';
const prepareActionPath = fileURLToPath(
  new URL(
    '../.github/actions/ac265-hosted-e2e-prepare/action.yml',
    import.meta.url,
  ),
);
const preflightActionPath = fileURLToPath(
  new URL(
    '../.github/actions/ac265-hosted-e2e-preflight/action.yml',
    import.meta.url,
  ),
);
const prepareAction = existsSync(prepareActionPath)
  ? readFileSync(prepareActionPath, 'utf8')
  : '';
const preflightAction = existsSync(preflightActionPath)
  ? readFileSync(preflightActionPath, 'utf8')
  : '';
const resolverEntrypointPath = fileURLToPath(
  new URL(
    '../infra/workflows/resolve-ac265-hosted-e2e-artifacts.ts',
    import.meta.url,
  ),
);
const resolverEntrypoint = existsSync(resolverEntrypointPath)
  ? readFileSync(resolverEntrypointPath, 'utf8')
  : '';

const configLineCount = (source: string): number =>
  source.trimEnd().split(/\r?\n/u).length;

// Rendered GitHub expression, e.g. expression('inputs.source_sha') is the
// literal text the workflow YAML contains. Built from parts so this test file
// never embeds an expression that a workflow would interpolate.
const expression = (inner: string): string =>
  ['\u0024', '{', '{', ' ', inner, ' ', '}', '}'].join('');

const jobBlock = (source: string, name: string): string => {
  const headers = [...source.matchAll(/^ {2}([a-zA-Z0-9_-]+):\s*$/gmu)];
  const index = headers.findIndex((match) => match[1] === name);
  if (index === -1) return '';
  const start = headers[index]?.index ?? 0;
  const end = headers[index + 1]?.index ?? source.length;
  return source.slice(start, end);
};

const namedStep = (source: string, name: string, indent = 6): string => {
  const stepIndent = ' '.repeat(indent);
  const marker = `${stepIndent}- name: ${name}`;
  const start = source.indexOf(marker);
  if (start === -1) return '';
  // A step ends at the next list item at the same indentation, so nested
  // sequence values such as `- run: |` block lines cannot truncate it early.
  const lines = source.slice(start).split('\n');
  const end = lines.findIndex(
    (line, index) => index > 0 && line.startsWith(`${stepIndent}- `),
  );
  return (end === -1 ? lines : lines.slice(0, end)).join('\n');
};

const inputBlock = (source: string, name: string): string => {
  const marker = `      ${name}:`;
  const start = source.indexOf(marker);
  if (start === -1) return '';
  const remainder = source.slice(start).split('\n');
  const next = remainder
    .slice(1)
    .findIndex((line) => /^ {6}[a-zA-Z0-9_-]+:\s*$/u.test(line));
  return remainder.slice(0, next === -1 ? undefined : next + 1).join('\n');
};

describe('AC265 hosted E2E preflight workflow contract', () => {
  it('is explicitly preflight-only and omits hosted execution surfaces', () => {
    const workflowHeader = workflow.slice(0, workflow.indexOf('\njobs:'));
    const jobs = workflow.slice(workflow.indexOf('\njobs:'));
    const jobNames = [...jobs.matchAll(/^\x20{2}([a-zA-Z0-9_-]+):\s*$/gmu)].map(
      (match) => match[1],
    );
    const preflightSources = `${workflow}\n${prepareAction}\n${preflightAction}`;

    expect(workflow).toContain('name: Preflight AC265 hosted E2E candidate');
    expect(jobNames).toEqual(['preflight']);
    expect(workflow).not.toMatch(/^\x20{2}execute:\s*$/mu);
    expect(workflow).not.toMatch(/^\s+id-token:\s*write\s*$/mu);
    expect(`${prepareAction}\n${preflightAction}`).not.toMatch(
      /\$\{\{\s*secrets\./u,
    );
    for (const serviceVariable of [
      'AC265_SESSION_BROKER_ORIGIN',
      'AC265_EVIDENCE_SERVICE_ORIGIN',
      'AC265_FAULT_CONTROL_PLANE_ORIGIN',
      'AC265_WORKLOAD_IDENTITY_AUDIENCE',
    ])
      expect(preflightSources).not.toContain(serviceVariable);
    expect(preflightSources).not.toContain(
      'infra/workflows/collect-ac265-hosted-e2e.ts',
    );
    expect(preflightSources).not.toContain('ac265_prepare_hosted_run');
    expect(preflightSources).not.toContain(
      './.github/actions/ac265-hosted-e2e-execution',
    );
    expect(preflightSources).not.toMatch(/hosted-e2e-report-v3/iu);
    expect(`${workflowHeader}\n${preflightSources}`).not.toMatch(
      /acceptance|accepted|collection/iu,
    );
  });

  it('keeps the workflow and each local action within the 100-line config limit', () => {
    for (const [path, source] of [
      [workflowPath, workflow],
      [prepareActionPath, prepareAction],
      [preflightActionPath, preflightAction],
    ]) {
      expect(source, path).not.toBe('');
      expect(configLineCount(source), path).toBeLessThanOrEqual(100);
    }
  });

  it('keeps the artifact resolver entrypoint bounded and credential-scoped', () => {
    expect(resolverEntrypoint).not.toBe('');
    // The resolver mirrors the collector's canonical-path guards, so it is
    // bounded above the generic utility limit while staying a single unit.
    expect(configLineCount(resolverEntrypoint)).toBeLessThanOrEqual(160);
    expect(resolverEntrypoint).toContain(
      'AC265 hosted E2E artifact resolution failed',
    );
    expect(resolverEntrypoint).not.toMatch(/\$\{\{\s*(?:secrets|vars)\./u);
  });

  it('binds the downloaded artifacts to the exact verified artifact IDs', () => {
    const resolution = namedStep(
      prepareAction,
      'Resolve the exact verified artifact IDs',
      4,
    );
    expect(resolution).not.toBe('');
    expect(resolution).toContain(
      'node --experimental-strip-types infra/workflows/resolve-ac265-hosted-e2e-artifacts.ts',
    );
    expect(resolution).toMatch(/^ {6}id: resolve$/mu);
    expect(resolution).toMatch(/^ {6}shell: bash$/mu);
    for (const mapping of [
      'AC265_SOURCE_SHA: ' + expression('inputs.source_sha'),
      'AC265_STAGING_RUN_ID: ' + expression('inputs.staging_run_id'),
      'AC265_STAGING_RUN_ATTEMPT: ' + expression('inputs.staging_run_attempt'),
      'AC265_CI_RUN_ID: ' + expression('inputs.ci_run_id'),
      'AC265_CI_RUN_ATTEMPT: ' + expression('inputs.ci_run_attempt'),
      'AC265_STAGING_DEPLOYMENT_ID: ' +
        expression('inputs.staging_deployment_id'),
      'STAGING_WEB_ORIGIN: ' + expression('inputs.staging_web_origin'),
      'STAGING_API_ORIGIN: ' + expression('inputs.staging_api_origin'),
      'GITHUB_REPOSITORY: ' + expression('github.repository'),
      'GITHUB_TOKEN: ' + expression('github.token'),
    ])
      expect(resolution, mapping).toContain(mapping);
    expect(resolution).not.toMatch(/\$\{\{\s*(?:secrets|vars)\./u);

    const workspaceSetup = namedStep(
      prepareAction,
      'Set up pinned workspace dependencies',
      4,
    );
    const stagingDownload = namedStep(
      prepareAction,
      'Download the staging-verified candidate',
      4,
    );
    const ciDownload = namedStep(
      prepareAction,
      'Download the exact CI build',
      4,
    );
    expect(stagingDownload).toContain(
      'artifact-ids: ' +
        expression('steps.resolve.outputs.staging_artifact_id'),
    );
    expect(ciDownload).toContain(
      'artifact-ids: ' + expression('steps.resolve.outputs.ci_artifact_id'),
    );
    for (const download of [stagingDownload, ciDownload]) {
      expect(download).toMatch(/^ {8}digest-mismatch: error$/mu);
      expect(download).not.toMatch(/^ {8}name:/mu);
      expect(download).toContain(
        'repository: ' + expression('github.repository'),
      );
      expect(download).toContain('github-token: ' + expression('github.token'));
    }

    expect(prepareAction.indexOf(workspaceSetup)).toBeLessThan(
      prepareAction.indexOf(resolution),
    );
    expect(prepareAction.indexOf(resolution)).toBeLessThan(
      prepareAction.indexOf(stagingDownload),
    );
    expect(prepareAction.indexOf(resolution)).toBeLessThan(
      prepareAction.indexOf(ciDownload),
    );
    expect(prepareAction).toContain('ci_artifact_id:');
    expect(prepareAction).toContain(
      'value: ' + expression('steps.resolve.outputs.ci_artifact_id'),
    );
    expect(prepareAction).toContain('staging_artifact_id:');
    expect(prepareAction).toContain(
      'value: ' + expression('steps.resolve.outputs.staging_artifact_id'),
    );

    const preparation = namedStep(
      preflightAction,
      'Prepare exact staging and CI artifacts',
      4,
    );
    expect(preparation).toMatch(/^ {6}id: prepare$/mu);
    for (const mapping of [
      'staging_run_id: ' + expression('inputs.staging_run_id'),
      'staging_run_attempt: ' + expression('inputs.staging_run_attempt'),
      'ci_run_id: ' + expression('inputs.ci_run_id'),
      'ci_run_attempt: ' + expression('inputs.ci_run_attempt'),
      'staging_deployment_id: ' + expression('inputs.staging_deployment_id'),
      'staging_web_origin: ' + expression('inputs.staging_web_origin'),
      'staging_api_origin: ' + expression('inputs.staging_api_origin'),
    ])
      expect(preparation, mapping).toContain(mapping);

    const verifier = namedStep(
      preflightAction,
      'Verify exact staging and CI candidate provenance',
      4,
    );
    for (const mapping of [
      'AC265_DOWNLOADED_CI_ARTIFACT_ID: ' +
        expression('steps.prepare.outputs.ci_artifact_id'),
      'AC265_DOWNLOADED_STAGING_ARTIFACT_ID: ' +
        expression('steps.prepare.outputs.staging_artifact_id'),
    ])
      expect(verifier, mapping).toContain(mapping);
  });

  it('is manual-only and requires exactly six staging and CI candidate selectors', () => {
    expect(workflow).not.toBe('');
    const workflowHeader = workflow.slice(0, workflow.indexOf('\njobs:'));
    expect(workflowHeader).toMatch(/^on:\n {2}workflow_dispatch:\s*$/mu);
    expect(workflowHeader).not.toMatch(
      /^ {2}(?:push|pull_request|pull_request_target|workflow_run|schedule|release):/mu,
    );

    expect(
      [...workflowHeader.matchAll(/^\x20{6}([a-zA-Z0-9_-]+):\s*$/gmu)].map(
        (match) => match[1],
      ),
    ).toEqual([
      'source_sha',
      'staging_run_id',
      'staging_run_attempt',
      'ci_run_id',
      'ci_run_attempt',
      'staging_deployment_id',
    ]);

    for (const input of [
      'source_sha',
      'staging_run_id',
      'staging_run_attempt',
      'ci_run_id',
      'ci_run_attempt',
      'staging_deployment_id',
    ]) {
      const definition = inputBlock(workflowHeader, input);
      expect(definition, input).not.toBe('');
      expect(definition, input).toMatch(/^ {8}required: true$/mu);
      expect(definition, input).toMatch(/^ {8}type: string$/mu);
    }

    expect(workflowHeader).toContain(
      'group: ac265-hosted-e2e-${{ github.ref }}',
    );
    expect(workflowHeader).toContain('cancel-in-progress: false');
    expect(workflow).toContain(
      'permissions: { actions: read, contents: read, deployments: read }',
    );
  });

  it('preflights the exact candidate on an isolated hosted runner in protected staging', () => {
    const preflight = jobBlock(workflow, 'preflight');
    expect(preflight).not.toBe('');
    expect(preflight).toContain("if: github.ref == 'refs/heads/main'");
    expect(preflight).toMatch(/^ {4}runs-on:\s*ubuntu-24\.04\s*$/mu);
    const timeout = Number(
      preflight.match(/^ {4}timeout-minutes:\s*(\d+)\s*$/mu)?.[1],
    );
    expect(timeout).toBeGreaterThan(0);
    expect(timeout).toBeLessThanOrEqual(20);
    expect(preflight).toMatch(/^ {4}environment:\s*$/mu);
    expect(preflight).toMatch(/^ {6}name:\s*staging\s*$/mu);
    expect(preflight).toContain(
      'candidate_ref: ${{ steps.enroll.outputs.candidate_ref }}',
    );
    expect(preflight).not.toMatch(/^\s+id-token:\s*write\s*$/mu);
    expect(preflight).not.toMatch(/\b(?:self-hosted|wejammin)\b/iu);

    const preflightInvocation = namedStep(
      preflight,
      'Verify exact staging and CI candidate provenance',
    );
    expect(preflightInvocation).toContain(
      'uses: ./.github/actions/ac265-hosted-e2e-preflight',
    );
    expect(preflightInvocation).not.toMatch(/uses: [^\n]+@/u);
    for (const mapping of [
      'source_sha: ${{ inputs.source_sha }}',
      'staging_run_id: ${{ inputs.staging_run_id }}',
      'staging_run_attempt: ${{ inputs.staging_run_attempt }}',
      'ci_run_id: ${{ inputs.ci_run_id }}',
      'ci_run_attempt: ${{ inputs.ci_run_attempt }}',
      'staging_deployment_id: ${{ inputs.staging_deployment_id }}',
    ])
      expect(preflightInvocation).toContain(mapping);
    for (const protectedValue of [
      'staging_web_origin: ${{ vars.STAGING_WEB_ORIGIN }}',
      'staging_api_origin: ${{ vars.STAGING_API_ORIGIN }}',
      'hosting_account_id: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}',
      'supabase_project_ref: ${{ vars.SUPABASE_PROJECT_REF }}',
      'supabase_origin: ${{ vars.SUPABASE_URL }}',
    ])
      expect(preflightInvocation).toContain(protectedValue);

    const preflightActionPreparation = namedStep(
      preflightAction,
      'Prepare exact staging and CI artifacts',
      4,
    );
    expect(preflightActionPreparation).toContain(
      'uses: ./.github/actions/ac265-hosted-e2e-prepare',
    );
    expect(preflightAction).not.toMatch(/\$\{\{\s*(?:secrets|vars)\./u);

    const checkout = namedStep(
      preflight,
      'Check out the approved workflow revision',
    );
    expect(checkout).toMatch(
      /uses: actions\/checkout@[0-9a-f]{40}(?:\s+# v\d+)?/u,
    );
    expect(checkout).toContain('ref: ${{ github.sha }}');
    expect(checkout).toContain('persist-credentials: false');
    expect(preflight.indexOf(checkout)).toBeLessThan(
      preflight.indexOf(preflightInvocation),
    );
    const workspaceSetup = namedStep(
      prepareAction,
      'Set up pinned workspace dependencies',
      4,
    );
    expect(workspaceSetup).toContain('uses: ./.github/actions/setup');

    const stagingDownload = namedStep(
      prepareAction,
      'Download the staging-verified candidate',
      4,
    );
    expect(stagingDownload).toMatch(
      /uses: actions\/download-artifact@[0-9a-f]{40}(?:\s+# v\d+)?/u,
    );
    expect(stagingDownload).toContain(
      'artifact-ids: ${{ steps.resolve.outputs.staging_artifact_id }}',
    );
    expect(stagingDownload).toContain('path: candidate');
    expect(stagingDownload).toContain('run-id: ${{ inputs.staging_run_id }}');
    expect(stagingDownload).toContain('repository: ${{ github.repository }}');
    expect(stagingDownload).toContain('github-token: ${{ github.token }}');

    const ciDownload = namedStep(
      prepareAction,
      'Download the exact CI build',
      4,
    );
    expect(ciDownload).toMatch(
      /uses: actions\/download-artifact@[0-9a-f]{40}(?:\s+# v\d+)?/u,
    );
    expect(ciDownload).toContain(
      'artifact-ids: ${{ steps.resolve.outputs.ci_artifact_id }}',
    );
    expect(ciDownload).toContain('path: ci-build');
    expect(ciDownload).toContain('run-id: ${{ inputs.ci_run_id }}');
    expect(ciDownload).toContain('repository: ${{ github.repository }}');
    expect(ciDownload).toContain('github-token: ${{ github.token }}');

    const verifier = namedStep(
      preflightAction,
      'Verify exact staging and CI candidate provenance',
      4,
    );
    for (const mapping of [
      'AC265_SOURCE_SHA: ${{ inputs.source_sha }}',
      'AC265_STAGING_RUN_ID: ${{ inputs.staging_run_id }}',
      'AC265_STAGING_RUN_ATTEMPT: ${{ inputs.staging_run_attempt }}',
      'AC265_CI_RUN_ID: ${{ inputs.ci_run_id }}',
      'AC265_CI_RUN_ATTEMPT: ${{ inputs.ci_run_attempt }}',
      'AC265_STAGING_DEPLOYMENT_ID: ${{ inputs.staging_deployment_id }}',
      'STAGING_WEB_ORIGIN: ${{ inputs.staging_web_origin }}',
      'STAGING_API_ORIGIN: ${{ inputs.staging_api_origin }}',
      'CLOUDFLARE_ACCOUNT_ID: ${{ inputs.hosting_account_id }}',
      'SUPABASE_PROJECT_REF: ${{ inputs.supabase_project_ref }}',
      'SUPABASE_URL: ${{ inputs.supabase_origin }}',
      'GITHUB_TOKEN: ${{ github.token }}',
      'GITHUB_REPOSITORY: ${{ github.repository }}',
    ])
      expect(verifier).toContain(mapping);
    expect(verifier).toContain(
      'node --experimental-strip-types infra/workflows/collect-ac265-hosted-e2e-preflight.ts',
    );

    const registration = namedStep(
      preflight,
      'Register exact candidate in staging',
      6,
    );
    expect(registration).toContain(
      'node --experimental-strip-types infra/workflows/register-ac265-candidate-enrollment.ts',
    );
    expect(registration).toContain('SUPABASE_URL: ${{ vars.SUPABASE_URL }}');
    expect(registration).toContain(
      'SUPABASE_PROJECT_REF: ${{ vars.SUPABASE_PROJECT_REF }}',
    );
    expect(registration).toContain(
      'SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}',
    );
    expect(registration).toContain(
      'AC265_ENROLLMENT_REQUEST_PATH: ${{ steps.preflight.outputs.enrollment_request_path }}',
    );
    expect(preflightInvocation).not.toContain('SUPABASE_SECRET_KEY');
    expect(preflightAction).not.toContain('SUPABASE_SECRET_KEY');
    expect(preflight.indexOf(registration)).toBeGreaterThan(
      preflight.indexOf(preflightInvocation),
    );

    expect(preflightAction).toContain(
      'value: ${{ steps.verify.outputs.enrollment_request_path }}',
    );
    const serviceKeyLines = workflow
      .split(/\r?\n/u)
      .filter((line) => line.includes('SUPABASE_SECRET_KEY'));
    expect(serviceKeyLines).toEqual([
      '          SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}',
    ]);
  });

  it('uploads only the short-lived non-secret candidate reference for authorization handoff', () => {
    const preflight = jobBlock(workflow, 'preflight');
    const registration = namedStep(
      preflight,
      'Register exact candidate in staging',
    );
    const artifactWrite = namedStep(
      preflight,
      'Persist candidate reference artifact',
    );
    const artifactUpload = namedStep(
      preflight,
      'Upload candidate reference artifact',
    );

    expect(artifactWrite).not.toBe('');
    expect(artifactWrite).toContain(
      'AC265_CANDIDATE_REF: ${{ steps.enroll.outputs.candidate_ref }}',
    );
    expect(artifactWrite).toContain(
      'node --experimental-strip-types infra/workflows/write-ac265-candidate-ref-artifact.ts',
    );
    expect(artifactWrite).not.toMatch(/\$\{\{\s*(?:secrets|vars)\./u);
    expect(artifactWrite).not.toMatch(
      /enrollment.request|provenance|identity/iu,
    );

    expect(artifactUpload).toMatch(
      /uses: actions\/upload-artifact@[0-9a-f]{40}(?:\s+# v\d+)?/u,
    );
    expect(artifactUpload).toContain(
      'uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7',
    );
    expect(artifactUpload).toContain(
      'name: ac265-candidate-ref-${{ github.run_id }}-${{ github.run_attempt }}',
    );
    expect(artifactUpload).toContain(
      'path: ${{ runner.temp }}/ac265-candidate-ref.txt',
    );
    expect(artifactUpload).toContain('retention-days: 1');
    expect(artifactUpload).toContain('if-no-files-found: error');
    expect(artifactUpload).not.toMatch(
      /enrollment.request|provenance|identity/iu,
    );
    expect(`${artifactWrite}\n${artifactUpload}`).not.toMatch(
      /SUPABASE_SECRET_KEY|SUPABASE_URL|provenance|identity|enrollment.request/iu,
    );
    expect([
      ...preflight.matchAll(/uses: actions\/upload-artifact@/gu),
    ]).toHaveLength(1);
    expect(preflight.indexOf(registration)).toBeLessThan(
      preflight.indexOf(artifactWrite),
    );
    expect(preflight.indexOf(artifactWrite)).toBeLessThan(
      preflight.indexOf(artifactUpload),
    );
  });
});
