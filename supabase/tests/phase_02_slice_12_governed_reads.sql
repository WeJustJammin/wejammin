-- Slice 12 lane governed-a, CMS-03C-10 and CMS-03C-11 (BE03c Route Registry, Per-operation authorization matrix, Permission
-- RLS and grants, Route field validation matrix; tracker P2-S12-AC-088 .. AC-099).  The governed review detail and the
-- scoped, signed-keyset reviewer queue through the real platform_api.cms_get_governed_review and
-- platform_api.cms_list_governed_reviews, called under the real service_role.
--
-- Real fixtures only: seven governed reviews are driven through the real submit, assignment and decision commands into
-- approved, rejected, open, invalidated and untouched states; the only labelled provisioning forgery is the S09 membership
-- tenure.  A pgTAP-transaction-only Vault key signs the queue cursors; it is never an operational value.

\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(56);

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
select pg_temp.s09d_session('owner', 'authenticated');
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_reads/010-setup.sqlinc
\ir phase_02_slice_12_governed_reads/020-detail.sqlinc
\ir phase_02_slice_12_governed_reads/030-queue.sqlinc
\ir phase_02_slice_12_governed_reads/040-cursor-privileges.sqlinc

select finish();
rollback;
