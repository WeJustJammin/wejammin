-- Slice 12 gap lane claude_s12_gaps_db2: P2-S12-AC-248 (BE03c "Outbox identity of the activation and taxonomy events", DEC-166, DEC-180 G3,
-- DEC-188): claim_outbox_batch claims each Slice 12 event under its EXACT aggregate type and refuses a wrong registry key; every claimable
-- event type resolves a registered producer; the cms.pattern. and cms.taxonomy. prefixes are registered exactly once.
--   cms.template.activated.v1  -> cms_template_version        cms.pattern.activated.v1 -> cms_pattern_version
--   cms.taxonomy.changed.v1    -> cms_taxonomy_version (activation) and cms_term (CMS-03C-03 term action)
-- Outbox rows are inserted directly as the test administrator (the precedent of phase_02_slice_11_recheck_relay.sql): the claim is the
-- unit under test, the producers' own tuples are proven in their suites.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- the producer registry covers every claimable Slice 12 event type exactly once
select is((select count(*)::integer from platform_private.outbox_event_producers where event_type_prefix = 'cms.pattern.'), 1,
  'the producer prefix cms.pattern. is registered exactly once [P2-S12-AC-248]');
select is((select count(*)::integer from platform_private.outbox_event_producers where event_type_prefix = 'cms.taxonomy.'), 1,
  'the producer prefix cms.taxonomy. is registered exactly once [P2-S12-AC-248]');
select is(platform_private.outbox_event_producer('cms.pattern.activated.v1') || '|' || platform_private.outbox_event_producer('cms.taxonomy.changed.v1')
    || '|' || platform_private.outbox_event_producer('cms.template.activated.v1'),
  'cms.composition|cms.composition|cms.composition',
  'the three Slice 12 event types resolve the registered composition producer, so no claimed event has an unregistered producer [P2-S12-AC-248]');

select set_config('app.cms_rpc', 'true', true);
insert into platform_private.outbox_events(id, event_type, schema_version, aggregate_type, aggregate_id, aggregate_version, correlation_id, payload)
select ('a1248000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, t.event_type, 1, t.aggregate_type,
       ('a1248000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid, 2, 'a1248000-0000-4000-8000-0000000000c1', '{}'::jsonb
  from (values
    (1, 'cms.template.activated.v1', 'cms_template_version'),
    (2, 'cms.pattern.activated.v1', 'cms_pattern_version'),
    (3, 'cms.taxonomy.changed.v1', 'cms_taxonomy_version'),
    (4, 'cms.taxonomy.changed.v1', 'cms_term'),
    (5, 'cms.localization.changed.v1', 'cms_locale_variant'),
    -- wrong registry keys: well-formed keys of other aggregates
    (21, 'cms.template.activated.v1', 'cms_pattern_version'),
    (22, 'cms.template.activated.v1', 'cms_term'),
    (23, 'cms.pattern.activated.v1', 'cms_template_version'),
    (24, 'cms.pattern.activated.v1', 'cms_term'),
    (25, 'cms.taxonomy.changed.v1', 'cms_template_version'),
    (26, 'cms.taxonomy.changed.v1', 'cms_content_entry'),
    (27, 'cms.template.activated.v1', 'cms_unknown_aggregate'),
    (28, 'cms.pattern.activated.v1', 'job'),
    (29, 'cms.taxonomy.changed.v1', 'cms_pattern_version')
  ) t(n, event_type, aggregate_type);

create temp table g2_claim on commit drop as
select * from platform_api.claim_outbox_batch('a1248000-0000-4000-8000-0000000000e1', 60, 100);

select is((select string_agg(event_type || '/' || aggregate_type, ',' order by event_type, aggregate_type) from g2_claim
      where event_id::text like 'a1248000-0000-4000-8000-0000000000%' and aggregate_id::text like 'a1248000-0000-4000-8000-00000000010%'),
  'cms.localization.changed.v1/cms_locale_variant,cms.pattern.activated.v1/cms_pattern_version,cms.taxonomy.changed.v1/cms_taxonomy_version,'
  || 'cms.taxonomy.changed.v1/cms_term,cms.template.activated.v1/cms_template_version',
  'the relay claims each Slice 12 event under its exact aggregate type, taxonomy under both cms_taxonomy_version and cms_term [P2-S12-AC-248]');
select is((select count(*)::integer from g2_claim where event_id::text like 'a1248000-0000-4000-8000-0000000000%'
      and aggregate_id::text like 'a1248000-0000-4000-8000-00000000012%'), 0,
  'a template, pattern or taxonomy event under a wrong registry key (another aggregate, an unknown key, a job) is not claimed [P2-S12-AC-248]');
select is((select count(*)::integer from g2_claim where event_id::text like 'a1248000-0000-4000-8000-0000000000%'), 5,
  'exactly the five listed tuples are claimed out of the fourteen inserted [P2-S12-AC-248]');
select is((select count(*)::integer from platform_private.outbox_events where id::text like 'a1248000-0000-4000-8000-0000000000%'
      and dispatch_lease_token is null), 9,
  'the nine wrong-key events keep no dispatch lease: they stay unclaimed [P2-S12-AC-248]');
select ok((select bool_and(producer is not null) from g2_claim where event_id::text like 'a1248000-0000-4000-8000-0000000000%'),
  'every claimed Slice 12 event carries a registered producer [P2-S12-AC-248]');
select ok(not exists (select 1 from pg_catalog.pg_proc p where p.oid = 'platform_private.claim_outbox_batch(uuid,integer,integer)'::regprocedure
      and p.prosrc ~ 'aggregate_type ~'),
  'the installed claim source holds no regex alternative on aggregate_type: the allowlist is exact tuples only [P2-S12-AC-248]');

select * from finish();
rollback;
