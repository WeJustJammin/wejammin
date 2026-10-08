# Web styles

## Contents

This directory contains web-surface styles for infrastructure pages, jobs, the
release/recovery status projection, and the CMS editorial surfaces
(`cms-editorial.css`, imported by the editorial document shell).

## Ownership

These styles own presentation only. UI tokens remain the design authority;
routes and components own semantics, authorization, and state decisions.

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
