// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  FORM_HARNESSES,
  newWiring,
} from './cms-workflow-focus-harness.test-support';
import {
  answeringFetcher,
  deferred,
  focusOn,
  hangingFetcher,
  lostFetcher,
  release,
  settle,
} from './cms-workflow-focus.test-support';

// The Time authority snapshot is 218 KB; waits are conditions, not budgets.
vi.setConfig({ testTimeout: 90_000 });

beforeAll(enableReactAct);
afterAll(disableReactAct);

/*
 * FE03 "focus stays until navigation or named result heading" and "keep focus
 * on refetch", for every Slice 11 command form on its own (the island tests
 * cover the same rules through the real composition). The commit control is
 * never disabled (a disabled button drops keyboard focus to the body); nothing
 * but a named result heading, the refusal alert or the local-error summary may
 * take focus from the control a person activated.
 */
describe.each(FORM_HARNESSES)('$name', (harness) => {
  const tag = `[${harness.criterion}] ${harness.name}`;

  it(`${tag} keeps focus on the activated control while its command is in flight`, async () => {
    const wire = newWiring(hangingFetcher());
    const { container } = harness.mount(wire);
    const trigger = focusOn(await harness.arm(container));
    await click(trigger);
    await settle();
    await click(trigger);
    await settle();
    expect(wire.fetcher).toHaveBeenCalledTimes(1);
    expect(trigger.disabled).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(wire.refetch).not.toHaveBeenCalled();
    expect(wire.onDone).not.toHaveBeenCalled();
  });

  it(`${tag} keeps focus through an unknown outcome and a reconciling read that is not verified`, async () => {
    const wire = newWiring(lostFetcher());
    const { container } = harness.mount(wire);
    const trigger = focusOn(await harness.arm(container));
    await click(trigger);
    await settle();
    // The lost answer triggers exactly one reconciling read; it verified.
    expect(wire.refetch).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
    wire.refetch.mockResolvedValueOnce(false);
    const check = focusOn(buttonNamed(container, 'Check the current state'));
    await click(check);
    await settle();
    expect(wire.refetch).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(check);
    expect(wire.onDone).not.toHaveBeenCalled();
  });

  it(`${tag} moves focus only to its named result heading once the canonical read has landed`, async () => {
    const wire = newWiring(answeringFetcher(harness.success));
    const read = deferred<boolean>();
    wire.refetch.mockImplementation(() => read.promise);
    const { container } = harness.mount(wire);
    const trigger = focusOn(await harness.arm(container));
    await click(trigger);
    await settle();
    expect(wire.refetch).toHaveBeenCalledTimes(1);
    if (harness.resultHeading === null) {
      // The preview form owns its result region: the token heading takes focus
      // at the commit and a later read does not take it back.
      expect(document.activeElement?.id).toBe('preview-token-title');
      await release(read, true);
      expect(document.activeElement?.id).toBe('preview-token-title');
      return;
    }
    // Committed, but the read behind the result has not landed: focus has not moved.
    expect(document.activeElement).toBe(trigger);
    expect(wire.onDone).not.toHaveBeenCalled();
    await release(read, true);
    expect(wire.onDone).toHaveBeenCalledTimes(1);
    expect(wire.onDone).toHaveBeenCalledWith(harness.resultHeading);
    // The form itself never focuses: the host moves focus to the named heading.
    expect(document.activeElement).toBe(trigger);
  });
});
