// @vitest-environment jsdom
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

/*
 * The term action form loads when the person opens an action, so it arrives after they pressed. Arriving must not move
 * focus the person has already moved (WCAG 2.4.3; FE03 1452 "Refresh never steals focus"). The lazy view is a module-level
 * singleton that stays resolved after its first load, so every test gets a fresh module graph (React included, imported
 * from the same graph) and its first open is the asynchronous one, in any order. This file never imports the preload support.
 */
const fresh = async () => {
  vi.resetModules();
  const react = await import('react');
  const dom =
    await import('../cms-editorial-fields/cms-editor-dom.test-support');
  const form = await import('./CmsTaxonomyTermForm');
  const view = await import('./term-action-view');
  const support = await import('./term-form.test-support');
  const real = { ...view.termActionImporters };
  const mount = () =>
    dom.mountElement(
      react.createElement(
        form.default,
        support.formProps({
          readTerms: support.readTermsStub(support.termsLoaded()),
          readVersions: support.readVersionsStub(),
        }),
      ),
    );
  /** The importer held until `release`, then the real one. */
  const hold = () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    view.termActionImporters.view = (async () => {
      await held;
      return real.view();
    }) as typeof view.termActionImporters.view;
    return release;
  };
  return { act: react.act, dom, mount, hold };
};

beforeAll(async () => {
  (
    await import('../cms-editorial-fields/cms-editor-dom.test-support')
  ).enableReactAct();
});
afterAll(async () => {
  (
    await import('../cms-editorial-fields/cms-editor-dom.test-support')
  ).disableReactAct();
});
beforeEach(() => document.body.replaceChildren());
afterEach(() => document.body.replaceChildren());

describe('the term action form arriving', () => {
  it('leaves focus on the control the person moved to while the chunk was loading', async () => {
    const { act, dom, mount, hold } = await fresh();
    const release = hold();
    const { container } = mount();
    await dom.click(dom.buttonNamed(container, 'Rename term guitar'));
    const create = dom.buttonNamed(container, 'Create a term');
    create.focus();
    expect(document.activeElement).toBe(create);
    await act(async () => release());
    await vi.waitFor(() =>
      expect(container.querySelector('#cms-term-form-heading')).not.toBeNull(),
    );
    await dom.flush();
    expect(document.activeElement).toBe(create);
    // The form did not take their place, so it says that it is there.
    expect(
      container.querySelector('.cms-term-action [role="status"]')?.textContent,
    ).toBe('The term form is ready.');
  });

  it('takes focus for the form heading when the person has not moved', async () => {
    const { act, dom, mount, hold } = await fresh();
    const release = hold();
    const { container } = mount();
    await dom.click(dom.buttonNamed(container, 'Rename term organ'));
    // Still loading: the heading does not exist yet, so nothing but the arrival can focus it.
    expect(container.querySelector('#cms-term-form-heading')).toBeNull();
    await act(async () => release());
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(
        container.querySelector('#cms-term-form-heading'),
      ),
    );
    // Focus moved to the form itself, which is announcement enough.
    expect(
      container.querySelector('.cms-term-action [role="status"]'),
    ).toBeNull();
  });
});
