-- SEC-2: an RPC does not leave the RPC-context flag set.
--
-- Every command that writes a guarded table sets the transaction-local flag
-- `app.cms_rpc` (the RPC gate of the table policies and of the direct-write guard
-- trigger) and never reset it, so for the rest of the transaction a direct write
-- passed the gate.  The boundary of an RPC is its platform_api function: each
-- function below, the content entry, revision, locale, template and conflict commands plus the migration source-row read (every platform_api function that reaches a command that sets the
-- flag) now remembers the flag, calls the same command, and restores the
-- remembered value before it returns.  Nesting restores the OUTER value, not
-- blank.  When the command raises, the flag is restored by the rollback of
-- whatever sub-transaction catches the error (a transaction-local setting made
-- inside an aborted sub-transaction does not survive it); the statement or
-- transaction that does not catch it is aborted entirely.  Signatures, security
-- attributes, search_path, ACLs and return types are unchanged (CREATE OR REPLACE).
-- Forward-only.
begin;

create or replace function platform_api.cms_author_locale_variant(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_author_locale_variant(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

create or replace function platform_api.cms_create_entry(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_create_entry(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

create or replace function platform_api.cms_create_revision(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_create_revision(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

create or replace function platform_api.cms_define_template(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$

declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
  template_key text := p_request->>'templateKey';
begin
  -- Invalid keys are rejected by the private validator without allocating a
  -- caller-chosen lock. A hash collision only serializes unrelated keys; it
  -- cannot permit two writers of the same key to pass concurrently.
  if template_key ~ '^[a-z][a-z0-9-]{1,63}$' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('cms.template:' || template_key, 0)
    );
  end if;
  rpc_result := platform_private.cms_define_template(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

create or replace function platform_api.cms_get_entry_draft(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_get_entry_draft(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

create or replace function platform_api.cms_list_revisions(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_list_revisions_signed(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

create or replace function platform_api.cms_read_schema_migration_source_rows(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_read_schema_migration_source_rows(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

create or replace function platform_api.cms_resolve_conflict(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_resolve_conflict(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

commit;
