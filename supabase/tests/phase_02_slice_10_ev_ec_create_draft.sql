-- Slice 10 evidence lane EC (P2-S10-AC-073, AC-074): CMS-03B-10 create identity and
-- bounds, and the CMS-03B-11 draft read re-validation of stored object and rich_text
-- values.  New file: nothing here edits or weakens an existing suite.
--
-- Every refusal is observed through the real platform_api RPC as the creator
-- (cms.author) and each probe also compares a row-count fingerprint of entries,
-- revisions, values, conflicts, idempotency reservations, outbox events and audit
-- events before and after the refused call, so "before any mutation" is a count, not
-- a claim.  The probe setup (a superseded version, a tampered row) is rolled back
-- with the probe, so every probe starts from the same healthy fixture.
--
-- Part A: contentTypeId/contentTypeVersionId resolve to one ACTIVE compiled schema
--   owned by the acting party, with non-null activation evidence, the exact
--   SchemaArtifact and registered validator refs; a stale or off-registry identity is
--   refused.
-- Part B: locale / changedPaths / values bounds (1-128 pointers, 128 keys, depth 8,
--   256 KiB) and the closed request (no caller owner, assignee or authority key).
-- Part C: the draft read validates the stored object and rich_text values against
--   the pinned schema artifact with the same value gate the write used, so a stored
--   value that no longer satisfies it is a scrubbed INTERNAL_ERROR, never served.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_value_source/000-gallery-fixture.sqlinc

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));

-- ------------------------------------------------------------ probe machinery ----
create temp table ec_calls(
  label text primary key,
  state text,
  message text,
  detail text,
  response jsonb,
  unchanged boolean
) on commit drop;

-- Runs p_setup then p_call inside one probe.  The refused call's own writes are rolled
-- back by its exception block, so `unchanged` is true exactly when a refusal left the
-- fingerprint untouched; a call that unexpectedly succeeds and writes flips it.  The
-- whole probe (setup included) is then rolled back by the sentinel.
create or replace function pg_temp.ec_call(p_label text, p_setup text, p_call text)
returns void
language plpgsql
as $body$
declare
  observed_state text := '00000';
  observed_message text;
  observed_detail text;
  observed_response jsonb;
  before_counts text;
  after_counts text;
begin
  begin
    if p_setup is not null then execute p_setup; end if;
    before_counts := pg_temp.s10g_counts();
    begin
      execute p_call into observed_response;
    exception when others then
      get stacked diagnostics observed_detail = pg_exception_detail;
      observed_state := sqlstate;
      observed_message := sqlerrm;
      observed_response := null;
    end;
    after_counts := pg_temp.s10g_counts();
    raise exception 'EC_PROBE_SENTINEL_4b71' using errcode = 'P0001';
  exception when others then
    if sqlerrm <> 'EC_PROBE_SENTINEL_4b71' then raise; end if;
  end;
  insert into ec_calls values (
    p_label, observed_state, observed_message, observed_detail, observed_response,
    before_counts is not distinct from after_counts);
end;
$body$;

-- "TOKEN DETAIL" of one probe, the exact refusal a caller sees.
create or replace function pg_temp.ec_out(p_label text)
returns text
language sql
stable
as $body$
  select coalesce(
    (select coalesce(message, 'OK') || ' ' || coalesce(nullif(detail, ''), '-') from ec_calls where label = p_label),
    'MISSING')
$body$;

create or replace function pg_temp.ec_unchanged(p_label text)
returns boolean
language sql
stable
as $body$
  select coalesce((select unchanged from ec_calls where label = p_label), false)
$body$;

create or replace function pg_temp.ec_create(p_values jsonb, p_key text, p_patch jsonb default '{}'::jsonb)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_create_entry(' || quote_literal(
    (pg_temp.s10g_create_request(p_values, p_key) || p_patch)::text) || '::jsonb)'
$body$;

