const PAGE_HEADING_ID = 'page-title';

/**
 * FE01: the single h1 receives focus on route load. It never takes focus
 * from an element the person (or autofocus) already holds and it preserves
 * fragment navigation.
 */
export const focusPageHeading = (
  documentRef: Pick<Document, 'activeElement' | 'body' | 'getElementById'>,
  locationRef: Pick<Location, 'hash'>,
): void => {
  if (locationRef.hash !== '') return;
  const active = documentRef.activeElement;
  if (active !== null && active !== documentRef.body) return;
  documentRef.getElementById(PAGE_HEADING_ID)?.focus({ preventScroll: true });
};

const run = (): void => focusPageHeading(document, window.location);

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
}
