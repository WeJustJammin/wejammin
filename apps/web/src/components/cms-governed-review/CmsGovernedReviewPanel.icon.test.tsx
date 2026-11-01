// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';

import {
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  HASH_A,
  SUBJECT_ID,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedReviewPanel, {
  type GovernedPanelSubject,
} from './CmsGovernedReviewPanel';
import { GOVERNED_SUBJECT_STATE_LABEL } from './governed-state-labels';

beforeAll(preloadWorkflowAnswerMachinery);
beforeAll(enableReactAct);
afterAll(disableReactAct);

const STATES = Object.keys(
  GOVERNED_SUBJECT_STATE_LABEL,
) as (keyof typeof GOVERNED_SUBJECT_STATE_LABEL)[];

const panel = (state: GovernedPanelSubject['state']) => {
  const subject: GovernedPanelSubject = {
    kind: 'template_version',
    id: SUBJECT_ID,
    hash: HASH_A,
    key: 'profile-header',
    version: 2,
    state,
  };
  return mountElement(
    <CmsGovernedReviewPanel
      subject={subject}
      readSubject={async () => subject}
    />,
  );
};

/** [P2-S12-AC-069] FE03: "Lifecycle is text and icon." The text carries the meaning; the icon is decorative and never the only signal. */
describe('CmsGovernedReviewPanel lifecycle icon (FE03 Slice 12 governed surfaces)', () => {
  it('shows exactly one decorative icon beside the lifecycle text for every subject state', () => {
    for (const state of STATES) {
      const { container, unmount } = panel(state);
      const line = container.querySelector('[data-governed-lifecycle]');
      expect(line, state).not.toBeNull();
      expect(line?.textContent).toContain(
        `Lifecycle: ${GOVERNED_SUBJECT_STATE_LABEL[state]}`,
      );
      const icons = line?.querySelectorAll('svg') ?? [];
      expect(icons, state).toHaveLength(1);
      const icon = icons[0] as SVGElement;
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.getAttribute('focusable')).toBe('false');
      expect(icon.getAttribute('data-lifecycle-icon')).toBe(state);
      unmount();
    }
  });

  it('gives every state its own glyph, so the state is never carried by colour alone', () => {
    const glyphs = STATES.map((state) => {
      const { container, unmount } = panel(state);
      const markup = container.querySelector('svg')?.innerHTML ?? '';
      unmount();
      return markup;
    });
    expect(new Set(glyphs).size).toBe(STATES.length);
    for (const glyph of glyphs) expect(glyph).not.toBe('');
  });
});
