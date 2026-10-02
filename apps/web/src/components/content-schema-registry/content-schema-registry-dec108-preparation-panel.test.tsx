// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  DRY_RUN_ID,
  HASH,
  JOB_ID,
  TYPE_ID,
  VERSION_ID,
  draftDetail,
} from './content-schema-review-dec108.test-support';
import {
  commandForm,
  definitionValue,
  renderDocument,
  requireRegion,
  successDetail,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';
import {
  activationPreparation,
  passedDryRunPreparation,
  queuedDryRunPreparation,
} from './content-schema-registry-activation-preparation.test-support';

/**
 * FE03 "DEC-108 review, dry-run and activation-preparation states": the
 * activationPreparation panel on the CMS-03A-07 detail renders the BE00 job
 * vocabulary, announces progress politely without moving focus, and takes a
 * pass/fail result only from the sealed report, never from a job state alone.
 */

type Preparation = Parameters<typeof draftDetail>[0];

const panel = (
  preparation: Preparation,
  access: 'full' | 'read-only' = 'full',
) =>
  requireRegion(
    renderDocument(
      versionPageProps({
        access,
        variant: access === 'full' ? 'ownerFull' : 'entitledRead',
        initialDetail: successDetail(draftDetail(preparation)),
      }),
    ),
    /activation preparation/iu,
  );

const dryRun = (
  state: 'queued' | 'running' | 'completed' | 'failed',
  result: 'passed' | 'failed' | null = null,
) => ({ id: DRY_RUN_ID, state, result, jobId: JOB_ID });

describe('[DEC-108] dry-run status panel', () => {
  it('renders for a read-only projection as well as for the designer', () => {
    expect(panel(queuedDryRunPreparation, 'read-only')).not.toBeNull();
    expect(panel(queuedDryRunPreparation, 'full')).not.toBeNull();
  });

  it('[P2-S09-AC-961] [P2-S09-AC-964] states that no dry run exists yet when dryRunRef is null', () => {
    expect(panel(activationPreparation()).textContent).toMatch(/no dry run/iu);
  });

  it.each([
    ['queued', 'queued'],
    ['running', 'running'],
  ] as const)(
    '[P2-S09-AC-962] announces a %s dry run politely without a result',
    (state, jobState) => {
      const region = panel(
        activationPreparation({
          dryRunRef: dryRun(state),
          jobRef: { id: JOB_ID, state: jobState },
        }),
      );
      const live = region.querySelector('[role="status"][aria-live="polite"]');
      expect(live?.textContent?.toLowerCase()).toContain(state);
      expect(live?.getAttribute('aria-atomic')).toBe('true');
      expect(region.textContent).not.toMatch(/passed|failed/iu);
      expect(region.textContent).not.toMatch(/[a-f0-9]{64}/u);
    },
  );

  it('never steals focus while it polls', () => {
    const region = panel(queuedDryRunPreparation);
    expect(region.querySelector('[autofocus]')).toBeNull();
    expect(region.querySelector('[tabindex="0"]')).toBeNull();
  });

  it.each(['queued', 'running', 'succeeded', 'failed', 'cancelled'] as const)(
    '[P2-S09-AC-969] renders the BE00 job state %s as a status line, never as a result',
    (jobState) => {
      const region = panel(
        activationPreparation({
          dryRunRef: dryRun(jobState === 'queued' ? 'queued' : 'running'),
          jobRef: { id: JOB_ID, state: jobState },
        }),
      );
      expect(definitionValue(region, /job/iu)?.toLowerCase()).toBe(jobState);
    },
  );

  it('[P2-S09-AC-963] renders the sealed passed result only for a completed dry run', () => {
    const region = panel(passedDryRunPreparation);
    expect(region.textContent).toMatch(/passed/iu);
  });

  it('[P2-S09-AC-963] renders a sealed failed result and keeps submit-review unavailable', () => {
    const preparation = activationPreparation({
      dryRunRef: dryRun('completed', 'failed'),
      jobRef: { id: JOB_ID, state: 'succeeded' },
      permittedNextActions: ['submit_review'],
    });
    expect(panel(preparation).textContent).toMatch(/failed/iu);
    expect(
      commandForm(
        renderDocument(
          versionPageProps({
            initialDetail: successDetail(draftDetail(preparation)),
          }),
        ),
        'CMS-03A-11',
      ),
    ).toBeNull();
  });

  it('[P2-S09-AC-960] does not render passed when the job succeeded but no sealed report exists', () => {
    // FE03: a job state of succeeded alone never renders a passed result.
    const region = panel(
      activationPreparation({
        dryRunRef: dryRun('running'),
        jobRef: { id: JOB_ID, state: 'succeeded' },
      }),
    );
    expect(region.textContent).not.toMatch(/passed/iu);
  });

  it.each(['failed', 'cancelled'] as const)(
    '[P2-S09-AC-960] renders unsealed-failure copy for a %s job without a sealed report',
    (jobState) => {
      const region = panel(
        activationPreparation({
          dryRunRef: dryRun('failed'),
          jobRef: { id: JOB_ID, state: jobState },
          permittedNextActions: ['start_dry_run'],
        }),
      );
      expect(region.textContent).toMatch(
        /did not (complete|finish)|could not (be )?(complete|finish)|not (completed|sealed)|no (sealed )?report/iu,
      );
      expect(region.textContent).not.toMatch(/passed/iu);
      expect(region.textContent).not.toMatch(/[a-f0-9]{64}/u);
    },
  );
});

describe('[DEC-108] template compatibility projection', () => {
  const projection = {
    templateVersionId: VERSION_ID,
    templateKey: 'profile.header',
    templateVersionNo: '2',
    state: 'active' as const,
    compatible: true as const,
    withdrawn: false as const,
    templateDigest: HASH,
    contentTypeId: TYPE_ID,
    contentTypeVersionId: VERSION_ID,
  };

  it('[P2-S09-AC-971] renders the safe resolver projection read-only for the exact candidate', () => {
    const region = panel(
      activationPreparation({
        ...passedDryRunPreparation,
        templateCompatibility: projection,
      }),
    );
    expect(region.textContent).toContain('profile.header');
    expect(region.textContent).toContain(HASH);
    expect(region.querySelector('input, select, textarea, button')).toBeNull();
  });

  it('[P2-S09-AC-971] states nothing about compatibility when the projection is absent', () => {
    // Control: the projection renders when present.
    expect(
      panel(
        activationPreparation({
          ...passedDryRunPreparation,
          templateCompatibility: projection,
        }),
      ).textContent,
    ).toMatch(/compatib/iu);
    expect(panel(passedDryRunPreparation).textContent).not.toMatch(
      /compatib/iu,
    );
  });
});
