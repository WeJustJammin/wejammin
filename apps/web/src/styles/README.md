# Web styles

## Contents

This directory contains web-surface styles for infrastructure pages, jobs, the
release/recovery status projection, and the CMS editorial surfaces
(`cms-editorial.css`, imported by the editorial document shell; `cms-danger-action.css`).

## Ownership

These styles own presentation only. UI tokens remain the design authority;
routes and components own semantics, authorization, and state decisions.

CMS surfaces share one destructive-button treatment, `cms-danger-action.css`: add
`class="cms-danger-action"` to a `<button>` whose label names the consequence and whose action is
genuinely destructive (DESIGN.md, Components > Buttons). It keeps the 44px target, the focus ring and
the disabled look. The sheet is unlayered, defines its own danger tokens and is scoped to the `<main>`
of the three CMS layouts (`#cms-editorial-main`, `#content-schema-registry-main`,
`#cms-template-main`); every CMS page loads it (the editorial document shell or its own import), and
`cms-danger-action.test.ts` checks that coverage page by page, the cascade and the contrast. A new
CMS layout adds its `<main>` id to the selector.

## Extension

Add a focused stylesheet when a component needs styles not shared by the UI
package. Import it from the owning Astro boundary and keep responsive behavior
semantic-preserving.

## Conventions

Use named cascade layers, existing token variables, logical properties, and
visible focus styles. Support 320 CSS pixel reflow, 200% zoom, and reduced
motion. Do not encode provider, secret, or protected-write decisions in CSS.

## Related links

- [Web component guidance](../components/infrastructure/README.md)
- [Shared UI tokens](../../../../packages/ui/src/styles.css)
- [Release/recovery status](../components/release-recovery/README.md)
