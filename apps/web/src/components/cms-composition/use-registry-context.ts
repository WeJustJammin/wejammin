import { useCallback, useEffect, useRef, useState } from 'react';
import type { TemplateDesignerContext } from '@wejammin/contracts';

import type { BlockSelector } from './cms-registry-changes';
import { useCmsTemplateRateWait } from './cms-template-rate-wait';
import { readRegistryOnDemand } from './registry-read-on-demand';
import type { RegistryReadState } from './registry-read-types';
import { useReconcileOnOutcome } from './use-reconcile-on-outcome';

export type { RegistryReadState } from './registry-read-types';

/**
 * The designer context an island chooses from, re-read by itself after a 409 `block_registry_digest_mismatch` (FE03
 * 1048 `commandState` error: 409 reasons "refetch"; review V19 M2). The person's values are never touched: only the
 * block choices are replaced, the selectors that changed are named, and no new send is possible while the read runs
 * or after it failed (a send would carry choices the registry no longer offers).
 */
export const useRegistryContext = <
  C extends { registeredBlocks: readonly BlockSelector[] },
>(
  initial: C,
  adapt: (context: TemplateDesignerContext) => C,
  digestRefused: boolean,
) => {
  const [context, setContext] = useState(initial);
  const [state, setState] = useState<RegistryReadState>({ kind: 'none' });
  const current = useRef(initial);
  const sequence = useRef(0);
  const mounted = useRef(true);
  const wait = useCmsTemplateRateWait();
  const startWait = wait.start;

  // Re-armed on every mount: React.StrictMode runs the cleanup once and mounts again in development.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sequence.current += 1;
    };
  }, []);

  const check = useCallback(async (): Promise<void> => {
    const mine = ++sequence.current;
    setState({ kind: 'checking' });
    const read = await readRegistryOnDemand(current.current.registeredBlocks);
    if (!mounted.current || sequence.current !== mine) return;
    if (read.waitSeconds !== undefined) startWait(read.waitSeconds);
    setState(read.state);
    if (read.context === null) return;
    const next = adapt(read.context);
    current.current = next;
    setContext(next);
  }, [adapt, startWait]);

  useReconcileOnOutcome(digestRefused, () => void check());

  return {
    context,
    state,
    /** A send is held while the read runs and after it failed. */
    holding: state.kind === 'checking' || state.kind === 'failed',
    waiting: wait.waiting,
    check: () => void check(),
  };
};
