-- CMS-03B-07 (BE03b "Review invalidation", "Accessibility provider (DEC-134, D25)", DEC-159 (2) (5);
-- tracker P2-S11-AC-096, AC-101, AC-111):
--   * a counted approver whose standing grant lapsed is found lazily by the schedule-phase revocation preflight:
--     the reviewer_authority_changed invalidation COMMITS (the review's pending and retry schedules are cancelled
--     in the same transaction) and the command answers the committed refusal { kind: refusal, reasonCode:
--     preflight_failed, details: { preflight } } with its reservation completed (422), instead of a rollback that
--     would leave the dead approval standing;
--   * the audit record is written by cms_record_audit_event with a chosen id, and the accessibility summary is
--     keyed to that exact audit event (no outbox event exists until execution).
-- A stale frozen manifest keeps its committed refusal; its token is now version_set_stale (the helper
-- cms_publication_stale_refusal answers it, BE03b E1).  Only the listed anchors of the installed body change.
-- Forward-only: rollback is a reviewed forward migration restoring the prior definition.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity text := 'platform_private.cms_schedule_publication(jsonb)';
  cms_owner oid := 'wejammin_cms_definer'::pg_catalog.regrole;
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  original_definition text;
  replacement_definition text;
  actual_definition text;
  replacement_source text;
  inverse_source text;
  original_metadata jsonb;
  original_comment text;
  anchor_index integer;
  old_anchors text[] := array[
    $old$  stamp timestamptz;
  refusal jsonb;
  response jsonb;
begin$old$,
    $old$  perform platform_private.cms_publication_preflight_verdict(
    'schedule', review_row, acting_party_id, publisher_person, resolved_value, evidence);$old$,
    $old$  perform platform_private.cms_record_audit(
    'cms.publication.schedule', actor_id, acting_party_id, 'cms_publication_schedule', schedule_id,
    'CMS_PUBLICATION_SCHEDULED', correlation_id);$old$,
    $old$  -- DEC-159 (5): the Worker's proof is summarized (no event exists until execution: a fresh effect id).
  perform platform_private.cms_record_command_accessibility_evidence(
    'CMS-03B-07', schedule_id, review_row.revision_id, extensions.gen_random_uuid(), correlation_id, evidence);$old$
  ];
  new_anchors text[] := array[
    $new$  stamp timestamptz;
  refusal jsonb;
  verdict jsonb;
  audit_id uuid := extensions.gen_random_uuid();
  response jsonb;
begin$new$,
    $new$  -- A lapsed counted approver is found lazily here: the invalidation COMMITS and the refusal is answered, not raised.
  verdict := platform_private.cms_publication_preflight_verdict(
    'schedule', review_row, acting_party_id, publisher_person, resolved_value, evidence, actor_id, correlation_id);
  if verdict->>'kind' = 'refusal' then
    perform platform_private.cms_complete(reservation.id, review_row.id, 422, verdict);
    return verdict;
  end if;$new$,
    $new$  perform platform_private.cms_record_audit_event(
    'cms.publication.schedule', actor_id, acting_party_id, 'cms_publication_schedule', schedule_id,
    'CMS_PUBLICATION_SCHEDULED', correlation_id, audit_id);$new$,
    $new$  -- DEC-159 (5): the Worker's proof is summarized, keyed to the exact audit event above (no outbox event exists
  -- until execution).
  perform platform_private.cms_record_command_accessibility_evidence(
    'CMS-03B-07', schedule_id, review_row.revision_id, audit_id, null, correlation_id, evidence);$new$
  ];
