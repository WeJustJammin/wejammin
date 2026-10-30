import type { TermLifecycle } from './taxonomy-terms-read';

/** The browser defaults of the term island's two seams (a test replaces them). */
export const defaultNavigate = (href: string): void => {
  if (typeof window !== 'undefined') window.location.assign(href);
};

export const defaultReplaceUrl =
  (basePath: string) =>
  (lifecycle: TermLifecycle | null): void => {
    if (typeof window === 'undefined') return;
    window.history.replaceState(
      null,
      '',
      lifecycle === null ? basePath : `${basePath}?lifecycle=${lifecycle}`,
    );
  };
