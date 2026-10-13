import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsEditorialWorkflowPanel from './CmsEditorialWorkflowPanel';
import {
  HASH_A,
  INSTANT,
  REVIEW_ID,
  approvedReviewFixture,
  approvedWorkflowFixture,
  preflightReportFixture,
  workflowFixture,
} from './cms-workflow-fixtures.test-support';

const render = (workflow = workflowFixture()): string =>
  renderToStaticMarkup(<CmsEditorialWorkflowPanel workflow={workflow} />);

const schedule = (overrides: Record<string, unknown> = {}) => ({
  id: '123e4567-e89b-42d3-a456-426614174031',
  version: '2',
  state: 'pending',
  action: 'publish',
  audience: 'members',
  resolvedUtc: '2026-11-01T14:30:00Z',
  reasonCode: null,
  ...overrides,
});

const publication = (overrides: Record<string, unknown> = {}) => ({
  publicationId: '123e4567-e89b-42d3-a456-426614174041',
  publicationVersionId: '123e4567-e89b-42d3-a456-426614174042',
  version: '3',
  state: 'active',
  action: 'publish',
  revisionId: '123e4567-e89b-42d3-a456-426614174003',
  locale: 'en-US',
  audience: 'members',
  publicationHash: HASH_A,
  projectionState: 'pending',
  createdAt: INSTANT,
  ...overrides,
});

describe('CmsEditorialWorkflowPanel (FE03 Slice 11)', () => {
  it('names one region per concern with a focusable heading each', () => {
    const html = render();
    for (const id of [
      'workflow-revision-title',
      'workflow-checks-title',
      'workflow-review-title',
      'workflow-schedules-title',
      'workflow-publications-title',
    ])
      expect(html).toContain(`id="${id}"`);
    expect(
      html.match(/<section[^>]*aria-labelledby/gu)?.length,
    ).toBeGreaterThanOrEqual(5);
    expect(html).toContain('tabindex="-1"');
  });

  it('states the derived revision state in words through one polite line', () => {
    const html = render();
    expect(html).toContain('Revision 4');
    expect(html).toContain('en-US');
    expect(html).toContain('Draft');
    expect(html).toMatch(
      /role="status"[^>]*aria-live="polite"[^>]*>[^<]*Draft/u,
    );
    expect(render(approvedWorkflowFixture())).toContain('Approved');
  });

  it('renders all 17 checks for a submittable draft and none otherwise', () => {
    const draft = render();
    expect(draft.match(/data-cms-preflight-outcome/gu)).toHaveLength(17);
    const approved = render(approvedWorkflowFixture());
    expect(approved).not.toContain('data-cms-preflight-outcome');
    expect(approved).toContain('Checks run for a draft that can be submitted.');
  });

  it('treats an unavailable check as a degraded check, not an error', () => {
    const html = render(
      workflowFixture({
        preparation: {
          ...workflowFixture().preparation!,
          preflight: preflightReportFixture({
            accessibility: {
              outcome: 'unavailable',
              reasonCode: 'checker_failed',
            },
          }),
        },
      }),
    );
    expect(html).toContain('degraded check, not an error');
    expect(html).not.toContain('role="alert"');
  });

  it('says Not submitted when no review exists and links the review when one does', () => {
    expect(render()).toContain('Not submitted');
    const html = render(approvedWorkflowFixture());
    expect(html).toContain(
      `href="/app/cms-content-modeling/reviews/${REVIEW_ID}"`,
    );
    expect(html).toContain('Open the review');
    expect(html).toContain('Approved');
    expect(html).toContain('1 of 1 decisions recorded');
    expect(html).toContain('Risk class: ordinary');
  });

  it('shows the closed invalidation reason of a review that no longer holds', () => {
    const html = render(
      workflowFixture({
        review: {
          ...approvedReviewFixture({
            state: 'invalidated',
            invalidatedReason: 'dependency_changed',
            decidedAt: null,
          }),
          frozen: {
            frozenHash: HASH_A,
            dependencyHash: 'b'.repeat(64),
            versionSet: workflowFixture().preparation!.versionSet,
          },
        },
        preparation: null,
        revision: {
          ...workflowFixture().revision,
          isCurrentDraft: false,
          state: 'draft',
        },
      }),
    );
    expect(html).toContain('Invalidated');
    expect(html).toContain(
      'A dependency changed after the review was submitted.',
    );
  });

  it('lists schedules as scheduled, not published, with a closed reason when blocked', () => {
    const html = render(
      workflowFixture({
        schedules: [
          schedule(),
          schedule({
            id: '123e4567-e89b-42d3-a456-426614174032',
            state: 'blocked',
            reasonCode: 'preflight_failed',
          }),
        ],
      }),
    );
    expect(html).toContain('Scheduled, not published');
    expect(html).toContain('Blocked, nothing was published');
    expect(html).toContain('A check failed when the schedule ran.');
    expect(html).toContain('<time dateTime="2026-11-01T14:30:00Z">');
    expect(html).toContain('members');
    expect(render()).toContain('No schedules');
  });

  it('never presents a pending projection as public visibility', () => {
    const html = render(
      workflowFixture({
        publications: [
          publication(),
          publication({
            publicationId: '123e4567-e89b-42d3-a456-426614174043',
            publicationVersionId: '123e4567-e89b-42d3-a456-426614174044',
            version: '2',
            state: 'superseded',
            projectionState: 'converged',
          }),
        ],
      }),
    );
    expect(html).toContain(
      'Recorded. Public delivery has not reported yet, so this is not confirmed visible to readers.',
    );
    expect(html).toContain('Delivery reported this version live.');
    expect(html).toContain('Current publication');
    expect(html).toContain('Replaced by a newer publication');
    expect(html).not.toMatch(/\bLive now\b|is public|now public/iu);
    expect(render()).toContain('No publications');
  });

  it('serializes no hash, manifest, version set or identifier into visible text', () => {
    const html = render(approvedWorkflowFixture());
    expect(html).not.toContain(HASH_A);
    expect(html).not.toContain('dependencyManifest');
    expect(html).not.toContain('schemaArtifact');
  });

  it('marks the panel as showing a last verified read when it is degraded', () => {
    const html = renderToStaticMarkup(
      <CmsEditorialWorkflowPanel
        workflow={workflowFixture()}
        degradedSince="2026-10-08T12:00:00Z"
      />,
    );
    expect(html).toContain('Showing the last verified state from');
    expect(html).toContain('<time dateTime="2026-10-08T12:00:00Z">');
  });
});
