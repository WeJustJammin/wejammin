# CMS-11 protected latest-template read — propagation scan

Date: 2026-09-27. Rechecked: 2026-09-30. Status: awaiting owner
confirmation before locked-spec apply.

## Decision under review

Add a designer-scoped `GET /api/v1/cms/templates/{templateKey}` support route
(`cmsTemplateLatestRead`) returning an exact `TemplateVersionDetail` plus a
strong version ETag. The route is read-only and no-store; the Worker derives
actor and acting party, checks the active `cms.template_designer` grant, and
calls only `platform_api.cms_template_latest`. SQL hides absent or cross-owner
keys as 404 and never grants browser roles direct RPC access. No publication,
activation, or new capability is introduced.

## Scan classification

| Source | Classification | Proposed propagation |
| --- | --- | --- |
| IA03 CMS-11 acceptance and access-control contract | Consistent | No product or capability change. |
| BE03c route registry and context invariant | Omission | Add exact route, response, access, rate, error, cache, and RPC rules beside `cmsTemplateContextRead`. |
| FE03 CMS-11 context paragraph | Explicit stale assumption | Replace the statement that a protected canonical read is still missing. Keep the create page described as create-only and describe the separately tested successor-edit page. |
| Phase 2 Slice 12 acceptance and tracker | Consistent/open | Record local support-route and two-tab HTTP 409/rebase proof without checking composite CMS-11 or hosted acceptance. |
| Canonical route registry and generated OpenAPI | Implementation target | Keep `TemplateLatestApiRequestSchema` and `TemplateVersionDetailSchema` aligned to the approved BE contract. |
| Other CMS 03c operations and Slices 13–17 | Consistent | No route or capability changes. |

## Gate

Owner confirmation is required before changing the progressively locked BE03c
and FE03 specs. The local production-built Chrome test
`tests/e2e/phase-02-slice-12-template-real-route.spec.ts` exercises two tabs
through the actual first-party route: a 201 successor, a stale-tab 409, a
protected latest-version read, explicit rebase retaining unsent values, and a
201 successor with the new strong `If-Match`. A fresh pinned one-test run on
2026-09-30 passed 1/1. This is local signed-session and local-service proof,
not hosted acceptance or template activation. After confirmation, apply the
two spec edits, run contract and consistency checks, and compile the spec
graph; do not repeat the already-proven local 409 flow as a missing prerequisite.


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]

### References
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
