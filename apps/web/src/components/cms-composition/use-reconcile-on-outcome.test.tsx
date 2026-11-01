// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { useReconcileOnOutcome } from './use-reconcile-on-outcome';

let root: Root | null = null;
beforeAll(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount());
  root = null;
});

const Probe = ({ active, run }: { active: boolean; run: () => void }): null => {
  useReconcileOnOutcome(active, run);
  return null;
};
const render = async (active: boolean, run: () => void): Promise<void> => {
  root ??= createRoot(document.body.appendChild(document.createElement('div')));
  await act(async () => root!.render(<Probe active={active} run={run} />));
};

describe('useReconcileOnOutcome', () => {
  it('runs once when the outcome appears, not on every render while it stays', async () => {
    const run = vi.fn();
    await render(false, run);
    expect(run).not.toHaveBeenCalled();
    await render(true, run);
    await render(true, run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs again when the outcome ends and a later command ends in it again', async () => {
    const run = vi.fn();
    await render(true, run);
    await render(false, run);
    await render(true, run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('calls the latest closure, never a stale one', async () => {
    const first = vi.fn();
    const second = vi.fn();
    await render(false, first);
    await render(false, second);
    await render(true, second);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
