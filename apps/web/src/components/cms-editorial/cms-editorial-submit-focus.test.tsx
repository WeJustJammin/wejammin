// @vitest-environment jsdom

import { ConflictDetailResourceSchema } from '@wejammin/contracts';
import { act } from 'react';
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
  apiError,
  editorFields,
} from './cms-editorial-editor-fixtures.test-support';

/**
 * Follow-up to the Save draft fix (lane P) in the other three forms (lane EB,
 * AC-052 / AC-055 / AC-058): the activated submit control is never disabled
 * while its command is in flight (Chrome would drop focus to <body>); it is
 * `aria-busy`, the state machine refuses a concurrent submit, and the states
 * that do disable the form's controls move focus explicitly (FE03: focus stays
 * until navigation or a named result).
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

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/** A fetcher that never answers, counting how many requests were made. */
const hanging = () => {
  const fetcher = vi.fn<Fetcher>(() => new Promise<Response>(() => undefined));
  return fetcher;
};

const settle = async (): Promise<void> => {
  await act(async () => {
    for (let tick = 0; tick < 40; tick += 1) await Promise.resolve();
  });
  await flush();
};

describe('create form: Create entry stays put while the create is in flight', () => {
  const mountCreate = (fetcher: Fetcher) =>
    mountElement(
      <CmsEditorialEntryCreateIsland
        type={selectedType()}
        fields={allKindFields()}
        fetcher={fetcher}
        navigate={vi.fn()}
      />,
    );

  it('is aria-busy rather than disabled, and a repeated activation sends one request', async () => {
    const fetcher = hanging();
    const { container } = mountCreate(fetcher);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'A title',
    );
    const create = buttonNamed(container, 'Create entry');
    create.focus();
    await click(create);
    await click(create);
    await click(create);
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(create.disabled).toBe(false);
    expect(create.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(create);
  });

  it('after an unknown outcome the form locks and focus moves to the retry button, not <body>', async () => {
    const fetcher = vi.fn<Fetcher>(async () => {
      throw new TypeError('Failed to fetch');
    });
    const { container } = mountCreate(fetcher);
    const title = byLabel<HTMLInputElement>(container, 'Title (required)');
    await typeInto(title, 'A title');
    title.focus();
    await act(async () => {
      title.form?.requestSubmit();
    });
    await settle();
    const retry = buttonNamed(container, 'Retry create');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(title.matches(':disabled')).toBe(true);
    expect(document.activeElement).toBe(retry);
  });
});

