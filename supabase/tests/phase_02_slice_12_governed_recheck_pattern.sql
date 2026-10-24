-- Slice 12 lane governed-v4, review V4-07 (BE03c "Governed review machinery" Invalidation; tracker P2-S12-AC-202 / AC-203): the `pattern` kind of the
-- governed recheck, which the template world of phase_02_slice_12_governed_recheck.sql cannot drive.  A nested pattern review is really authored,
-- submitted, assigned and approved through the named producers; the nested child pattern's successor is really activated; the producers'
-- event resolver reads the real committed cms.pattern.activated.v1 event; the recheck run is called with THAT event id (so the audit records
-- carry the source event's correlation id, the path the template-world suite cannot reach with a random event id).
-- No governed row is inserted by hand and no trigger is disabled.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();
-- two content types are enough for this suite (the pattern-definition fixtures default to 65 for their compatibility bounds)
select set_config('s12pd.type_count', '2', true);

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_definition/010-oracles.sqlinc
\ir phase_02_slice_12_governed_recheck_pattern/010-pattern.sqlinc

select * from finish();
rollback;
