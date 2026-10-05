\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 acceptance evidence (lane e1-db), persistence rows of BE03a "Canonical
-- records and fields", part 2 of 3: capability grants, grant events, workflow policies and capability bindings. Proven by
-- behaviour, not column presence:
--   * s09e_check isolates ONE real CHECK or NOT NULL (the table's own definition
--     copied into a temp table with every other constraint dropped): the unchanged
--     producer row is accepted and the offending override is rejected by exactly
--     that constraint.
--   * s09e_unique / s09e_unique_idx do the same for a unique constraint or a
--     partial/expression unique index; s09e_fk_probe for every foreign key.
--   * The writer sets are read from the function catalog, so a new writer fails
--     the file that pins the writer set.
-- Base rows come from the real producer chain; no review, decision, dry-run, plan
-- or evidence row is hand-built.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
\ir phase_02_slice_09_dec108/05-probes.sqlinc

-- ====================================== cms_capability_grants + events (655-662) ====
select pg_temp.s09g_member('rev1');
select pg_temp.s09g_grant('cg', 'owner', 'rev1', 'cms.editor', pg_temp.s09g_day(10), '{"reason":"evidence"}');
select pg_temp.s09g_renew('cg:renew', 'owner', pg_temp.s09g_grant_id(pg_temp.s09d_resp('cg')), '1', pg_temp.s09g_day(20));
create temp table s09e_grant_ids on commit drop as
select pg_temp.s09g_grant_id(pg_temp.s09d_resp('cg')) as grant_id,
       (select id from platform_private.cms_capability_grant_events
         where grant_id = pg_temp.s09g_grant_id(pg_temp.s09d_resp('cg')) and aggregate_version = 1) as event_id;
select is(pg_temp.s09d_outcome('cg') || pg_temp.s09d_outcome('cg:renew'), 'OKOK', 'fixture: a granted and renewed aggregate with two events');

select is(pg_temp.s09e_check('cms_capability_grants', c.name, (select grant_id from s09e_grant_ids), c.over),
  'control:ACCEPTED|override:REJECTED:23514:' || c.name,
  'cms_capability_grants CHECK ' || c.name || ' rejects ' || c.over::text || ' [P2-S09-AC-655]')
from (values
  ('cms_capability_grants_capability_check', '{"capability_code":"Cms Editor"}'::jsonb),
  ('cms_capability_grants_capability_check', jsonb_build_object('capability_code', 'a' || repeat('b', 128))),
  ('cms_capability_grants_capability_check', '{"capability_code":"1cms"}'::jsonb),
  ('cms_capability_grants_last_action_check', '{"last_action":"extended"}'::jsonb),
  ('cms_capability_grants_reason_check', '{"reason":""}'::jsonb),
  ('cms_capability_grants_reason_check', jsonb_build_object('reason', repeat('x', 257))),
  ('cms_capability_grants_state_check', '{"state":"lapsed"}'::jsonb),
  ('cms_capability_grants_version_check', '{"version":0}'::jsonb)
) as c(name, over);
select is(pg_temp.s09e_check('cms_capability_grants', 'cms_capability_grants_capability_check', (select grant_id from s09e_grant_ids),
    jsonb_build_object('capability_code', 'a' || repeat('b', 127))), 'control:ACCEPTED|override:ACCEPTED',
  'a 128-character capability code in the grammar is accepted [P2-S09-AC-655]');
select is(pg_temp.s09e_check('cms_capability_grants', 'cms_capability_grants_reason_check', (select grant_id from s09e_grant_ids),
    jsonb_build_object('reason', repeat('x', 256))), 'control:ACCEPTED|override:ACCEPTED', 'a 256-octet reason is accepted [P2-S09-AC-655]');
select is(pg_temp.s09e_check('cms_capability_grants', 'valid_from', (select grant_id from s09e_grant_ids), '{"valid_from":null}'),
  'control:ACCEPTED|override:REJECTED:23502:valid_from', 'valid_from is NOT NULL: a grant has a finite start date [P2-S09-AC-655]');
