commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 P240 (DEC-123, AC003 / AC045 / AC049): a new content type is created
-- WITHOUT a template.  A compatible template names the type id, which exists only
-- after CMS-03A-01 commits, so the draft RPC refuses a default template and any
-- template binding outright (never by consulting the template tables), and a
-- type gains its template binding only through a successor version, which
-- carries the source's bindings (re-guarded for compatibility) forward.
-- No template binding row is ever inserted by hand here.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

\ir phase_02_slice_09_p240/00-a01.sqlinc

-- ------------------------------------------------ structural: no binding path ----
select is(position('cms_content_type_template_bindings' in pg_temp.s09d_def('platform_private.cms_create_type_draft(jsonb)')), 0,
  'the create RPC has no code path that writes a template binding [P2-S09-AC-049]');
select is(position('cms_template_registry_valid' in pg_temp.s09d_def('platform_private.cms_create_type_draft(jsonb)')), 0,
  'the create RPC never consults the template registry: a template reference is refused as such, not as a missing or incompatible template [P2-S09-AC-045]');
select ok(position('default_template_version_id' in pg_temp.s09d_def('platform_private.cms_create_type_draft(jsonb)')) > 0
    and position('nullif(p_request->>''defaultTemplateVersionId''' in pg_temp.s09d_def('platform_private.cms_create_type_draft(jsonb)')) = 0,
  'the new version stores a null default template, never the request value [P2-S09-AC-045]');
select ok(position('cms_content_type_template_bindings' in pg_temp.s09d_def('platform_private.cms_create_schema_successor(jsonb)')) > 0
    and position('default_template_version_id' in pg_temp.s09d_def('platform_private.cms_create_schema_successor(jsonb)')) > 0,
  'the successor RPC carries the source default template and bindings into the new draft [P2-S09-AC-003]');

-- --------------------------------------------------- behavior: refused whole ----
select is(pg_temp.p_run('t:null', pg_temp.p_base('p240_dec123_ok'), 'OK'), 'ok',
  'control: a null default template and no bindings creates the type [P2-S09-AC-003]');
select is((select count(*)::integer from platform_private.cms_content_type_template_bindings), 0,
  'the created aggregate holds no template binding row [P2-S09-AC-049]');
select is((select v.default_template_version_id::text from platform_private.cms_content_type_versions v
    join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = 'p240_dec123_ok'), null,
  'the created version holds no default template [P2-S09-AC-045]');
select is(pg_temp.p_run('t:default:' || c.n, pg_temp.p_base(pg_temp.p_key('t123d' || c.n),
    jsonb_build_object('defaultTemplateVersionId', c.v)), 'VALIDATION_FAILED'), 'ok',
  'a default template ' || c.n || ' is refused with 422 and nothing is committed [P2-S09-AC-045]')
from (values ('uuid that resolves nowhere', to_jsonb(extensions.gen_random_uuid())), ('malformed id', '"nope"'::jsonb),
  ('number', '7'::jsonb), ('object', '{}'::jsonb), ('empty string', '""'::jsonb)) c(n, v);
select is(pg_temp.p_run('t:bind:' || c.n, pg_temp.p_base(pg_temp.p_key('t123b' || c.n),
    jsonb_build_object('templateBindings', c.v)), 'VALIDATION_FAILED'), 'ok',
  'template bindings ' || c.n || ' are refused with 422 and nothing is committed [P2-S09-AC-049]')
from (values
  ('with one reference', jsonb_build_array(jsonb_build_object('templateVersionId', extensions.gen_random_uuid()))),
  ('with 32 references', (select jsonb_agg(jsonb_build_object('templateVersionId', extensions.gen_random_uuid())) from generate_series(1, 32))),
  ('with 33 references', (select jsonb_agg(jsonb_build_object('templateVersionId', extensions.gen_random_uuid())) from generate_series(1, 33))),
  ('as a bare id', jsonb_build_array(extensions.gen_random_uuid()::text)),
  ('as an object', '{}'::jsonb), ('as null', 'null'::jsonb)) c(n, v);
select is((select count(*)::integer from platform_private.cms_content_types where type_key like 'p240\_dec123%' or type_key like 't123%'), 1,
  'only the control type exists after every refusal [P2-S09-AC-049]');

select * from finish();
rollback;
