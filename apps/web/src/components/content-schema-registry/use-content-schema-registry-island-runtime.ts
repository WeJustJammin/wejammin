import * as React from 'react';
import { flushSync } from 'react-dom';

import { ACTING_CONTEXT_CHANGED_EVENT } from '../../lib/client-binding';
import type { HydrationFence } from './content-schema-registry-hydration-fence';
import { installLazyCommandEnhancement } from './content-schema-registry-runtime-dom-lazy';
import { subscribeContentSchemaRegistryInvalidation } from './content-schema-registry-invalidation';
import {
  canonicalAuthNavigate,
  CanonicalRefreshScheduler,
  type FocusLocator,
  type RefetchReason,
} from './content-schema-registry-canonical-refresh-scheduler';
import {
  initialProjectionState,
  toDisabledProjection,
  type ContentSchemaRegistryProjectionState,
} from './content-schema-registry-canonical-state-validate';
import { restoreContentSchemaRegistryFocus } from './content-schema-registry-runtime-dom-refetch-support';
import type { ContentSchemaRegistryWorkbenchProps } from './content-schema-registry-types';

export interface ContentSchemaRegistryIslandRuntime {
  readonly projectionState: ContentSchemaRegistryProjectionState;
  readonly contextEpoch: number;
  readonly loading: boolean;
  readonly offline: boolean;
  readonly message: string | null;
  readonly onCanonicalRefetch: ContentSchemaRegistryWorkbenchProps['onCanonicalRefetch'];
}

/**
 * Browser-owned runtime of the registry island: the canonical refresh
 * scheduler, its projection state, focus restoration, the command
 * enhancement, and the online/offline/acting-context subscriptions. The
 * island component renders; this hook owns every effect.
 */
export function useContentSchemaRegistryIslandRuntime(
  props: Parameters<typeof initialProjectionState>[0] & {
    readonly canonicalRefetchUrl: string;
  },
  ssrHasAuthority: boolean,
  fence: HydrationFence,
): ContentSchemaRegistryIslandRuntime {
  const [contextEpoch, setContextEpoch] = React.useState(0);
  // The lazily loaded views keep their server HTML until their chunk arrives;
  // nothing edits that DOM (draft restore, status, enhancement) before React
  // has hydrated it, or React would discard the edit.
  const [viewsReady, setViewsReady] = React.useState(false);
  React.useEffect(() => fence.whenReady(() => setViewsReady(true)), [fence]);
  const active = ssrHasAuthority && viewsReady;
  const [projectionState, setProjectionState] =
    React.useState<ContentSchemaRegistryProjectionState>(() =>
      initialProjectionState(props),
    );
  const [loading, setLoading] = React.useState(false);
  const [offline, setOffline] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const projectionRef = React.useRef(projectionState);
  projectionRef.current = projectionState;
  const commandCleanupRef = React.useRef<() => void>(() => undefined);
  const [focusLocator, setFocusLocator] = React.useState<FocusLocator>(null);
  const schedulerRef = React.useRef<CanonicalRefreshScheduler | null>(null);
  if (schedulerRef.current === null) {
    schedulerRef.current = new CanonicalRefreshScheduler(
      {
        setLoading,
        setMessage,
        setProjection: (updater) => setProjectionState(updater),
        setFocusLocator,
        currentProjection: () => projectionRef.current,
        navigate: (target) => {
          // Commit the fail-closed state to the DOM before navigating so the
          // protected controls are gone at the moment navigation is observed.
          flushSync(() =>
            setProjectionState((current) =>
              toDisabledProjection(current, 'navigate'),
            ),
          );
          canonicalAuthNavigate(target);
        },
      },
      props.canonicalRefetchUrl,
    );
  }

  React.useEffect(() => {
    schedulerRef.current?.setUrl(props.canonicalRefetchUrl);
  }, [props.canonicalRefetchUrl]);

  const onCanonicalRefetch = React.useCallback(
    async (reason: RefetchReason | 'mutation'): Promise<void> => {
      // A completed mutation reconciles its own result; it never triggers a
      // canonical refetch. Mutation is not a scheduler reason.
      if (reason === 'mutation') return;
      schedulerRef.current?.request(reason);
    },
    [],
  );

  React.useEffect(() => {
    if (typeof document === 'undefined' || !active) return undefined;
    commandCleanupRef.current = installLazyCommandEnhancement(document).dispose;
    document
      .querySelector<HTMLElement>('[data-workbench="content-schema-registry"]')
      ?.setAttribute('data-content-schema-registry-hydrated', 'true');
    return () => {
      commandCleanupRef.current();
      commandCleanupRef.current = () => undefined;
    };
  }, [active]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !active) return undefined;
    const scheduler = schedulerRef.current;
    const subscription = subscribeContentSchemaRegistryInvalidation({
      onInvalidate: () => scheduler?.request('list-read'),
    });
    const onOffline = (): void => setOffline(true);
    const onOnline = (): void => {
      setOffline(false);
      scheduler?.request('reconnect');
    };
    // Context change forces an immediate read and invalidates the in-flight one.
    const onActingContextChanged = (): void => {
      scheduler?.bumpEpoch();
      setContextEpoch((current) => current + 1);
      setProjectionState((current) =>
        toDisabledProjection(current, 'context-change'),
      );
      scheduler?.request('list-read', true);
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    window.addEventListener(
      ACTING_CONTEXT_CHANGED_EVENT,
      onActingContextChanged,
    );
    const kickoff = window.setTimeout(
      () => scheduler?.request('detail-read', true),
      0,
    );
    return () => {
      window.clearTimeout(kickoff);
      scheduler?.dispose();
      subscription.unsubscribe();
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      window.removeEventListener(
        ACTING_CONTEXT_CHANGED_EVENT,
        onActingContextChanged,
      );
    };
  }, [active]);

  const projectionRevision = JSON.stringify([
    projectionState.access,
    projectionState.initialList.status,
    projectionState.initialDetail?.status ?? null,
  ]);
  React.useEffect(() => {
    if (focusLocator === null || typeof document === 'undefined') return;
    restoreContentSchemaRegistryFocus(document, focusLocator);
    const clear = setTimeout(() => setFocusLocator(null), 0);
    return () => clearTimeout(clear);
  }, [projectionRevision, focusLocator]);

  // A denial/failure boundary takes focus so the removed controls are announced
  // from a safe, non-interactive heading.
  const accessState = projectionState.access;
  React.useEffect(() => {
    if (accessState !== 'disabled' || typeof document === 'undefined') return;
    document
      .getElementById('content-schema-registry-capability-heading')
      ?.focus({ preventScroll: true });
  }, [accessState]);

  return {
    projectionState,
    contextEpoch,
    loading,
    offline,
    message,
    onCanonicalRefetch,
  };
}