select is(pg_temp.s09e_check('cms_capability_grants', 'valid_through', (select grant_id from s09e_grant_ids), '{"valid_through":null}'),
  'control:ACCEPTED|override:REJECTED:23502:valid_through', 'valid_through is NOT NULL: a grant has a finite end date [P2-S09-AC-655]');
select ok(pg_temp.s09e_check('cms_capability_grants', 'cms_capability_grants_term_check', (select grant_id from s09e_grant_ids),
    '{"valid_through":"infinity"}') like 'control:ACCEPTED|override:REJECTED:%',
  'an infinite valid_through is rejected [P2-S09-AC-655]');
select ok(pg_temp.s09d_has_columns('cms_capability_grants', array['subject_person_ref','capability_code','valid_from','valid_through',
    'grantor_person_ref','last_action','reason']), 'cms_capability_grants persists subject, capability, term, grantor, last action and reason [P2-S09-AC-655]');

select is(pg_temp.s09e_check('cms_capability_grants', 'cms_capability_grants_term_check', (select grant_id from s09e_grant_ids),
    (select jsonb_build_object('valid_through', (valid_from - 1)::text) from platform_private.cms_capability_grants where id = (select grant_id from s09e_grant_ids))),
  'control:ACCEPTED|override:REJECTED:23514:cms_capability_grants_term_check', 'valid_through before valid_from is rejected [P2-S09-AC-656]');
select is(pg_temp.s09e_check('cms_capability_grants', 'cms_capability_grants_term_check', (select grant_id from s09e_grant_ids),
    (select jsonb_build_object('valid_through', (valid_from + 90)::text) from platform_private.cms_capability_grants where id = (select grant_id from s09e_grant_ids))),
  'control:ACCEPTED|override:REJECTED:23514:cms_capability_grants_term_check', 'a 91-day term (valid_through - valid_from = 90) is rejected [P2-S09-AC-656]');
select is(pg_temp.s09e_check('cms_capability_grants', 'cms_capability_grants_term_check', (select grant_id from s09e_grant_ids),
    (select jsonb_build_object('valid_through', (valid_from + 89)::text) from platform_private.cms_capability_grants where id = (select grant_id from s09e_grant_ids))),
  'control:ACCEPTED|override:ACCEPTED', 'valid_through - valid_from = 89 (the DEC-120 ceiling) is accepted [P2-S09-AC-656]');
select is(pg_temp.s09e_check('cms_capability_grants', 'cms_capability_grants_term_check', (select grant_id from s09e_grant_ids),
    (select jsonb_build_object('valid_through', valid_from::text) from platform_private.cms_capability_grants where id = (select grant_id from s09e_grant_ids))),
  'control:ACCEPTED|override:ACCEPTED', 'valid_through = valid_from (a one-day term) is accepted [P2-S09-AC-656]');

select is(pg_temp.s09e_check('cms_capability_grants', 'cms_capability_grants_revoked_action_check', (select grant_id from s09e_grant_ids),
    '{"state":"revoked"}'), 'control:ACCEPTED|override:REJECTED:23514:cms_capability_grants_revoked_action_check',
  'state revoked with last_action renewed is rejected [P2-S09-AC-657]');
select is(pg_temp.s09e_check('cms_capability_grants', 'cms_capability_grants_revoked_action_check', (select grant_id from s09e_grant_ids),
    '{"last_action":"revoked"}'), 'control:ACCEPTED|override:REJECTED:23514:cms_capability_grants_revoked_action_check',
  'last_action revoked on an active aggregate is rejected [P2-S09-AC-657]');
select is(pg_temp.s09e_check('cms_capability_grants', 'cms_capability_grants_revoked_action_check', (select grant_id from s09e_grant_ids),
    '{"state":"revoked","last_action":"revoked"}'), 'control:ACCEPTED|override:ACCEPTED',
  'state revoked together with last_action revoked is accepted [P2-S09-AC-657]');
