-- Slice 10 round 2 (lane H, Codex SQL review 3 findings 1 and 2): a residual deadlock is
-- the typed retryable CONFLICT, never a raw SQLSTATE 40P01.
--
-- 20261005013000 gives the entry/revision writers, both schema activation commands and
-- authority revocation ONE lock order, so the cycles the review found cannot form.  This
-- is the defense in depth for any pair of commands outside that order: PostgreSQL's
-- deadlock detector aborts one transaction, and the command wrappers answer it with
-- 409 CONFLICT (P0001, whole-message token CONFLICT) after rolling the whole command
-- back.  Nothing is committed, so the caller may retry with the same idempotency key.
-- The wrappers are the API surface of the four writers (create, append, resolve,
-- restore), the human and Worker activation commands and the CMS-03A-17 revocation.
--
-- Signatures, SECURITY DEFINER attributes, search_path, owners and grants are unchanged
-- (CREATE OR REPLACE).  The race runner 010 (S4) proves it through each wrapper with a
-- helper session that holds the locks in the legacy order.
-- Forward-only.
begin;

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
  begin
    rpc_result := platform_private.cms_create_entry(p_request);
  exception
    when deadlock_detected then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
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
  begin
    rpc_result := platform_private.cms_create_revision(p_request);
  exception
    when deadlock_detected then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
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
  begin
    rpc_result := platform_private.cms_resolve_conflict(p_request);
  exception
    when deadlock_detected then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

create or replace function platform_api.cms_restore_revision(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  begin
    rpc_result := platform_private.cms_restore_revision(p_request);
  exception
    when deadlock_detected then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

create or replace function platform_api.cms_activate_schema(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  begin
    rpc_result := platform_private.cms_activate_schema(p_request);
  exception
    when deadlock_detected then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

create or replace function platform_api.cms_activate_schema_migration(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  begin
    rpc_result := platform_private.cms_worker_activate_schema(p_request);
  exception
    when deadlock_detected then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

create or replace function platform_api.cms_revoke_capability_grant(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  begin
    rpc_result := platform_private.cms_revoke_capability_grant(p_request);
  exception
    when deadlock_detected then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

commit;
