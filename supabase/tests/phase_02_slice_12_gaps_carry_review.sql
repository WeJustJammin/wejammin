-- Slice 12 gap lane claude_s12_gaps_db2: P2-S12-AC-219 clause 1 (BE03c Canonical records, "every composition write ... invalidates the
-- revision's live editorial review in the same transaction"): the REVISION-APPEND carry-over.  Proven today for the other three writers
-- (placement p7, pattern update 060-effects, scan 030-scan) and, for the append, only the rollback (CB-FAULT-REVIEWS) and the restore
-- trigger path.  World: the dec193 carry world (real signed blocks, governed patterns, real public placement and append).  A live
-- editorial review is seeded on the current draft exactly as phase_02_slice_12_dec193_carry/016 does (s12pl_review), then the REAL
-- public cms_create_revision append carries composition rows; the review is read back.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();
select set_config('s12pd.type_count', '1', true);
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_definition/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_placement/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_placement/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_updates_common/000-helpers.sqlinc
\ir phase_02_slice_12_dec193_carry/000-fixture.sqlinc
\ir phase_02_slice_12_dec193_carry/010-append-conflict.sqlinc
\ir phase_02_slice_12_dec193_carry/015-boundary-fixtures.sqlinc

select pg_temp.s12cb_world('g2-rv');
select pg_temp.s12cb_row('g2-rv', '/legacy', 0);
select pg_temp.s12cb_row('g2-rv', '/other', 7);
select pg_temp.s12cc_capture('g2-rv');
create temp table g2_rv on commit drop as select pg_temp.s12pl_review('g2-rv', clock_timestamp()) as review_id;
select ok((select r.state = 'open' and r.revision_id = pg_temp.s12pl_rev('g2-rv') from platform_private.cms_editorial_reviews r where r.id = (select review_id from g2_rv))
    and (select count(*) = 2 from platform_private.cms_composition_instances where revision_id = pg_temp.s12pl_rev('g2-rv')),
  'fixture: the current draft of g2-rv holds two composition rows and one live (open) editorial review [P2-S12-AC-219]');
select pg_temp.s12cc_call('G2-RV-APP', 'append', pg_temp.s12cc_request('g2-rv', 'append', 'g2-rv-append-key'));
select is((select state from s12cc_out where label = 'G2-RV-APP'), '00000',
  'the real public revision append over a draft with a live review succeeds [P2-S12-AC-219]');
select ok((select count(*) = 2 and bool_and(i.carried_from_id is not null) from platform_private.cms_composition_instances i
      where i.revision_id = (pg_temp.s12cc_body('G2-RV-APP')->>'id')::uuid),
  'the append carried both composition rows onto the new revision with carry-over provenance [P2-S12-AC-219]');
select ok((select r.state = 'invalidated' and r.invalidated_reason = 'revision_superseded'
      from platform_private.cms_editorial_reviews r where r.id = (select review_id from g2_rv)),
  'the same append invalidated the old revision''s live editorial review with the reason revision_superseded [P2-S12-AC-219]');
select ok((select count(*) = 1 from platform_private.cms_editorial_reviews r where r.entry_id = pg_temp.s12pl_entry_id('g2-rv')),
  'control: the entry holds exactly the one review, so the invalidated row is the seeded live review [P2-S12-AC-219]');

select * from finish();
rollback;
