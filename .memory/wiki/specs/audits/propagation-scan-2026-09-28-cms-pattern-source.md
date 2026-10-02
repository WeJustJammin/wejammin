# Propagation scan — reusable-pattern authority source

**Status:** scan only; awaiting owner choice for protected pattern authoring and read contracts.
**Origin:** IA03 CMS-12, BE03c CMS-03C-02, FE03 human-form contract.
**Decision type:** locked API and authority-source addition. No pattern row,
capability grant, or endpoint is approved by this scan.

## Explicit gap

- CMS-12 requires an immutable, readable `PatternVersion` before an assigned
  author/editor can insert a linked or detached instance. The sole declared
  operation is `POST /api/v1/cms/compositions/pattern-instances`; its request
  names an existing `patternId` and `patternVersion` and carries no pattern
  tree or authoring fields.
- BE03c describes pattern create/activate digest recomputation and draft-only
  RPC writes, but enumerates no create, activation, or protected selector/read
  contract for pattern versions. The current private table has forced RLS and
  no direct browser or service-role grants; no Worker pattern route or named
  pattern-authoring RPC is implemented. Direct database seeding would not
  fulfill the CMS-12 human form or review/activation semantics.
- The 201 instance operation also needs an explicit source for the pattern
  tree's registered block refs and a reviewed three-way diff command when a
  linked update collides with local overrides. Neither can be inferred from
  the existing instance request without changing the locked interaction.

## Proposed correction for confirmation

Add narrowly scoped protected pattern-version create, activation, and
selector/detail-read contracts for the currently authorized designer and
assigned editor, then specify linked update/diff acceptance and detach
commands. Keep pattern writes server-derived and draft-only at creation,
activation review-gated, block registry and digest server-recomputed, and
browser/database roles without direct table access. Define graph shape,
depth/node limits, and slot/path semantics before implementing the named
instance RPC or a human form.

## Cascade if approved

- Update IA03 CMS-12 and BE03c operation/authority/error/data-flow tables;
  update FE03 selector, diff/reconcile, and recovery contracts.
- Add strict Zod request/resource types and canonical route/OpenAPI entries.
- Add forward-only private RPCs, RLS/grant and graph/digest tests, Worker
  adapters/routes, first-party proxy and native CMS-12 form, then local and
  hosted role/browser evidence. Update Slice 12 AC mapping, ledger, and graph.

The apply shard waits for the owner response. This scan does not change
locked specs, enable pattern authoring, or close a Slice 12 criterion.
