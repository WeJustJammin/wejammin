-- Slice 11 criteria: P2-S11-AC-119, "Persistence `cms_editorial_review_assignments`: rows are created only by
-- `cms_assign_editorial_reviewer` (create) and moved `active` to `revoked` only by its revoke action (advancing
-- `version` and `updated_at`) ..."  The older suites prove that a revoke advances `version` by exactly one and that
-- `updated_at` never moves backwards; neither proves that `updated_at` ADVANCES.  This suite does, at both levels:
--   * the update guard: a revoke that leaves `updated_at` unchanged, or moves it back, is refused CONFLICT; a revoke
--     that moves it forward is accepted;
--   * the command: the revoke response's `updatedAt` and the stored `updated_at` are later than the creation's, and
--     `createdAt` / `created_at` do not move.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(16);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/010-assign.sqlinc

create temp table r11_req(label text primary key, request jsonb not null) on commit drop;

-- Every revision of entry A is inserted BEFORE any review (a newer revision invalidates older live reviews).
select pg_temp.r11_revision('revR2', 22);
-- r1: the open review the guard-level and command-level assignments belong to.
select pg_temp.h11r_review('r1');

-- ---------------------------------------------------------------------------
-- The update guard.
-- ---------------------------------------------------------------------------
select pg_temp.h11r_assign('g-1', 'r1', 'reviewer02');
select pg_temp.h11r_assign('g-2', 'r1', 'reviewer03');
select pg_temp.h11r_assign('g-3', 'r1', 'reviewer04');
select is(
  (select string_agg(state || '/v' || version || '/' || (updated_at = created_at)::text, ',' order by id::text)
     from platform_private.cms_editorial_review_assignments where id in (pg_temp.s11_id('g-1'), pg_temp.s11_id('g-2'), pg_temp.s11_id('g-3'))),
  'active/v1/true,active/v1/true,active/v1/true',
  'control: three guard-created assignments are active at version 1 with updated_at = created_at [P2-S11-AC-119]');
select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_review_assignments set state = ''revoked'', version = 2, updated_at = updated_at where id = %L',
    pg_temp.s11_id('g-1'))),
  'P0001:CONFLICT',
  'a revoke that leaves updated_at unchanged is refused: the revoke must advance updated_at [P2-S11-AC-119]');
select is(
  (select state || '/v' || version from platform_private.cms_editorial_review_assignments where id = pg_temp.s11_id('g-1')),
  'active/v1', 'and the assignment stays active at version 1 [P2-S11-AC-119]');
select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_review_assignments set state = ''revoked'', version = 2, updated_at = updated_at - interval ''1 second'' where id = %L',
    pg_temp.s11_id('g-2'))),
  'P0001:CONFLICT',
  'a revoke that moves updated_at backwards is refused [P2-S11-AC-119]');
select is(
  pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_review_assignments set state = ''revoked'', version = 2, updated_at = clock_timestamp() where id = %L',
    pg_temp.s11_id('g-3'))),
  '00000', 'a revoke that advances updated_at is accepted [P2-S11-AC-119]');
select is(
  (select state || '/v' || version || '/' || (updated_at > created_at)::text
     from platform_private.cms_editorial_review_assignments where id = pg_temp.s11_id('g-3')),
  'revoked/v2/true', 'and leaves the assignment revoked at version 2 with updated_at later than created_at [P2-S11-AC-119]');

-- ---------------------------------------------------------------------------
-- The command: create, then revoke.
-- ---------------------------------------------------------------------------
insert into r11_req(label, request) values ('create', pg_temp.r11_areq('r1', 'create'));
select pg_temp.r11_acall('create', 'owner', (select request from r11_req where label = 'create'));
select pg_sleep(0.02);
select pg_temp.r11_acall('revoke', 'owner', pg_temp.r11_areq('r1', 'revoke', jsonb_build_object('assignmentId', pg_temp.r11_resp('create')->>'id')));
select is(pg_temp.r11_out('create') || '|' || pg_temp.r11_out('revoke'), '00000:|00000:',
  'control: the owner creates and then revokes the assignment through the command [P2-S11-AC-119]');
select ok(
  pg_temp.r11_resp('create')->>'version' = '1' and pg_temp.r11_resp('revoke')->>'version' = '2'
    and (pg_temp.r11_resp('revoke')->>'updatedAt')::timestamptz > (pg_temp.r11_resp('create')->>'updatedAt')::timestamptz,
  'the revoke response advances version (1 to 2) and updatedAt (later than the creation''s) [P2-S11-AC-119]');
select ok(
  pg_temp.r11_resp('revoke')->>'createdAt' = pg_temp.r11_resp('create')->>'createdAt',
  'and createdAt is the creation instant, unchanged [P2-S11-AC-119]');
select ok(
  (select assignment.version = 2 and assignment.state = 'revoked' and assignment.updated_at > assignment.created_at
     from platform_private.cms_editorial_review_assignments assignment
    where assignment.id = (pg_temp.r11_resp('create')->>'id')::uuid),
  'the stored row has version 2, state revoked and updated_at later than created_at [P2-S11-AC-119]');

select * from finish();
rollback;
