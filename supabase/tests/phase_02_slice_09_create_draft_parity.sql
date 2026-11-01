\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 (AC217; P2-S09-AC-217): CMS-03A-01 compiles the definition once
-- (supabase/migrations/20261010166000_cms_create_type_draft_single_compile.sql).  The replacement is
-- performance-only: this suite proves it by running the VERBATIM previous body (installed as
-- platform_private.cms_create_type_draft_legacy for the length of this transaction, definer-owned like the
-- real function) and the installed function on the same fixed requests from the same database state, and
-- comparing, byte for byte, the outcome (SQLSTATE, message, DETAIL), the response, every row each call
-- wrote (type, version, schema artifact with both manifests and the hash, every field, relation and
-- capability binding, the outbox event, the audit event, the idempotency record, with the generated ids
-- replaced by symbols) and the row-count delta of every table of the four private schemas.  The corpus
-- covers the 128-field benchmark shape, every field kind, the protected-validator manifests, locales,
-- defaults, lifecycles, unordered input, Unicode, the splice-slot collision, heavy constraints, an
-- idempotent replay and the refusals, including the 512 KiB artifact-bound violation that precedes the
-- field validation (the error precedence must not move).  It also holds the replacement to the helpers
-- the previous body called: the stored manifests and hash must equal cms_compiled_editor_manifest,
-- cms_compiled_renderer_manifest and cms_definition_artifact_hash of the same request, so a later change
-- of the compile rule that the command does not follow fails here.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_create_draft_parity/00-legacy-body.sqlinc
\ir phase_02_slice_09_create_draft_parity/01-capture.sqlinc
\ir phase_02_slice_09_create_draft_parity/02-requests.sqlinc

-- ---- the replacement kept the identity of the function ----------------------------------------------------
select is((select md5(p.prosrc) from pg_proc p where p.oid = 'platform_private.cms_create_type_draft_legacy(jsonb)'::regprocedure),
  'f5d93c0442dd733e401065dca1d9ecc6',
  'fixture: the legacy copy is the body that 20261010166000 pins by md5 before replacing it [P2-S09-AC-217]');
select isnt((select md5(p.prosrc) from pg_proc p where p.oid = 'platform_private.cms_create_type_draft(jsonb)'::regprocedure),
  'f5d93c0442dd733e401065dca1d9ecc6',
  'the installed cms_create_type_draft is the single-compile body, not the previous one [P2-S09-AC-217]');
select is((select pg_get_userbyid(p.proowner) from pg_proc p where p.oid = 'platform_private.cms_create_type_draft(jsonb)'::regprocedure),
  'wejammin_cms_definer', 'the replacement is still owned by the CMS definer role (SEC-2) [P2-S09-AC-217]');
select is((select p.prosecdef and p.provolatile = 'v' and not p.proisstrict and p.proconfig = array['search_path=""']
      and p.prolang = (select oid from pg_language where lanname = 'plpgsql') and p.prorettype = 'jsonb'::regtype
    from pg_proc p where p.oid = 'platform_private.cms_create_type_draft(jsonb)'::regprocedure),
  true, 'the replacement is SECURITY DEFINER, VOLATILE, not strict, plpgsql, returns jsonb, pins an empty search_path [P2-S09-AC-217]');
select is((select p.proacl::text from pg_proc p where p.oid = 'platform_private.cms_create_type_draft(jsonb)'::regprocedure),
  '{wejammin_cms_definer=X/wejammin_cms_definer}', 'the replacement keeps the definer-only ACL: no API role or PUBLIC can execute it [P2-S09-AC-217]');
select is((select string_agg(r.rolname, ',' order by r.rolname) from (values ('anon'), ('authenticated'), ('service_role')) r(rolname)
    where has_function_privilege(r.rolname, 'platform_private.cms_create_type_draft(jsonb)'::regprocedure, 'EXECUTE')),
  null, 'no API role can execute the private command (only the platform_api wrapper reaches it) [P2-S09-AC-217]');

-- ---- previous body and current body on the same inputs -----------------------------------------------------
create temp table parity_images on commit drop as
select c.n, c.name, c.expect, c.request, c.calls,
  pg_temp.parity_capture('platform_private.cms_create_type_draft_legacy', c.request, c.prior, c.calls) as legacy,
  pg_temp.parity_capture('platform_private.cms_create_type_draft', c.request, c.prior, c.calls) as current
from parity_cases c order by c.n;

select is(pg_temp.parity_diff(i.legacy, i.current), null,
  'parity ' || i.name || ': outcome, response, every written row and the row-count delta are identical to the previous body [P2-S09-AC-217]')
from parity_images i order by i.n;

