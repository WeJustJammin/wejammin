/**
 * Zod-free vocabulary of the publication preflight registry (BE03b D19).
 *
 * The browser publish and review surfaces list the seventeen categories in
 * registry order without shipping zod, so the closed tuple lives here and
 * `preflight.ts` builds `PreflightCategorySchema` from it. Add a category only
 * here, in registry order; `preflight.ts` and its parity test follow.
 */

/** The seventeen categories in registry order (BE03b `PreflightCategory`). */
export const CMS_PREFLIGHT_CATEGORIES = [
  'contract',
  'schema',
  'template',
  'block',
  'pattern',
  'taxonomy',
  'settings',
  'relation',
  'privacy',
  'security',
  'accessibility',
  'media',
  'route',
  'locale',
  'migration',
  'domain_binding',
  'revocation',
] as const;
