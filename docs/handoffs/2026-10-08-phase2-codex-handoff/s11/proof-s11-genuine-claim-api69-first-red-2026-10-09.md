# Slice 11 — API69 actual first RED, including one fixture failure

Main54322 pre-reset0/API exit1/closing reset0, freshCI0 each stage/flock.
Port55322 untouched. Three suites:21 failed/48 passed,30.03s.

- Original46 unchanged:14 failed/32 passed at resolver assertions.
- Grammar22:6 failed/16 passed. The actual protected UUIDv7 and uppercase claims,
  receipt versions, stored token and original-event assertions completed before
  the resolver returned400 instead of200. Three valid full19-digit versions and
  valid nil wrong-token request receive INVALID_REQUEST instead of CONFLICT.
- Graph1: baseline hash predicate failed at line108 BEFORE the public field
  append or resolver call. This is a fixture failure, NOT graph-drift resolver
  RED. Twenty total failures are functional resolver RED; one is setup/oracle.

Logs:

- `.lane-logs/parent-s11-genuine-claim-api69-pre-reset-20261009.log`
- `.lane-logs/parent-s11-genuine-claim-api69-first-red-20261009.log`
- `.lane-logs/parent-s11-genuine-claim-api69-post-reset-20261009.log`
- `.lane-logs/parent-s11-genuine-claim-grammar22-graph1-first-static-20261009.log`

Formatted new files184/175, format/ESLint/type/contracts/progress exit0.
Independent6.1 source reviews found no bounded gap before execution; that static
judgment did not prove the graph fixture's runtime context.

## Source-backed diagnosis and restricted amendment

`cms_jcs_sha256` RETURNS TEXT already hex (authority358–372), not bytea.
Latest `cms_candidate_definition_request` is STABLE SECURITY DEFINER and returns
NULL if its candidate SELECT finds no row (02164000:29–47); owner is the CMS
definer (03120500). Forced-RLS definition-table policies first require
`cms_rpc_context_valid()` (authority2199–2212), whose exact gate is
`app.cms_rpc = true` (authority1600–1608). Direct diagnostic SELECT lacks that
RPC flag, so the getter's first candidate lookup is filtered. JWT system scope
separately governs scoped plans/reports; it is not this first lookup's gate.
This corrects the earlier JWT-first diagnosis. Source-backed diagnosis only,
not independently observed raw hash values. No JWT/GUC/role/grant manufacture.

Narrow graph-only continuation may replace that scoped getter with an inline,
read-only, complete persisted definition reconstruction using the diagnostic
SELECT's actual candidate/type rows, exact fields/relations/templates/capability
bindings and locale/workflow metadata. Preserve all current assertions, public
field write and exact final CONFLICT; no production/helper/other-test changes.
Checkpoint/push/exact-origin before author continuation. Parent must rerun and
prove baseline/changed graph isolation reaches the actual resolver.

Passing malformed cases are not isolated SQL guard proof while the new request
branch is absent. Genuine nonzero preparation/completed nullable replay,
receiving/heartbeat/per-stage authority and full acceptance remain open;0/122.