create or replace function pg_temp.ec_detail_sql(p_entry text)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_get_entry_draft(' || quote_literal(jsonb_build_object(
    'entryId', p_entry,
    'context', jsonb_build_object(
      'actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094',
      'correlationId', 'a9100000-0000-4000-8000-000000000095'))::text) || '::jsonb)'
$body$;

-- ---------------------------------------------------------------------- Part A ----
-- Control: the healthy gallery create is accepted, so every refusal below is caused by
-- exactly the one thing the probe changes.
select pg_temp.ec_call('a-control', null,
  pg_temp.ec_create('{"title":"identity control"}', 'ec-identity-0000'));
select is(pg_temp.ec_out('a-control'), 'OK -',
  'EC-073 control: a create naming the active compiled schema pair, artifact and evidence is accepted');

select pg_temp.ec_call('a-not-active',
  format($sql$set local session_replication_role = replica;
    update platform_private.cms_content_type_versions
       set state = 'superseded'
     where id = %L;
    set local session_replication_role = origin;$sql$,
    (select value from s10g_ids where key = 'versionId')),
  pg_temp.ec_create('{"title":"stale"}', 'ec-identity-0001'));
select is(pg_temp.ec_out('a-not-active'), 'VALIDATION_FAILED ["/contentTypeVersionId"]',
  'EC-073 a version that is no longer the active one is a stale identity refused at /contentTypeVersionId');
select ok(pg_temp.ec_unchanged('a-not-active'),
  'EC-073 the stale-version refusal committed no entry, revision, value, reservation, outbox or audit row');

select pg_temp.ec_call('a-pair', null,
  pg_temp.ec_create('{"title":"pair"}', 'ec-identity-0002',
    jsonb_build_object('contentTypeId', (select value from s10_ids where key = 'typeId'))));
select is(pg_temp.ec_out('a-pair'), 'NOT_FOUND -',
  'EC-073 a version paired with a content type it does not belong to is concealed as NOT_FOUND with no detail');
select ok(pg_temp.ec_unchanged('a-pair'),
  'EC-073 the mismatched id pair committed nothing');

select pg_temp.ec_call('a-unknown-version', null,
  pg_temp.ec_create('{"title":"unknown"}', 'ec-identity-0003',
    jsonb_build_object('contentTypeVersionId', extensions.gen_random_uuid())));
select is(pg_temp.ec_out('a-unknown-version'), 'NOT_FOUND -',
  'EC-073 an off-registry version id is concealed as NOT_FOUND with no detail');
select ok(pg_temp.ec_unchanged('a-unknown-version'),
  'EC-073 the off-registry version refusal committed nothing');

select pg_temp.ec_call('a-foreign-artifact', null,
  pg_temp.ec_create('{"title":"artifact"}', 'ec-identity-0004',
    jsonb_build_object('schemaArtifact',
      (pg_temp.s10g_create_request('{"title":"x"}', 'k')->'schemaArtifact')
        || jsonb_build_object('id', (select value from s10_ids where key = 'typeArtifactId')))));
select is(pg_temp.ec_out('a-foreign-artifact'), 'VALIDATION_FAILED ["/schemaArtifact"]',
  'EC-073 the SchemaArtifact of another schema version is refused at /schemaArtifact');
select ok(pg_temp.ec_unchanged('a-foreign-artifact'),
  'EC-073 the foreign SchemaArtifact refusal committed nothing');

select pg_temp.ec_call('a-compiler', null,
  pg_temp.ec_create('{"title":"compiler"}', 'ec-identity-0005',
    jsonb_build_object('schemaArtifact',
      (pg_temp.s10g_create_request('{"title":"x"}', 'k')->'schemaArtifact')
        || jsonb_build_object('compilerVersion', '0.0.0-stale'))));
select is(pg_temp.ec_out('a-compiler'), 'VALIDATION_FAILED ["/schemaArtifact"]',
  'EC-073 a stale SchemaArtifact compiler version is refused at /schemaArtifact');

