-- DEC-193 / DEC-198 / DEC-200: private immediate carry provenance.
-- Nullable, no default and no backfill. Provenance crosses revisions, not owners.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table platform_private.cms_composition_instances
  add column carried_from_id uuid,
  add constraint cms_composition_instances_carried_from_owner_fkey
    foreign key (carried_from_id, owner_id)
    references platform_private.cms_composition_instances(id, owner_id);

comment on column platform_private.cms_composition_instances.carried_from_id is
  'Private immediate source row for revision carry; NULL retains legacy rows. Same-owner provenance may cross revision boundaries; it is not a render or pattern-expansion source.';

commit;