describe('conflict form: Resolve conflict stays put while the resolve is in flight', () => {
  const mountConflict = (fetcher: Fetcher) => {
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
    const view = mountElement(
      <CmsEditorialConflictResolveIsland
        init={init}
        navigate={vi.fn()}
        fetcher={fetcher}
      />,
    );
    const radio = (name: string): HTMLInputElement => {
      const found = Array.from(view.container.querySelectorAll('label'))
        .find((label) => label.textContent?.trim() === name)
        ?.querySelector('input');
      if (found === null || found === undefined) throw new Error(name);
      return found;
    };
    return { ...view, radio };
  };

  it('is aria-busy rather than disabled, and a repeated activation sends one request', async () => {
    const fetcher = hanging();
    const { container, radio } = mountConflict(fetcher);
    await click(radio('Keep their version'));
    const resolve = buttonNamed(container, 'Resolve conflict');
    resolve.focus();
    await click(resolve);
    await click(resolve);
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(resolve.disabled).toBe(false);
    expect(resolve.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(resolve);
  });

  it('keeps the request that is in flight: a choice changed meanwhile is not applied', async () => {
    const fetcher = hanging();
    const { container, radio } = mountConflict(fetcher);
    await click(radio('Keep their version'));
    await click(buttonNamed(container, 'Resolve conflict'));
    await click(radio('Keep your version'));
    expect(radio('Keep their version').checked).toBe(true);
    expect(radio('Keep your version').checked).toBe(false);
  });

  it('keeps a focused radio enabled while submitting with Enter from the radio', async () => {
    const fetcher = hanging();
    const { container, radio } = mountConflict(fetcher);
    const theirs = radio('Keep their version');
    await click(theirs);
    theirs.focus();
    await act(async () => {
      container.querySelector('form')?.requestSubmit();
    });
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(theirs.matches(':disabled')).toBe(false);
    expect(document.activeElement).toBe(theirs);
  });

  it('moves focus to the alert when the conflict turns out to be closed', async () => {
    const fetcher = vi.fn<Fetcher>(async () => apiError(404, 'NOT_FOUND'));
    const { container, radio } = mountConflict(fetcher);
    await click(radio('Keep their version'));
    const resolve = buttonNamed(container, 'Resolve conflict');
    resolve.focus();
    await click(resolve);
    await settle();
    const alert = container.querySelector<HTMLElement>('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(document.activeElement).toBe(alert);
  });

  it('after an unknown outcome focus moves to the retry button, not <body>', async () => {
    const fetcher = vi.fn<Fetcher>(async () => {
      throw new TypeError('Failed to fetch');
    });
    const { container, radio } = mountConflict(fetcher);
    const theirs = radio('Keep their version');
    await click(theirs);
    theirs.focus();
    await act(async () => {
      container.querySelector('form')?.requestSubmit();
    });
    await settle();
    const retry = buttonNamed(container, 'Retry resolve');
    expect(theirs.matches(':disabled')).toBe(true);
    expect(document.activeElement).toBe(retry);
  });
});

describe('restore confirmation: Confirm restore stays put while the restore is in flight', () => {
  const field = (name: string, value: string) =>
    `<input type="hidden" name="${name}" value="${value}" />`;

  const mountRestore = (fetch: Fetcher) => {
    vi.stubGlobal('fetch', fetch);
    const lifetime = new AbortController();
    installCmsEditorialPageActions(document, {
      navigate: vi.fn(),
      signal: lifetime.signal,
    });
    const form = document.createElement('form');
    form.setAttribute('data-cms-editorial-restore', '');
    form.innerHTML = [
      field('entryId', '018f0c45-73fe-7dc2-9c09-68f7ecf132dc'),
      field('revisionId', '018f0c45-73fe-7dc2-9c09-68f7ecf132dd'),
      field('migrationChainId', '018f0c45-73fe-7dc2-9c09-68f7ecf132de'),
      field('edgeCount', '2'),
      field('availability', 'available'),
      field('expectedVersion', '7'),
      '<button type="button" data-cancel>Cancel</button>',
      '<button type="submit">Confirm restore</button>',
    ].join('');
    document.body.appendChild(form);
    return {
      form,
      confirm: form.querySelector('[type="submit"]') as HTMLButtonElement,
      cancel: form.querySelector('[data-cancel]') as HTMLButtonElement,
      stop: () => lifetime.abort(),
    };
  };
  const submit = (form: HTMLFormElement): void => {
    form.dispatchEvent(
      new SubmitEvent('submit', { bubbles: true, cancelable: true }),
    );
  };

  it('is aria-busy rather than disabled, and a repeated submit sends one request', async () => {
    const fetcher = hanging();
    const { form, confirm, stop } = mountRestore(fetcher);
    confirm.focus();
    submit(form);
    submit(form);
    submit(form);
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(confirm.disabled).toBe(false);
    expect(confirm.getAttribute('aria-busy')).toBe('true');
    expect(form.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(confirm);
    stop();
  });

  it('still makes the other controls of the form inert while the restore runs', async () => {
    const fetcher = hanging();
    const { form, confirm, cancel, stop } = mountRestore(fetcher);
    confirm.focus();
    submit(form);
    await flush();
    expect(cancel.disabled).toBe(true);
    stop();
  });

  it('releases the form and moves focus to the failure summary when the restore is refused (FE03 :2599)', async () => {
    const fetcher = vi.fn<Fetcher>(async () => apiError(409, 'CONFLICT'));
    const { form, confirm, cancel, stop } = mountRestore(fetcher);
    confirm.focus();
    submit(form);
    await settle();
    expect(form.getAttribute('aria-busy')).toBe('false');
    expect(confirm.getAttribute('aria-busy')).toBeNull();
    expect(cancel.disabled).toBe(false);
    expect(confirm.disabled).toBe(false);
    expect(document.activeElement).toBe(
      form.querySelector('[data-cms-editorial-restore-error] h4'),
    );
    stop();
  });
});
