-- CMS-03B-20 execute (BE03b "Schedule execution", "Publication lineage (E3)", DEC-158(c), DEC-159 (5);
-- tracker P2-S11-AC-083, AC-084, AC-101, AC-114):
--   * finding 6: stale, wrong-provider-version or mis-bound accessibility proof is the typed conflict
--     preflight_evidence_stale (DEC-158(c)); it propagates and rolls the execution back, so the schedule, its
--     lease, version, attempts and audit stay as the claim left them.  The retry ladder is only for UNAVAILABLE
--     checker outcomes;
--   * finding 8: the lineage head is observed BEFORE the first shared lock and passed to the append, which
--     compares it under the lineage lock: an execution racing a publish loses with publication_conflict (its
--     retry ladder), exactly one of them commits;
--   * finding 10: the audit and outbox events of the execution carry ids chosen here, and the accessibility
--     summary is keyed to the exact audit event (the lineage row's, the block's or the retry's).
-- Only the listed anchors of the installed body change.  Forward-only: rollback is a reviewed forward migration
-- restoring the prior definition.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity text := 'platform_private.cms_execute_publication_schedule(jsonb)';
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
    $old$  event_ref uuid;
  result jsonb;
begin$old$,
    $old$  -- 2. global lock order: entry (0), the creator's authority (1), schema (4), review (5), schedule (6)
$old$,
    $old$  begin
    report := platform_private.cms_evaluate_preflight(pg_catalog.jsonb_build_object(
      'phase', 'execute', 'revisionId', schedule_row.revision_id, 'actingPartyId', schedule_row.owner_id,
      'actorPersonId', schedule_row.created_by, 'effectiveAt', platform_private.auth_iso_time(fire_at),
      'reviewId', review_row.id, 'frozenManifest', review_row.dependency_manifest, 'evidence', evidence));
  exception
    when raise_exception then
      -- Stale or mis-bound proof (DEC-158(c)) is never accepted and never a pass: the schedule retries.
      if sqlerrm in ('preflight_evidence_stale', 'dependency_changed') then
        report := null;
      else
        raise;
      end if;
  end;
  if report is null then
    return platform_private.cms_schedule_retry_result(schedule_row, correlation_id);
  end if;
$old$,
    $old$    result := platform_private.cms_schedule_blocked_result(schedule_row, 'preflight_failed', correlation_id);$old$,
    $old$  ) then
    result := platform_private.cms_schedule_retry_result(schedule_row, correlation_id);
  else$old$,
    $old$          'activationEvidenceHash', schedule_row.activation_evidence_hash,
          'correlationId', correlation_id, 'scheduleId', schedule_row.id));$old$,
    $old$          'action', schedule_row.action, 'publisherPersonId', schedule_row.created_by,
          'correlationId', correlation_id, 'scheduleId', schedule_row.id));$old$,
    $old$          result := platform_private.cms_schedule_blocked_result(schedule_row, 'publication_not_active', correlation_id);$old$,
    $old$        elsif sqlerrm = 'publication_conflict' then
          result := platform_private.cms_schedule_retry_result(schedule_row, correlation_id);$old$,
    $old$          result := platform_private.cms_schedule_blocked_result(schedule_row, 'approval_invalidated', correlation_id);
        else
          raise;$old$,
    $old$      event_ref := (
        select event.id
          from platform_private.outbox_events event
         where event.event_type = 'cms.publication.changed.v1'
           and event.aggregate_id = (lineage->>'id')::uuid
           and event.aggregate_version = (lineage->>'version')::bigint);$old$,
    $old$  perform platform_private.cms_record_command_accessibility_evidence(
    'CMS-03B-20', schedule_row.id, schedule_row.revision_id,
    coalesce(event_ref, extensions.gen_random_uuid()), correlation_id, evidence);$old$
  ];
  new_anchors text[] := array[
    $new$  event_ref uuid;
  result jsonb;
  head_locale text;
  head_observation jsonb;
  execution_audit uuid := extensions.gen_random_uuid();
  execution_outbox uuid := extensions.gen_random_uuid();
begin$new$,
    $new$  -- 1'. BE03b E3 (finding 8): the lineage head this execution saw, observed BEFORE the first shared lock (the entry
  -- row, position 0); the append compares it with the head under the lineage lock, so an execution racing a
  -- publish of the same lineage loses with publication_conflict (its retry ladder) instead of both committing.
  select revision_item.locale into head_locale
    from platform_private.cms_entry_revisions revision_item
   where revision_item.id = schedule_row.revision_id;
  head_observation := platform_private.cms_lineage_head_observation(
    schedule_row.entry_id, head_locale, schedule_row.audience);

  -- 2. global lock order: entry (0), the creator's authority (1), schema (4), review (5), schedule (6)
