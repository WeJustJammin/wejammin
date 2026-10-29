// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsPatternVersionDesigner from './CmsPatternVersionDesigner';
import {
  CSRF_TOKEN,
  designerContext,
  latestDetail,
  submitStub,
} from './pattern-designer.test-support';
import { PATTERN_ISSUE_COPY } from './pattern-designer-copy';
import type { PatternSubmitResult } from './pattern-designer-submit';

beforeAll(enableReactAct);
afterAll(disableReactAct);

/*
 * DEC-228 (FE03 885; P2-S12-AC-105): "a cycle, depth or node-count refusal render inline with the node path; error summary
 * links to the node". The default saved pattern is `hero` (Node 1) with one child `title` (Node 1.1).
 */
const refuse = async (result: PatternSubmitResult) => {
  const view = mountElement(
    <CmsPatternVersionDesigner
      context={designerContext}
      latest={latestDetail()}
      csrfToken={CSRF_TOKEN}
      submit={submitStub(result)}
    />,
  );
  await click(buttonNamed(view.container, 'Save successor draft'));
  await flush();
  return view.container;
};
const status = (container: HTMLElement): HTMLElement =>
  container.querySelector('#cms-pattern-status') as HTMLElement;

describe('CmsPatternVersionDesigner: a refusal that names its node (DEC-228)', () => {
  it.each([
    ['pattern_depth_exceeded', 422],
    ['pattern_nodes_exceeded', 422],
    ['pattern_cycle', 409],
  ] as const)(
    'links %s to Node 1.1 and renders it inline at that node',
    async (reason, httpStatus) => {
      const container = await refuse({
        kind: 'refused',
        status: httpStatus,
        reason,
        nodePath: [0, 0],
      });
      const copy = PATTERN_ISSUE_COPY[reason];
      const links = Array.from(status(container).querySelectorAll('a'));
      expect(links.map((link) => link.textContent)).toEqual([
        `Node 1.1: ${copy}`,
      ]);
      const nodeId = (links[0] as HTMLAnchorElement)
        .getAttribute('href')
        ?.slice(1) as string;
      const target = container.querySelector(`#${nodeId}`) as HTMLElement;
      expect(target.tagName).toBe('LI');
      expect(target.textContent).toContain('Node 1.1');
      expect(target.querySelector('.cms-field-errors')?.textContent).toBe(copy);
      // The error belongs to that node only: it is the one node-level error of the tree.
      const nodeErrors = container.querySelectorAll(
        '#cms-pattern-tree li .cms-field-errors',
      );
      expect(nodeErrors).toHaveLength(1);
      expect(target.contains(nodeErrors[0] as Element)).toBe(true);
      await click(links[0] as HTMLElement);
      expect(document.activeElement).toBe(target);
    },
  );

  it('falls back to the tree link when the pointer names no node on screen', async () => {
    const container = await refuse({
      kind: 'refused',
      status: 422,
      reason: 'pattern_depth_exceeded',
      nodePath: [4, 0],
    });
    const links = Array.from(status(container).querySelectorAll('a'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#cms-pattern-tree',
    ]);
    expect(
      container.querySelector('#cms-pattern-tree li .cms-field-errors'),
    ).toBeNull();
  });
});
