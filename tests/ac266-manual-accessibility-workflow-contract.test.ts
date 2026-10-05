import { describe, expect, it } from 'vitest';

import {
  artifactDownload,
  executableReportMaterializer,
  executableStagingWorkflow,
  executableWorkflow,
  expectCleanupGuard,
  header,
  jobConfigurationBeforeSteps,
  namedStep,
  requiredStringInput,
  retentionDays,
  stagingCandidateProducer,
  uploadSteps,
} from './ac266-manual-accessibility-workflow-contract-helpers.ts';

describe('AC266 manual accessibility finalizer workflow contract', () => {
  it('uses a GitHub-hosted runner and sets up the pinned workspace before report secrets', () => {
    const runnerConfiguration = jobConfigurationBeforeSteps(executableWorkflow);
    expect(runnerConfiguration).toMatch(/^\s{4}runs-on:\s*ubuntu-24\.04\s*$/mu);
    expect(runnerConfiguration).not.toMatch(/\b(?:self-hosted|wejammin)\b/iu);

    const checkoutStep = namedStep(
      executableWorkflow,
      'Check out the protected finalizer revision',
    );
    const setupStep = namedStep(
      executableWorkflow,
      'Set up pinned workspace dependencies',
    );
    expect(checkoutStep).toContain('ref: ${{ github.sha }}');
    expect(checkoutStep).toContain('persist-credentials: false');
    expect(setupStep).toMatch(
      /^\s{8}uses:\s*\.\/\.github\/actions\/setup\s*$/mu,
    );
    const checkoutIndex = executableWorkflow.indexOf(checkoutStep);
    const setupIndex = executableWorkflow.indexOf(setupStep);
    const secretIndexes = [
      executableWorkflow.indexOf(
        '${{ secrets.AC266_VOICEOVER_REPORT_BASE64 }}',
      ),
      executableWorkflow.indexOf('${{ secrets.AC266_NVDA_REPORT_BASE64 }}'),
    ];
    expect(setupIndex).toBeGreaterThan(checkoutIndex);
    expect(secretIndexes.every((index) => index > setupIndex)).toBe(true);
  });

  it('keeps collection main-only and binds the candidate artifact to its source run attempt', () => {
    expect(executableWorkflow).toMatch(
      /^\s{4}if:\s*github\.ref == 'refs\/heads\/main'\s*$/mu,
    );
    const candidateDownload = artifactDownload(
      executableWorkflow,
      'staging-verified-candidate',
    );
    expect(candidateDownload).toBe('');
    const candidateStep = namedStep(
      executableWorkflow,
      'Download the requested staging candidate',
    );
    expect(candidateStep).toContain('path: candidate');
    expect(candidateStep).not.toContain('merge-multiple');
    expect(candidateStep).not.toMatch(/^ {10}name:/mu);
    expect(candidateStep).toContain(
      'artifact-ids: ${{ steps.resolve.outputs.staging_artifact_id }}',
    );
    expect(candidateStep).toMatch(/^ {10}digest-mismatch: error$/mu);
    expect(stagingCandidateProducer).toContain('GITHUB_REPOSITORY');
    expect(stagingCandidateProducer).toContain('GITHUB_RUN_ID');
    expect(stagingCandidateProducer).toContain('GITHUB_RUN_ATTEMPT');
    expect(stagingCandidateProducer).toContain(
      'promotion-candidate/staging-run-identity.json',
    );
    expect(stagingCandidateProducer).toContain(
      '"schemaVersion":"ac266-staging-run-identity-v1"',
    );
    expect(stagingCandidateProducer).toContain(
      '"workflowPath":".github/workflows/deploy-staging.yml"',
    );
    expect(stagingCandidateProducer).toContain(
      '"runId":"%s","runAttempt":"%s","headSha":"%s"',
    );
    expect(executableStagingWorkflow).toContain(
      'name: staging-verified-candidate',
    );
    expect(executableStagingWorkflow).toContain('path: promotion-candidate');
  });

  it('is manual-only and requires exact staging and report-run identities', () => {
    const workflowHeader = header(executableWorkflow);
    expect(workflowHeader).toMatch(/^\s{2}workflow_dispatch:\s*$/mu);
    expect(workflowHeader).not.toMatch(
      /^\s{2}(?:push|pull_request|pull_request_target|workflow_run|schedule|release):/mu,
    );

    for (const input of [
      'staging_run_id',
      'source_sha',
      'staging_deployment_id',
      'manual_report_run_id',
    ])
      expect(requiredStringInput(workflowHeader, input), input).toBe(true);

    expect(executableWorkflow).toMatch(
      /environment:\s*(?:\{[^\n}]*name:\s*ac266-manual-evidence|\n\s+name:\s*ac266-manual-evidence)/u,
    );
    expect(executableWorkflow).not.toMatch(
      /environment:\s*(?:\{[^\n}]*name:\s*\$\{\{|\n\s+name:\s*\$\{\{)/u,
    );
    expect(executableWorkflow).toContain('vars.STAGING_WEB_ORIGIN');
    expect(executableWorkflow).not.toContain('inputs.staging_web_origin');
  });

  it('grants only the read permissions needed for artifact and deployment verification', () => {
    expect(executableWorkflow).toContain(
      'permissions: { actions: read, contents: read, deployments: read }',
    );
    expect(executableWorkflow).not.toMatch(
      /^\s*(?:actions|contents|deployments|id-token):\s*write\s*$/mu,
    );
    expect(executableWorkflow).toContain('GITHUB_TOKEN: ${{ github.token }}');
    expect(executableWorkflow).toContain(
      'GITHUB_REPOSITORY: ${{ github.repository }}',
    );
  });

  it('downloads the candidate and sanitized intake manifest from distinct approved run IDs', () => {
    const candidateStep = namedStep(
      executableWorkflow,
      'Download the requested staging candidate',
    );
    expect(candidateStep).toMatch(
      /actions\/download-artifact@(?:[0-9a-f]{40}|v\d+)/u,
    );
    expect(candidateStep).toContain('run-id: ${{ inputs.staging_run_id }}');
    expect(candidateStep).toContain('repository: ${{ github.repository }}');
    expect(candidateStep).toContain('github-token: ${{ github.token }}');
    expect(candidateStep).toContain(
      'artifact-ids: ${{ steps.resolve.outputs.staging_artifact_id }}',
    );

    const reportStep = namedStep(
      executableWorkflow,
      'Download the sanitized manual intake manifest',
    );
    expect(reportStep).toMatch(
      /actions\/download-artifact@(?:[0-9a-f]{40}|v\d+)/u,
    );
    expect(reportStep).toContain('run-id: ${{ inputs.manual_report_run_id }}');
    expect(reportStep).toContain('repository: ${{ github.repository }}');
    expect(reportStep).toContain('github-token: ${{ github.token }}');
    expect(reportStep).toContain(
      'artifact-ids: ${{ steps.resolve.outputs.intake_artifact_id }}',
    );

    expect(executableReportMaterializer).toContain(
      'manual/voiceover-safari.json',
    );
    expect(executableReportMaterializer).toContain('manual/nvda-firefox.json');
    expect(executableWorkflow).toContain(
      'AC266_MANUAL_INTAKE_MANIFEST_PATH: manual-intake/intake-manifest.json',
    );
    expect(executableReportMaterializer).toContain(
      '.github/workflows/intake-ac266-manual-accessibility-reports.yml',
    );
  });

  it('passes independent release identity to the strict verifier before any upload', () => {
    expect(executableWorkflow).toMatch(
      /DEPLOY_SHA:\s*\$\{\{\s*inputs\.source_sha\s*\}\}/u,
    );
    expect(executableWorkflow).toMatch(
      /STAGING_RUN_ID:\s*\$\{\{\s*inputs\.staging_run_id\s*\}\}/u,
    );
    expect(executableWorkflow).toMatch(
      /STAGING_DEPLOYMENT_ID:\s*\$\{\{\s*inputs\.staging_deployment_id\s*\}\}/u,
    );
    expect(executableWorkflow).toMatch(
      /MANUAL_REPORT_RUN_ID:\s*\$\{\{\s*inputs\.manual_report_run_id\s*\}\}/u,
    );
    expect(executableWorkflow).toMatch(
      /STAGING_WEB_ORIGIN:\s*\$\{\{\s*vars\.STAGING_WEB_ORIGIN\s*\}\}/u,
    );

    const verifierCommand =
      'node --experimental-strip-types infra/workflows/verify-ac266-manual-accessibility-evidence.ts';
    const verifierIndex = executableWorkflow.indexOf(verifierCommand);
    const uploadIndex = executableWorkflow.indexOf(
      'uses: actions/upload-artifact@',
    );
    expect(verifierIndex).toBeGreaterThanOrEqual(0);
    expect(uploadIndex).toBeGreaterThan(verifierIndex);
    expect(executableWorkflow).toContain('AC266_MANUAL_CANDIDATE_PATH');
    expect(executableWorkflow).toContain('AC266_MANUAL_INTAKE_MANIFEST_PATH');
    expect(executableWorkflow).toContain('AC266_PRIVATE_EVIDENCE_DIR');
    expect(executableWorkflow).toContain('AC266_VOICEOVER_REPORT_BASE64');
    expect(executableWorkflow).toContain('AC266_NVDA_REPORT_BASE64');
    expect(executableReportMaterializer).toContain(
      '.github/workflows/intake-ac266-manual-accessibility-reports.yml',
    );

    const cleanupIndex = executableWorkflow.indexOf(
      'rm -rf -- "$AC266_PRIVATE_EVIDENCE_DIR"',
    );
    expect(cleanupIndex).toBeGreaterThan(verifierIndex);
    expect(cleanupIndex).toBeLessThan(uploadIndex);
    expect(
      namedStep(
        executableWorkflow,
        'Remove private raw reports before evidence upload',
      ),
    ).toMatch(/if:\s*(?:\$\{\{\s*)?always\(\)/u);
    expectCleanupGuard(executableWorkflow, cleanupIndex);
  });

  it('uploads only a minimized verification manifest after cleaning private reports', () => {
    const uploads = uploadSteps(executableWorkflow);
    expect(uploads).toHaveLength(1);
    for (const upload of uploads) {
      expect(upload).toContain('name: ac266-manual-accessibility-evidence');
      expect(upload).toContain(
        'path: ac266-manual-evidence/verification-manifest.json',
      );
      expect(upload).toContain('if-no-files-found: error');
      expect(upload).not.toMatch(/^\s*if:.*always\(\)/mu);
      expect(upload).not.toContain('staging-verified-candidate');
      expect(upload).not.toContain('candidate/');
      expect(upload).not.toContain('manual/voiceover-safari.json');
      expect(upload).not.toContain('manual/nvda-firefox.json');
      expect(upload).not.toContain('manual/intake-manifest.json');
    }

    const retention = retentionDays(executableWorkflow);
    expect(retention.length).toBeGreaterThan(0);
    expect(retention.every((days) => days >= 1 && days <= 30)).toBe(true);
  });
});