$new$,
    $new$  -- DEC-158(c): proof older than 60 seconds, from another provider version or bound to other rows is 409
  -- preflight_evidence_stale (BE03b "Accessibility provider").  The typed conflict PROPAGATES: the execution rolls
  -- back, so the schedule, its lease, version, attempt count and audit stay exactly as the claim left them (the
  -- lease expiry, not this call, spends a retry).  Only an UNAVAILABLE checker outcome takes the retry ladder.
  report := platform_private.cms_evaluate_preflight(pg_catalog.jsonb_build_object(
    'phase', 'execute', 'revisionId', schedule_row.revision_id, 'actingPartyId', schedule_row.owner_id,
    'actorPersonId', schedule_row.created_by, 'effectiveAt', platform_private.auth_iso_time(fire_at),
    'reviewId', review_row.id, 'frozenManifest', review_row.dependency_manifest, 'evidence', evidence));
$new$,
    $new$    result := platform_private.cms_schedule_blocked_result(schedule_row, 'preflight_failed', correlation_id, execution_audit);$new$,
    $new$  ) then
    result := platform_private.cms_schedule_retry_result(schedule_row, correlation_id, execution_audit);
  else$new$,
    $new$          'activationEvidenceHash', schedule_row.activation_evidence_hash,
          'correlationId', correlation_id, 'scheduleId', schedule_row.id,
          'expectedHead', head_observation, 'auditEventId', execution_audit, 'outboxEventId', execution_outbox));$new$,
    $new$          'action', schedule_row.action, 'publisherPersonId', schedule_row.created_by,
          'correlationId', correlation_id, 'scheduleId', schedule_row.id,
          'expectedHead', head_observation, 'auditEventId', execution_audit, 'outboxEventId', execution_outbox));$new$,
    $new$          result := platform_private.cms_schedule_blocked_result(schedule_row, 'publication_not_active', correlation_id, execution_audit);$new$,
    $new$        elsif sqlerrm = 'publication_conflict' then
          result := platform_private.cms_schedule_retry_result(schedule_row, correlation_id, execution_audit);$new$,
    $new$          result := platform_private.cms_schedule_blocked_result(schedule_row, 'approval_invalidated', correlation_id, execution_audit);
        else
          raise;$new$,
    $new$      event_ref := execution_outbox;$new$,
    $new$  -- Keyed to the exact audit event this execution wrote (the lineage row's, the block's or the retry's); the outbox
  -- event only when a publication event was emitted.
  perform platform_private.cms_record_command_accessibility_evidence(
    'CMS-03B-20', schedule_row.id, schedule_row.revision_id, execution_audit, event_ref, correlation_id, evidence);$new$
  ];
