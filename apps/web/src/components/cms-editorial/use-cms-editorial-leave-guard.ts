import * as React from 'react';

export interface CmsEditorialLeaveGuard {
  /** The in-app destination the author tried to leave for; null when none. */
  readonly pendingHref: string | null;
  /** Capture-phase click handler for the editor's root element. */
  readonly onClickCapture: (event: React.MouseEvent<HTMLElement>) => void;
  /** Keep editing: close the confirmation and return focus to the link. */
  readonly stay: () => void;
  /** The explicit discard: navigate and let the unsent work go. */
  readonly leaveWithoutSaving: () => void;
  /** Flush the draft first; navigate only when nothing is left unsent. */
  readonly saveAndLeave: () => Promise<void>;
}

export interface CmsEditorialLeaveGuardInput {
  /** True while the author holds work the server has not confirmed. */
  readonly active: boolean;
  /** The explicit save; resolves when the attempt has settled. */
  readonly save: () => Promise<void>;
  /** Read after `save`: is anything still unsent? */
  readonly stillUnsent: () => boolean;
  readonly navigate: (href: string) => void;
}

/** A plain left click that would navigate this tab to another document. */
const leavingAnchor = (
  event: React.MouseEvent<HTMLElement>,
): HTMLAnchorElement | null => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !(event.target instanceof Element)
  )
    return null;
  const anchor = event.target.closest('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  const target = anchor.getAttribute('target');
  if (
    (target !== null && target !== '' && target !== '_self') ||
    anchor.hasAttribute('download')
  )
    return null;
  const url = new URL(anchor.href, window.location.href);
  // A fragment on this very page does not leave it.
  if (
    url.origin === window.location.origin &&
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    url.hash !== ''
  )
    return null;
  return anchor;
};

/**
 * FE03 "Unsaved changes": the scoped draft is retained while the author
 * decides, an inline leave confirmation guards in-app links, and `beforeunload`
 * is armed only while there is unsent work (Codex review s10-ts-2, H2). The
 * native link stays a native link until work is unsent; a destination the
 * author chose explicitly (Leave without saving, or after a verified save) is
 * never blocked by `beforeunload`.
 */
export const useCmsEditorialLeaveGuard = (
  input: CmsEditorialLeaveGuardInput,
): CmsEditorialLeaveGuard => {
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const trigger = React.useRef<HTMLAnchorElement | null>(null);
  const leaving = React.useRef(false);
  const { active } = input;

  React.useEffect(() => {
    if (!active) return undefined;
    const warn = (event: BeforeUnloadEvent): void => {
      if (leaving.current) return;
      event.preventDefault();
      // Legacy browsers require a (ignored) string to raise the prompt.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);

  const leave = (href: string): void => {
    leaving.current = true;
    input.navigate(href);
  };
  const stay = (): void => {
    setPendingHref(null);
    trigger.current?.focus();
    trigger.current = null;
  };

  return {
    pendingHref,
    onClickCapture: (event) => {
      if (!active) return;
      const anchor = leavingAnchor(event);
      if (anchor === null) return;
      event.preventDefault();
      trigger.current = anchor;
      setPendingHref(anchor.getAttribute('href'));
    },
    stay,
    leaveWithoutSaving: () => {
      if (pendingHref !== null) leave(pendingHref);
    },
    saveAndLeave: async () => {
      const href = pendingHref;
      if (href === null) return;
      await input.save();
      if (input.stillUnsent()) {
        // Refused, conflicted or unconfirmed: the page and its banners explain
        // why, and the draft stays here.
        setPendingHref(null);
        return;
      }
      leave(href);
    },
  };
};
