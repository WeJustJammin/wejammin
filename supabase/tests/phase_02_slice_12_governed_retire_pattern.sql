-- Slice 12 lane governed-retire, CMS-03C-09 `retire` on a PATTERN subject (DEC-190; BE03c 1326 "retire", 1552-1554, 1561).  The pattern kind is the
-- one subject kind phase_02_slice_12_governed_activation.sql (templates, taxonomy) cannot drive cheaply, so this suite reuses the pattern-definition
-- fixtures (000, 010) and the real nested-pattern scenario (050: a child pattern and a nested parent, both really authored, submitted, assigned,
-- approved and activated through the named producers), then retires the active parent through the real platform_api.cms_activate_governed_subject.
-- No governed row is inserted by hand and no trigger is disabled.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_definition/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_definition/050-nested.sqlinc
\ir phase_02_slice_12_governed_retire_pattern/010-retire.sqlinc

select * from finish();
rollback;