begin
  if not exists (
    select 1 from pg_catalog.pg_roles role
     where role.oid = cms_owner
       and not role.rolcanlogin and not role.rolsuper and not role.rolbypassrls
  ) or pg_catalog.has_schema_privilege(cms_owner, 'platform_private', 'CREATE') then
    raise exception 'CMS execute publication schedule conflicts owner baseline mismatch' using errcode = '55000';
  end if;

  select proc.* into original
    from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'CMS execute publication schedule conflicts function missing' using errcode = '55000';
  end if;
  original_definition := pg_catalog.pg_get_functiondef(original.oid);
  if pg_catalog.md5(original.prosrc) is distinct from 'd1955f3887d98be3edc391b73ac01b27'
     or pg_catalog.md5(original_definition) is distinct from '18becdf55ef2078e7d494a5b3e0a2b19'
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
    raise exception 'CMS execute publication schedule conflicts function baseline mismatch (installed source md5 %, definition md5 %)',
      pg_catalog.md5(original.prosrc), pg_catalog.md5(original_definition) using errcode = '55000';
  end if;
  original_metadata := pg_catalog.to_jsonb(original) - 'prosrc';
  original_comment := pg_catalog.obj_description(original.oid, 'pg_proc');
  if pg_catalog.cardinality(old_anchors) <> 12 or pg_catalog.cardinality(new_anchors) <> 12
     or (pg_catalog.length(original_definition) - pg_catalog.length(
       pg_catalog.replace(original_definition, original.prosrc, '')
     )) / pg_catalog.length(original.prosrc) <> 1 then
    raise exception 'CMS execute publication schedule conflicts definition shape mismatch' using errcode = '55000';
  end if;

  replacement_source := original.prosrc;
  for anchor_index in 1..pg_catalog.cardinality(old_anchors) loop
    if (pg_catalog.length(replacement_source) - pg_catalog.length(
         pg_catalog.replace(replacement_source, old_anchors[anchor_index], '')
       )) / pg_catalog.length(old_anchors[anchor_index]) <> 1
       or pg_catalog.strpos(original.prosrc, new_anchors[anchor_index]) <> 0 then
      raise exception 'CMS execute publication schedule conflicts anchor % mismatch', anchor_index using errcode = '55000';
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
      raise exception 'CMS execute publication schedule conflicts inverse anchor % mismatch', anchor_index using errcode = '55000';
    end if;
    inverse_source := pg_catalog.replace(
      inverse_source, new_anchors[anchor_index], old_anchors[anchor_index]
    );
  end loop;
  if inverse_source is distinct from original.prosrc then
    raise exception 'CMS execute publication schedule conflicts source inverse mismatch' using errcode = '55000';
  end if;

  replacement_definition := pg_catalog.replace(
    original_definition, original.prosrc, replacement_source
  );
  if (pg_catalog.length(replacement_definition) - pg_catalog.length(
       pg_catalog.replace(replacement_definition, replacement_source, '')
     )) / pg_catalog.length(replacement_source) <> 1
     or pg_catalog.replace(replacement_definition, replacement_source, inverse_source)
       is distinct from original_definition then
    raise exception 'CMS execute publication schedule conflicts definition inverse mismatch' using errcode = '55000';
  end if;

  execute replacement_definition;

  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = original.oid;
  if not found then
    raise exception 'CMS execute publication schedule conflicts replacement missing' using errcode = '55000';
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
    raise exception 'CMS execute publication schedule conflicts preservation mismatch' using errcode = '55000';
  end if;
end;
$migration$;

comment on function platform_private.cms_execute_publication_schedule(jsonb) is
  'CMS-03B-20 execute: re-reads the approved review and every frozen identity, rechecks the creator''s publisher grant (DEC-120), runs the 17-category execute-phase preflight with the verified proof (stale or mis-bound proof is the typed conflict preflight_evidence_stale and consumes nothing), applies the action under the lineage rules from the head observed before any shared lock (publication_conflict is retried) and completes the schedule with its actual instant and deviation, or blocks it (closed reason) or retries it (15 s / 60 s / 300 s, then retries_exhausted). Its accessibility summary is keyed to the exact audit event it wrote. Idempotent per (schedule, version, lease): a completed schedule answers already_completed. Private; the Worker scheduled sweep calls the platform_api wrapper.';

commit;
