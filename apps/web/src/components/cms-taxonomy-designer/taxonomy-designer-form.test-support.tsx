import type { TaxonomyVersionRequest } from '@wejammin/contracts';
import * as React from 'react';

import {
  buttonNamed,
  byLabel,
  click,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTaxonomyVersionDesigner from './CmsTaxonomyVersionDesigner';
import { CSRF_TOKEN, type submitStub } from './taxonomy-designer.test-support';

export const mount = (
  props: Partial<React.ComponentProps<typeof CmsTaxonomyVersionDesigner>> = {},
) =>
  mountElement(
    <CmsTaxonomyVersionDesigner
      latest={null}
      csrfToken={CSRF_TOKEN}
      {...props}
    />,
  );
export const text = (container: HTMLElement): string =>
  container.textContent ?? '';
export const checkbox = (
  container: HTMLElement,
  label: string,
): HTMLInputElement => byLabel<HTMLInputElement>(container, label);
export const radio = (
  container: HTMLElement,
  label: RegExp,
): HTMLInputElement => byLabel<HTMLInputElement>(container, label);
export const sentOf = (
  submit: ReturnType<typeof submitStub>,
  call = 0,
): TaxonomyVersionRequest =>
  (submit.mock.calls[call] as unknown as [TaxonomyVersionRequest])[0];

export const fillValid = async (container: HTMLElement) => {
  await typeInto(
    byLabel<HTMLInputElement>(container, 'Vocabulary key'),
    'instruments',
  );
  await click(radio(container, /^Hierarchical/u));
  await typeInto(
    byLabel<HTMLInputElement>(container, 'Content type keys'),
    'article profile',
  );
  await click(buttonNamed(container, 'Add content type key'));
  await typeInto(byLabel<HTMLInputElement>(container, 'Field keys'), 'tags');
  await click(buttonNamed(container, 'Add field key'));
  await click(checkbox(container, 'Role'));
};
