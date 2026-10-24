import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SRC_ROOT, staticClosure } from './island-static-closure.test-support';

/**
 * P2-S11-AC-106 in Chrome (`phase-02-slice-11-bundle-budget-real-route.spec.ts`) charges every script
 * the route fetches until it is idle, which includes the command forms the island mounts for a
 * permitted publisher. `pnpm bundle:check` cannot see those, so what a mounted form needs only
 * after a command is answered (the transport, the refusal classifier) or after a refetch (the
 * canonical read) loads then, not with the form. The loaders below are dynamic `import()` edges;
 * this guard names the module that dragged the machinery back into the cold-load graph.
 */
describe('CMS workflow command forms: answer machinery loads when a command is sent', () => {
  const WORKFLOW = 'components/cms-editorial-workflow/';
  const read = (name: string): string =>
    readFileSync(resolve(SRC_ROOT, WORKFLOW, name), 'utf8');
  const TRANSPORT = `${WORKFLOW}cms-workflow-command-transport.ts`;
  const REFUSAL = `${WORKFLOW}cms-workflow-refusal.ts`;

  it.each([
    ['use-cms-workflow-command.ts', TRANSPORT],
    ['use-cms-workflow-command.ts', REFUSAL],
    ['cms-workflow-command-controller.ts', TRANSPORT],
    ['cms-workflow-command-controller.ts', REFUSAL],
    ['CmsEditorialScheduleForm.tsx', TRANSPORT],
    ['CmsEditorialPreviewForm.tsx', REFUSAL],
    ['CmsEditorialPublishConfirmation.tsx', TRANSPORT],
  ] as const)('%s keeps %s out of its static closure', (entry, machinery) => {
    expect(existsSync(resolve(SRC_ROOT, machinery)), machinery).toBe(true);
    expect(
      staticClosure(resolve(SRC_ROOT, WORKFLOW, entry)).files,
    ).not.toContain(machinery);
  });

  it('loads the transport and the refusal classifier through dynamic imports of one loader module', () => {
    const loader = read('cms-workflow-answer-machinery.ts');
    expect(loader).toMatch(
      /import\(\s*'\.\/cms-workflow-command-transport'\s*\)/u,
    );
    expect(loader).toMatch(/import\(\s*'\.\/cms-workflow-refusal'\s*\)/u);
    // The send and the classifier go through the loader's failure-aware wrappers (a chunk that
    // cannot be fetched means nothing was sent), never through a static import.
    expect(read('use-cms-workflow-command.ts')).toMatch(
      /sendWorkflowCommandLazily\(/u,
    );
    expect(read('cms-workflow-command-controller.ts')).toMatch(
      /await classifyRefusalLazily\(/u,
    );
    expect(read('CmsWorkflowCommandFrame.tsx')).toContain(
      'warmWorkflowAnswerMachinery',
    );
  });

  it.each(['cms-workflow-canonical-read.ts', '../../lib/client-binding.ts'])(
    'CmsEditorialWorkflowIsland keeps %s out of its static closure: a read runs only on a refetch',
    (module) => {
      const files = staticClosure(
        resolve(SRC_ROOT, WORKFLOW, 'CmsEditorialWorkflowIsland.tsx'),
      ).files;
      const target = relative(SRC_ROOT, resolve(SRC_ROOT, WORKFLOW, module));
      expect(files).not.toContain(target);
    },
  );

  it('loads the default workflow read through a dynamic import', () => {
    expect(read('cms-workflow-answer-machinery.ts')).toMatch(
      /import\(\s*'\.\/cms-workflow-canonical-read'\s*\)/u,
    );
    expect(read('CmsEditorialWorkflowIsland.tsx')).toMatch(
      /readWorkflowLazily/u,
    );
  });

  it.each([
    'CmsEditorialReviewSubmitForm.tsx',
    'CmsEditorialScheduleForm.tsx',
    'CmsEditorialPreviewForm.tsx',
    'CmsEditorialPublishConfirmation.tsx',
  ])(
    'CmsEditorialWorkflowIsland has %s in its static closure: a publisher mounts it at hydration and Chrome needs it before the schedule form opens',
    (form) => {
      expect(
        staticClosure(
          resolve(SRC_ROOT, WORKFLOW, 'CmsEditorialWorkflowIsland.tsx'),
        ).files,
      ).toContain(`${WORKFLOW}${form}`);
      expect(read('cms-workflow-form-views.ts')).not.toMatch(/import\(/u);
    },
  );
});

/**
 * The governed forms answer the same way: what a mounted governed form needs only after a command
 * is sent (the transport, the refusal classifiers) or after a refetch (the canonical read) loads
 * then. A reviewer offered every action mounts all the forms at hydration, so Chrome (and
 * `bundle:check`) charges the route for everything they import statically.
 */
describe('governed command forms: answer machinery loads when a command is sent', () => {
  const GOVERNED_DIR = 'components/cms-governed-review/';
  const readGoverned = (name: string): string =>
    readFileSync(resolve(SRC_ROOT, GOVERNED_DIR, name), 'utf8');

  it.each([
    ['use-governed-review-command.ts', 'governed-review-command-transport.ts'],
    ['use-governed-review-command.ts', 'governed-review-refusal.ts'],
    ['use-governed-review-command.ts', 'governed-activation-refusal.ts'],
    ['CmsGovernedDecisionForm.tsx', 'governed-review-command-transport.ts'],
    ['CmsGovernedActivationForm.tsx', 'governed-review-refusal.ts'],
    ['CmsGovernedSubmitForm.tsx', 'governed-activation-refusal.ts'],
    ['CmsGovernedReviewDetailIsland.tsx', 'governed-review-canonical-read.ts'],
  ] as const)('%s keeps %s out of its static closure', (entry, machinery) => {
    const target = `${GOVERNED_DIR}${machinery}`;
    expect(existsSync(resolve(SRC_ROOT, target)), target).toBe(true);
    expect(
      staticClosure(resolve(SRC_ROOT, GOVERNED_DIR, entry)).files,
    ).not.toContain(target);
  });

  it('keeps the client binding out of the governed island: a read runs only on a refetch', () => {
    expect(
      staticClosure(
        resolve(SRC_ROOT, GOVERNED_DIR, 'CmsGovernedReviewDetailIsland.tsx'),
      ).files,
    ).not.toContain('lib/client-binding.ts');
  });

  it('loads them through dynamic imports of one loader module, warmed when a form takes focus', () => {
    const loader = readGoverned('governed-answer-machinery.ts');
    for (const module of [
      'governed-review-command-transport',
      'governed-review-refusal',
    ])
      expect(loader).toMatch(
        new RegExp(`import\\(\\s*'\\./${module}'\\s*\\)`, 'u'),
      );
    expect(loader).toMatch(
      /import\(\s*'\.\/governed-review-canonical-read'\s*\)/u,
    );
    expect(readGoverned('use-governed-review-command.ts')).toMatch(
      /sendGovernedCommandLazily\(/u,
    );
    expect(readGoverned('use-governed-review-command.ts')).toMatch(
      /classifyGovernedRefusalLazily\(/u,
    );
    expect(readGoverned('CmsGovernedReviewDetailIsland.tsx')).toMatch(
      /readGovernedReviewLazily/u,
    );
  });
});

/**
 * A form that loads on intent (`loadViewOnIntent(region, () => import('./Form'))`) must name that
 * same region on its command frame, or its server markup carries nothing to show intent in and the
 * chunk loads at once; and its chunk must not ride in the static closure of the island.
 */
describe('forms that load on intent', () => {
  const COMPONENTS = resolve(SRC_ROOT, 'components');
  const VIEWS = [
    'cms-governed-review/governed-panel-form-views.ts',
    'cms-governed-review/governed-review-form-views.ts',
    'cms-editorial-workflow/cms-review-form-views.ts',
  ] as const;
  const declared = VIEWS.flatMap((views) => {
    const source = readFileSync(resolve(COMPONENTS, views), 'utf8');
    return [
      ...source.matchAll(
        /loadViewOnIntent\(\s*'([\w-]+)',\s*\(\)\s*=>\s*import\('\.\/(\w+)'\)/gu,
      ),
    ].map((match) => ({
      views,
      region: match[1] as string,
      form: `${views.slice(0, views.lastIndexOf('/') + 1)}${match[2] as string}.tsx`,
    }));
  });

  it('declares the governed panel submit form, the three definition review forms and the editorial assignment forms', () => {
    expect(declared.map(({ region }) => region).sort()).toEqual([
      'governed-activation',
      'governed-assignment',
      'governed-decision',
      'governed-submit',
      'review-assignment',
    ]);
  });

  it.each(declared)(
    '$form names the region $region on a command frame of its own closure',
    ({ form, region }) => {
      const frames = staticClosure(resolve(COMPONENTS, form)).files.filter(
        (file) =>
          readFileSync(resolve(SRC_ROOT, file), 'utf8').includes(
            `lazyRegion="${region}"`,
          ),
      );
      expect(frames.length).toBeGreaterThan(0);
    },
  );

  it.each(declared)(
    '$region has its own region name in the whole page',
    ({ region }) => {
      expect(declared.filter((entry) => entry.region === region)).toHaveLength(
        1,
      );
    },
  );
});
