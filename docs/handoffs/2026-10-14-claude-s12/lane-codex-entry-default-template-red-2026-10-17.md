# Entry bootstrap default-template QA — least-privilege extension, UNRUN

Native `gpt-6.1-sol` / `ultra`, 2026-10-17. This bounded TEST-only lane writes
only the standalone SQL and this report under the reopened same-two-path claim.
No implementation, migration,
public contract, existing test/helper/driver/README or progress file was edited.
All513 executed migrations remain outside this author's write scope.

## Locked positive contract

The source was read before authoring:

- FE03 `03-cms-content-modeling.md:1267–1275`: a new type starts without a
  template; the successor form selects its default. The default's help text
  explicitly identifies it as the template new entries start from.
- IA03 `03-cms-content-modeling.md:279/285–286`: a type version has an optional
  default template; entry creation atomically records its immutable first
  revision with schema/template references and server-derived owner/assignment.
- BE03a `03a-content-schema-registry.md:206/209`: type creation accepts only
  NULL default; a successor can bind the real compatible template using the
  required default/bindings pair. An empty bindings list is valid.
- `packages/contracts/src/cms-editorial/entry-create.ts:32–44`: strict public
  EntryCreateRequest has no client template operand. The revision's existing
  metadata response at65–76 likewise adds no template field in this QA.

Actual promoted `20261005018040_cms_create_entry_derived_state.sql:330–339`
inserts NULL into the first revision's `template_version_id` unconditionally.
The request's closed keys84–92 provide no client override. This is the precise
positive producer omission the test targets, not a new request schema.
The same producer60–65 accepts a proven `cms.author` OR `cms.editor` grant;
its395–400 initial person assignment stores that exact proven capability.
The extension adds no new capability and does not require either designer key.

Readback fingerprints of those unchanged source files:

- promoted18040 SHA256 `6c3915b4dbc4ec0c31c3870ea4a82af5b1c5e3569c321009310627960115b74c`;
- entry-create contract SHA256 `2722fd58cbfe395bf0fcfe29676424c22ff8b0d3fe141afe5534a8a97ee6f157`.

## Producer-only fixture chain

There is **no revision storage seam** in this suite. No immutable revision or
field is seeded, edited or deleted; no schema/template activation, review,
approval or completed migration row is inserted directly. No guard/constraint
is disabled and no fault/time-warp utility is called.

SQL9–14 reuses existing S09 helper/actor/type-chain and governed helper
definitions. The S09 accounts, local Auth/MFA envelope and labelled membership
scaffolding remain local fixture provisioning, not hosted identity acceptance.
The real owner initialization and named public producer steps remain intact.

The new sequence is:

1. Real owner designer/author grants, two separate real initial content types,
   and their compile/dry-run/review/approval/activation chains. Both initial
   versions genuinely have no default template.
2. Real designer template creation with literal slot
   `[{"key":"main","required":false,"allowedBlocks":[],"maxCount":7}]`.
   Empty allowedBlocks is valid under the actual template manifest grammar;
   no signed block identity is needed and no signature gate is bypassed.
3. Real service-role governed submission, reviewer assignment, independent
   approval and activation. Actual stored state is active, definition version1,
   lifecycle4, with the exact literal slot and compatible type UUID.
4. Real CMS-03A-09 successor of the intended defaulted type. Its explicit pair
   is default=T1 and bindings=[]. It is compiled, dry-run/sealed, reviewed,
   independently approved and activated using the existing worker producers.
5. Only after every schema chain completes, the original two service-role public
   `cms_create_entry` calls: one against the exact default-bearing active
   successor; one against the distinct active no-default type.
6. After all original forty checks, two distinct existing humans receive actual
   author-only/editor-only grants and select actual owner-organization contexts.
   Both then create entries against the same real default-bearing successor.

No affected entry exists before the successor dry-run. The existing S09 zero-row
worker helper is therefore used within its documented actual zero-population
scope, not to falsify migration counters. Schema reviewers rev1/rev2/rev3 remain
distinct; the template reviewer is selected in the owner party using the same
temporary actor-selection seam as the existing governed suites.

## Original forty assertions preserved first

SQL8 now declares `plan(76)`. The original sixteen setup premises and twelve
checks for each original public bootstrap still execute first, preserving their
TAP identities1–40. The reused fragments contribute helper/actor setup, not extra
TAP scenarios. No original assertion was deleted or relaxed.

Setup EDT01–EDT16 checks real grants; both initial activations; initial NULL;
the five actual service-role governed RPC receipts and role restoration; real
active T1 plus its literal slots; zero pre-existing entries; successor acceptance;
all thirty expected schema producer/worker/review/activation receipts; the actual
active compiled successor's T1 default and still-active owned compatible T1;
the distinct active compiled NULL control;
the actual completed zero-population migration plan; and the empty binding list.

Request construction at116–146 reads genuine artifact/activation/workflow
evidence in the selected actor's CMS scope. It does not supply or derive a client
template operand. The actual role switch occurs only after request/context
construction, so no API-role access to temporary fixture tables is assumed.
SQL147–172 records actual SQL service_role, SQLSTATE/message, raw response,
entry/revision before-counts and full type/version/artifact/template row images.