select pg_temp.ec_call('a-contract-ref', null,
  pg_temp.ec_create('{"title":"zod"}', 'ec-identity-0006',
    jsonb_build_object('schemaArtifact',
      (pg_temp.s10g_create_request('{"title":"x"}', 'k')->'schemaArtifact')
        || jsonb_build_object('zodContractRef', 'cms/content-type/stale/v1'))));
select is(pg_temp.ec_out('a-contract-ref'), 'VALIDATION_FAILED ["/schemaArtifact"]',
  'EC-073 a stale SchemaArtifact contract reference is refused at /schemaArtifact');

select pg_temp.ec_call('a-evidence-null', null,
  pg_temp.ec_create('{"title":"evidence"}', 'ec-identity-0007', '{"activationEvidence":null}'));
select is(pg_temp.ec_out('a-evidence-null'), 'VALIDATION_FAILED ["/activationEvidence"]',
  'EC-073 a null activationEvidence is refused at /activationEvidence');
select ok(pg_temp.ec_unchanged('a-evidence-null'),
  'EC-073 the null activation evidence refusal committed nothing');

select pg_temp.ec_call('a-evidence-stale', null,
  pg_temp.ec_create('{"title":"evidence"}', 'ec-identity-0008',
    jsonb_build_object('activationEvidence',
      (pg_temp.s10g_create_request('{"title":"x"}', 'k')->'activationEvidence')
        || jsonb_build_object('approvalEvidenceHash', repeat('e', 64)))));
select is(pg_temp.ec_out('a-evidence-stale'), 'VALIDATION_FAILED ["/activationEvidence"]',
  'EC-073 activation evidence that differs from the stored envelope by one hash is refused at /activationEvidence');

-- The schema itself refuses an active version without activation evidence, so a version
-- with null evidence can never be the one a create resolves.
select pg_temp.ec_call('db-evidence-null',
  'set local session_replication_role = replica;',
  format($sql$with changed as (
      update platform_private.cms_content_type_versions
         set activation_approval_evidence_hash = null
       where id = %L
      returning 1)
    select to_jsonb(count(*)) from changed$sql$,
    (select value from s10g_ids where key = 'versionId')));
select is((select state from ec_calls where label = 'db-evidence-null'), '23514',
  'EC-073 an active content-type version cannot carry null activation evidence (check_violation)');

select pg_temp.ec_call('a-refs-key', null,
  pg_temp.ec_create('{"title":"refs"}', 'ec-identity-0009',
    '{"validatorRefs":[{"key":"free.form.validator","version":"1"}]}'));
select is(pg_temp.ec_out('a-refs-key'), 'VALIDATION_FAILED ["/validatorRefs"]',
  'EC-073 a validator ref naming an unregistered key is refused at /validatorRefs');
select pg_temp.ec_call('a-refs-version', null,
  pg_temp.ec_create('{"title":"refs"}', 'ec-identity-0010',
    '{"validatorRefs":[{"key":"rich_text.v1","version":"2"}]}'));
select is(pg_temp.ec_out('a-refs-version'), 'VALIDATION_FAILED ["/validatorRefs"]',
  'EC-073 the protected rich_text.v1 ref at an unregistered version is refused at /validatorRefs');
select ok(pg_temp.ec_unchanged('a-refs-version'),
  'EC-073 the unregistered validator ref refusal committed nothing');

-- Typed object and rich_text values against the frozen structure and rich_text.v1.
select pg_temp.ec_call('a-object-ok', null,
  pg_temp.ec_create(jsonb_build_object('meta', jsonb_build_object('label', 'Launch')), 'ec-identity-0011'));
select is(pg_temp.ec_out('a-object-ok'), 'OK -',
  'EC-073 an object value satisfying the frozen depth-1 property structure is accepted');
