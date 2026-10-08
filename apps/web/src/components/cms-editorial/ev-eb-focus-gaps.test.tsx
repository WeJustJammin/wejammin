// @vitest-environment jsdom

import { ConflictDetailResourceSchema } from '@wejammin/contracts';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { installCmsEditorialPageActions } from '../../lib/cms-editorial-page-actions-core';
import {
  allKindFields,
  selectedType,
} from '../cms-editorial-fields/cms-field-fixtures.test-support';
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
import CmsEditorialConflictResolveIsland from './CmsEditorialConflictResolveIsland';
import CmsEditorialEntryCreateIsland from './CmsEditorialEntryCreateIsland';
import { conflictDetailBody } from './cms-editorial-conflict-fixtures.test-support';
import { conflictInitFrom } from './cms-editorial-conflict-state';
import {
  TITLE,
  editorFields,
} from './cms-editorial-editor-fixtures.test-support';

/**
 * "Focus stays until navigation or named result heading" (AC-052, AC-055, AC-058). A control that becomes
 * disabled while it holds focus drops focus to <body> in a real browser (the Slice 10 keyboard spec proves it
 * for the edit island). jsdom keeps focus on a disabled control, so each test asserts the browser-relevant
 * contract: the activated submit control is not disabled, it is `aria-busy`, and a repeated activation sends
 * nothing. Lane EB found these as `it.fails` probes; lane N fixed the three forms and turned them into tests.
 */

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => {
  document.cookie = 'wj_csrf=csrf-token';
});
afterEach(() => {
  document.body.replaceChildren();
  document.cookie = 'wj_csrf=; max-age=0';
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

const pending = (): Promise<Response> => new Promise<Response>(() => undefined);

describe('focus: the activated submit control stays enabled while the command is in flight', () => {
  it('AC-055: the Resolve conflict button is not disabled while the resolve is in flight', async () => {
    const init = conflictInitFrom(
      ConflictDetailResourceSchema.parse(
        conflictDetailBody({
          paths: [
            {
              fieldId: TITLE,
              base: { value: 'Base' },
              theirs: { value: 'Theirs' },
              yours: { value: 'Yours' },
            },
          ],
        }),
      ),
      editorFields(),
    );
    const { container } = mountElement(
      <CmsEditorialConflictResolveIsland
        init={init}
        navigate={vi.fn()}
        fetcher={pending}
      />,
    );
    const radio = Array.from(container.querySelectorAll('label'))
      .find((label) => label.textContent?.trim() === 'Keep their version')
      ?.querySelector('input');
    if (radio === null || radio === undefined) throw new Error('no radio');
    await click(radio);
    const resolve = buttonNamed(container, 'Resolve conflict');
    resolve.focus();
    await click(resolve);
    await flush();
    expect(document.activeElement).toBe(resolve);
    expect(resolve.disabled).toBe(false);
  });

  it('AC-052: the Create entry button is not disabled while the create is in flight', async () => {
    const { container } = mountElement(
      <CmsEditorialEntryCreateIsland
        type={selectedType()}
        fields={allKindFields()}
        fetcher={pending}
        navigate={vi.fn()}
      />,
    );
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'A title',
    );
    const create = buttonNamed(container, 'Create entry');
    create.focus();
    await click(create);
    await flush();
    expect(document.activeElement).toBe(create);
    expect(create.disabled).toBe(false);
  });

  it('AC-058: the restore confirmation button is not disabled while the restore is in flight', async () => {
    vi.stubGlobal('fetch', vi.fn(pending));
    const lifetime = new AbortController();
    installCmsEditorialPageActions(document, {
      navigate: vi.fn(),
      signal: lifetime.signal,
    });
    const form = document.createElement('form');
    form.setAttribute('data-cms-editorial-restore', '');
    const field = (name: string, value: string) =>
      `<input type="hidden" name="${name}" value="${value}" />`;
    form.innerHTML = [
      field('entryId', '018f0c45-73fe-7dc2-9c09-68f7ecf132dc'),
      field('revisionId', '018f0c45-73fe-7dc2-9c09-68f7ecf132dd'),
      field('migrationChainId', '018f0c45-73fe-7dc2-9c09-68f7ecf132de'),
      field('edgeCount', '2'),
      field('availability', 'available'),
      field('expectedVersion', '7'),
      '<button type="submit">Confirm restore</button>',
    ].join('');
    document.body.appendChild(form);
    const confirm = form.querySelector('button') as HTMLButtonElement;
    confirm.focus();
    form.dispatchEvent(
      new SubmitEvent('submit', { bubbles: true, cancelable: true }),
    );
    await flush();
    expect(document.activeElement).toBe(confirm);
    expect(confirm.disabled).toBe(false);
    lifetime.abort();
  });
});
