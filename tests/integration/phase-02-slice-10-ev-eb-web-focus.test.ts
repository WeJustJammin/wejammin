// @vitest-environment jsdom

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  typeInto,
} from '../../apps/web/src/components/cms-editorial-fields/cms-editor-dom.test-support';
import {
  setup,
  unmountAll,
} from '../../apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland.test-support';

/**
 * Evidence lane EB (AC-052): the edit island keeps its activated Save draft control focusable while a save is in
 * flight. jsdom does not drop focus from a control that becomes disabled (a real browser does), so the contract
 * asserted here is the one a browser needs: the focused control is never disabled and a repeated activation sends
 * nothing. The matching probes for the create form, the conflict form and the restore form live in
 * phase-02-slice-10-ev-eb-web-focus-gaps.test.tsx.
 */

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => {
  document.cookie = 'wj_csrf=csrf-token';
});
afterEach(() => {
  unmountAll();
  document.body.replaceChildren();
  document.cookie = 'wj_csrf=; max-age=0';
  window.sessionStorage.clear();
});

describe('EB edit island focus: the activated Save draft control stays enabled and focused while the save is in flight', () => {
  it('EB edit island: Save draft is marked busy, not disabled, keeps focus and a second activation sends no second request', async () => {
    const pending = new Promise<Response>(() => undefined);
    const { container, calls } = setup([() => pending]);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Held in flight',
    );
    const save = buttonNamed(container, 'Save draft');
    save.focus();
    await click(save);
    await flush();
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    expect(save.disabled).toBe(false);
    expect(save.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(save);
    await click(save);
    await flush();
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    expect(document.activeElement).toBe(save);
  });
});
