// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  DRY_RUN_ID,
  JOB_ID,
  draftDetail,
} from './content-schema-review-dec108.test-support';
import {
  definitionValue,
  renderDocument,
  requireRegion,
  successDetail,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';
import {
  SEALED_REPORT_HASH,
  SEALED_SOURCE_HASH,
  SEALED_TARGET_HASH,
  activationPreparation,
  passedDryRunPreparation,
  queuedDryRunPreparation,
  sealedDryRunPreparation,
} from './content-schema-registry-activation-preparation.test-support';

/**
 * FE03 "DEC-108 review, dry-run and activation-preparation states": a
 * completed dry run reads its counts and hashes only from the immutable sealed
 * report the server projected; nothing is derived on the client.
 */

type Preparation = Parameters<typeof draftDetail>[0];

const panel = (preparation: Preparation): HTMLElement =>
  requireRegion(
    renderDocument(
      versionPageProps({
        initialDetail: successDetail(draftDetail(preparation)),
      }),
    ),
    /activation preparation/iu,
  );

const liveText = (region: HTMLElement): string =>
  region.querySelector('[role="status"][aria-live="polite"]')?.textContent ??
  '';

describe('[DEC-108] sealed dry-run report evidence', () => {
  it('[P2-S09-AC-963] renders counts and hashes from a sealed passed report', () => {
    const region = panel(sealedDryRunPreparation('passed'));
    expect(definitionValue(region, /source rows/iu)).toBe('12');
    expect(definitionValue(region, /target rows/iu)).toBe('12');
    expect(definitionValue(region, /row errors/iu)).toBe('0');
    expect(definitionValue(region, /source hash/iu)).toBe(SEALED_SOURCE_HASH);
    expect(definitionValue(region, /target hash/iu)).toBe(SEALED_TARGET_HASH);
    expect(definitionValue(region, /report hash/iu)).toBe(SEALED_REPORT_HASH);
    expect(definitionValue(region, /result/iu)).toBe('passed');
  });

  it('[P2-S09-AC-963] renders counts and hashes from a sealed failed report', () => {
    const region = panel(
      sealedDryRunPreparation('failed', { source: 40, target: 37, errors: 3 }),
    );
    expect(definitionValue(region, /source rows/iu)).toBe('40');
    expect(definitionValue(region, /target rows/iu)).toBe('37');
    expect(definitionValue(region, /row errors/iu)).toBe('3');
    expect(definitionValue(region, /report hash/iu)).toBe(SEALED_REPORT_HASH);
    expect(definitionValue(region, /result/iu)).toBe('failed');
  });

  it('[P2-S09-AC-963] renders no counts or hashes when the completed reference carries none', () => {
    const region = panel(passedDryRunPreparation);
    expect(region.textContent).not.toMatch(/source rows|row errors|hash/iu);
    expect(region.textContent).not.toMatch(/[a-f0-9]{64}/u);
  });

  it.each(['queued', 'running'] as const)(
    '[P2-S09-AC-963] renders no counts or hashes for a %s dry run',
    (state) => {
      const region = panel(
        activationPreparation({
          dryRunRef: { id: DRY_RUN_ID, state, result: null, jobId: JOB_ID },
          jobRef: { id: JOB_ID, state },
        }),
      );
      expect(region.textContent).not.toMatch(/source rows|row errors|hash/iu);
    },
  );

  it('[P2-S09-AC-963] renders the report hash as code text', () => {
    const region = panel(sealedDryRunPreparation('passed'));
    const hash = Array.from(region.querySelectorAll('dd code')).find(
      (node) => node.textContent === SEALED_REPORT_HASH,
    );
    expect(hash).toBeDefined();
  });

  it('renders the sealed report without any inline style the production CSP refuses', () => {
    const region = panel(sealedDryRunPreparation('passed'));
    expect(region.querySelectorAll('[style]')).toHaveLength(0);
    expect(region.querySelector('dd code')).not.toBeNull();
  });

  it('[P2-S09-AC-1039] announces the sealed counts and hashes in the polite live region', () => {
    const region = panel(sealedDryRunPreparation('passed'));
    const live = region.querySelector('[role="status"][aria-live="polite"]');
    expect(live?.getAttribute('aria-atomic')).toBe('true');
    const text = liveText(region);
    expect(text).toMatch(/sealed dry run passed/iu);
    expect(text).toContain('12 source rows');
    expect(text).toContain('12 target rows');
    expect(text).toContain('0 row errors');
    expect(text).toContain(SEALED_SOURCE_HASH);
    expect(text).toContain(SEALED_TARGET_HASH);
    expect(text).toContain(SEALED_REPORT_HASH);
  });

  it('[P2-S09-AC-1039] announces a sealed failed report with its counts and hashes', () => {
    const text = liveText(
      panel(
        sealedDryRunPreparation('failed', { source: 1, target: 1, errors: 1 }),
      ),
    );
    expect(text).toMatch(/sealed dry run failed/iu);
    expect(text).toContain('1 source row,');
    expect(text).toContain('1 row error');
    expect(text).toContain(SEALED_REPORT_HASH);
  });

  it('[P2-S09-AC-1039] announces no counts or hashes before the report is sealed', () => {
    const text = liveText(panel(queuedDryRunPreparation));
    expect(text.toLowerCase()).toContain('queued');
    expect(text).not.toMatch(/source row|row error|hash|[a-f0-9]{64}/iu);
  });
});
