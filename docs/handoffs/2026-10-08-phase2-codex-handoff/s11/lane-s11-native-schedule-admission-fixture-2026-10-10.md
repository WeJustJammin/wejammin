# S11 schedule admission exact-details fixture correction

Status: selected source-backed two-leaf QA correction; author UNRUN until current
gate, canonical receipt and clean pushed checkpoint. Nanosecond producer RED stays
untouched; no SQL production change selected by this brief.

Root owns commands/tests/DB/format/Git/canonical memory. Native author uses
apply_patch only, source reads allowed; no commands/scripts/tests/DB/network.
Sole claim tests/postgrest/phase-02-slice-11-schedule-actions.apispec.ts.
Hard400/target350. Freeze all other files and all other case statements/titles.

## Exact two changes

1. [CMS-03B-07] header/body CAS disagreement is 400 before any RPC or reservation
   At123-146 replace ONLY expected details:{} with exact closed object:
   {violations:[{path:'/expectedVersion',code:'mismatch',message:'The value is invalid.'}]}.
   workflow-admission.ts65-79 actually returns400 INVALID_REQUEST with that exact
   redacted tuple; schedule admission unit quota197-217 and closed refusal grammar
   confirm it. Do not change status/code/version operands/RPCzero/effect fingerprints.

2. [CMS-03B-07] non-JSON body is exact 415 before RPC and changes nothing
   At149-169 replace ONLY expected details:{} with exact
   {allowedMediaTypes:['application/json']}.
   BE00 UNSUPPORTED_MEDIA_TYPE168 and admission-common.ts97-111 route allowlist,
   workflow-command-admission.test.ts101-112 and be00-middleware-order.test.ts101-105
   lock the exact details. Keep text/plain input, 415 code, RPCzero/full no-effects.

Keep both original titles. Exact whole JSON equality, not partial match,
deduplication/filtering or omission. Preserve all other cases byte/token exact,
especially nine-digit schedule202+nanosecond equality, cancel/hide identity and
action/audience identity. No contract/projector/provider/grant/policy mutation.

Return FROZEN/UNRUN/released, original title/body preservation/caps/source mapping.
Root fresh focused execution required; source-backed correction is not API GREEN.
