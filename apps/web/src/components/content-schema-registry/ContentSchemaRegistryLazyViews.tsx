import * as React from 'react';

import { HydrationFenceContext } from './content-schema-registry-hydration-fence';

import type ContentSchemaRegistryActivationPreparationType from './ContentSchemaRegistryActivationPreparation';
import type ContentSchemaRegistryDetailType from './ContentSchemaRegistryDetail';
import type ContentSchemaRegistryReviewModeType from './ContentSchemaRegistryReviewMode';
import type ContentSchemaRegistryReviewPanelType from './ContentSchemaRegistryReviewPanel';
import type ContentSchemaRegistryVersionCommandsType from './ContentSchemaRegistryVersionCommands';

/**
 * Detail, review and editor views of the registry workbench (FE03 Performance,
 * AC261: detail/editor modules are split). The list route renders none of them,
 * so the browser loads each chunk only on a route that renders it; the server
 * (and the unit tests) import them eagerly so the server-rendered HTML is
 * complete and the hydrated markup matches it. A browser hydrating a detail or
 * review route keeps the server HTML in place until the chunk arrives.
 */
// Vite supplies `import.meta.env` (SSR is true for the server render, MODE is
// "test" under Vitest); the Node loader the Playwright fixtures use supplies
// none, and that process renders on the server, so it is eager as well.
const viteEnv = (
  import.meta as unknown as {
    readonly env?: { readonly SSR?: boolean; readonly MODE?: string };
  }
).env;
const eager =
  viteEnv === undefined || viteEnv.SSR === true || viteEnv.MODE === 'test';

export const ContentSchemaRegistryDetailView: React.ComponentType<
  React.ComponentProps<typeof ContentSchemaRegistryDetailType>
> = eager
  ? (await import('./ContentSchemaRegistryDetail')).default
  : React.lazy(() => import('./ContentSchemaRegistryDetail'));

export const ContentSchemaRegistryActivationPreparationView: React.ComponentType<
  React.ComponentProps<typeof ContentSchemaRegistryActivationPreparationType>
> = eager
  ? (await import('./ContentSchemaRegistryActivationPreparation')).default
  : React.lazy(() => import('./ContentSchemaRegistryActivationPreparation'));

export const ContentSchemaRegistryReviewPanelView: React.ComponentType<
  React.ComponentProps<typeof ContentSchemaRegistryReviewPanelType>
> = eager
  ? (await import('./ContentSchemaRegistryReviewPanel')).default
  : React.lazy(() => import('./ContentSchemaRegistryReviewPanel'));

export const ContentSchemaRegistryVersionCommandsView: React.ComponentType<
  React.ComponentProps<typeof ContentSchemaRegistryVersionCommandsType>
> = eager
  ? (await import('./ContentSchemaRegistryVersionCommands')).default
  : React.lazy(() => import('./ContentSchemaRegistryVersionCommands'));

export const ContentSchemaRegistryReviewModeView: React.ComponentType<
  React.ComponentProps<typeof ContentSchemaRegistryReviewModeType>
> = eager
  ? (await import('./ContentSchemaRegistryReviewMode')).default
  : React.lazy(() => import('./ContentSchemaRegistryReviewMode'));

/** Reports to the island's fence once the boundary around it has hydrated. */
const FenceReady = (): null => {
  const fence = React.useContext(HydrationFenceContext);
  React.useEffect(() => {
    fence?.ready();
  }, [fence]);
  return null;
};

/**
 * One lazily loaded region. The sibling inside the boundary only runs its
 * effect once the boundary has hydrated, which is the signal the island waits
 * for before it edits the region's DOM.
 */
export const LazyBoundary = ({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement => (
  <React.Suspense fallback={null}>
    {children}
    <FenceReady />
  </React.Suspense>
);
