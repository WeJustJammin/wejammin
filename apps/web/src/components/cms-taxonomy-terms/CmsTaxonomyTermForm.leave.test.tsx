// @vitest-environment jsdom
import './term-action-preload.test-support';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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
import CmsTaxonomyTermForm from './CmsTaxonomyTermForm';
import {
  doneResult,
  formProps,
  readTermsStub,
  readVersionsStub,
  submitStub,
  termsLoaded,
} from './term-form.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const BASE = formProps().basePath;

/** [P2-S12-AC-048] FE03 "Unsaved changes": retain the scoped draft, confirm inline, `beforeunload` only while dirty, clear only after success or discard. */
const mountForm = (
  results: Parameters<typeof submitStub> = [],
  navigate: (href: string) => void = () => undefined,
) =>
  mountElement(
    <CmsTaxonomyTermForm
      {...formProps({
        query: { lifecycle: 'active', cursor: null },
        submit: submitStub(...results),
        readTerms: readTermsStub(termsLoaded()),
        readVersions: readVersionsStub(),
        navigate,
      })}
    />,
  );

const unloadPrevented = (): boolean => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

const leaveLink = (container: HTMLElement): HTMLAnchorElement => {
  const link = Array.from(container.querySelectorAll('a')).find(
    (anchor) => anchor.textContent === 'Clear filter',
  );
  if (link === undefined) throw new Error('no leaving link rendered');
  return link;
};
const clickEvent = (link: HTMLAnchorElement): MouseEvent => {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
  });
  link.dispatchEvent(event);
  return event;
};

describe('CmsTaxonomyTermForm: leaving with an unsent term draft (FE03 "Unsaved changes")', () => {
  it('arms beforeunload only while the open form holds input', async () => {
    const { container } = mountForm();
    expect(unloadPrevented()).toBe(false);
    await click(buttonNamed(container, 'Create a term'));
    expect(unloadPrevented()).toBe(false);
    await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'cello');
    expect(unloadPrevented()).toBe(true);
    await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), '');
    expect(unloadPrevented()).toBe(false);
  });

  it('shows an inline confirmation instead of leaving, and keeps the typed draft', async () => {
    const navigate = vi.fn();
    const { container } = mountForm([], navigate);
    await click(buttonNamed(container, 'Create a term'));
    await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'cello');
    await typeInto(byLabel<HTMLInputElement>(container, 'Label 1'), 'Cello');
    const link = leaveLink(container);
    const event = clickEvent(link);
    await flush();
    expect(event.defaultPrevented).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    const confirm = container.querySelector('.cms-term-leave');
    expect(confirm?.getAttribute('role')).toBe('alert');
    expect(confirm?.textContent).toContain('discards them');
    expect(byLabel<HTMLInputElement>(container, 'Term key').value).toBe(
      'cello',
    );
    await click(buttonNamed(container, 'Keep editing'));
    expect(container.querySelector('.cms-term-leave')).toBeNull();
    expect(byLabel<HTMLInputElement>(container, 'Term key').value).toBe(
      'cello',
    );
    expect(byLabel<HTMLInputElement>(container, 'Label 1').value).toBe('Cello');
    expect(document.activeElement).toBe(link);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaves only through the explicit discard, to the link the person chose', async () => {
    const navigate = vi.fn();
    const { container } = mountForm([], navigate);
    await click(buttonNamed(container, 'Create a term'));
    await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'cello');
    clickEvent(leaveLink(container));
    await flush();
    await click(buttonNamed(container, 'Leave without saving'));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(BASE);
  });

  it('does not intercept a link while the form is clean or closed', async () => {
    const navigate = vi.fn();
    const { container } = mountForm([], navigate);
    expect(clickEvent(leaveLink(container)).defaultPrevented).toBe(false);
    await click(buttonNamed(container, 'Create a term'));
    expect(clickEvent(leaveLink(container)).defaultPrevented).toBe(false);
    expect(container.querySelector('.cms-term-leave')).toBeNull();
  });

  it('clears the draft and disarms the guard only after success or an explicit cancel', async () => {
    const { container } = mountForm([doneResult()]);
    await click(buttonNamed(container, 'Create a term'));
    await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'cello');
    await typeInto(byLabel<HTMLInputElement>(container, 'Label 1'), 'Cello');
    expect(unloadPrevented()).toBe(true);
    await click(buttonNamed(container, 'Create term'));
    await flush();
    expect(unloadPrevented()).toBe(false);
    expect(clickEvent(leaveLink(container)).defaultPrevented).toBe(false);

    await click(buttonNamed(container, 'Create a term'));
    await typeInto(byLabel<HTMLInputElement>(container, 'Term key'), 'viola');
    expect(unloadPrevented()).toBe(true);
    await click(buttonNamed(container, 'Cancel'));
    expect(unloadPrevented()).toBe(false);
  });
});