select pg_temp.ec_call('a-object-extra', null,
  pg_temp.ec_create(jsonb_build_object('meta', jsonb_build_object('label', 'Launch', 'extra', 1)), 'ec-identity-0012'));
select is(pg_temp.ec_out('a-object-extra'),
  'object_property_invalid ["/fields/' || pg_temp.s10g_fid('meta') || '"]',
  'EC-073 an object value with a property the frozen structure does not declare is object_property_invalid at its field');
select ok(pg_temp.ec_unchanged('a-object-extra'),
  'EC-073 the object refusal committed nothing');
select pg_temp.ec_call('a-rich-ok', null,
  pg_temp.ec_create(jsonb_build_object('body', jsonb_build_object(
    'format', 'rich_text.v1',
    'blocks', jsonb_build_array(jsonb_build_object(
      'type', 'paragraph',
      'spans', jsonb_build_array(jsonb_build_object('text', 'Hello', 'marks', '[]'::jsonb)))))),
    'ec-identity-0013'));
select is(pg_temp.ec_out('a-rich-ok'), 'OK -',
  'EC-073 a canonical rich_text.v1 document is accepted');
select pg_temp.ec_call('a-rich-bad', null,
  pg_temp.ec_create(jsonb_build_object('body', jsonb_build_object(
    'format', 'rich_text.v1',
    'blocks', jsonb_build_array(jsonb_build_object(
      'type', 'paragraph',
      'spans', jsonb_build_array(jsonb_build_object(
        'text', 'x', 'marks', '[]'::jsonb,
        'link', jsonb_build_object('kind', 'https', 'href', 'javascript:alert(1)'))))))),
    'ec-identity-0014'));
select is(pg_temp.ec_out('a-rich-bad'),
  'rich_text_not_canonical ["/fields/' || pg_temp.s10g_fid('body') || '"]',
  'EC-073 a rich_text value with an unsafe link scheme is rich_text_not_canonical at its field');
select ok(pg_temp.ec_unchanged('a-rich-bad'),
  'EC-073 the rich_text refusal committed nothing');

-- ---------------------------------------------------------------------- Part B ----
create or replace function pg_temp.ec_pointers(p_count integer)
returns jsonb
language sql
stable
as $body$
  select jsonb_agg('/fields/' || extensions.gen_random_uuid()::text)
  from generate_series(1, p_count)
$body$;

create or replace function pg_temp.ec_unknown_values(p_count integer)
returns jsonb
language sql
stable
as $body$
  select jsonb_object_agg(extensions.gen_random_uuid()::text, 'x')
  from generate_series(1, p_count)
$body$;

create or replace function pg_temp.ec_nested(p_levels integer)
returns jsonb
language plpgsql
immutable
as $body$
declare
  nested jsonb := '1'::jsonb;
  step integer;
begin
  for step in 1..p_levels loop
    nested := jsonb_build_array(nested);
  end loop;
  return nested;
end;
$body$;

select pg_temp.ec_call('b-paths-129', null,
  pg_temp.ec_create('{"title":"x"}', 'ec-bounds-0001',
    jsonb_build_object('changedPaths', pg_temp.ec_pointers(129))));
select is(pg_temp.ec_out('b-paths-129'), 'VALIDATION_FAILED ["/changedPaths"]',
  'EC-074 129 changedPaths are refused at /changedPaths');
select ok(pg_temp.ec_unchanged('b-paths-129'),
  'EC-074 the 129-path refusal committed nothing');
select pg_temp.ec_call('b-paths-128', null,
  pg_temp.ec_create('{"title":"x"}', 'ec-bounds-0002',
    jsonb_build_object('changedPaths', pg_temp.ec_pointers(128))));
select is(pg_temp.ec_out('b-paths-128'), 'VALIDATION_FAILED ["/changedPaths/0"]',
  'EC-074 128 changedPaths pass the count bound and are refused only because the first names no field');

