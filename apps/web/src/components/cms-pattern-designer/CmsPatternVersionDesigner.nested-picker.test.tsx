// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsPatternVersionDesigner from './CmsPatternVersionDesigner';
import {
  CSRF_TOKEN,
  TYPE_B,
  createdResult,
  designerContext,
  latestDetail,
  submitStub,
} from './pattern-designer.test-support';
import type { NestableReadResult } from './pattern-nestable-read';
import type { ReadNestable } from './use-nestable-patterns';
import { TYPE_ID } from '../../server/cms-pattern-platform.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

/**
 * The designer wires the nested-pattern picker (FE03 `CmsPatternVersionDesigner`, P2-S12-AC-105): the picker lists the active
 * patterns compatible with EVERY content type the version lists, choosing one adds a `pattern` node to the tree, and the
 * request that is saved carries that node as a lineage reference. Nothing here decides authority.
 */
const NESTED = {
  patternId: '20000000-0000-4000-8000-000000000101',
  patternVersionId: '20000000-0000-4000-8000-000000000201',
  patternKey: 'shared-footer',
  patternVersion: 3,
  nodeCount: 2,
  blockRegistryDigest: 'a'.repeat(64),
} as const;
const pageOf = (): NestableReadResult => ({
  kind: 'page',
  page: { items: [NESTED], nextCursor: null, pageVersion: '17' },
});
const mount = (
  props: Partial<React.ComponentProps<typeof CmsPatternVersionDesigner>> = {},
) =>
  mountElement(
    <CmsPatternVersionDesigner
      context={designerContext}
      latest={null}
      csrfToken={CSRF_TOKEN}
      {...props}
    />,
  );
const picker = (container: HTMLElement): HTMLSelectElement =>
  byLabel(container, 'Add a nested pattern') as unknown as HTMLSelectElement;
const boxes = (container: HTMLElement): HTMLInputElement[] =>
  Array.from(
    container.querySelectorAll<HTMLInputElement>(
      'fieldset input[type="checkbox"]',
    ),
  );

describe('CmsPatternVersionDesigner: the nested-pattern picker', () => {
  it('is disabled and says why until the version lists a content type, and reads nothing', async () => {
    const readNestable = vi.fn<ReadNestable>(async () => pageOf());
    const { container } = mount({ readNestable });
    await flush();
    expect(picker(container).disabled).toBe(true);
    expect(buttonNamed(container, 'Add nested pattern').disabled).toBe(true);
    expect(
      container.querySelector('#cms-pattern-nested-reason')?.textContent,
    ).toContain('Choose at least one compatible content type');
    expect(readNestable).not.toHaveBeenCalled();
  });

  it('reads with the version content types, in step with the checkboxes, and adds a nested node that saves as a lineage reference', async () => {
    const submit = submitStub(createdResult());
    const readNestable = vi.fn<ReadNestable>(async () => pageOf());
    const { container } = mount({ submit, readNestable });
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Pattern key'),
      'profile-hero',
    );
    await click(boxes(container)[0] as HTMLElement);
    await flush();
    expect(readNestable.mock.calls.map((call) => call[0])).toEqual([[TYPE_ID]]);
    await click(boxes(container)[1] as HTMLElement);
    await flush();
    expect(readNestable.mock.calls.map((call) => call[0])).toEqual([
      [TYPE_ID],
      [TYPE_ID, TYPE_B],
    ]);
    await choose(picker(container), NESTED.patternVersionId);
    await click(buttonNamed(container, 'Add nested pattern'));
    await flush();
    expect(container.textContent).toContain('Nested pattern');
    expect(container.textContent).toContain(NESTED.patternId);
    expect(container.textContent).toContain('Added nested pattern');
    const keyInput = container.querySelector<HTMLInputElement>(
      'input[id^="cms-pattern-node-"][id$="-key"]',
    );
    expect(keyInput?.value).toBe('shared-footer');
    expect(document.activeElement).toBe(keyInput);
    expect(picker(container).value).toBe('');
    await click(buttonNamed(container, 'Create draft'));
    await flush();
    const [request] = submit.mock.calls[0] as unknown as [unknown];
    expect(request).toEqual({
      patternKey: 'profile-hero',
      compatibleTypeIds: [TYPE_ID, TYPE_B],
      blockTree: [
        {
          kind: 'pattern',
          key: 'shared-footer',
          patternId: NESTED.patternId,
          patternVersion: 3,
        },
      ],
      expectedVersion: null,
    });
  });

  it('starts from the types of the version being edited', async () => {
    const readNestable = vi.fn<ReadNestable>(async () => pageOf());
    mount({
      latest: latestDetail({ compatibleTypeIds: [TYPE_ID, TYPE_B] }),
      readNestable,
    });
    await flush();
    expect(readNestable.mock.calls.map((call) => call[0])).toEqual([
      [TYPE_ID, TYPE_B],
    ]);
  });

  it('cannot add a nested pattern when the tree holds the most top-level nodes', async () => {
    const roots = Array.from({ length: 32 }, (_unused, index) => ({
      kind: 'block' as const,
      key: `node-${index + 1}`,
      blockKey: 'profile.header',
      blockVersion: 1,
      props: {},
      children: [],
    }));
    const { container } = mount({
      latest: latestDetail({ blockTree: roots, nodeCount: 32 }),
      readNestable: vi.fn<ReadNestable>(async () => pageOf()),
    });
    await flush();
    await choose(picker(container), NESTED.patternVersionId);
    expect(buttonNamed(container, 'Add nested pattern').disabled).toBe(true);
    expect(container.textContent).toContain(
      'no room for another top-level node',
    );
  });
});
