# CMS composition contracts

## Contents

`template.ts` defines the CMS-03C-01 template request, mutation headers,
browser-resource schema, and the protected CMS-11 designer-context projection.
`template.test.ts` exercises their strict input and
response boundary, including unique references and the fixed protected-region
spine.
`template-detail.ts` adds the path-key request and complete editable current
version projection for the protected latest read; its test rejects private
authority and renderer fields.
`pattern-instance.ts` defines the CMS-03C-02 bounded pattern insertion
request, required mutation headers, and closed browser resource;
`pattern-instance.test.ts` probes the request and disclosure boundary.
`taxonomy-term.ts` defines the CMS-03C-03 term-action request, strong mutation
headers, and closed term/redirect resource; `taxonomy-term.test.ts` covers
merge-only survivor addressing and bounded labels/aliases.
`locale-variant.ts` defines the CMS-03C-04 addressed translation request,
strong mutation headers, and closed variant status resource;
`locale-variant.test.ts` covers bounded field values and ordered fallback.
`related-content.ts` defines the CMS-03C-05 explicit pin/exclusion command,
strong headers, and safe rule resource; `related-content.test.ts` probes
overlap, size, and disclosure boundaries.
`index.ts` is the public export surface for this domain.

## Ownership

This directory owns strict CMS-03C request and browser-resource contracts.
Worker adapters, not these schemas, resolve registered blocks, recompute the
registry digest, authorize the actor, and commit the template.

## Extension

Add one focused schema module and adjacent boundary tests per operation, then
export the module from `index.ts`. Validate both request and response in the
Worker before adding a browser flow. Keep every schema strict and bounded.

## Conventions

Reuse 03a's safe registry projection and shared CMS primitives. Never copy
release credentials, ownership identifiers, or capability authority into a
browser resource. A caller-supplied block-registry digest is an equality
expectation, not authoritative persisted evidence.

## Related links

The governing source is
`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`. Related
contracts live in `packages/contracts/src/content-schema-registry/`.