select pg_temp.ec_call('b-keys-129', null,
  pg_temp.ec_create('{"title":"x"}', 'ec-bounds-0003',
    jsonb_build_object('values', pg_temp.ec_unknown_values(129))));
select is(pg_temp.ec_out('b-keys-129'), 'VALIDATION_FAILED ["/values"]',
  'EC-074 129 value keys are refused at /values');
select ok(pg_temp.ec_unchanged('b-keys-129'),
  'EC-074 the 129-key refusal committed nothing');
select pg_temp.ec_call('b-keys-128', null,
  pg_temp.ec_create('{"title":"x"}', 'ec-bounds-0004',
    jsonb_build_object('values', pg_temp.ec_unknown_values(128))));
select ok(pg_temp.ec_out('b-keys-128') like 'VALIDATION_FAILED ["/fields/%"]',
  'EC-074 128 value keys pass the key bound and are refused only because the first key names no field');

select pg_temp.ec_call('b-depth-9', null,
  pg_temp.ec_create('{"title":"x"}', 'ec-bounds-0005',
    jsonb_build_object('values', jsonb_build_object(pg_temp.s10g_fid('title'), pg_temp.ec_nested(8)))));
select is(pg_temp.ec_out('b-depth-9'), 'VALIDATION_FAILED ["/values"]',
  'EC-074 a values object nested to depth 9 is refused at /values');
select pg_temp.ec_call('b-depth-8', null,
  pg_temp.ec_create('{"title":"x"}', 'ec-bounds-0006',
    jsonb_build_object('values', jsonb_build_object(pg_temp.s10g_fid('title'), pg_temp.ec_nested(7)))));
select ok(pg_temp.ec_out('b-depth-8') like 'VALIDATION_FAILED ["/fields/%"]',
  'EC-074 a values object nested to depth 8 passes the depth bound and is refused only as a wrong-kind field value');

select pg_temp.ec_call('b-bytes-over', null,
  pg_temp.ec_create('{"title":"x"}', 'ec-bounds-0007',
    jsonb_build_object('values', jsonb_build_object(pg_temp.s10g_fid('title'), repeat('x', 262145)))));
select is(pg_temp.ec_out('b-bytes-over'), 'VALIDATION_FAILED ["/values"]',
  'EC-074 a values object over 256 KiB is refused at /values');
select ok(pg_temp.ec_unchanged('b-bytes-over'),
  'EC-074 the oversize refusal committed nothing');

select pg_temp.ec_call('b-locale-long', null,
  pg_temp.ec_create('{"title":"x"}', 'ec-bounds-0008',
    jsonb_build_object('locale', 'en-aaaaaaaa-aaaaaaaa-aaaaaaaa-aaaaaaaa')));
select is(pg_temp.ec_out('b-locale-long'), 'VALIDATION_FAILED ["/locale"]',
  'EC-074 a locale longer than the 35-character BCP 47 bound is refused at /locale (it can belong to no active schema locale set)');
select pg_temp.ec_call('b-locale-bad', null,
  pg_temp.ec_create('{"title":"x"}', 'ec-bounds-0009', '{"locale":"en_US"}'));
select is(pg_temp.ec_out('b-locale-bad'), 'VALIDATION_FAILED ["/locale"]',
  'EC-074 a locale that is not BCP 47 is refused at /locale');

select pg_temp.ec_call('b-owner', null,
  pg_temp.ec_create('{"title":"x"}', 'ec-bounds-0010',
    jsonb_build_object('ownerId', extensions.gen_random_uuid())));
select is(pg_temp.ec_out('b-owner'), 'INVALID_REQUEST -',
  'EC-074 a caller-supplied ownerId is an unknown request key refused as INVALID_REQUEST');
select pg_temp.ec_call('b-assignee', null,
  pg_temp.ec_create('{"title":"x"}', 'ec-bounds-0011',
    jsonb_build_object('assigneeId', extensions.gen_random_uuid())));
