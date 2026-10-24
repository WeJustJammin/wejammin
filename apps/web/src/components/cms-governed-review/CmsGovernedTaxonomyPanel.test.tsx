// @vitest-environment jsdom
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
import CmsGovernedTaxonomyPanel, {
  readTaxonomySubject,
  taxonomySubjectOf,
  type GovernedTaxonomyFacts,
} from './CmsGovernedTaxonomyPanel';
import {
  bodyOf,
  governedEnvironment,
  queuedFetcher,
} from './governed-review-form-test-support';

beforeAll(preloadWorkflowAnswerMachinery);

beforeAll(enableReactAct);
afterAll(disableReactAct);

const TAXONOMY_ID = '0b0f6c1e-5a3d-4d7e-8f21-9a1b2c3d4e5f';
const facts: GovernedTaxonomyFacts = {
  id: SUBJECT_ID,
  contentHash: HASH_A,
  taxonomyId: TAXONOMY_ID,
  taxonomyKey: 'instruments',
  taxonomyVersion: 2,
  state: 'draft',
};

describe('taxonomySubjectOf', () => {
  it('takes the subject id, hash, key, version and lifecycle exactly as the versions read served them', () => {
    expect(taxonomySubjectOf(facts)).toEqual({
      kind: 'taxonomy_version',
      id: SUBJECT_ID,
      hash: HASH_A,
      key: 'instruments',
      version: 2,
      state: 'draft',
    });
  });
});

describe('readTaxonomySubject', () => {
  it('maps the newest version of the vocabulary to the panel subject', async () => {
    const readVersions = vi.fn(async () => ({
      kind: 'loaded' as const,
      page: {
        pageVersion: '1',
        items: [
          { ...facts, version: '2', state: 'review' as const },
          { ...facts, version: '1', taxonomyVersion: 1 },
        ],
      } as never,
    }));
    expect(await readTaxonomySubject(TAXONOMY_ID, readVersions)).toEqual({
      ...taxonomySubjectOf(facts),
      state: 'review',
    });
    expect(readVersions).toHaveBeenCalledWith(TAXONOMY_ID);
  });

  it.each([
    [{ kind: 'unavailable' as const }],
    [{ kind: 'rejected' as const, status: 404 as const }],
    [{ kind: 'loaded' as const, page: { pageVersion: '1', items: [] } }],
  ])(
    'is null when the newest version cannot be verified (%j)',
    async (result) => {
      expect(
        await readTaxonomySubject(TAXONOMY_ID, (async () => result) as never),
      ).toBeNull();
    },
  );
});

describe('CmsGovernedTaxonomyPanel', () => {
  it('submits the vocabulary version it was served and re-reads the versions afterwards', async () => {
    const fetcher = queuedFetcher([
      jsonResponse(
        201,
        governedReviewFixture({ subjectKind: 'taxonomy_version' }),
        { etag: '"1"' },
      ),
    ]);
    const readVersions = vi.fn(async () => ({
      kind: 'loaded' as const,
      page: {
        pageVersion: '1',
        items: [{ ...facts, version: '2', state: 'review' as const }],
      } as never,
    }));
    const { container } = mountElement(
      <CmsGovernedTaxonomyPanel
        detail={facts}
        readVersions={readVersions}
        environment={governedEnvironment(fetcher)}
      />,
    );
    await click(buttonNamed(container, 'Submit for review'));
    await flush();
    expect(bodyOf(fetcher)).toEqual({
      subjectKind: 'taxonomy_version',
      subjectId: SUBJECT_ID,
      subjectHash: HASH_A,
    });
    expect(readVersions).toHaveBeenCalledWith(TAXONOMY_ID);
    expect(container.textContent).toContain('Lifecycle: In review');
  });

  it('offers no submit control for a version that is not a draft', () => {
    const { container } = mountElement(
      <CmsGovernedTaxonomyPanel detail={{ ...facts, state: 'active' }} />,
    );
    expect(container.textContent).toContain('Lifecycle: Active');
    expect(() => buttonNamed(container, 'Submit for review')).toThrow();
  });

  it('shows the review summary it was served and links to that review', () => {
    const { container } = mountElement(
      <CmsGovernedTaxonomyPanel
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
