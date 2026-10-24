-- Slice 12 lane governed-fix3: the pattern branch of platform_private.cms_governed_current_digest enforces block
-- compatibility (BE03c 317-327, 1361, 1500; BE03a 1098-1101), exactly as the template branch already does through
-- cms_template_block_digest.  BE03c 1361: CMS-03C-12 "rejects a missing, withdrawn or incompatible block" and "the
-- digest is recomputed again at activation and at 03b publication preflight"; 317-327: the server recomputes the
-- digest at pattern create, pattern activate and publication preflight, and a missing, withdrawn or incompatible
-- block reference fails closed.  Before the fix the pattern branch checked registry + withdrawn only.
-- Real signed block registration and the S09 chains; the two fixture clones are those of the block-compat suite
-- (read-only reuse of its 000-fixtures.sqlinc).
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
\ir phase_02_slice_12_block_compatibility/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_fix3/010-pattern-compat.sqlinc
\ir phase_02_slice_12_governed_fix3/020-template-parity.sqlinc
\ir phase_02_slice_12_governed_fix3/030-identity.sqlinc
\ir phase_02_slice_12_governed_fix3/040-replay.sqlinc

select finish();
rollback;
