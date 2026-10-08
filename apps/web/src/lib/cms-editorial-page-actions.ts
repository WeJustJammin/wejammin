import { installCmsEditorialPageActions } from './cms-editorial-page-actions-core';

/**
 * Bundled entry for the CMS editorial document shell. Loading this script is
 * what installs the document-level submit interceptor (the create form, the
 * restore confirmation and the create type selector); the behavior itself lives
 * in `cms-editorial-page-actions-core.ts` so a test can install it on a clean
 * document. Same self-install shape as `route-heading-focus.ts` and
 * `auth-scope-sync.ts`.
 */
if (typeof document !== 'undefined' && typeof window !== 'undefined')
  installCmsEditorialPageActions(document);