select is(pg_temp.ec_out('b-assignee'), 'INVALID_REQUEST -',
  'EC-074 a caller-supplied assigneeId is refused as INVALID_REQUEST');
select pg_temp.ec_call('b-authority', null,
  pg_temp.ec_create('{"title":"x"}', 'ec-bounds-0012',
    '{"authority":{"capability":"cms.publisher"}}'));
select is(pg_temp.ec_out('b-authority'), 'INVALID_REQUEST -',
  'EC-074 a caller-supplied authority member is refused as INVALID_REQUEST');
select pg_temp.ec_call('b-acting', null,
  pg_temp.ec_create('{"title":"x"}', 'ec-bounds-0013',
    jsonb_build_object('actingPartyId', extensions.gen_random_uuid())));
select is(pg_temp.ec_out('b-acting'), 'INVALID_REQUEST -',
  'EC-074 a caller-supplied actingPartyId is refused as INVALID_REQUEST');
select ok(pg_temp.ec_unchanged('b-owner') and pg_temp.ec_unchanged('b-assignee')
    and pg_temp.ec_unchanged('b-authority') and pg_temp.ec_unchanged('b-acting'),
  'EC-074 the caller-authority refusals committed nothing');

-- ---------------------------------------------------------------------- Part C ----
-- A healthy gallery entry carrying a canonical rich_text body and a structured meta.
create temp table ec_entry on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.ec_create(jsonb_build_object(
  'title', 'Draft read',
  'body', jsonb_build_object('format', 'rich_text.v1', 'blocks', jsonb_build_array(
    jsonb_build_object('type', 'paragraph', 'spans', jsonb_build_array(
      jsonb_build_object('text', 'Hello', 'marks', '[]'::jsonb))))),
  'meta', jsonb_build_object('label', 'Launch')), 'ec-draft-seed-0001')) as response;
select is(pg_temp.s10_last_error_state(), '00000',
  'EC-074 fixture: the gallery entry with a canonical rich_text body and a structured meta is created');

create temp table ec_entry_ids on commit drop as
select response->'entry'->>'id' as entry_id, response->'revision'->>'id' as revision_id
from ec_entry;

-- Tampering keeps the stored value hash and the revision payload hash CONSISTENT with
-- the tampered value, so the only thing that can refuse the read is the value gate.
create or replace function pg_temp.ec_tamper(p_field text, p_value jsonb)
returns text
language sql
stable
as $body$
  select format($sql$set local session_replication_role = replica;
    update platform_private.cms_entry_field_values
       set value = %1$L::jsonb,
           value_hash = platform_private.cms_jcs_sha256(%1$L::jsonb)::char(64)
     where revision_id = %2$L and field_id = %3$L;
    update platform_private.cms_entry_revisions
       set payload_hash = platform_private.cms_jcs_sha256((
         select pg_catalog.jsonb_object_agg(field_value.field_id::text, field_value.value)
           from platform_private.cms_entry_field_values field_value
          where field_value.revision_id = %2$L))::char(64)
     where id = %2$L;
    set local session_replication_role = origin;$sql$,
    p_value::text, (select revision_id from ec_entry_ids), pg_temp.s10g_fid(p_field))
$body$;

select pg_temp.ec_call('c-control', null, pg_temp.ec_detail_sql((select entry_id from ec_entry_ids)));
select is(pg_temp.ec_out('c-control'), 'OK -',
  'EC-074 the draft read of the healthy entry succeeds');
select is(
  (select response->'fields' @> jsonb_build_array(jsonb_build_object(
     'fieldId', pg_temp.s10g_fid('meta'), 'value', jsonb_build_object('label', 'Launch')))
   from ec_calls where label = 'c-control'),
  true,
  'EC-074 the draft read returns the object value exactly as written');

