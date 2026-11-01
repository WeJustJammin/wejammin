// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsGovernedActivationConfirm from './CmsGovernedActivationConfirm';
import {
  ACTIVATION_COMMIT_LABEL,
  type ActivationAction,
} from './governed-activation-model';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const mount = (action: ActivationAction) =>
  mountElement(
    <CmsGovernedActivationConfirm
      action={action}
      sentence="Subject 1."
      blocked={false}
      pending={false}
      pendingLabel="Working…"
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

/**
 * DESIGN.md Components > Buttons: a destructive action names its consequence and uses Danger only
 * when it is genuinely destructive. Retiring an active version is; activating and scheduling are
 * not, and Cancel never is. The class is styled by `styles/cms-editorial.css`.
 */
describe('CmsGovernedActivationConfirm: Danger on the commit control', () => {
  it('marks the Retire commit control as a danger action', () => {
    const { container } = mount('retire');
    const commit = buttonNamed(container, ACTIVATION_COMMIT_LABEL.retire);
    expect(commit.classList.contains('cms-danger-action')).toBe(true);
    expect(commit.textContent).toBe('Retire this version');
  });

  it('does not mark Cancel in the retire confirmation', () => {
    const { container } = mount('retire');
    expect(
      buttonNamed(container, 'Cancel').classList.contains('cms-danger-action'),
    ).toBe(false);
  });

  it.each(['activate', 'schedule'] as const)(
    'leaves the %s commit control in the ordinary style',
    (action) => {
      const { container } = mount(action);
      expect(container.querySelector('.cms-danger-action')).toBeNull();
    },
  );
});
