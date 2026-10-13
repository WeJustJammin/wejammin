# Contract source

## Contents

Zod schemas and inferred TypeScript types for identifiers, API errors, request context, operational endpoints, and closed registries.

Two curated entries serve the browser islands, which ship no zod (FE03 performance budgets, AC261, AC-106): `client.ts` exports the zod-free constants and pure rules an island needs at hydration, and `content-schema-registry/validators.ts` and `cms-editorial/validators.ts` list the schemas an island loads lazily, with a dynamic `import()`, the first time it must check a payload. A rule an island needs synchronously is written once in a zod-free module and the schema is built from it (or proven equal to it by a differential test).

## Ownership

The platform contract owner approves wire-shape changes. Feature packages consume these exports and may not redefine them.

## Extension rules

Add a focused schema module, export it from `index.ts`, and add boundary tests. Keep schemas strict, JSON-safe, and below the schema file-size limit.

## Conventions and related material

Runtime schemas are authoritative; inferred types follow schemas. See [`../README.md`](../README.md) and the backend infrastructure specification.