Each case at174–227 independently asserts:

- no `templateVersionId`, `defaultTemplateVersionId` or `templateBindings` request
  member; actual service-role invocation and successful public result;
- the unchanged eight-member EntryCreateResource envelope;
- exactly one entry and first revision, their persisted head/owner/type/creator
  and initial person assignment, and exact schema/locale/parent/author context;
- the FIRST revision's template pin equals independently known governed T1,
  or actual SQLNULL for the distinct no-default control;
- literal slot readback through that FIRST revision's pin, not a direct lookup
  of the default to manufacture a matching oracle;
- exact literal field map and independent JCS preimage hash in both response
  and persisted revision; existing schema/artifact/template full rows unchanged.

The expected template UUID is the separately created T1 identity, not copied
from the create producer or selected from its resulting first revision. Its
schema-default premise and first-revision consequence are distinct assertions.

The original SQL has already received root-only genuine RED on clean513:
40 assertions,38 PASS,2 FAIL, complete TAP/no abort, psql0/strict1. Only24
first-revision default pin and25 literal slots through that pin failed; all16
real-producer premises, all NULL controls and other bootstrap assertions passed.
Receipt `/tmp/wejammin-native-s12-20261017.Adf0uP/entry-default-template-513-first-red.log`,
SHA256 `a62479fea5fe763f205f6197d595efb942c6c0f695d19b253d68176c74e15ed1`.
This root-reported result applies to the prior228-line SQL, not the extension.

## Thirty-six additional least-privilege checks

SQL233–248 selects the existing real rev2/rev3 humans under new temporary aliases
`edt-author`/`edt-editor`. It changes no Auth/person binding, historical approval or
existing actor row. `s09d_grant_via_rpc` calls real CMS-03A-15 for the two grants;
its existing explicitly labelled ungoverned membership provisioning remains a
local fixture seam, not proof of a public membership-acceptance producer.
No CMS or identity capability-grant row is inserted or edited directly here.

Both call the actual `identity_context_bind` producer using the existing helper
with fresh alias-specific `s09d-*` client/idempotency keys. The helper's public
identity call is a real producer, not a claim of actual authenticated SQL-role
transport. The subsequent public entry calls do switch to actual service_role.
Failed binding calls become explicit TAP failures through the existing guarded
try helper; they are not silently accepted as setup success.

Four additional checks per actor at250–289 assert:

- a distinct real Auth/person binding, confirmed membership of the owner
  organization, and an actual fresh active organization-context row matching
  the actor, party and alias-specific client key;
- exact live CMS grant array `[cms.author]` or `[cms.editor]` respectively;
- the same exact live identity-grant projection, excluding the opposite entry
  capability and any unrelated live capability in the target organization;
- explicit absence of BOTH `cms.schema_designer` and `cms.template_designer`
  in BOTH actual grant stores for that person, across all organizations, even
  if a hypothetical such row were inactive or expired.

Together with two real-grant outcome assertions and two actual-context producer
assertions, these are12 new premises. Neither new human inherits the owner's
designer grants or identity. Prior review assignments grant no entry authority.

SQL292–295 then runs the complete existing twelve-check public bootstrap oracle
twice with literal titles, the independently created T1 UUID and literal main
slot JSON. Only actor and expected initial assignment capability are parameters;
schema and creator/assignment/hash/full-metadata assertions remain mandatory.
The new request keys are explicitly distinct:
`s12edt-edt-bound-edt-author-create` / `s12edt-edt-bound-edt-editor-create`.
The original owner keys and descriptions are unchanged. New result labels are
`edt-bound:edt-author` / `edt-bound:edt-editor`, avoiding overwrite or replay.

Fixed source count is16 + 2×12 + 4 + 2×4 + 2×12 =76. This is source arithmetic,
not a claimed actual76-case execution. Removing only the appended extension,
restoring plan40 and reversing actor/capability/label parameterization produces
the EXACT original228 lines/17113 bytes and SHA256
`e7297fc26c960bab39c0c559ca977510b3eb351005d516d5eba1a3e1c71f8162`.
That guarded text-only inverse was checked; it is not a SQL parse or execution.

## Runtime gate and explicit limits

This extension is author **UNRUN**: no parser, formatter, test runner,
DB/Docker, Git, network or child agent execution. Only source reading/counting,
hashing and scoped apply_patch authoring occurred. Root owns independent review
and strict complete76 TAP execution under enclosing rollback on authorized ALT.
There is no prelude COMMIT; failed setup/collection must not be called producer RED.

The original omission has genuine root RED above. On the unchanged producer the
extension predicts two additional meaningful pin/slot failures for EACH new
least-privilege bootstrap, provided every new authority/context/grant premise and
other bootstrap check passes. No new execution or failure count is claimed.

