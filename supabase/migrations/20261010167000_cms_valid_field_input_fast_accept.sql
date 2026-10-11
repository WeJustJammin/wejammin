-- Slice 09 (AC217; P2-S09-AC-217): the field-definition validator accepts the common field shape early.
--
-- The criterion "128-field create/activate RPC p95 < 300 ms" (BE03a Performance budgets) held in isolation after
-- 20261010166000 but not in the canonical SQL suite: create128 p95 309.5 ms and activate p95 276.9 ms there, and
-- 237 to 305 ms (create128) over five further in-suite reproductions on a quiet host.  The function-level
-- profile of the benchmark chain (supabase/tests/phase_02_slice_09_evidence_bench128.sql, track_functions)
-- attributes the time to platform_private.cms_valid_field_input: 61.7 of 210 ms in create (one pass over the 128
-- fields) and 130.1 of 226 ms in activation (cms_activation_references_valid validates every field of the
-- manifest and then every stored field row: 256 calls).  The validator costs about 0.4 ms per field because it
-- walks ~35 statements and calls cms_exact_keys, cms_valid_uuid, cms_reserved_key (0.15 ms per call in the
-- profile) and cms_json_bounded (a recursive walk) for every field.
--
-- This forward migration replaces ONLY that function.  It opens with an early accept: a single boolean
-- conjunction that returns true for the common field shape (complete definition form, scalar kind, no default
-- value, no validator pair, constraints within minLength / maxLength / minimum / maximum, a well-formed
-- editorConfig) and is, member by member, at least as strict as the full rules.  Every other input, and every
-- refusal, runs the previous rules unchanged: they are the previous body, nested one block deeper so that the
-- handler for the cast errors still wraps exactly them.  An input is never refused earlier and never accepted
-- that the full rules refuse.  The suite supabase/tests/phase_02_slice_09_valid_field_input_fast_accept.sql
-- proves it against the verbatim previous body on a corpus of 3,383 inputs (every variant of every member, 3,000
-- mixtures, every reserved word) and shows which inputs take the early accept.
--
-- Preservation (checked in this transaction): the installed body must be exactly the one of
-- 20261005010100 (md5 of prosrc), owned by postgres, IMMUTABLE, not SECURITY DEFINER, search_path = '', with
-- its ACL (owner and the CMS definer role); after the replacement every pg_proc attribute except the source and
-- the comment is unchanged.  The early accept calls pg_catalog built-ins and operators only, so no role needs a
-- new EXECUTE grant.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  target_oid oid := pg_catalog.to_regprocedure('platform_private.cms_valid_field_input(jsonb,boolean)');
  original pg_catalog.pg_proc%rowtype;
begin
  select proc.* into original from pg_catalog.pg_proc proc where proc.oid = target_oid;
  if not found then
    raise exception 'CMS field input validator missing' using errcode = '55000';
  end if;
  if pg_catalog.md5(original.prosrc) is distinct from 'f3fbc53fdde3f16a338c3edadc94a02b'
     or pg_catalog.pg_get_userbyid(original.proowner) is distinct from 'postgres'
     or original.prokind is distinct from 'f'
     or original.provolatile is distinct from 'i'
     or original.prosecdef is distinct from false
     or original.proisstrict is distinct from false
     or original.proleakproof is distinct from false
     or original.proparallel is distinct from 'u'
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.proacl is distinct from
       array['postgres=X/postgres', 'wejammin_cms_definer=X/postgres']::pg_catalog.aclitem[]
     or original.pronargs is distinct from 2
     or original.pronargdefaults is distinct from 1
     or original.proargnames is distinct from array['p_value', 'p_require_stable_id']::text[]
     or pg_catalog.oidvectortypes(original.proargtypes) is distinct from 'jsonb, boolean'
     or original.prorettype is distinct from 'boolean'::pg_catalog.regtype
     or original.proretset is distinct from false
     or original.prolang is distinct from (
       select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql'
     ) then
    raise exception 'CMS field input validator baseline mismatch (installed source md5 %)',
      pg_catalog.md5(original.prosrc) using errcode = '55000';
  end if;
  perform pg_catalog.set_config(
    'wejammin.valid_field_input_metadata',
    ((pg_catalog.to_jsonb(original) - 'prosrc')::text), true);
  perform pg_catalog.set_config(
    'wejammin.valid_field_input_comment',
    coalesce(pg_catalog.obj_description(original.oid, 'pg_proc'), ''), true);
