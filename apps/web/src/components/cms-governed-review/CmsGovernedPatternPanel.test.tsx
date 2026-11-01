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
import CmsGovernedPatternPanel, {
  patternSubjectOf,
  readPatternSubject,
  type GovernedPatternFacts,
} from './CmsGovernedPatternPanel';
import {
  bodyOf,
  governedEnvironment,
  queuedFetcher,
} from './governed-review-form-test-support';

beforeAll(preloadWorkflowAnswerMachinery);

beforeAll(enableReactAct);
afterAll(disableReactAct);

const facts: GovernedPatternFacts = {
  id: SUBJECT_ID,
  contentHash: HASH_A,
  patternKey: 'profile-hero',
  patternVersion: 2,
  state: 'draft',
};

describe('patternSubjectOf', () => {
  it('takes the subject id, hash, key, version and lifecycle exactly as the latest read served them', () => {
    expect(patternSubjectOf(facts)).toEqual({
      kind: 'pattern_version',
      id: SUBJECT_ID,
      hash: HASH_A,
      key: 'profile-hero',
      version: 2,
      state: 'draft',
    });
  });
});

describe('readPatternSubject', () => {
  it('maps a loaded latest version to the panel subject', async () => {
    const readLatest = vi.fn(async () => ({
      kind: 'loaded' as const,
      detail: { ...facts, version: '2' } as never,
    }));
    expect(await readPatternSubject('profile-hero', readLatest)).toEqual(
      patternSubjectOf(facts),
    );
    expect(readLatest).toHaveBeenCalledWith('profile-hero');
  });

  it.each([
    [{ kind: 'unavailable' as const }],
    [{ kind: 'rejected' as const, status: 404 as const }],
  ])(
    'is null when the latest version cannot be verified (%j)',
    async (result) => {
      expect(
        await readPatternSubject('profile-hero', (async () => result) as never),
      ).toBeNull();
    },
  );
});

describe('CmsGovernedPatternPanel', () => {
  it('submits the pattern version it was served and re-reads the latest pattern afterwards', async () => {
    const fetcher = queuedFetcher([
      jsonResponse(
        201,
        governedReviewFixture({ subjectKind: 'pattern_version' }),
        {
          etag: '"1"',
        },
      ),
    ]);
    const readLatest = vi.fn(async () => ({
      kind: 'loaded' as const,
      detail: { ...facts, state: 'review' as const } as never,
    }));
    const { container } = mountElement(
      <CmsGovernedPatternPanel
        detail={facts}
        readLatest={readLatest}
        environment={governedEnvironment(fetcher)}
      />,
    );
    await click(buttonNamed(container, 'Submit for review'));
    await flush();
    expect(bodyOf(fetcher)).toEqual({
      subjectKind: 'pattern_version',
      subjectId: SUBJECT_ID,
      subjectHash: HASH_A,
    });
    expect(readLatest).toHaveBeenCalledWith('profile-hero');
    expect(container.textContent).toContain('Lifecycle: In review');
  });

  it('offers no submit control for a version that is not a draft', () => {
    const { container } = mountElement(
      <CmsGovernedPatternPanel detail={{ ...facts, state: 'active' }} />,
    );
    expect(container.textContent).toContain('Lifecycle: Active');
    expect(() => buttonNamed(container, 'Submit for review')).toThrow();
  });

  it('shows the review summary it was served and links to that review', () => {
    const { container } = mountElement(
      <CmsGovernedPatternPanel
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