-- The comparison is not vacuous: each accepted case wrote the aggregate, each refused case failed the same way and wrote nothing.
select ok(i.current->'outcomes'->0->>'state' = '00000'
    and i.current->'outcomes'->0->'response'->>'resourceKind' = 'content_type_version'
    and (i.current->'rowDelta'->>'platform_private.cms_content_types')::integer = 1
    and (i.current->'rowDelta'->>'platform_private.cms_content_type_versions')::integer = 1
    and (i.current->'rowDelta'->>'platform_private.cms_schema_artifacts')::integer = 1
    and coalesce((i.current->'rowDelta'->>'platform_private.cms_field_definition_versions')::integer, 0) = jsonb_array_length(i.request->'fields')
    and (i.current->'rowDelta'->>'platform_private.outbox_events')::integer = 1
    and (i.current->'rowDelta'->>'audit_private.audit_events')::integer = 1
    and (i.current->'rowDelta'->>'platform_private.idempotency_records')::integer = 1
    and jsonb_array_length(i.current->'outcomes') = i.calls,
  'case ' || i.name || ' is accepted and writes one type, version, artifact, event, audit and idempotency row and every field [P2-S09-AC-217]')
from parity_images i where i.expect = 'OK' order by i.n;
select ok(i.current->'outcomes'->0->>'message' like i.expect and i.current->'rowDelta' = '{}'::jsonb,
  'case ' || i.name || ' is refused with ' || i.expect || ' and writes nothing [P2-S09-AC-217]')
from parity_images i where i.expect <> 'OK' order by i.n;
select is(i.current->'outcomes'->1->'response', i.current->'outcomes'->0->'response',
  'the idempotent replay answers the stored response of the first call [P2-S09-AC-217]')
from parity_images i where i.name = 'replay';

-- ---- the stored artifact is what the compile helpers produce -----------------------------------------------
select is(i.current->'artifact'->'editor_manifest', platform_private.cms_compiled_editor_manifest(i.request),
  'case ' || i.name || ': the stored editor manifest is cms_compiled_editor_manifest of the request [P2-S09-AC-217]')
from parity_images i where i.expect = 'OK' order by i.n;
select is(i.current->'artifact'->'renderer_manifest', platform_private.cms_compiled_renderer_manifest(i.request),
  'case ' || i.name || ': the stored renderer manifest is cms_compiled_renderer_manifest of the request [P2-S09-AC-217]')
from parity_images i where i.expect = 'OK' order by i.n;
select is(i.current->'artifact'->>'artifact_hash', platform_private.cms_definition_artifact_hash(i.request, 1),
  'case ' || i.name || ': the artifact hash is cms_definition_artifact_hash of the request [P2-S09-AC-217]')
from parity_images i where i.expect = 'OK' order by i.n;
select is(i.current->'version'->>'definition_hash', platform_private.cms_definition_artifact_hash(i.request, 1),
  'case ' || i.name || ': the version definition_hash is the same hash [P2-S09-AC-217]')
from parity_images i where i.expect = 'OK' order by i.n;
select is(i.current->'artifact'->>'zod_contract_ref', platform_private.cms_artifact_contract_ref(i.request->>'typeKey', 1),
  'case ' || i.name || ': the contract reference is the versioned one [P2-S09-AC-217]')
from parity_images i where i.expect = 'OK' order by i.n;

-- Which hash path ran: the slot text is searched in the document with the field array replaced by the slot.
-- The 128-field benchmark, every kind and the Unicode request take the splice; a request whose label is the
-- slot text takes the direct serialisation, and a request that only carries the slot text inside its fields
-- still takes the splice; every one of them hashes to cms_definition_artifact_hash of the request (above).
select ok(position('"#cms-canonical-fields#"' in platform_private.cms_jcs(
    platform_private.cms_canonical_type_definition(i.request) - 'fields')) = 0,
  'case ' || i.name || ': the slot text is absent outside the fields, so the hash splices the field array [P2-S09-AC-217]')
from parity_images i where i.name in ('bench128', 'every_kind', 'unicode', 'slot_text_in_fields');
select ok(position('"#cms-canonical-fields#"' in platform_private.cms_jcs(
    platform_private.cms_canonical_type_definition(i.request) - 'fields')) > 0,
  'case ' || i.name || ': the slot text occurs outside the fields, so the hash takes the direct serialisation [P2-S09-AC-217]')
from parity_images i where i.name = 'slot_collision';
select ok(i.current->'artifact'->'editor_manifest' ? 'validators',
  'case ' || i.name || ': a definition that uses rich_text freezes the protected validator in the editor manifest [P2-S09-AC-217]')
from parity_images i where i.name in ('every_kind', 'rich_text_pair');
select ok(not (i.current->'artifact'->'editor_manifest' ? 'validators'),
  'case ' || i.name || ': a definition without rich_text keeps the manifest, and so the hash, without validators [P2-S09-AC-217]')
from parity_images i where i.name in ('bench128', 'locales', 'defaults');

-- The public function (the one the benchmark and the Worker call) returns what the private command returns.
create temp table parity_public on commit drop as
select pg_temp.parity_capture('platform_api.cms_create_type_draft', c.request, c.prior, c.calls) as public_face, i.legacy, c.name
from parity_cases c join parity_images i on i.n = c.n where c.name in ('bench128', 'every_kind', 'key_conflict', 'invalid_kind');
select is(pg_temp.parity_diff(p.legacy, p.public_face), null,
  'the platform_api wrapper adds nothing: ' || p.name || ' through the public function equals the previous body [P2-S09-AC-217]')
from parity_public p order by p.name;

select * from finish();
rollback;
