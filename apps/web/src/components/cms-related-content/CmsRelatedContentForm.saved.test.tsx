// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { RelatedRuleSnapshot } from './related-content-types';
import {
  ENTRY_ID,
  candidate,
  id,
  listItems,
  mount,
  submitStub,
  text,
} from './related-content.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

/*
 * The form starts from the stored rule `cmsRelatedContentRead` returned (DEC-195), replacing the read-only
 * boundary of SG-S12-03. The read names the derived rule by key and version only, so the saved bound is
 * unknown and is asked for again; ids are kept exactly as stored, and an id the viewer's entry list cannot
 * show is labelled "Unavailable entry" and kept on save.
 */
const saved: RelatedRuleSnapshot = {
  pins: [id(2), id(1)],
  exclusions: [id(3)],
  derivedRule: { key: 'shared-terms', version: '1', maxCandidates: null },
};
const boundField = (container: HTMLElement) =>
  byLabel(container, /Most entries the rule may choose/u) as HTMLInputElement;
const requestOf = (submit: ReturnType<typeof submitStub>, call = 0) =>
  (
    submit.mock.calls[call] as unknown as [
      {
        pins: string[];
        exclusions: string[];
        entryId: string;
        derivedRule: { key: string; maxCandidates: number } | null;
        expectedVersion: string;
      },
    ]
  )[0];

describe('CmsRelatedContentForm from a stored rule', () => {
  it('starts from the stored pins in order, the stored exclusions and the stored rule', () => {
    const { container } = mount({ rule: saved });
    expect(listItems(container, 'ol.cms-related-rows')).toEqual([id(2), id(1)]);
    expect(listItems(container, 'ul.cms-related-rows')).toEqual([id(3)]);
    expect(
      (byLabel(container, /Shared terms/u) as HTMLInputElement).checked,
    ).toBe(true);
    expect(text(container)).toContain('Save related content');
  });

  it('offers the editing controls: there is no read-only mode', () => {
    const { container } = mount({ rule: saved });
    expect(container.querySelector('button[type="submit"]')).not.toBeNull();
    expect(text(container)).not.toContain(
      'Saving related content is unavailable',
    );
  });

  it('says the saved bound is not shown and asks for it before saving the rule', async () => {
    const submit = submitStub();
    const { container } = mount({ rule: saved, submit });
    expect(boundField(container).value).toBe('');
    expect(text(container)).toContain(
      'The saved bound is not shown on this page.',
    );
    await click(buttonNamed(container, 'Save related content'));
    expect(submit).not.toHaveBeenCalled();
    expect(text(container)).toContain(
      'Enter how many entries the rule may choose, from 1 to 128.',
    );
  });

  it('saves the stored set once the bound is entered: every stored item, the stored order, the entry version', async () => {
    const submit = submitStub();
    const { container } = mount({ rule: saved, submit });
    await typeInto(boundField(container), '8');
    await click(buttonNamed(container, 'Save related content'));
    const request = requestOf(submit);
    expect(request.entryId).toBe(ENTRY_ID);
    expect(request.pins).toEqual([id(2), id(1)]);
    expect(request.exclusions).toEqual([id(3)]);
    expect(request.derivedRule).toMatchObject({
      key: 'shared-terms',
      maxCandidates: 8,
    });
    expect(request.expectedVersion).toBe('4');
  });

  it('needs no bound when the stored rule has no derived rule, and saves it unchanged', async () => {
    const submit = submitStub();
    const { container } = mount({
      rule: { ...saved, derivedRule: null },
      submit,
    });
    expect(text(container)).not.toContain('The saved bound is not shown');
    await click(buttonNamed(container, 'Save related content'));
    const request = requestOf(submit);
    expect(request.pins).toEqual([id(2), id(1)]);
    expect(request.exclusions).toEqual([id(3)]);
    expect(request.derivedRule).toBeNull();
  });

  it('stops saying the bound is unknown once the person chooses another rule or none', async () => {
    const { container } = mount({ rule: saved });
    await click(byLabel(container, /No derived rule/u) as HTMLInputElement);
    expect(text(container)).not.toContain('The saved bound is not shown');
    await click(
      byLabel(container, /Same type, most recent/u) as HTMLInputElement,
    );
    expect(text(container)).not.toContain('The saved bound is not shown');
  });
});

describe('CmsRelatedContentForm: targets the viewer cannot open', () => {
  const hidden: RelatedRuleSnapshot = {
    pins: [id(1), id(9)],
    exclusions: [id(8)],
    derivedRule: null,
  };

  it('labels a stored id the complete entry list does not show as an unavailable entry', () => {
    const { container } = mount({
      rule: hidden,
      candidates: { items: [candidate(1)], nextCursor: null },
    });
    const pins = Array.from(
      container.querySelectorAll('ol.cms-related-rows > li'),
    );
    expect(pins[0]?.textContent).not.toContain('Unavailable entry');
    expect(pins[0]?.textContent).toContain('en-US');
    expect(pins[1]?.textContent).toContain('Unavailable entry');
    expect(pins[1]?.querySelector('code')?.textContent).toBe(id(9));
    const exclusions = container.querySelector('ul.cms-related-rows > li');
    expect(exclusions?.textContent).toContain('Unavailable entry');
  });

  it('does not call an id unavailable while more entries could still show it', () => {
    const { container } = mount({
      rule: hidden,
      candidates: { items: [candidate(1)], nextCursor: 'more' },
    });
    expect(text(container)).not.toContain('Unavailable entry');
    expect(listItems(container, 'ol.cms-related-rows')).toEqual([id(1), id(9)]);
  });

  it('keeps them on save and lets the person remove them with their own controls', async () => {
    const submit = submitStub();
    const { container } = mount({
      rule: hidden,
      candidates: { items: [candidate(1)], nextCursor: null },
      submit,
    });
    await click(buttonNamed(container, 'Save related content'));
    expect(requestOf(submit).pins).toEqual([id(1), id(9)]);
    expect(requestOf(submit).exclusions).toEqual([id(8)]);
    await click(buttonNamed(container, `Remove pin entry ${id(9).slice(-12)}`));
    await click(buttonNamed(container, 'Save related content'));
    expect(requestOf(submit, 1).pins).toEqual([id(1)]);
  });
});
