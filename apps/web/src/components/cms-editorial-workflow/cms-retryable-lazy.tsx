import * as React from 'react';

/**
 * `React.lazy` for a chunk that may not arrive (a stale tab after a deploy, a dropped connection).
 * `React.lazy` remembers a rejection for good and throws it into the island; this keeps the page,
 * says in an alert that the form could not be loaded, and offers the load again, which imports
 * again. The boundary renders no element of its own around a loaded view, so the server markup
 * and the hydrated markup are the same as for a plain lazy view.
 */
export const LAZY_VIEW_UNAVAILABLE_COPY =
  'This form could not be loaded. Check your connection and try again.';

type Loader<P> = () => Promise<{ readonly default: React.ComponentType<P> }>;

export const retryableLazy = <P extends object>(
  load: Loader<P>,
): React.ComponentType<P> => {
  let current = React.lazy(load);

  class Boundary extends React.Component<
    { readonly viewProps: P },
    { readonly failed: boolean }
  > {
    override state = { failed: false };

    static getDerivedStateFromError(): { failed: boolean } {
      return { failed: true };
    }

    private retried = false;

    // The retry button left with the old alert, taking focus with it: a retry that fails again puts focus on the new
    // alert, so the person is told where they are instead of being dropped on the page (WCAG 2.4.3).
    private readonly focusAlert = (
      alert: HTMLParagraphElement | null,
    ): void => {
      if (alert === null || !this.retried) return;
      this.retried = false;
      alert.focus();
    };

    private readonly retry = (): void => {
      this.retried = true;
      // A retry that loads is over: a later render error of the loaded view is not a retry and must not take focus.
      current = React.lazy(async () => {
        const loaded = await load();
        this.retried = false;
        return loaded;
      });
      this.setState({ failed: false });
    };

    override render(): React.ReactNode {
      if (this.state.failed)
        return (
          <p
            role="alert"
            tabIndex={-1}
            ref={this.focusAlert}
            data-cms-lazy-view-failed=""
          >
            {LAZY_VIEW_UNAVAILABLE_COPY}{' '}
            <button type="button" onClick={this.retry}>
              Try loading this form again
            </button>
          </p>
        );
      const Lazy = current as unknown as React.ComponentType<P>;
      return <Lazy {...this.props.viewProps} />;
    }
  }

  return function RetryableLazyView(props: P): React.ReactElement {
    return <Boundary viewProps={props} />;
  };
};
