import { useEffect, useMemo, useRef, useState } from 'react';

import { ACTING_CONTEXT_CHANGED_EVENT } from '../../lib/client-binding';
import { ActingContextRequestError } from './acting-context-errors';
import type { ActingContextSwitcherProps } from './acting-context-model';
import { clearAllStepUpState } from './step-up-mfa/step-up-binding';

/**
 * A different acting context must never inherit the previous one's pending
 * step-up drafts or command envelopes (and their original Idempotency-Keys),
 * so they are cleared before any dependent surface can restore them.
 */
const invalidateDependentSurfaces = (): void => {
  if (typeof window === 'undefined') return;
  try {
    clearAllStepUpState(window.sessionStorage);
  } catch {
    // Blocked storage holds no step-up state to clear.
  }
  window.dispatchEvent(new Event(ACTING_CONTEXT_CHANGED_EVENT));
};

export const useActingContextSwitcher = ({
  contexts,
  items,
  initial,
  selectedContextId,
  selectedPartyId,
  tabContextStatus = 'verified',
  suggestedContextId = null,
  onBindContext,
  onCanonicalRefetch,
  invalidationChannel,
}: ActingContextSwitcherProps) => {
  const supplied = contexts ?? items ?? initial.items;
  const [canonicalItems, setCanonicalItems] = useState(supplied);
  const [selected, setSelected] = useState(selectedContextId);
  const [selectedParty, setSelectedParty] = useState(selectedPartyId);
  const [draft, setDraft] = useState(selectedContextId);
  const [revoked, setRevoked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [needsReconciliation, setNeedsReconciliation] = useState(false);
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  const current = useMemo(
    () =>
      canonicalItems.find(
        ({ contextId, partyId }) =>
          contextId === selected && partyId === selectedParty,
      ),
    [canonicalItems, selected, selectedParty],
  );
  const suggestion = canonicalItems.find(
    ({ contextId }) => contextId === suggestedContextId,
  );

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const channel = new BroadcastChannel(invalidationChannel);
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const payload = event.data;
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('eventType' in payload) ||
        payload.eventType !== 'identity.acting-context.revoked.v1'
      )
        return;
      invalidateDependentSurfaces();
      void onCanonicalRefetch()
        .then((resource) => {
          setCanonicalItems(resource.items);
          const fallback =
            resource.items.find(({ kind }) => kind === 'person') ??
            resource.items[0];
          if (fallback !== undefined) {
            setSelected(fallback.contextId);
            setSelectedParty(fallback.partyId);
            setDraft(fallback.contextId);
          }
          setRevoked(true);
        })
        .catch(() => undefined);
    };
    return () => channel.close();
  }, [invalidationChannel, onCanonicalRefetch]);

  useEffect(() => {
    if (error !== null) errorRef.current?.focus({ preventScroll: true });
  }, [error]);

  const confirmSelection = async (): Promise<void> => {
    const candidate = canonicalItems.find(
      ({ contextId }) => contextId === draft,
    );
    if (
      pending ||
      tabContextStatus !== 'verified' ||
      needsReconciliation ||
      candidate === undefined ||
      !candidate.selectable ||
      draft === selected
    )
      return;
    setError(null);
    setPending(true);
    let bindingAccepted = false;
    try {
      const binding = await onBindContext(draft);
      bindingAccepted = true;
      invalidateDependentSurfaces();
      if (binding.selectedPartyId !== candidate.partyId) {
        setNeedsReconciliation(true);
        throw new ActingContextRequestError(
          'The server confirmed a different context. Reload this page to verify before continuing.',
          true,
        );
      }
      const resource = await onCanonicalRefetch();
      const canonicalCandidate = resource.items.find(
        ({ contextId, partyId, selectable }) =>
          contextId === candidate.contextId &&
          partyId === candidate.partyId &&
          selectable,
      );
      if (canonicalCandidate === undefined) {
        setNeedsReconciliation(true);
        throw new ActingContextRequestError(
          'The server changed context, but this page could not verify the current selection. Reload before continuing.',
          true,
        );
      }
      setCanonicalItems(resource.items);
      setSelected(canonicalCandidate.contextId);
      setSelectedParty(canonicalCandidate.partyId);
      setDraft(canonicalCandidate.contextId);
      setRevoked(false);
      setNeedsReconciliation(false);
    } catch (cause) {
      const requiresReconciliation =
        bindingAccepted ||
        (cause instanceof ActingContextRequestError &&
          cause.requiresReconciliation);
      if (requiresReconciliation) {
        if (!bindingAccepted) invalidateDependentSurfaces();
        setNeedsReconciliation(true);
      }
      setError(
        requiresReconciliation
          ? cause instanceof ActingContextRequestError
            ? cause.message
            : 'The server may have changed context, but this page could not verify it. Reload before continuing.'
          : cause instanceof Error && cause.message.length > 0
            ? cause.message
            : 'The context could not be changed. Your current selection was not changed.',
      );
    } finally {
      setPending(false);
    }
  };

  const changeDraft = (contextId: string): void => {
    setDraft(contextId);
    setError(null);
  };
  const contextVerified =
    tabContextStatus === 'verified' && !needsReconciliation;
  const indicatorLabel =
    tabContextStatus === 'checking'
      ? 'Checking this tab’s server-selected context…'
      : !contextVerified
        ? 'Context could not be verified'
        : (current?.label ?? 'Context unavailable');

  return {
    canonicalItems,
    selected,
    draft,
    revoked,
    error,
    pending,
    contextVerified,
    indicatorLabel,
    current,
    suggestion,
    errorRef,
    changeDraft,
    confirmSelection,
  };
};

export type ActingContextSwitcherState = ReturnType<
  typeof useActingContextSwitcher
>;