end;
$migration$;

create or replace function platform_private.cms_valid_field_input(
  p_value jsonb,
  p_require_stable_id boolean default true
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  constraints jsonb;
  editor_config jsonb;
  kind text;
begin
  -- AC217 early accept.  Create validates every field of a definition once and activation twice, and the full
  -- rules below cost about 0.4 ms per field.  An input that is the common field shape is accepted here without
  -- them.  The condition below ONLY ever answers true: it is a conjunction of checks each of
  -- which is at least as strict as the rule of the same name below (a digits-only bound is written as the digit
  -- patterns that satisfy it, a literal default, a validator pair and the list, object, enumValues, itemKind and
  -- objectStructure rules are left to the full rules), so every input it accepts is accepted by the full rules, and
  -- every other input, every refusal included, falls through to them unchanged.  The suite
  -- phase_02_slice_09_valid_field_input_fast_accept.sql holds this to the verbatim previous body on a corpus and
  -- shows which inputs take it.  Only the complete-definition form (p_require_stable_id) is accepted early.  The two
  -- CASE expressions are parenthesized because PL/pgSQL ends an IF condition at the first THEN it meets outside parentheses.
  if p_require_stable_id and pg_catalog.jsonb_typeof(p_value) = 'object' then
    constraints := p_value->'constraints';
    editor_config := p_value->'editorConfig';
    if p_value ?& array['stableFieldId','key','kind','constraints','required','validatorKey','validatorVersion','defaultMode','localizationMode','editorConfig','lifecycle']::pg_catalog.text[]
       and (p_value - array['stableFieldId','key','kind','constraints','required','validatorKey','validatorVersion','defaultMode','defaultValue','localizationMode','editorConfig','lifecycle']::pg_catalog.text[]) = '{}'::pg_catalog.jsonb
       and not (p_value ? 'defaultValue')
       and (p_value->>'stableFieldId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       and pg_catalog.jsonb_typeof(p_value->'key') = 'string'
       and (p_value->>'key') ~ '^[a-z][a-z0-9_]{1,63}$'
       and not (pg_catalog.lower(p_value->>'key') = any (array[
        'user', 'users', 'person', 'persons', 'account', 'accounts',
        'session', 'sessions', 'identity', 'identities', 'party', 'parties',
        'profile', 'profiles', 'asset', 'assets', 'menu', 'menus',
        'setting', 'settings', 'comment', 'comments', 'credit', 'credits',
        'right', 'rights', 'money', 'mandate', 'mandates', 'dispute',
        'disputes', 'entitlement', 'entitlements', 'credential', 'credentials', 'evidence',
        'institution', 'institutions', 'institution_gate', 'course', 'courses', 'lesson',
        'lessons', 'authority', 'authorities', 'permission', 'permissions', 'role',
        'roles', 'billing', 'payment', 'payments', 'transaction', 'transactions'
       ]::pg_catalog.text[]))
       and pg_catalog.jsonb_typeof(p_value->'kind') = 'string'
       and (p_value->>'kind') = any (array['short_text','long_text','rich_text','boolean','integer','decimal','date','datetime','enum','taxonomy','relation','media']::pg_catalog.text[])
       and pg_catalog.jsonb_typeof(constraints) = 'object'
       and (case when pg_catalog.jsonb_typeof(constraints) = 'object'
             then (constraints - array['minLength','maxLength','minimum','maximum']::pg_catalog.text[]) = '{}'::pg_catalog.jsonb
             else false end)
       and pg_catalog.octet_length(constraints::pg_catalog.text) <= 8192
       and (not (constraints ? 'minLength')
            or (pg_catalog.jsonb_typeof(constraints->'minLength') = 'number' and (constraints->>'minLength') ~ '^([0-9]{1,5}|100000)$'))
       and (not (constraints ? 'maxLength')
            or (pg_catalog.jsonb_typeof(constraints->'maxLength') = 'number' and (constraints->>'maxLength') ~ '^([0-9]{1,5}|100000)$'))
       and (not (constraints ? 'minLength' and constraints ? 'maxLength') or constraints->'minLength' <= constraints->'maxLength')
       and (not (constraints ? 'minimum') or pg_catalog.jsonb_typeof(constraints->'minimum') = 'number')
       and (not (constraints ? 'maximum') or pg_catalog.jsonb_typeof(constraints->'maximum') = 'number')
       and (not (constraints ? 'minimum' and constraints ? 'maximum') or constraints->'minimum' <= constraints->'maximum')
       and pg_catalog.jsonb_typeof(p_value->'required') = 'boolean'
       and (p_value->>'defaultMode') = any (array['none','inherited']::pg_catalog.text[])
       and (p_value->>'localizationMode') = any (array['none','localized','no_fallback']::pg_catalog.text[])
       and (p_value->>'lifecycle') = any (array['active','deprecated','retired']::pg_catalog.text[])
       and (p_value->>'validatorKey') is null
       and (p_value->>'validatorVersion') is null
       and pg_catalog.jsonb_typeof(editor_config) = 'object'
       and (case when pg_catalog.jsonb_typeof(editor_config) = 'object'
             then editor_config ?& array['label','order']::pg_catalog.text[]
                  and (editor_config - array['label','helpText','order']::pg_catalog.text[]) = '{}'::pg_catalog.jsonb
             else false end)
       and pg_catalog.jsonb_typeof(editor_config->'label') = 'string'
       and pg_catalog.length(pg_catalog.normalize(editor_config->>'label', 'NFC')) between 1 and 120
       and (not (editor_config ? 'helpText')
            or (pg_catalog.jsonb_typeof(editor_config->'helpText') = 'string'
                and pg_catalog.length(pg_catalog.normalize(editor_config->>'helpText', 'NFC')) <= 500))
       and pg_catalog.jsonb_typeof(editor_config->'order') = 'number'
       and (editor_config->>'order') ~ '^([0-9]{1,4}|10000)$' then
      return true;
    end if;
  end if;
  begin
    if not platform_private.cms_exact_keys(
      p_value,
      case when p_require_stable_id
        then array['stableFieldId','key','kind','constraints','required','validatorKey','validatorVersion','defaultMode','localizationMode','editorConfig','lifecycle']::text[]
        else array['key','kind','constraints','required','validatorKey','validatorVersion','defaultMode','localizationMode','editorConfig','lifecycle']::text[]
      end,
      array['stableFieldId','key','kind','constraints','required','validatorKey','validatorVersion','defaultMode','defaultValue','localizationMode','editorConfig','lifecycle']::text[]
    ) then
      return false;
    end if;
    if p_require_stable_id and not platform_private.cms_valid_uuid(p_value->>'stableFieldId') then return false; end if;
    if not p_require_stable_id and p_value ? 'stableFieldId'
       and not platform_private.cms_valid_uuid(p_value->>'stableFieldId') then return false; end if;
    if pg_catalog.jsonb_typeof(p_value->'key') is distinct from 'string'
       or p_value->>'key' !~ '^[a-z][a-z0-9_]{1,63}$'
       or platform_private.cms_reserved_key(p_value->>'key') then return false; end if;
    if pg_catalog.jsonb_typeof(p_value->'kind') is distinct from 'string' then return false; end if;
    kind := p_value->>'kind';
    if kind not in (
      'short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal',
      'date', 'datetime', 'enum', 'taxonomy', 'relation', 'media', 'object', 'list'
    ) then return false; end if;
    constraints := p_value->'constraints';
    if pg_catalog.jsonb_typeof(constraints) is distinct from 'object'
       or not platform_private.cms_json_bounded(constraints, 8192, 8, 64, 256)
       or exists (select 1 from pg_catalog.jsonb_object_keys(constraints) key_name
         where key_name not in ('minLength','maxLength','minimum','maximum','enumValues','itemKind','objectStructure')) then
      return false;
    end if;
    if constraints ? 'minLength' and (
         pg_catalog.jsonb_typeof(constraints->'minLength') <> 'number'
         or (constraints->>'minLength') !~ '^[0-9]+$'
         or (constraints->>'minLength')::numeric > 100000
       ) then return false; end if;
    if constraints ? 'maxLength' and (
         pg_catalog.jsonb_typeof(constraints->'maxLength') <> 'number'
         or (constraints->>'maxLength') !~ '^[0-9]+$'
         or (constraints->>'maxLength')::numeric > 100000
       ) then return false; end if;
    if constraints ? 'minLength' and constraints ? 'maxLength'
       and (constraints->>'minLength')::numeric > (constraints->>'maxLength')::numeric then return false; end if;
    if constraints ? 'minimum' and pg_catalog.jsonb_typeof(constraints->'minimum') <> 'number' then return false; end if;
    if constraints ? 'maximum' and pg_catalog.jsonb_typeof(constraints->'maximum') <> 'number' then return false; end if;
    if constraints ? 'minimum' and constraints ? 'maximum'
       and (constraints->>'minimum')::numeric > (constraints->>'maximum')::numeric then return false; end if;
    if constraints ? 'enumValues' then
      if pg_catalog.jsonb_typeof(constraints->'enumValues') <> 'array'
         or pg_catalog.jsonb_array_length(constraints->'enumValues') > 256
         or exists (select 1 from pg_catalog.jsonb_array_elements(constraints->'enumValues') enum_entry
           where pg_catalog.jsonb_typeof(enum_entry) <> 'string'
             or pg_catalog.length(enum_entry #>> '{}') > 160) then return false; end if;
    end if;
    if constraints ? 'itemKind' and (constraints->>'itemKind') not in (
      'short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal',
      'date', 'datetime', 'enum', 'taxonomy', 'relation', 'media', 'object', 'list'
    ) then return false; end if;
    -- DEC-133: itemKind is a list-only constraint.  Carrying it on any other
    -- kind (including object, whose properties live in objectStructure) is
    -- refused so a definition can never declare two item encodings.
    if kind <> 'list' and constraints ? 'itemKind' then return false; end if;
    -- BE03a "Field kind structure" (DEC-133): a list field requires an itemKind
    -- that is a scalar kind or enum, so a nested list/object/relation/media/
    -- rich_text item (or a list with no usable itemKind) is refused at definition
    -- time, on the complete-definition and the incremental edit path alike.  A
    -- JSON-null or non-string itemKind reads as SQL NULL here and is refused too.
    if kind = 'list'
       and not platform_private.cms_list_item_kind_valid(constraints->>'itemKind') then
      return false;
    end if;
    -- DEC-133: a declared structure must be valid, and it may only appear on the
    -- object kind.  A complete type definition (p_require_stable_id, the
    -- create/activation field manifest) must also declare one for every object
    -- field; the incremental single-field edit path (p_require_stable_id false)
    -- keeps its legacy permissiveness, and its object values still fail closed at
    -- the value gate.
    if constraints ? 'objectStructure'
       and not platform_private.cms_object_structure_valid(constraints->'objectStructure') then
      return false;
    end if;
    if kind = 'object' and p_require_stable_id
       and not (constraints ? 'objectStructure') then
      return false;
    end if;
    if kind <> 'object' and constraints ? 'objectStructure' then return false; end if;
    if pg_catalog.jsonb_typeof(p_value->'required') <> 'boolean'
       or coalesce(p_value->>'defaultMode', '') not in ('none','literal','inherited')
       or coalesce(p_value->>'localizationMode', '') not in ('none','localized','no_fallback')
       or coalesce(p_value->>'lifecycle', '') not in ('active','deprecated','retired') then return false; end if;
    if (p_value->>'validatorKey' is null) <> (p_value->>'validatorVersion' is null) then return false; end if;
    if p_value->>'validatorKey' is not null
       and (p_value->>'validatorKey') !~ '^[a-z][a-z0-9._-]{0,127}$' then return false; end if;
    if p_value->>'validatorVersion' is not null
       and (
         not platform_private.cms_valid_version(p_value->>'validatorVersion')
         or not platform_private.cms_protected_validator_ref(
           p_value->>'validatorKey', (p_value->>'validatorVersion')::bigint
         )
       ) then return false; end if;
    -- BE03a kind/validator pairing: a present pair must name the registered
    -- rich_text.v1 v1 member (checked above), and a member pair is valid only on
    -- a rich_text field.  A member pair on another kind is refused so a
    -- definition can never bind a foreign grammar.
    if p_value->>'validatorKey' = 'rich_text.v1'
       and kind <> 'rich_text' then return false; end if;
    -- BE03a (Field definition: defaultValue is Json.nullable().optional(); a literal default needs
    -- the key present): an explicit JSON null is a literal default, only a missing key is not.
    if p_value->>'defaultMode' = 'literal' and not (p_value ? 'defaultValue') then return false; end if;
    if p_value->>'defaultMode' in ('none','inherited') and p_value ? 'defaultValue' then return false; end if;
    if p_value ? 'defaultValue'
       and not platform_private.cms_json_bounded(p_value->'defaultValue', 262144, 8, 128, 128) then return false; end if;
    -- BE03a: a literal defaultValue must satisfy the same encoding its field
    -- kind imposes on values, through the one shared cms_field_kind_value_shape:
    -- rich text is the canonical rich_text.v1 AST; a DEC-133 object satisfies its
    -- declared structure; a list is an array of its declared scalar/enum
    -- itemKind; every other kind is its primitive, choice-set or calendar
    -- encoding bounded by the 03a constraints.  The one exception is a present
    -- explicit JSON null: it is itself a valid literal default for every kind
    -- (defaultValue is Json.nullable()), while the shape helper keeps refusing an
    -- authored null so no invalid null can pass as a value.
    if p_value ? 'defaultValue'
       and pg_catalog.jsonb_typeof(p_value->'defaultValue') <> 'null'
       and not platform_private.cms_field_kind_value_shape(
         kind,
         constraints,
         p_value->'defaultValue'
       ) then
      return false;
    end if;
    editor_config := p_value->'editorConfig';
    if not platform_private.cms_exact_keys(
      editor_config,
      array['label','order']::text[],
      array['label','helpText','order']::text[]
    ) or pg_catalog.jsonb_typeof(editor_config->'label') is distinct from 'string'
      or pg_catalog.length(pg_catalog.normalize(editor_config->>'label', 'NFC')) not between 1 and 120
      or (editor_config ? 'helpText' and (
           pg_catalog.jsonb_typeof(editor_config->'helpText') is distinct from 'string'
           or pg_catalog.length(pg_catalog.normalize(editor_config->>'helpText', 'NFC')) > 500))
      or pg_catalog.jsonb_typeof(editor_config->'order') <> 'number'
      or (editor_config->>'order') !~ '^[0-9]+$'
      or (editor_config->>'order')::numeric > 10000 then return false; end if;
    return true;
  exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then
    return false;
  end;
end;
$body$;

do $migration$
declare
  actual pg_catalog.pg_proc%rowtype;
begin
  select proc.* into actual
    from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure('platform_private.cms_valid_field_input(jsonb,boolean)');
  if not found
     or (pg_catalog.to_jsonb(actual) - 'prosrc')::text
        is distinct from pg_catalog.current_setting('wejammin.valid_field_input_metadata')
     or coalesce(pg_catalog.obj_description(actual.oid, 'pg_proc'), '')
        is distinct from pg_catalog.current_setting('wejammin.valid_field_input_comment')
     or pg_catalog.md5(actual.prosrc) is not distinct from 'f3fbc53fdde3f16a338c3edadc94a02b' then
    raise exception 'CMS field input validator preservation mismatch' using errcode = '55000';
  end if;
end;
$migration$;

commit;