select pg_temp.ec_call('c-valid-tamper',
  pg_temp.ec_tamper('body', jsonb_build_object('format', 'rich_text.v1', 'blocks', jsonb_build_array(
    jsonb_build_object('type', 'heading', 'level', 2, 'spans', jsonb_build_array(
      jsonb_build_object('text', 'Rewritten', 'marks', jsonb_build_array('bold'))))))),
  pg_temp.ec_detail_sql((select entry_id from ec_entry_ids)));
select is(pg_temp.ec_out('c-valid-tamper'), 'OK -',
  'EC-074 control: a consistently rewritten but still canonical rich_text value reads, so the next refusals are the value gate and not the hashes');

select pg_temp.ec_call('c-rich-invalid',
  pg_temp.ec_tamper('body', jsonb_build_object('format', 'rich_text.v1', 'blocks', jsonb_build_array(
    jsonb_build_object('type', 'paragraph', 'spans', jsonb_build_array(
      jsonb_build_object('text', 'a', 'marks', '[]'::jsonb),
      jsonb_build_object('text', 'b', 'marks', '[]'::jsonb)))))),
  pg_temp.ec_detail_sql((select entry_id from ec_entry_ids)));
select is(pg_temp.ec_out('c-rich-invalid'), 'INTERNAL_ERROR -',
  'EC-074 a stored rich_text value with adjacent merge-equivalent spans is a scrubbed INTERNAL_ERROR, never served');

select pg_temp.ec_call('c-rich-unsafe',
  pg_temp.ec_tamper('body', jsonb_build_object('format', 'rich_text.v1', 'blocks', jsonb_build_array(
    jsonb_build_object('type', 'paragraph', 'spans', jsonb_build_array(
      jsonb_build_object('text', 'x', 'marks', '[]'::jsonb,
        'link', jsonb_build_object('kind', 'https', 'href', 'javascript:alert(1)'))))))),
  pg_temp.ec_detail_sql((select entry_id from ec_entry_ids)));
select is(pg_temp.ec_out('c-rich-unsafe'), 'INTERNAL_ERROR -',
  'EC-074 a stored rich_text value with an unsafe link scheme is a scrubbed INTERNAL_ERROR, never served');

select pg_temp.ec_call('c-rich-raw',
  pg_temp.ec_tamper('body', to_jsonb('<script>alert(1)</script>'::text)),
  pg_temp.ec_detail_sql((select entry_id from ec_entry_ids)));
select is(pg_temp.ec_out('c-rich-raw'), 'INTERNAL_ERROR -',
  'EC-074 a stored raw HTML string in a rich_text field is a scrubbed INTERNAL_ERROR, never served');

select pg_temp.ec_call('c-object-extra',
  pg_temp.ec_tamper('meta', jsonb_build_object('label', 'Launch', 'extra', 1)),
  pg_temp.ec_detail_sql((select entry_id from ec_entry_ids)));
select is(pg_temp.ec_out('c-object-extra'), 'INTERNAL_ERROR -',
  'EC-074 a stored object value with an undeclared property is a scrubbed INTERNAL_ERROR, never served');

select pg_temp.ec_call('c-object-missing',
  pg_temp.ec_tamper('meta', '{}'::jsonb),
  pg_temp.ec_detail_sql((select entry_id from ec_entry_ids)));
select is(pg_temp.ec_out('c-object-missing'), 'INTERNAL_ERROR -',
  'EC-074 a stored object value missing its required property is a scrubbed INTERNAL_ERROR, never served');

select pg_temp.ec_call('c-object-nested',
  pg_temp.ec_tamper('meta', jsonb_build_object('label', jsonb_build_object('deep', 1))),
  pg_temp.ec_detail_sql((select entry_id from ec_entry_ids)));
select is(pg_temp.ec_out('c-object-nested'), 'INTERNAL_ERROR -',
  'EC-074 a stored object value that nests a scalar property is a scrubbed INTERNAL_ERROR, never served');

select * from finish();
rollback;
