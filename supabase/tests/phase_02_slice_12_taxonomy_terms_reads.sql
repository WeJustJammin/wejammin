-- cmsTaxonomyTermsRead (GET /api/v1/cms/taxonomies/{taxonomyId}/terms) and CMS-03C-17 (GET /api/v1/cms/taxonomies/selector) RED/GREEN suite,
-- lane taxonomy-terms.  Normative: BE03c 166-167 and 179 (route rows), 371-372 (validation rows), 1146-1190 (page contracts), 1478-1480
-- (authorization), 1377 ("the label for the requested locale (null when the term has none; there is no fallback), merged and deprecated
-- terms never listed"); contracts taxonomy-term-list.ts, taxonomy-selector.ts; tracker P2-S12-AC-130 .. AC-135, AC-183 .. AC-188.
-- Real fixtures: the same real vocabularies as the term-action suite plus terms written only through the real CMS-03C-03 command.  The
-- signed-cursor environment is a pgTAP-transaction-only Vault key.  See taxonomy_terms_reads/README.md.

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
\ir phase_02_slice_09_dec119/00-support.sqlinc
select pg_temp.s09d_session('owner', 'authenticated');
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc
\ir phase_02_slice_12_taxonomy_terms/000-world.sqlinc
\ir phase_02_slice_12_taxonomy_terms/010-setup.sqlinc
\ir phase_02_slice_12_taxonomy_terms_reads/000-world.sqlinc
\ir phase_02_slice_12_taxonomy_terms_reads/010-fixtures.sqlinc
\ir phase_02_slice_12_taxonomy_terms_reads/020-terms-read.sqlinc
\ir phase_02_slice_12_taxonomy_terms_reads/030-terms-read-pages.sqlinc
\ir phase_02_slice_12_taxonomy_terms_reads/040-terms-read-authority.sqlinc
\ir phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc
\ir phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc

select finish();
rollback;
