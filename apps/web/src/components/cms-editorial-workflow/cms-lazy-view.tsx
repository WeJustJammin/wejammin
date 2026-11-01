import * as React from 'react';

import { whenRegionIntent } from './cms-lazy-intent';
import { retryable } from '../../lib/retryable-import';
import { retryableLazy } from './cms-retryable-lazy';

/**
 * Command forms of the CMS workflow and governed review surfaces load when they are first
 * offered, not with the island (FE03 "Performance budgets and loading strategy": each hydrated entry stays within its
 * island budget and the page within its initial-route budget). The pattern follows
 * `content-schema-registry/ContentSchemaRegistryLazyViews.tsx`: the server and the test renderer
 * include the form eagerly so the served HTML is complete and the hydrated markup matches it; the
 * browser keeps that HTML in place until the chunk arrives.
 */
type Loader<P> = () => Promise<{ readonly default: React.ComponentType<P> }>;

interface ViteEnvironment {
  readonly SSR?: boolean;
  readonly MODE?: string;
}

/**
 * Whether a form is included eagerly. Vite supplies `import.meta.env` (SSR is true for the
 * server render, MODE is "test" under Vitest); the Node loader the Playwright fixtures use
 * supplies none, and that process renders on the server, so it is eager as well.
 */
export const eagerRenderFor = (env: ViteEnvironment | undefined): boolean =>
  env === undefined || env.SSR === true || env.MODE === 'test';

export const EAGER_RENDER = eagerRenderFor(
  (import.meta as unknown as { readonly env?: ViteEnvironment }).env,
);

/** The component itself where the render is eager, else a lazy one that has not loaded yet. */
export const selectView = async <P extends object>(
  eager: boolean,
  load: Loader<P>,
): Promise<React.ComponentType<P>> =>
  eager ? (await load()).default : retryableLazy(retryable(load));

/** A form view for this render environment. */
export const loadView = <P extends object>(
  load: Loader<P>,
): Promise<React.ComponentType<P>> => selectView(EAGER_RENDER, load);

/**
 * Like `selectView`, but in the browser the chunk waits for the first sign of intent in the
 * form's region (`cms-lazy-intent.ts`), so a form no one has reached is not part of the cold load.
 */
export const selectViewOnIntent = async <P extends object>(
  eager: boolean,
  region: string,
  load: Loader<P>,
): Promise<React.ComponentType<P>> =>
  selectView(eager, async () => {
    await whenRegionIntent(region);
    return load();
  });

/**
 * A form view that loads on intent in its region. The form's server markup must carry
 * `data-cms-lazy-region="<region>"` (the command frame renders it from its `lazyRegion` prop) and
 * the form marks the region hydrated when it mounts.
 */
export const loadViewOnIntent = <P extends object>(
  region: string,
  load: Loader<P>,
): Promise<React.ComponentType<P>> =>
  selectViewOnIntent(EAGER_RENDER, region, load);

export interface WhenOfferedProps {
  /** The server permits the action right now. */
  readonly offered: boolean;
  readonly children: React.ReactNode;
}

/**
 * Mounts its form the first time the action is offered and keeps it mounted for the life of the
 * island, even after the offer is withdrawn: the canonical re-read that follows a refusal can
 * remove the action, and it must not erase the sentence that says why
 * (`governed-review-form-visibility.ts`). A person who is never offered the action never loads
 * the form.
 */
export function WhenOffered({
  offered,
  children,
}: WhenOfferedProps): React.ReactElement {
  const [seen, setSeen] = React.useState(offered);
  if (offered && !seen) setSeen(true);
  return seen || offered ? (
    <React.Suspense fallback={null}>{children}</React.Suspense>
  ) : (
    <></>
  );
}