No refusal, lifecycle-failure token, error pointer, lock-order or race assertion
was added. Owner-approved DEC-202 now records resolver failure policy at
`.memory/wiki/decisions.md:5324–5334`; exercising that matrix and its lock order
remains outside this positive-only claim. No guessed error outcome is encoded.
Positive co-creation readback is not an injected-fault atomicity proof; metadata
images are not a universal durable-store rollback oracle. No public delivery,
publication-currentness, HTTP transport, hosted Auth/MFA or acceptance gate is
cleared. Neither the earlier restore receiving-storage seam nor private447 is a
causal producer in this test.

## Frozen manifest

`supabase/tests/phase_02_slice_12_entry_default_template.sql`:

- Physical lines297; bytes22440.
- SHA256 `ca782111c89abd51930c03e018828b16654f031ab99d349821296ca41b9df938`.

This report is the only other owned path. Its final line/byte count and hash are
provided in the formal freeze message, not embedded self-referentially.

## Exact text inverse for independent reproduction

No retained original snapshot path is asserted. Apply this JavaScript transform
to the frozen SQL's UTF-8 text **in memory**, without newline normalization or
writing its result over any file. `createHash` is from Node's built-in crypto;
`text` is the entire current297-line SQL. This is string/hash processing only,
not SQL parsing or project execution. The complete transformation is:

```js
const sha = value => createHash('sha256').update(value).digest('hex');
if (sha(text) !== 'ca782111c89abd51930c03e018828b16654f031ab99d349821296ca41b9df938')
  throw Error('unexpected frozen input');
let s = text;
const once = (before, after) => {
  if (s.split(before).length !== 2) throw Error('nonunique inverse anchor');
  s = s.replace(before, after);
};
once('select plan(76);', 'select plan(40);');
const start = s.indexOf('\n-- Additional least-privilege cases');
const end = s.indexOf('select * from finish();', start);
if (start < 0 || end < 0) throw Error('missing extension anchors');
s = s.slice(0, start) + s.slice(end);
const pairs = [
  ["create function pg_temp.s12edt_request(p_tag text, p_title text, p_actor text default 'owner')\nreturns jsonb language plpgsql as $body$",
   'create function pg_temp.s12edt_request(p_tag text, p_title text) returns jsonb language plpgsql as $body$'],
  ["create function pg_temp.s12edt_run(p_tag text, p_title text, p_actor text default 'owner')\nreturns void language plpgsql security invoker as $body$",
   'create function pg_temp.s12edt_run(p_tag text, p_title text) returns void language plpgsql security invoker as $body$'],
  ['pg_temp.s12edt_request(p_tag, p_title, p_actor)',
   'pg_temp.s12edt_request(p_tag, p_title)'],
  ["  insert into s12edt_out values (p_tag || case when p_actor = 'owner' then '' else ':' || p_actor end,\n    request, answer, code, msg, invoked, before_entries,",
   '  insert into s12edt_out values (p_tag, request, answer, code, msg, invoked, before_entries,'],
  ["create function pg_temp.s12edt_check(p_tag text, p_title text, p_template uuid, p_slots jsonb,\n  p_actor text default 'owner', p_assignment text default 'cms.author')",
   'create function pg_temp.s12edt_check(p_tag text, p_title text, p_template uuid, p_slots jsonb)'],
  ["  case_label text := p_tag || case when p_actor = 'owner' then '' else ':' || p_actor end;\n", ''],
  ['pg_temp.s12edt_run(p_tag, p_title, p_actor)',
   'pg_temp.s12edt_run(p_tag, p_title)'],
  ["'idempotencyKey', 's12edt-' || p_tag || case when p_actor = 'owner' then '' else '-' || p_actor end || '-create'",
   "'idempotencyKey', 's12edt-' || p_tag || '-create'"],
  ['a.capability_key = p_assignment', "a.capability_key = 'cms.author'"]
];
for (const [before, after] of pairs) once(before, after);
s = s.replaceAll("pg_temp.s09d_session(p_actor, 'service_role')",
  "pg_temp.s09d_session('owner', 'service_role')");
s = s.replaceAll('pg_temp.s09d_context(p_actor, true)',
  "pg_temp.s09d_context('owner', true)");
s = s.replaceAll("pg_temp.s09d_actor_id(p_actor, 'auth')",
  "pg_temp.s09d_actor_id('owner', 'auth')");
s = s.replaceAll("pg_temp.s09d_actor_id(p_actor, 'person')",
  "pg_temp.s09d_actor_id('owner', 'person')");
s = s.replaceAll('case_label', 'p_tag');
const result = {
  lines: s.split('\n').length - 1,
  bytes: Buffer.byteLength(s, 'utf8'),
  sha256: sha(s)
};
if (result.lines !== 228 || result.bytes !== 17113 || result.sha256 !==
  'e7297fc26c960bab39c0c559ca977510b3eb351005d516d5eba1a3e1c71f8162')
  throw Error('original bytes not reconstructed');
console.log(result);
```

This spells out the previously checked inverse; it does not add an execution
receipt. Independent reproduction is a separate reviewer-owned text-only check.