begin
  if not exists (
    select 1 from pg_catalog.pg_roles role
     where role.oid = cms_owner
       and not role.rolcanlogin and not role.rolsuper and not role.rolbypassrls
  ) or pg_catalog.has_schema_privilege(cms_owner, 'platform_private', 'CREATE') then
    raise exception 'CMS schedule publication lapse and audit owner baseline mismatch' using errcode = '55000';
  end if;

  select proc.* into original
    from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'CMS schedule publication lapse and audit function missing' using errcode = '55000';
  end if;
  original_definition := pg_catalog.pg_get_functiondef(original.oid);
  if pg_catalog.md5(original.prosrc) is distinct from '28456f4de5c65e27d5215cafb0c12317'
     or pg_catalog.md5(original_definition) is distinct from '9791f3716070a0f5fae238c75fed68ed'
     or original.proowner is distinct from cms_owner
     or original.prokind is distinct from 'f'
     or original.provolatile is distinct from 'v'
     or original.prosecdef is distinct from true
     or original.proisstrict is distinct from false
     or original.proleakproof is distinct from false
     or original.proparallel is distinct from 'u'
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.proacl is distinct from
       array['wejammin_cms_definer=X/wejammin_cms_definer']::pg_catalog.aclitem[]
     or original.pronargs is distinct from 1
     or original.pronargdefaults is distinct from 0
     or original.proargnames is distinct from array['p_request']::text[]
     or pg_catalog.oidvectortypes(original.proargtypes) is distinct from 'jsonb'
     or original.prorettype is distinct from 'jsonb'::pg_catalog.regtype
     or original.proretset is distinct from false
     or original.prolang is distinct from (
       select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql'
     ) then
    raise exception 'CMS schedule publication lapse and audit function baseline mismatch (installed source md5 %, definition md5 %)',
      pg_catalog.md5(original.prosrc), pg_catalog.md5(original_definition) using errcode = '55000';
  end if;
  original_metadata := pg_catalog.to_jsonb(original) - 'prosrc';
  original_comment := pg_catalog.obj_description(original.oid, 'pg_proc');
  if pg_catalog.cardinality(old_anchors) <> 4 or pg_catalog.cardinality(new_anchors) <> 4
     or (pg_catalog.length(original_definition) - pg_catalog.length(
       pg_catalog.replace(original_definition, original.prosrc, '')
     )) / pg_catalog.length(original.prosrc) <> 1 then
    raise exception 'CMS schedule publication lapse and audit definition shape mismatch' using errcode = '55000';
  end if;

  replacement_source := original.prosrc;
  for anchor_index in 1..pg_catalog.cardinality(old_anchors) loop
    if (pg_catalog.length(replacement_source) - pg_catalog.length(
         pg_catalog.replace(replacement_source, old_anchors[anchor_index], '')
       )) / pg_catalog.length(old_anchors[anchor_index]) <> 1
       or pg_catalog.strpos(original.prosrc, new_anchors[anchor_index]) <> 0 then
      raise exception 'CMS schedule publication lapse and audit anchor % mismatch', anchor_index using errcode = '55000';
    end if;
    replacement_source := pg_catalog.replace(
      replacement_source, old_anchors[anchor_index], new_anchors[anchor_index]
    );
  end loop;
  -- Inverse proof: undoing every replacement in reverse order restores the installed source byte for byte,
  -- so the listed anchors are the ONLY body change.
  inverse_source := replacement_source;
  for anchor_index in reverse pg_catalog.cardinality(new_anchors)..1 loop
    if (pg_catalog.length(inverse_source) - pg_catalog.length(
         pg_catalog.replace(inverse_source, new_anchors[anchor_index], '')
       )) / pg_catalog.length(new_anchors[anchor_index]) <> 1 then
      raise exception 'CMS schedule publication lapse and audit inverse anchor % mismatch', anchor_index using errcode = '55000';
    end if;
    inverse_source := pg_catalog.replace(
      inverse_source, new_anchors[anchor_index], old_anchors[anchor_index]
    );
  end loop;
  if inverse_source is distinct from original.prosrc then
    raise exception 'CMS schedule publication lapse and audit source inverse mismatch' using errcode = '55000';
  end if;

  replacement_definition := pg_catalog.replace(
    original_definition, original.prosrc, replacement_source
  );
  if (pg_catalog.length(replacement_definition) - pg_catalog.length(
       pg_catalog.replace(replacement_definition, replacement_source, '')
     )) / pg_catalog.length(replacement_source) <> 1
     or pg_catalog.replace(replacement_definition, replacement_source, inverse_source)
       is distinct from original_definition then
    raise exception 'CMS schedule publication lapse and audit definition inverse mismatch' using errcode = '55000';
  end if;

  execute replacement_definition;

  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = original.oid;
  if not found then
    raise exception 'CMS schedule publication lapse and audit replacement missing' using errcode = '55000';
  end if;
  actual_definition := pg_catalog.pg_get_functiondef(actual.oid);
  inverse_source := actual.prosrc;
  for anchor_index in reverse pg_catalog.cardinality(new_anchors)..1 loop
    inverse_source := pg_catalog.replace(
      inverse_source, new_anchors[anchor_index], old_anchors[anchor_index]
    );
  end loop;
  if actual.prosrc is distinct from replacement_source
     or (pg_catalog.to_jsonb(actual) - 'prosrc') is distinct from original_metadata
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from original_comment
     or actual_definition is distinct from replacement_definition
     or inverse_source is distinct from original.prosrc
     or pg_catalog.replace(actual_definition, replacement_source, inverse_source)
       is distinct from original_definition then
    raise exception 'CMS schedule publication lapse and audit preservation mismatch' using errcode = '55000';
  end if;
end;
$migration$;

comment on function platform_private.cms_schedule_publication(jsonb) is
  'CMS-03B-07: an owner-party publisher schedules one action of a revision whose latest review is approved: step-up, workflow-scope concealment, the DEC-157 lock order, the approved review''s version as the CAS operand, the re-checked time rules, the publisher''s grant end, frozen-dependency currency (a stale manifest commits the invalidation dependency_changed and answers the committed refusal version_set_stale), the schedule-phase preflight (a lapsed counted approver commits the reviewer_authority_changed invalidation and answers the committed refusal), then the pending schedule, its audit record (the exact audit event its accessibility summary is keyed to) and the idempotency record. No event until execution. Private; the Worker calls the platform_api wrapper.';

commit;
