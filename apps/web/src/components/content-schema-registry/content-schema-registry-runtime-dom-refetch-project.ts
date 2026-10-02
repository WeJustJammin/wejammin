import {
  buildProjection,
  type ContentSchemaRegistryWorkbenchProjection,
} from './content-schema-registry-canonical-state-validate';
import { decodeIslandProps } from './content-schema-registry-island-props-codec';
import { scanCanonicalWorkbenchIsland } from './content-schema-registry-island-props-scanner';

/**
 * Turns a canonical refetch response into either a validated projection or a
 * fail-closed disabled outcome. It reuses the exact WorkbenchIsland props the
 * same Astro route already serializes and never parses a second document, so no
 * new API, route, query contract, or authority prop is introduced. Failure
 * reasons are a fixed vocabulary and never include protected payload.
 */

export type { ContentSchemaRegistryWorkbenchProjection };

export type ContentSchemaRegistryCanonicalOutcome =
  | {
      readonly kind: 'projection';
      readonly projection: ContentSchemaRegistryWorkbenchProjection;
    }
  | { readonly kind: 'disabled'; readonly reason: string };

export type ContentSchemaRegistryCanonicalFailureReason =
  'markup' | 'props' | 'invalid';

/**
 * Turn a canonical refetch response into either a validated projection or a
 * fail-closed disabled outcome. Never parses a second document and never logs
 * or returns protected payload.
 */
export const parseCanonicalWorkbenchOutcome = (
  html: string,
): ContentSchemaRegistryCanonicalOutcome => {
  const scan = scanCanonicalWorkbenchIsland(html);
  if (scan.count === 0 || scan.props === null)
    return { kind: 'disabled', reason: 'markup' };
  if (scan.count > 1 || scan.ambiguous)
    return { kind: 'disabled', reason: 'props' };
  let decoded: unknown;
  try {
    decoded = decodeIslandProps(JSON.parse(scan.props));
  } catch {
    return { kind: 'disabled', reason: 'props' };
  }
  try {
    return { kind: 'projection', projection: buildProjection(decoded) };
  } catch {
    return { kind: 'disabled', reason: 'invalid' };
  }
};

/** True when a canonical outcome would replace the protected UI. */
export const isCanonicalProjection = (
  outcome: ContentSchemaRegistryCanonicalOutcome,
): outcome is Extract<
  ContentSchemaRegistryCanonicalOutcome,
  { kind: 'projection' }
> => outcome.kind === 'projection';
