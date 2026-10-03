export const ROUTE_PAGE_LOAD_EVENT = 'astro:page-load';
const PAGE_HEADING_ID = 'page-title';

export interface RouteHeadingFocusDocument {
  readonly addEventListener: (type: string, listener: () => void) => void;
  readonly getElementById: (id: string) => HTMLElement | null;
}

export interface RouteHeadingFocusLocation {
  readonly hash: string;
}

/**
 * Focuses the route heading after client navigation while preserving the
 * browser's initial and fragment-navigation focus destinations.
 */
export const installRouteHeadingFocus = (
  documentRef: RouteHeadingFocusDocument,
  locationRef: RouteHeadingFocusLocation,
): void => {
  let initialPageLoad = true;
  documentRef.addEventListener(ROUTE_PAGE_LOAD_EVENT, () => {
    if (initialPageLoad) {
      initialPageLoad = false;
      return;
    }
    if (locationRef.hash !== '') return;
    documentRef.getElementById(PAGE_HEADING_ID)?.focus({ preventScroll: true });
  });
};

type MarkStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

const FOCUS_MARK_KEY = 'wj:focus-route-heading';

/**
 * FE03 "Completion: Focus result heading". A committed command that navigates to
 * its result leaves this one-shot, identifier-free, tab-scoped mark so the
 * destination route takes focus at its heading on its initial load.
 */
export const markRouteHeadingForFocus = (storage: MarkStorage | null): void => {
  try {
    storage?.setItem(FOCUS_MARK_KEY, '1');
  } catch {
    // Storage may be blocked; the page then keeps the browser's default focus.
  }
};

/** Reads and clears the mark; blocked or absent storage reads as no mark. */
export const consumeRouteHeadingFocusMark = (
  storage: MarkStorage | null,
): boolean => {
  if (storage === null) return false;
  try {
    const marked = storage.getItem(FOCUS_MARK_KEY) === '1';
    if (marked) storage.removeItem(FOCUS_MARK_KEY);
    return marked;
  } catch {
    return false;
  }
};

export const shouldFocusInitialHeading = (input: {
  readonly search: URLSearchParams;
  readonly hash: string;
  readonly storage: MarkStorage | null;
}): boolean => {
  // The mark is always consumed so it can never leak onto a later load.
  const marked = consumeRouteHeadingFocusMark(input.storage);
  if (input.hash !== '') return false;
  return marked || input.search.has('tab') || input.search.has('selected');
};

const sessionStorageOrNull = (): MarkStorage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const focusInitialNavigationHeading = (): void => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (
    !shouldFocusInitialHeading({
      search: new URL(window.location.href).searchParams,
      hash: window.location.hash,
      storage: sessionStorageOrNull(),
    })
  )
    return;
  const focus = (): void =>
    document.getElementById(PAGE_HEADING_ID)?.focus({ preventScroll: true });
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', focus, { once: true });
  else focus();
};

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  installRouteHeadingFocus(document, window.location);
  focusInitialNavigationHeading();
}
