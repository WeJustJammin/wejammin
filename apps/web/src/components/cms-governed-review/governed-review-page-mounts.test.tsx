// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { templateSuccessorPageOutcome } from '../cms-composition/cms-template-page-outcome';
import {
  buttonNamed,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';
import { loadPatternDesignerPage } from '../cms-pattern-designer/load-pattern-designer-page';
import {
  jsonResponse as patternJson,
  patternDetailFixture,
} from '../../server/cms-pattern-platform.test-support';
import {
  governedQueueItem,
  governedQueuePageFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedPatternPanel from './CmsGovernedPatternPanel';
import CmsGovernedTemplatePanel from './CmsGovernedTemplatePanel';
import type { CmsGovernedPageReads } from './governed-review-page-reads';
import { loadGovernedSubjectReview } from './load-governed-subject-review';

/*
 * P2-S12-AC-069: CMS-03C-06 is consumed by the protected `CmsGovernedReviewPanel` on the template and pattern pages. The
 * Astro pages cannot be rendered by the plain Vitest config (no Astro plugin), so this drives the SAME chain each page's
 * frontmatter runs with real code and only the protected edge replaced, then mounts the component the page renders for
 * the result: the page loader's verdict, the owned-queue read of the version's review (`loadGovernedSubjectReview`), and
 * the panel with the props the page passes. A page that is not ready (denied, degraded, absent) renders no panel. The
 * source-text guards of `governed-review-mounts.test.ts` still pin that each page names the panel and hydrates it with
 * `client:load`; this suite pins what the page does with it.
 */
beforeAll(preloadWorkflowAnswerMachinery);
beforeAll(enableReactAct);
afterAll(disableReactAct);

const ORIGIN = 'https://web.test';
const request = (path: string) =>
  new Request(`${ORIGIN}${path}`, {
    headers: { cookie: 'wj_access=a; wj_csrf=csrf-token' },
  });

/** The owned-queue edge: the review of exactly one subject version, else an empty queue. */
const queueReads = (
  match: { kind: string; key: string; version: number } | null,
) =>
  ({
    reviewQueue: vi.fn(async () =>
      jsonResponse(
        200,
        governedQueuePageFixture(
          match === null
            ? []
            : [
                governedQueueItem(3, {
                  subjectKind: match.kind,
                  subjectKey: match.key,
                  subjectVersion: match.version,
                  state: 'open',
                  requiredDecisionCount: 2,
                  recordedDecisionCount: 1,
                }),
              ],
        ),
        { etag: '"5"' },
      ),
    ),
  }) as unknown as CmsGovernedPageReads;

const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const HASH = 'a'.repeat(64);
const TEMPLATE_CONTEXT = {
  contentTypes: [
    {
      id: TYPE_ID,
      typeKey: 'release_note',
      activeVersionId: '018f0c45-73fe-7dc2-9c09-68f7ecf132db',
      activeVersion: 2,
      sourceLocale: 'en-US',
    },
  ],
  registeredBlocks: [{ blockKey: 'profile.text', blockVersion: 1 }],
};
const TEMPLATE_DETAIL = {
  id: '018f0c45-73fe-7dc2-9c09-68f7ecf132dc',
  version: '2',
  templateVersion: 2,
  contentHash: HASH,
  createdAt: '2026-09-27T12:00:00.000Z',
  updatedAt: '2026-09-27T13:00:00.000Z',
  state: 'draft',
  templateId: '90000000-0000-4000-8000-000000000009',
  templateKey: 'release-note',
  compatibleTypeIds: [TYPE_ID],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: HASH,
  slots: [],
  bindings: {},
  locale: 'en-US',
  audience: 'public',
};

const lifecycle = (container: HTMLElement): string =>
  container.textContent ?? '';

describe('the template page hosts the governed review panel for the version it served', () => {
  const page = async (context: Response, latest: Response) => {
    const outcome = await templateSuccessorPageOutcome(
      'release-note',
      context,
      latest,
    );
    const detail = outcome.kind === 'ready' ? outcome.detail : null;
    const reads = queueReads({
      kind: 'template_version',
      key: 'release-note',
      version: 2,
    });
    const review =
      detail === null
        ? null
        : await loadGovernedSubjectReview({
            request: request(
              '/app/cms-content-modeling/templates/release-note',
            ),
            reads,
            subject: {
              kind: 'template_version',
              key: detail.templateKey,
              version: detail.templateVersion,
            },
          });
    // The props the page passes to the panel island (templates/[templateKey].astro).
    return detail === null ? null : { detail, review };
  };

  it('[P2-S12-AC-069] renders the panel with the served version, its lifecycle as text, the submit action and the version’s review summary', async () => {
    const hosted = await page(
      Response.json(TEMPLATE_CONTEXT),
      Response.json(TEMPLATE_DETAIL, {
        status: 200,
        headers: { etag: '"2"' },
      }),
    );
    expect(hosted).not.toBeNull();
    if (hosted === null) return;
    const { container } = mountElement(
      <CmsGovernedTemplatePanel
        detail={{
          id: hosted.detail.id,
          contentHash: hosted.detail.contentHash,
          templateKey: hosted.detail.templateKey,
          templateVersion: hosted.detail.templateVersion,
          state: hosted.detail.state,
        }}
        review={hosted.review}
      />,
    );
    await flush();
    expect(lifecycle(container)).toContain('Lifecycle: Draft');
    expect(buttonNamed(container, 'Submit for review')).not.toBeNull();
    expect(hosted.review).toMatchObject({
      state: 'open',
      requiredDecisionCount: 2,
      recordedDecisionCount: 1,
    });
    const reviewLink = container.querySelector<HTMLAnchorElement>(
      'a[href^="/app/cms-content-modeling/definition-reviews/"]',
    );
    expect(reviewLink?.getAttribute('href')).toContain(
      encodeURIComponent(hosted.review?.reviewId ?? 'missing'),
    );
  });

  it('[P2-S12-AC-069] renders no panel when the page is not ready: a denied context, a degraded detail', async () => {
    expect(
      await page(
        Response.json({ code: 'X' }, { status: 403 }),
        Response.json(TEMPLATE_DETAIL, { headers: { etag: '"2"' } }),
      ),
    ).toBeNull();
    expect(
      await page(
        Response.json(TEMPLATE_CONTEXT),
        Response.json({ code: 'X' }, { status: 503 }),
      ),
    ).toBeNull();
  });
});

describe('the pattern page hosts the governed review panel for the version it served', () => {
  const reads = (latest: Response) => ({
    context: vi.fn(async () =>
      patternJson(200, {
        contentTypes: [
          {
            id: '30000000-0000-4000-8000-000000000003',
            typeKey: 'profile',
            activeVersionId: '40000000-0000-4000-8000-000000000004',
            activeVersion: 1,
            sourceLocale: 'en-US',
          },
        ],
        registeredBlocks: [
          { blockKey: 'profile.header', blockVersion: 1 },
          { blockKey: 'profile.text', blockVersion: 3 },
        ],
      }),
    ),
    latest: vi.fn(async () => latest),
  });
  const page = async (latest: Response) => {
    const path = '/app/cms-content-modeling/patterns/profile-hero';
    const outcome = await loadPatternDesignerPage({
      request: request(path),
      patternKey: 'profile-hero',
      reads: reads(latest),
    });
    const panel =
      outcome.kind === 'view' && outcome.view.panel !== null
        ? outcome.view.panel
        : null;
    const review =
      panel === null
        ? null
        : await loadGovernedSubjectReview({
            request: request(path),
            reads: queueReads({
              kind: 'pattern_version',
              key: panel.patternKey,
              version: panel.patternVersion,
            }),
            subject: {
              kind: 'pattern_version',
              key: panel.patternKey,
              version: panel.patternVersion,
            },
          });
    return panel === null ? null : { panel, review };
  };

  it('[P2-S12-AC-069] renders the panel with the served version, its lifecycle as text, the submit action and the version’s review summary', async () => {
    const hosted = await page(
      patternJson(
        200,
        patternDetailFixture({ patternKey: 'profile-hero', state: 'draft' }),
        { etag: '"1"' },
      ),
    );
    expect(hosted).not.toBeNull();
    if (hosted === null) return;
    const { container } = mountElement(
      <CmsGovernedPatternPanel detail={hosted.panel} review={hosted.review} />,
    );
    await flush();
    expect(lifecycle(container)).toContain('Lifecycle: Draft');
    expect(buttonNamed(container, 'Submit for review')).not.toBeNull();
    expect(hosted.review).toMatchObject({ state: 'open' });
    expect(
      container.querySelector(
        'a[href^="/app/cms-content-modeling/definition-reviews/"]',
      ),
    ).not.toBeNull();
  });

  it('[P2-S12-AC-069] renders no panel for a new pattern or a pattern that cannot be read', async () => {
    const outcome = await loadPatternDesignerPage({
      request: request('/app/cms-content-modeling/patterns/new'),
      patternKey: null,
      reads: reads(patternJson(404, {})),
    });
    expect(outcome.kind === 'view' && outcome.view.panel).toBeNull();
    expect(await page(patternJson(503, { code: 'X' }))).toBeNull();
  });
});