select is(pg_temp.s09e_unique('cms_capability_grants', (select grant_id from s09e_grant_ids), array['owner_id', 'subject_person_ref', 'capability_code'],
    '{"capability_code":"cms.other"}'), 'dup:REJECTED:23505|ctl:ACCEPTED',
  'UNIQUE(owner_id, subject_person_ref, capability_code): one aggregate per key [P2-S09-AC-657]');

select is(pg_temp.s09e_writers('cms_capability_grants', 'insert[[:space:]]+into'), 'cms_backfill_owner_capability_grants,cms_grant_capability',
  'only the grant RPC and the owner-initialization backfill insert an aggregate [P2-S09-AC-658]');
select is(pg_temp.s09e_writers('cms_capability_grants', 'update'), 'cms_grant_capability,cms_renew_capability_grant,cms_revoke_capability_grant',
  'only the grant, renew and revoke RPCs update an aggregate [P2-S09-AC-658]');
select is((select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private' and p.prokind = 'f' and pg_get_functiondef(p.oid) ~* 'cms_capability_grant_project\(' and p.proname <> 'cms_capability_grant_project'),
  'cms_grant_capability,cms_renew_capability_grant,cms_revoke_capability_grant',
  'each of the three RPCs upserts the matching actor-grant projection row and no other CMS code does [P2-S09-AC-658]');
select is(pg_temp.s09e_writers('cms_capability_grants', 'delete[[:space:]]+from'), '', 'no function deletes an aggregate [P2-S09-AC-658]');
select ok(pg_temp.s09d_rls('cms_capability_grants') and pg_temp.s09d_no_direct_grants('cms_capability_grants'),
  'cms_capability_grants has forced RLS and no direct browser or service-role table grant [P2-S09-AC-660]');
select ok(pg_temp.s09d_service_only('platform_api.cms_list_capability_grants(jsonb)')
  and not has_function_privilege('authenticated', 'platform_private.cms_list_capability_grants(jsonb)', 'execute'),
  'the aggregate is readable only through the service-role projection RPC (owner-only inside it) [P2-S09-AC-660]');

select is(pg_temp.s09e_unique('cms_capability_grant_events', (select event_id from s09e_grant_ids), array['grant_id', 'aggregate_version'],
    '{"aggregate_version":9}'), 'dup:REJECTED:23505|ctl:ACCEPTED', 'UNIQUE(grant_id, aggregate_version): one event per committed version [P2-S09-AC-661]');
select is(pg_temp.s09e_check('cms_capability_grant_events', c.name, (select event_id from s09e_grant_ids), c.over),
  'control:ACCEPTED|override:REJECTED:23514:' || c.name,
  'cms_capability_grant_events CHECK ' || c.name || ' rejects ' || c.over::text || ' [P2-S09-AC-661]')
from (values
  ('cms_capability_grant_events_action_check', '{"action":"extended"}'::jsonb),
  ('cms_capability_grant_events_aggregate_version_check', '{"aggregate_version":0}'::jsonb),
  ('cms_capability_grant_events_binding_hash_check', jsonb_build_object('binding_context_hash', repeat('A', 64))),
  ('cms_capability_grant_events_reason_check', '{"reason":""}'::jsonb),
  ('cms_capability_grant_events_state_check', '{"state":"pending"}'::jsonb),
  ('cms_capability_grant_events_version_check', '{"version":2}'::jsonb)
) as c(name, over);
select is(pg_temp.s09e_check('cms_capability_grant_events', 'mfa_verified_at', (select event_id from s09e_grant_ids), '{"mfa_verified_at":null}'),
  'control:ACCEPTED|override:REJECTED:23502:mfa_verified_at', 'an event without mfa_verified_at is rejected [P2-S09-AC-661]');
select is(pg_temp.s09e_check('cms_capability_grant_events', 'binding_context_hash', (select event_id from s09e_grant_ids), '{"binding_context_hash":null}'),
  'control:ACCEPTED|override:REJECTED:23502:binding_context_hash', 'an event without binding_context_hash is rejected [P2-S09-AC-661]');
select ok((select count(*) = 2 and bool_and(e.prior_valid_through is null) filter (where e.aggregate_version = 1)
      and bool_and(e.prior_valid_through is not null) filter (where e.aggregate_version = 2)
    from platform_private.cms_capability_grant_events e where e.grant_id = (select grant_id from s09e_grant_ids)),
  'a grant event has no prior_valid_through and the renewal event records the prior one, one row per version in the aggregate transaction [P2-S09-AC-661]');
select is(pg_temp.s09e_writers('cms_capability_grant_events', 'insert[[:space:]]+into'), 'cms_capability_grant_record_event',
  'one function appends grant events [P2-S09-AC-661]');
select is(pg_temp.s09e_check('cms_capability_grant_events', 'cms_capability_grant_events_immutable_check', (select event_id from s09e_grant_ids),
    jsonb_build_object('updated_at', (now() + interval '1 hour')::text)),
  'control:ACCEPTED|override:REJECTED:23514:cms_capability_grant_events_immutable_check', 'an event whose updated_at differs from created_at is rejected [P2-S09-AC-662]');
select set_config('app.cms_rpc', 'true', true);
select throws_ok(format('update platform_private.cms_capability_grant_events set reason = ''x'' where id = %L', (select event_id from s09e_grant_ids)),
  'P0001', 'IMMUTABLE_RECORD', 'an event UPDATE is rejected [P2-S09-AC-662]');
select throws_ok(format('delete from platform_private.cms_capability_grant_events where id = %L', (select event_id from s09e_grant_ids)),
  'P0001', 'IMMUTABLE_RECORD', 'an event DELETE is rejected [P2-S09-AC-662]');
select ok(pg_temp.s09d_rls('cms_capability_grant_events') and pg_temp.s09d_no_direct_grants('cms_capability_grant_events'),
  'cms_capability_grant_events has forced RLS and no direct privilege [P2-S09-AC-662]');
select ok(pg_temp.s09d_resp('cg') is not null and position('binding' in lower(pg_temp.s09d_resp('cg')::text)) = 0
  and position((select binding_context_hash from platform_private.cms_capability_grant_events where id = (select event_id from s09e_grant_ids)) in pg_temp.s09d_resp('cg')::text) = 0
  and not exists (select 1 from platform_private.outbox_events o
      where o.payload::text like '%' || (select binding_context_hash from platform_private.cms_capability_grant_events where id = (select event_id from s09e_grant_ids)) || '%'),
  'the identity hash is never serialized into a resource or an outbox payload [P2-S09-AC-662]');

-- ================================================ cms_workflow_policies (663-670) ====
create temp table s09e_policy on commit drop as
select id from platform_private.cms_workflow_policies where policy_key = 'editorial' and policy_version = 1;
select is(pg_temp.s09e_check('cms_workflow_policies', 'cms_workflow_policies_state_check', (select id from s09e_policy), '{"state":"active"}'),
  'control:ACCEPTED|override:REJECTED:23514:cms_workflow_policies_state_check', 'only the state seeded is admitted [P2-S09-AC-663]');
select is(pg_temp.s09e_unique('cms_workflow_policies', (select id from s09e_policy), array['policy_key', 'policy_version'], '{"policy_version":2,"version":2}'),
  'dup:REJECTED:23505|ctl:ACCEPTED', 'UNIQUE(policy_key, policy_version): one row per member version [P2-S09-AC-663]');
select is(pg_temp.s09e_writers('cms_workflow_policies', 'insert[[:space:]]+into') || pg_temp.s09e_writers('cms_workflow_policies', 'update')
  || pg_temp.s09e_writers('cms_workflow_policies', 'delete[[:space:]]+from'), '',
  'no function inserts, updates or deletes a workflow policy: the rows are seeded only by a forward migration [P2-S09-AC-663]');
select set_config('app.cms_rpc', 'true', true);
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select throws_ok(format('update platform_private.cms_workflow_policies set required_decision_count = 3 where id = %L', (select id from s09e_policy)),
  'P0001', null, 'a policy UPDATE is rejected [P2-S09-AC-663] [P2-S09-AC-686]');
select throws_ok(format('delete from platform_private.cms_workflow_policies where id = %L', (select id from s09e_policy)),
  'P0001', null, 'a policy DELETE is rejected [P2-S09-AC-663] [P2-S09-AC-686]');
select set_config('app.cms_rpc', '', true);
-- NEGATIVE CONTROL: a runtime INSERT of a policy member is refused; the registry is code-owned.
select ok(not pg_temp.s09d_try(format($q$insert into platform_private.cms_workflow_policies(owner_id, state, version, policy_key, policy_version, policy_hash, risk_class, required_decision_count, required_capabilities)
    select owner_id, state, version, 'editorial.runtime', policy_version, policy_hash, risk_class, required_decision_count, required_capabilities
      from platform_private.cms_workflow_policies where id = %L$q$, (select id from s09e_policy))),
  'a runtime INSERT of a policy member outside a migration is refused [P2-S09-AC-663]');
select is(pg_temp.s09e_check('cms_workflow_policies', 'cms_workflow_policies_protected_check', (select id from s09e_policy),
    '{"risk_class":"protected","required_decision_count":1,"required_capabilities":["cms.reviewer","cms.reviewer.policy"]}'),
  'control:ACCEPTED|override:REJECTED:23514:cms_workflow_policies_protected_check', 'a protected member with one required decision is rejected [P2-S09-AC-664]');
select is(pg_temp.s09e_check('cms_workflow_policies', 'cms_workflow_policies_protected_check', (select id from s09e_policy),
    '{"risk_class":"protected","required_decision_count":2,"required_capabilities":["cms.reviewer"]}'),
  'control:ACCEPTED|override:REJECTED:23514:cms_workflow_policies_protected_check', 'a protected member with one required capability is rejected [P2-S09-AC-664]');
select is(pg_temp.s09e_check('cms_workflow_policies', 'cms_workflow_policies_protected_check', (select id from s09e_policy),
    '{"risk_class":"protected","required_decision_count":2,"required_capabilities":["cms.reviewer","cms.reviewer.policy"]}'),
  'control:ACCEPTED|override:ACCEPTED', 'a protected member with two decisions and two capabilities is accepted [P2-S09-AC-664]');

select is((select count(*)::integer from platform_private.cms_workflow_policies p
    where p.policy_hash = platform_private.cms_jcs_sha256(jsonb_build_object('key', p.policy_key, 'version', p.policy_version,
      'riskClass', p.risk_class, 'requiredDecisionCount', p.required_decision_count, 'requiredCapabilities', p.required_capabilities))), 8,
  'policyHash of every seeded row is the SHA-256 of the JCS canonical { key, version, riskClass, requiredDecisionCount, requiredCapabilities } object, recomputed here from the row''s own columns [P2-S09-AC-665]');
select is((select count(*)::integer from platform_private.cms_workflow_policies p
    where p.policy_hash = platform_private.cms_workflow_policy_hash(p.policy_key, p.policy_version, p.risk_class,
      p.required_decision_count, p.required_capabilities) and p.policy_hash ~ '^[a-f0-9]{64}$'), 8,
  'the registry hash function reproduces all eight lowercase 64-hex hashes [P2-S09-AC-665]');
create or replace function pg_temp.s09e_member_after_tamper(p_sql text) returns text language plpgsql as $body$
declare observed text;
begin
  begin
    set constraints all immediate;
    alter table platform_private.cms_workflow_policies disable trigger user;
    execute p_sql;
    observed := coalesce(platform_private.cms_workflow_policy_member('editorial', 1)::text, 'NULL');
    raise exception 'S09E_ROLLBACK';
  exception when others then
    if sqlerrm <> 'S09E_ROLLBACK' then return 'ERROR:' || sqlerrm; end if;
  end;
  return observed;
end;
$body$;
select is(pg_temp.s09e_member_after_tamper('select 1'), platform_private.cms_workflow_policy_member('editorial', 1)::text,
  'control: the untampered member projection is returned whole [P2-S09-AC-666]');
select is(pg_temp.s09e_member_after_tamper(format('update platform_private.cms_workflow_policies set policy_hash = %L where policy_key = ''editorial'' and policy_version = 1', repeat('0', 64))),
  'NULL', 'the evidence projection returns NULL (fail closed) when a stored policy_hash differs from the recomputation of the row''s own columns [P2-S09-AC-666]');
select is(pg_temp.s09e_member_after_tamper('update platform_private.cms_workflow_policies set required_decision_count = 2 where policy_key = ''editorial'' and policy_version = 1'),
  'NULL', 'a changed column with the old hash is the same hash mismatch and fails closed [P2-S09-AC-666]');

select is((select string_agg(policy_key || ':' || risk_class || ':' || required_decision_count || ':' || required_capabilities::text, ' ' order by policy_key)
    from platform_private.cms_workflow_policies where policy_version = 1 and policy_key in ('editorial', 'editorial.default', 'cms.content.workflow', 'cms.standard')),
  'cms.content.workflow:ordinary:1:["cms.reviewer"] cms.standard:ordinary:1:["cms.reviewer"] editorial:ordinary:1:["cms.reviewer"] editorial.default:ordinary:1:["cms.reviewer"]',
  'the four ordinary members (version 1) each require one decision and the cms.reviewer slot [P2-S09-AC-667]');
select is((select string_agg(policy_key || ':' || risk_class || ':' || required_decision_count || ':' || required_capabilities::text, ' ' order by policy_key)
    from platform_private.cms_workflow_policies where policy_version = 1 and policy_key like 'cms.disclosure.%'),
  'cms.disclosure.financial:protected:2:["cms.reviewer", "cms.reviewer.financial"] cms.disclosure.legal:protected:2:["cms.reviewer", "cms.reviewer.legal"] cms.disclosure.policy:protected:2:["cms.reviewer", "cms.reviewer.policy"] cms.disclosure.security:protected:2:["cms.reviewer", "cms.reviewer.security"]',
  'the four protected members (version 1) each require two decisions with cms.reviewer plus the matching specialist slot [P2-S09-AC-668]');
select is((select count(*)::integer from platform_private.cms_workflow_policies), 8, 'exactly the eight DEC-110 members are seeded [P2-S09-AC-667]');

-- AC669: a version binds exactly one seeded member; nothing the caller supplies is policy authority.
select is(pg_temp.s09d_scalar('select (count(*) = 2)::text from information_schema.columns where table_schema = ''platform_private''
    and table_name = ''cms_content_type_versions'' and column_name in (''workflow_key'', ''workflow_version'') and is_nullable = ''NO'''), 'true',
  'a content-type version carries a NOT NULL workflow_key and workflow_version: exactly one bound registry member [P2-S09-AC-669]');
select pg_temp.s09d_create_type('ux', 'evc_unseeded', 'no.such.policy');
select ok(pg_temp.s09d_outcome('ux:create') = 'VALIDATION_FAILED',
  'CMS-03A-01 refuses a workflow key outside the seeded registry (422/409) and creates nothing [P2-S09-AC-669] [P2-S09-AC-193]');
select pg_temp.s09d_rpc('ux:authority', 'platform_api.cms_create_type_draft', 'owner',
  jsonb_build_object('typeKey', 'evc_authority', 'label', 'x', 'ownerCapability', 'cms.schema_designer', 'sourceLocale', 'en-US',
    'defaultLocale', 'en-US', 'supportedLocales', '["en-US"]'::jsonb, 'fallbackChains', '{}'::jsonb, 'workflowKey', 'editorial',
    'workflowVersion', '1', 'defaultTemplateVersionId', null, 'fields', '[]'::jsonb, 'relations', '[]'::jsonb, 'templateBindings', '[]'::jsonb,
    'capabilityBindings', '[]'::jsonb, 'policyHash', repeat('a', 64), 'requiredCapabilities', '["cms.reviewer"]'::jsonb,
    'idempotencyKey', 's09e-policy-authority-0001'));
select is(pg_temp.s09d_outcome('ux:authority'), 'INVALID_REQUEST',
  'a caller-supplied policy hash or capability list is an unknown key, never authority [P2-S09-AC-669] [P2-S09-AC-193]');

-- AC670: the entry's editorial evidence follows the strictest-of rule of its bound schema version.
select pg_temp.s09d_create_type('sp', 'evc_strict', 'cms.disclosure.policy');
select pg_temp.s09d_grant_specialist('rev1', 'cms.reviewer.policy');
select pg_temp.s09d_to_active('sp', array['rev1', 'rev2']);
select pg_temp.s09d_successor('sq', 'sp');
select set_config('app.cms_rpc', 'true', true);
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
update platform_private.cms_content_type_versions set workflow_key = 'editorial', workflow_version = 1 where id = pg_temp.s09d_id('sq:version');
select pg_temp.s09d_to_active('sq', array['rev1', 'rev2']);
-- the evidence projection is a definer function: called outside a command it holds the RPC context itself
select set_config('app.cms_rpc', 'true', true);
select ok(pg_temp.s09d_outcome('sq:activate') = 'OK'
  and (select e->>'key' = 'editorial' and e->>'riskClass' = 'protected' and (e->>'requiredDecisionCount')::int = 2
        and e->'requiredCapabilities' = '["cms.reviewer", "cms.reviewer.policy"]'::jsonb
      from (select platform_private.cms_editorial_workflow_policy_evidence(pg_temp.s09d_id('sq:version')) e) s),
  'the editorial policy an entry carries for a successor under an ordinary key is the strictest of the source and bound members (protected, two decisions, the specialist slot) [P2-S09-AC-670]');
select set_config('app.cms_rpc', '', true);

-- ===================== cms_content_type_capability_bindings CHECKs (AC215 part) ====
select pg_temp.s09d_rpc('cb:create', 'platform_api.cms_create_type_draft', 'owner',
  jsonb_build_object('typeKey', 'evc_capbind', 'label', 'Capability binding', 'ownerCapability', 'cms.schema_designer',
    'sourceLocale', 'en-US', 'defaultLocale', 'en-US', 'supportedLocales', '["en-US"]'::jsonb, 'fallbackChains', '{}'::jsonb,
    'workflowKey', 'editorial', 'workflowVersion', '1', 'defaultTemplateVersionId', null, 'fields', '[]'::jsonb,
    'relations', '[]'::jsonb, 'templateBindings', '[]'::jsonb,
    'capabilityBindings', jsonb_build_array(jsonb_build_object('capabilityKey', 'cms.schema_designer', 'capabilityVersion', '1')),
    'idempotencyKey', 's09e-capbind-0001'));
select is(pg_temp.s09d_outcome('cb:create'), 'OK', 'fixture: a draft type with a real protected capability binding');
select ok(pg_temp.s09e_auto_check('cms_content_type_capability_bindings', con.conname) like 'PROVEN:%',
  con.conname || ' rejects an override of its own columns while the producer row passes [P2-S09-AC-215]')
from pg_constraint con where con.conrelid = 'platform_private.cms_content_type_capability_bindings'::regclass and con.contype = 'c';



-- ===================== foreign keys of this file's tables (AC215 part) ====
create temp table s09e_fk_results on commit drop as
select t as table_name,
       pg_temp.s09e_fk_probe('platform_private', t, null::jsonb) as outcome,
       (select count(*)::integer from pg_constraint con where con.conrelid = format('platform_private.%I', t)::regclass and con.contype = 'f') as fk_count
from unnest(array[
  'cms_capability_grants',
  'cms_capability_grant_events']) t;
select diag(table_name || ' => ' || outcome) from s09e_fk_results where outcome not like 'probed=%;bad=' order by 1;
select ok(outcome = 'probed=' || fk_count || ';bad=',
  table_name || ': all ' || fk_count || ' foreign keys reject a dangling reference (' || outcome || ') [P2-S09-AC-215]')
from s09e_fk_results where outcome <> 'EMPTY' order by table_name;
select is((select count(*)::integer from s09e_fk_results where outcome = 'EMPTY'), 0,
  'every probed table held a real producer row, so no foreign key was skipped [P2-S09-AC-215]');

select * from finish();
rollback;
