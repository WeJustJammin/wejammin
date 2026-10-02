import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/** jsdom helpers shared by the OD-4 locale configuration control tests. */

type Scope = Pick<HTMLElement, 'querySelector' | 'querySelectorAll'>;

export interface Mounted {
  readonly container: HTMLDivElement;
  readonly form: HTMLFormElement;
  unmount: () => void;
}

export const mount = (element: React.ReactElement): Mounted => {
  const container = document.createElement('div');
  (document.body as unknown as HTMLElement).appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(element));
  const form = container.querySelector('form');
  if (form === null) throw new Error('no form rendered');
  return {
    container,
    form,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

export const byText = (
  scope: Scope,
  selector: string,
  text: string,
): HTMLElement => {
  const found = [...scope.querySelectorAll<HTMLElement>(selector)].find(
    (element) => element.textContent?.trim() === text,
  );
  if (found === undefined) throw new Error(`no ${selector} with text ${text}`);
  return found;
};

export const buttonNamed = (scope: Scope, name: string): HTMLButtonElement =>
  byText(scope, 'button', name) as HTMLButtonElement;

export const inputByLabel = (scope: Scope, label: string): HTMLInputElement => {
  const target = byText(scope, 'label', label) as HTMLLabelElement;
  const control = scope.querySelector<HTMLInputElement>(
    `#${CSS.escape(target.htmlFor)}`,
  );
  if (control === null) throw new Error(`no control for label ${label}`);
  return control;
};

export const type = (input: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

export const click = (element: Pick<HTMLElement, 'dispatchEvent'>): void => {
  act(() => {
    element.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
  });
};

export const choose = (select: HTMLSelectElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    'value',
  )?.set;
  act(() => {
    setter?.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

export const pressEnter = (input: HTMLInputElement): boolean => {
  let allowed = true;
  act(() => {
    allowed = input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  return allowed;
};

export const submit = (form: HTMLFormElement): boolean => {
  let allowed = true;
  act(() => {
    allowed = form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  });
  return allowed;
};

export const hiddenValue = (form: HTMLFormElement, name: string): string => {
  const field = form.elements.namedItem(name);
  if (
    !(field instanceof HTMLInputElement) &&
    !(field instanceof HTMLSelectElement)
  )
    throw new Error(`no field ${name}`);
  return field.value;
};

export const blur = (element: Pick<HTMLElement, 'dispatchEvent'>): void => {
  act(() => {
    element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
};
