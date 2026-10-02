import { executeContentSchemaRegistryRead } from './content-schema-registry-runtime';
import { parseCanonicalWorkbenchOutcome } from './content-schema-registry-runtime-dom-refetch-project';
import type { ContentSchemaRegistryWorkbenchProjection } from './content-schema-registry-canonical-state-validate';

/**
 * Maps one canonical read into a React-ownable outcome. It never touches the
 * DOM; the caller applies it through React state so protected UI is replaced or
 * removed by re-render, never by an imperative swap.
 */

export type ContentSchemaRegistryCanonicalReadResult =
  | {
      readonly kind: 'projection';
      readonly projection: ContentSchemaRegistryWorkbenchProjection;
    }
  | { readonly kind: 'disabled'; readonly reason: string }
  | { readonly kind: 'navigate'; readonly target: string };

const sameOriginTarget = (document: Document, value: string): string | null => {
  try {
    const target = new URL(value, document.location.href);
    return target.origin === document.location.origin
      ? target.pathname + target.search + target.hash
      : null;
  } catch {
    return null;
  }
};

const signInTarget = (document: Document): string => {
  const current = document.defaultView?.location;
  const returnTo =
    current === undefined ? '' : current.pathname + current.search;
  return '/auth/sign-in?returnTo=' + encodeURIComponent(returnTo);
};

export const readContentSchemaRegistryCanonicalOutcome = async (
  document: Document,
  canonicalUrl: string,
): Promise<ContentSchemaRegistryCanonicalReadResult> => {
  const result = await executeContentSchemaRegistryRead({ url: canonicalUrl });
  const response = result.response;
  if (response === null) return { kind: 'disabled', reason: 'network' };
  // A manual fetch surfaces a cross-origin-style redirect as an opaque response
  // (status 0, type "opaqueredirect") whose Location is unreadable. Fail closed
  // and route to the safe sign-in shell rather than rendering stale controls.
  if (
    response.type === 'opaqueredirect' ||
    (response.status === 0 &&
      response.ok === false &&
      response.type !== 'basic')
  )
    return { kind: 'navigate', target: signInTarget(document) };
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    const safe =
      location === null ? null : sameOriginTarget(document, location);
    return safe === null
      ? { kind: 'disabled', reason: 'navigation' }
      : { kind: 'navigate', target: safe };
  }
  if (response.status === 401) {
    return { kind: 'navigate', target: signInTarget(document) };
  }
  if (response.status === 403) return { kind: 'disabled', reason: 'forbidden' };
  if (response.status === 404) return { kind: 'disabled', reason: 'not-found' };
  // Any remaining status (including 429 rate limits and dependency 5xx) may
  // carry a canonical server projection describing the exact bounded state; a
  // body that does not decode to a projection fails closed.
  let markup: string;
  try {
    markup = await response.text();
  } catch {
    return { kind: 'disabled', reason: 'unavailable' };
  }
  const outcome = parseCanonicalWorkbenchOutcome(markup);
  return outcome.kind === 'projection'
    ? { kind: 'projection', projection: outcome.projection }
    : { kind: 'disabled', reason: outcome.reason };
};
