// @vitest-environment jsdom
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  ENTRY,
  PLACE,
  entryDetail,
  json,
  mountPage,
  noStrayRequests,
  refusal,
  settle,
} from './composition-page.test-support';
import { row, selectorItem } from './composition.test-support';

/*
 * FE03 927 ("Unsaved changes": retain the scoped draft, show an inline leave confirmation, use beforeunload only while
 * dirty, clear only after success or explicit discard) and FE03 1048 / interaction row CMS-12 ("An unknown outcome renders
 * pending and reconciles by refetching ... the entry before any retry"); P2-S12-AC-045.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const hero = selectorItem('hero-block', 2);
const pick = async (container: HTMLElement) =>
  choose(
    byLabel<HTMLSelectElement>(container, 'Pattern'),
    hero.patternVersionId,
  );
const placed = (version = '10') =>
  json(
    {
      items: [
        row(1, { path: '/main/hero1', patternVersion: 2, state: 'draft' }),
      ],
    },
    201,
    `"${version}"`,
  );
const unloadPrevented = (): boolean => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};
const outsideLink = (): HTMLAnchorElement => {
  const link = document.createElement('a');
  link.href = '/app/cms-content-modeling/entries';
  link.textContent = 'Entries';
  document.body.appendChild(link);
  return link;
};
const clickLink = (link: HTMLAnchorElement): MouseEvent => {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
  });
  link.dispatchEvent(event);
  return event;
};
afterEach(() => {
  document.querySelectorAll('body > a').forEach((node) => node.remove());
});

describe('insert: leaving with an unsent placement draft', () => {
  it('arms beforeunload only while the form holds unsent input, and disarms it after a success', async () => {
    const page = mountPage({ [PLACE]: [placed()] });
    expect(unloadPrevented()).toBe(false);
    await pick(page.container);
    expect(unloadPrevented()).toBe(true);
    await click(byLabel<HTMLInputElement>(page.container, /^Linked/u));
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    expect(page.container.textContent).toContain('Pattern placed');
    expect(unloadPrevented()).toBe(false);
  });

  it('treats a changed slot path or typed overrides as unsent input too', async () => {
    const page = mountPage({});
    await typeInto(
      byLabel<HTMLInputElement>(page.container, 'Slot path'),
      '/main',
    );
    expect(unloadPrevented()).toBe(true);
    await typeInto(byLabel<HTMLInputElement>(page.container, 'Slot path'), '/');
    expect(unloadPrevented()).toBe(false);
    await typeInto(
      byLabel<HTMLTextAreaElement>(
        page.container,
        'Overrides (JSON, optional)',
      ),
      '{}',
    );
    expect(unloadPrevented()).toBe(true);
  });

  it('lets a clean form leave without a confirmation', async () => {
    const navigate = vi.fn();
    mountPage({}, { navigate });
    const event = clickLink(outsideLink());
    expect(event.defaultPrevented).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows an inline confirmation instead of leaving, keeps the draft, and leaves only through the explicit discard', async () => {
    const navigate = vi.fn();
    const page = mountPage({}, { navigate });
    await pick(page.container);
    await typeInto(
      byLabel<HTMLInputElement>(page.container, 'Slot path'),
      '/main',
    );
    const link = outsideLink();
    const event = clickLink(link);
    await settle();
    expect(event.defaultPrevented).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    const confirm = page.container.querySelector('.cms-composition-leave');
    expect(confirm?.getAttribute('role')).toBe('alert');
    expect(confirm?.textContent).toContain('discards them');
    await click(buttonNamed(page.container, 'Keep editing'));
    expect(page.container.querySelector('.cms-composition-leave')).toBeNull();
    expect(byLabel<HTMLSelectElement>(page.container, 'Pattern').value).toBe(
      hero.patternVersionId,
    );
    expect(byLabel<HTMLInputElement>(page.container, 'Slot path').value).toBe(
      '/main',
    );
    expect(document.activeElement).toBe(link);
    clickLink(link);
    await settle();
    await click(buttonNamed(page.container, 'Leave without saving'));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/app/cms-content-modeling/entries');
    noStrayRequests(page.unexpected);
  });

  it('never puts the draft in the URL, history or storage', async () => {
    const page = mountPage({});
    await pick(page.container);
    await typeInto(
      byLabel<HTMLTextAreaElement>(
        page.container,
        'Overrides (JSON, optional)',
      ),
      '{"/a": {"t": "secret-draft"}}',
    );
    expect(window.location.href).not.toContain('secret-draft');
    expect(JSON.stringify(Object.entries(window.localStorage))).not.toContain(
      'secret-draft',
    );
    expect(JSON.stringify(Object.entries(window.sessionStorage))).not.toContain(
      'secret-draft',
    );
  });
});

describe('insert: an unknown outcome is reconciled with the entry before any retry', () => {
  const fill = async (container: HTMLElement) => {
    await pick(container);
    await click(byLabel<HTMLInputElement>(container, /^Linked/u));
    await typeInto(byLabel<HTMLInputElement>(container, 'Slot path'), '/main');
  };
  const unknown = () =>
    refusal(502, 'DEPENDENCY_UNAVAILABLE', { retryable: true });

  it('reads the entry, keeps the identical request and key, and offers the retry only after the read', async () => {
    let answerEntry: (value: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => (answerEntry = resolve));
    const page = mountPage({
      [PLACE]: [unknown(), placed()],
      [ENTRY]: [(() => held) as unknown as () => Response],
    });
    await fill(page.container);
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    expect(page.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /api/v1/cms/compositions/pattern-instances',
      `GET /api/v1/cms/entries/${page.calls[1]?.path.split('/').pop()}`,
    ]);
    expect(page.container.textContent).toContain('Checking the entry');
    expect(buttonNamed(page.container, 'Place pattern').disabled).toBe(true);
    answerEntry(entryDetail('9'));
    await settle();
    expect(page.container.textContent).toContain('The result is not known.');
    expect(page.container.textContent).toContain(
      'The entry is still at version 9',
    );
    expect(buttonNamed(page.container, 'Place pattern').disabled).toBe(false);
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    const posts = page.calls.filter((call) => call.method === 'POST');
    expect(posts[1]?.headers['idempotency-key']).toBe(
      posts[0]?.headers['idempotency-key'],
    );
    expect(posts[1]?.body).toEqual(posts[0]?.body);
    expect(posts[1]?.headers['if-match']).toBe('"9"');
    noStrayRequests(page.unexpected);
  });

  it('says so when the entry has moved on, and still retries the same request', async () => {
    const page = mountPage({
      [PLACE]: [unknown(), placed()],
      [ENTRY]: [entryDetail('11')],
    });
    await fill(page.container);
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    expect(page.container.textContent).toContain(
      'The entry has moved to version 11',
    );
    expect(page.container.textContent).toContain('cannot place twice');
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    const posts = page.calls.filter((call) => call.method === 'POST');
    expect(posts[1]?.headers['if-match']).toBe('"9"');
    expect(posts[1]?.headers['idempotency-key']).toBe(
      posts[0]?.headers['idempotency-key'],
    );
  });

  it('says the entry could not be checked when the read fails, and the retry is still offered', async () => {
    const page = mountPage({
      [PLACE]: [unknown()],
      [ENTRY]: [refusal(503, 'DEPENDENCY_UNAVAILABLE')],
    });
    await fill(page.container);
    await click(buttonNamed(page.container, 'Place pattern'));
    await settle();
    expect(page.container.textContent).toContain(
      'The entry could not be read to check',
    );
    expect(buttonNamed(page.container, 'Place pattern').disabled).toBe(false);
  });
});
