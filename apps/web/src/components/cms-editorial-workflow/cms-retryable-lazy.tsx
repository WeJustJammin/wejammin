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

    private readonly retry = (): void => {
      current = React.lazy(load);
      this.setState({ failed: false });
    };

    override render(): React.ReactNode {
      if (this.state.failed)
        return (
          <p role="alert" data-cms-lazy-view-failed="">
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
