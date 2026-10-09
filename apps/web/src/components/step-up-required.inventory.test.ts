import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * AC1127 sweep guard. FE00 error-per-class: every browser-facing or
 * first-party-boundary mapper that reads an HTTP 401 either routes 401
 * STEP_UP_REQUIRED to `/step-up?returnTo=` or is listed here with the reason
 * the response can never be a step-up shortfall. A new 401 mapper that is in
 * neither list fails this guard, so the mapping cannot silently become partial
 * again.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));

const WORKER_READ = 'Worker policy stepUp none: a GET read, 401 means sign in';
const NO_STEP_UP_ROW =
  'BE03b/BE03c (CMS editorial and composition) list no STEP_UP_REQUIRED row';
const SSR_READ =
  'server-rendered read of an identity or context resource: 401 redirects to sign-in, no step-up policy';

const stepUpAware: readonly string[] = [
  'components/cms-editorial-workflow/cms-workflow-command-transport.ts',
  'components/content-schema-registry/content-schema-registry-runtime.ts',
  'components/content-schema-registry/content-schema-registry-step-up-classify.ts',
  'components/identity-authority/step-up-mfa/mfa-failure-view.ts',
  'components/platform-configuration/admin-mfa-reset/admin-mfa-reset-failure.ts',
  'components/profile-ownership/profile-ownership-command-transport.ts',
  'components/step-up-required.ts',
  'server/cms-workflow-platform-errors.ts',
  'server/content-schema-registry-platform-error-details.ts',
];

const exempt: Readonly<Record<string, string>> = {
  'components/cms-editorial-workflow/cms-workflow-canonical-read.ts':
    WORKER_READ,
  'components/cms-capability-grants/cms-capability-grant-client.ts':
    'list GET (stepUp none); grant mutations route step-up in cms-capability-grant-commands.ts',
  'components/cms-composition/CmsTemplateStatus.tsx': NO_STEP_UP_ROW,
  'components/cms-composition/cms-template-designer-submit.ts': NO_STEP_UP_ROW,
  'components/cms-composition/cms-template-edit-reconcile-state.ts':
    NO_STEP_UP_ROW,
  'components/cms-composition/cms-template-edit-reconcile.ts': NO_STEP_UP_ROW,
  'components/cms-editorial/cms-editorial-entry-draft-detail-transport.ts':
    NO_STEP_UP_ROW,
  'components/cms-editorial/cms-editorial-conflict-detail-transport.ts':
    NO_STEP_UP_ROW,
  'components/cms-editorial/cms-editorial-mutation-errors.ts': NO_STEP_UP_ROW,
  'components/cms-editorial/cms-editorial-restore-response.ts': NO_STEP_UP_ROW,
  'components/cms-editorial-pages/cms-editorial-page-outcome.ts':
    NO_STEP_UP_ROW,
  'components/cms-editorial-pages/load-entry-edit-page.ts': NO_STEP_UP_ROW,
  'components/content-schema-registry/content-schema-registry-canonical-read.ts':
    WORKER_READ,
  'components/content-schema-registry/content-schema-registry-runtime-dom-refetch.ts':
    WORKER_READ,
  'components/identity-authority/acting-context-request-support.ts':
    'acting-context change: BE01 lists no STEP_UP_REQUIRED row for it',
  'components/identity-authority/step-up-mfa/step-up-failure.ts':
    'the /step-up page itself (AUTH-API-20/21 are the step-up)',
  'components/platform-configuration/platform-configuration-state.ts':
    'status-only fallback after parsePlatformConfigurationError, which keeps a typed STEP_UP_REQUIRED code',
  'lib/infrastructure-jobs.ts': WORKER_READ,
  'pages/app/cms-content-modeling/templates/[templateKey].astro':
    NO_STEP_UP_ROW,
  'pages/app/cms-content-modeling/templates/new.astro': NO_STEP_UP_ROW,
  'pages/app/identity-authority/[recordId].astro': SSR_READ,
  'pages/app/identity-authority/index.astro': SSR_READ,
  'pages/settings/security.astro':
    'AUTH-API-16 factor list read: BE01a step-up applies only to AUTH-API-17/19',
  'server/admin-workspace-context.ts':
    'CFG-05B inbox read for the workspace shell (GET, no step-up policy)',
  'server/cms-composition-platform-locale.ts': NO_STEP_UP_ROW,
  'server/cms-composition-platform-mutation.ts': NO_STEP_UP_ROW,
  'server/cms-composition-platform-pattern.ts': NO_STEP_UP_ROW,
  'server/cms-composition-platform-related.ts': NO_STEP_UP_ROW,
  'server/cms-editorial-platform-error-details.ts': NO_STEP_UP_ROW,
  'server/cms-editorial-platform-shared.ts': NO_STEP_UP_ROW,
  'server/content-schema-registry-platform-mutation-support.ts':
    'local fallback error only; a valid upstream ApiError keeps its STEP_UP_REQUIRED code',
  'server/identity-authority-private-organization-read.ts': SSR_READ,
  'server/job-status-boundary-response.ts': WORKER_READ,
  'server/job-status-boundary.ts': WORKER_READ,
  'server/job-status-platform-api.ts': WORKER_READ,
  'server/content-schema-registry-platform-shared.ts': WORKER_READ,
  'server/platform-configuration-context.ts': SSR_READ,
  'server/profile-ownership-context.ts': SSR_READ,
  'server/profile-portfolio-context.ts': SSR_READ,
  'server/step-up-mfa-read.ts':
    'AUTH-API-16 factor list read: BE01a step-up applies only to AUTH-API-17/19',
};

