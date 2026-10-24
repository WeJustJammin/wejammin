// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  HASH_A,
  REVIEW_ID,
  SUBJECT_ID,
  governedReviewFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedTemplatePanel, {
  readTemplateSubject,
  templateSubjectOf,
  type GovernedTemplateFacts,
} from './CmsGovernedTemplatePanel';
import {
  bodyOf,
  governedEnvironment,
  queuedFetcher,
} from './governed-review-form-test-support';

beforeAll(preloadWorkflowAnswerMachinery);

beforeAll(enableReactAct);
afterAll(disableReactAct);

const facts: GovernedTemplateFacts = {
  id: SUBJECT_ID,
  contentHash: HASH_A,
  templateKey: 'profile-header',
  templateVersion: 2,
  state: 'draft',
};

describe('templateSubjectOf', () => {
  it('takes the subject id, hash, key, version and lifecycle exactly as the latest read served them', () => {
    expect(templateSubjectOf(facts)).toEqual({
      kind: 'template_version',
      id: SUBJECT_ID,
      hash: HASH_A,
      key: 'profile-header',
      version: 2,
      state: 'draft',
    });
  });
});

describe('readTemplateSubject', () => {
  it('maps a loaded latest version to the panel subject', async () => {
    const readLatest = vi.fn(async () => ({
      kind: 'loaded' as const,
      detail: facts,
    }));
    expect(
      await readTemplateSubject('profile-header', readLatest as never),
    ).toEqual(templateSubjectOf(facts));
    expect(readLatest).toHaveBeenCalledWith('profile-header');
  });

  it.each([
    [{ kind: 'unavailable' as const }],
    [{ kind: 'rejected' as const, status: 404 as const }],
  ])(
    'is null when the latest version cannot be verified (%j)',
    async (result) => {
      expect(
        await readTemplateSubject(
          'profile-header',
          (async () => result) as never,
        ),
      ).toBeNull();
    },
  );
});

describe('CmsGovernedTemplatePanel', () => {
  it('submits the template version it was served and re-reads the latest template afterwards', async () => {
    const fetcher = queuedFetcher([
      jsonResponse(201, governedReviewFixture(), { etag: '"1"' }),
    ]);
    const readLatest = vi.fn(async () => ({
      kind: 'loaded' as const,
      detail: { ...facts, state: 'review' as const },
    }));
    const { container } = mountElement(
      <CmsGovernedTemplatePanel
        detail={facts}
        readLatest={readLatest as never}
        environment={governedEnvironment(fetcher)}
      />,
    );
    expect(container.firstElementChild?.className).toBe(
      'cms-template-designer',
    );
    await click(buttonNamed(container, 'Submit for review'));
    await flush();
    expect(bodyOf(fetcher)).toEqual({
      subjectKind: 'template_version',
      subjectId: SUBJECT_ID,
      subjectHash: HASH_A,
    });
    expect(readLatest).toHaveBeenCalledWith('profile-header');
    expect(container.textContent).toContain('Lifecycle: In review');
  });

  it('shows the review summary it was served and links to that review', () => {
    const { container } = mountElement(
      <CmsGovernedTemplatePanel
        detail={{ ...facts, state: 'review' }}
        review={{
          reviewId: REVIEW_ID,
          state: 'open',
          requiredDecisionCount: 2,
          recordedDecisionCount: 1,
        }}
      />,
    );
    expect(container.textContent).toContain('Review: Open · 1 of 2 decisions');
    expect(
      container
        .querySelector<HTMLAnchorElement>('a[href*="definition-reviews/"]')
        ?.getAttribute('href'),
    ).toBe(`/app/cms-content-modeling/definition-reviews/${REVIEW_ID}`);
  });
});
