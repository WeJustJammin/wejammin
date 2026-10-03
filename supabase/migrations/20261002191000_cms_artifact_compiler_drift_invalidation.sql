-- Slice 09 audit remediation (R3, AC-102): CMS-03A-04 invalidates approval and
-- evidence when the compiler changes and forces review again.  The review
-- invalidation triggers covered the candidate, definition children, block
-- lifecycle, owner capability and reviewer authority, but nothing watched the
-- compiled SchemaArtifact itself, so a change of the compiler version or of the
-- compiled manifests of an approved candidate left the review approved.  A
-- change of any compiled member of the candidate's artifact now invalidates the
-- open or approved review and returns the candidate to draft in the same
-- transaction (the artifact rows stay immutable to every normal writer; this
-- only reacts when a privileged recompile changes one).  Forward-only.
begin;

create or replace function platform_private.cms_artifact_review_invalidation_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
begin
  if new.compiler_version is distinct from old.compiler_version
     or new.artifact_hash is distinct from old.artifact_hash
     or new.zod_contract_ref is distinct from old.zod_contract_ref
     or new.editor_manifest is distinct from old.editor_manifest
     or new.renderer_manifest is distinct from old.renderer_manifest then
    perform platform_private.cms_invalidate_activation_reviews(new.content_type_version_id);
  end if;
  return new;
end;
$body$;

revoke all on function platform_private.cms_artifact_review_invalidation_trigger()
  from public, anon, authenticated, service_role;

create trigger cms_schema_artifacts_activation_review_invalidation
  after update on platform_private.cms_schema_artifacts
  for each row execute function platform_private.cms_artifact_review_invalidation_trigger();

commit;
