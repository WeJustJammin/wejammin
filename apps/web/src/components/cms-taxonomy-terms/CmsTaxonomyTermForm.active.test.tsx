// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  loadedVersions,
  versionFacts,
} from '../cms-taxonomy-designer/taxonomy-designer.test-support';
import CmsTaxonomyTermForm from './CmsTaxonomyTermForm';
import {
  REVIEW_HREF,
  doneResult,
  formProps,
  readTermsStub,
  readVersionsStub,
  submitStub,
  termsLoaded,
} from './term-form.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const NEWEST_FIFTY =
  'No active version was found among the newest 50 versions of this vocabulary. Older versions are not searched, so its terms are listed read-only.';
const text = (container: HTMLElement): string => container.textContent ?? '';

/** 50 versions, newest first, none of them active (BE03c 406 holds at most the newest 50). */
const fiftySuperseded = () =>
  Array.from({ length: 50 }, (_value, index) =>
    versionFacts({
      id: `40000000-0000-4000-8000-${String(50 - index).padStart(12, '0')}`,
      version: String(50 - index),
      taxonomyVersion: 50 - index,
      state: 'superseded',
    }),
  );

describe('CmsTaxonomyTermForm: a vocabulary whose active version was not found', () => {
  const noActive = { ...formProps().vocabulary, active: null };

  it('says the search stopped at the newest 50 when the read was full, and links the review', () => {
    const { container } = mountElement(
      <CmsTaxonomyTermForm
        {...formProps({ vocabulary: { ...noActive, versionsBounded: true } })}
      />,
    );
    expect(text(container)).toContain(NEWEST_FIFTY);
    expect(text(container)).not.toContain('has no active version');
    expect(
      container.querySelector(`a[href="${REVIEW_HREF}"]`)?.textContent,
    ).toContain('governed review');
    expect(container.querySelectorAll('table button')).toHaveLength(0);
  });

  it('keeps the plain no-active-version sentence when every version was read', () => {
    const { container } = mountElement(
      <CmsTaxonomyTermForm
        {...formProps({ vocabulary: { ...noActive, versionsBounded: false } })}
      />,
    );
    expect(text(container)).toContain(
      'This vocabulary has no active version, so its terms cannot change.',
    );
    expect(text(container)).not.toContain('newest 50');
  });

  it('applies the same message after a refresh reads 50 versions with no active one', async () => {
    const { container } = mountElement(
      <CmsTaxonomyTermForm
        {...formProps({
          submit: submitStub(doneResult()),
          readTerms: readTermsStub(termsLoaded()),
          readVersions: readVersionsStub(loadedVersions(fiftySuperseded())),
        })}
      />,
    );
    await click(buttonNamed(container, 'Create a term'));
    await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'cello');
    await typeInto(byLabel<HTMLInputElement>(container, 'Label 1'), 'Cello');
    await click(buttonNamed(container, 'Create term'));
    await flush();
    expect(text(container)).toContain(NEWEST_FIFTY);
  });
});
