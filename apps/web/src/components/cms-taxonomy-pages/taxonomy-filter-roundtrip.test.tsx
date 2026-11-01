// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  TAXONOMY_ID,
  jsonResponse,
  termsPageFixture,
  versionsPageFixture,
} from '../../server/cms-taxonomy-platform.test-support';
import {
  byLabel,
  choose,
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTaxonomyTermForm from '../cms-taxonomy-terms/CmsTaxonomyTermForm';
import { formProps } from '../cms-taxonomy-terms/term-form.test-support';
import { loadTaxonomyPage } from './load-taxonomy-page';

beforeAll(enableReactAct);
afterAll(disableReactAct);

/**
 * The composition the unit tests of the form and of the loader cannot see alone: the address a
 * browser builds when the filter form is submitted, read back by the page loader (FE03 :1068).
 */
const submittedAddress = (form: HTMLFormElement): string => {
  const parameters = new URLSearchParams(
    Array.from(new FormData(form)).map(([name, value]) => [
      name,
      String(value),
    ]),
  );
  const search = parameters.size === 0 ? '' : `?${parameters}`;
  return `https://web.test${form.getAttribute('action')}${search}`;
};

const loadAddress = async (address: string) => {
  const reads = {
    versions: vi.fn(async () =>
      jsonResponse(200, versionsPageFixture(), {
        etag: `"${versionsPageFixture().pageVersion}"`,
      }),
    ),
    terms: vi.fn(async () =>
      jsonResponse(200, termsPageFixture(), {
        etag: `"${termsPageFixture().pageVersion}"`,
      }),
    ),
  };
  const outcome = await loadTaxonomyPage({
    request: new Request(address, { headers: { cookie: 'wj_csrf=csrf-1' } }),
    taxonomyId: TAXONOMY_ID,
    reads,
  });
  return { outcome, reads };
};

describe('the term filter form read back by the page loader', () => {
  it.each([
    ['all terms', '', null, ''],
    ['active terms', 'active', 'active', '?lifecycle=active'],
    ['merged terms', 'merged', 'merged', '?lifecycle=merged'],
  ])(
    'serves the page for %s',
    async (_name, choice, lifecycle, forwardedSearch) => {
      const { container } = mountElement(
        <CmsTaxonomyTermForm
          {...formProps({ query: { lifecycle: 'deprecated', cursor: null } })}
        />,
      );
      await choose(byLabel<HTMLSelectElement>(container, 'Show'), choice);
      const form = container.querySelector(
        'form.cms-term-filter',
      ) as HTMLFormElement;
      const { outcome, reads } = await loadAddress(submittedAddress(form));
      expect(outcome.kind).toBe('view');
      if (outcome.kind === 'view')
        expect(outcome.view.query).toEqual({ lifecycle, cursor: null });
      expect(reads.terms).toHaveBeenCalledWith(
        expect.any(Request),
        TAXONOMY_ID,
        forwardedSearch,
      );
    },
  );

  it('still refuses a lifecycle that is not one of the three', async () => {
    const { outcome } = await loadAddress(
      `https://web.test/app/cms-content-modeling/taxonomies/${TAXONOMY_ID}?lifecycle=gone`,
    );
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(400);
  });
});