const isDirectory = (path: string): boolean => {
  try {
    readdirSync(path);
    return true;
  } catch {
    return false;
  }
};

const walk = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = `${directory}${name}`;
    return isDirectory(path) ? walk(`${path}/`) : [path];
  });

const withoutComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^\s*\/\/.*$/gmu, '')
    .replace(/\/\/ .*$/gmu, '');

const filesReading401 = (): string[] =>
  walk(SRC)
    .filter((file) => /\.(ts|tsx|astro)$/u.test(file))
    .filter((file) => !/\.test\.|test-support|\.fixtures?\./u.test(file))
    .filter((file) =>
      /\b401\b/u.test(withoutComments(readFileSync(file, 'utf8'))),
    )
    .map((file) => file.slice(SRC.length))
    .sort();

describe('401 STEP_UP_REQUIRED mapper inventory (AC1127 sweep guard)', () => {
  it('classifies every 401-reading mapper as step-up aware or exempt with a reason', () => {
    const found = filesReading401();
    const classified = [...stepUpAware, ...Object.keys(exempt)].sort();
    expect(found).toEqual(classified);
    expect(found.length).toBe(stepUpAware.length + Object.keys(exempt).length);
  });

  it('every step-up aware mapper names the step-up code or the shared reader', () => {
    for (const file of stepUpAware) {
      const source = readFileSync(`${SRC}${file}`, 'utf8');
      expect(source, file).toMatch(
        /STEP_UP_REQUIRED|isStepUpRequired(?:Body|Code)|classifyStepUpResponse/u,
      );
    }
  });

  it('every exemption states a reason', () => {
    for (const [file, reason] of Object.entries(exempt))
      expect(reason.length, file).toBeGreaterThan(20);
  });
});

const filesComparingTheLiteral = (): string[] =>
  walk(SRC)
    .filter((file) => /\.(ts|tsx|astro)$/u.test(file))
    .filter((file) => !/\.test\.|test-support|\.fixtures?\./u.test(file))
    .filter((file) =>
      /(?:===|!==|==|!=)\s*'STEP_UP_REQUIRED'|'STEP_UP_REQUIRED'\s*(?:===|!==)|case\s+'STEP_UP_REQUIRED'/u.test(
        withoutComments(readFileSync(file, 'utf8')),
      ),
    )
    .map((file) => file.slice(SRC.length))
    .sort();

const filesBuildingTheHref = (): string[] =>
  walk(SRC)
    .filter((file) => /\.(ts|tsx|astro)$/u.test(file))
    .filter((file) => !/\.test\.|test-support|\.fixtures?\./u.test(file))
    .filter((file) =>
      /['"`]\/step-up\?returnTo=/u.test(
        withoutComments(readFileSync(file, 'utf8')),
      ),
    )
    .map((file) => file.slice(SRC.length))
    .sort();

describe('one shared reading of STEP_UP_REQUIRED (AC1127 consolidation)', () => {
  it('no surface builds the /step-up?returnTo= target by hand; step-up-return.ts is the only builder', () => {
    expect(filesBuildingTheHref()).toEqual([]);
  });

  it('no surface compares an error code with the STEP_UP_REQUIRED literal; they all use step-up-required.ts', () => {
    expect(filesComparingTheLiteral()).toEqual([]);
  });
});
