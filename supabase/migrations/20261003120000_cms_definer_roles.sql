-- SEC-2: dedicated definer roles for the Slice 09 functions.
--
-- The platform `postgres` role has BYPASSRLS and owned every SECURITY DEFINER
-- function, so the forced RLS policies of the Slice 09 tables never applied to
-- any real caller (service_role also bypasses, but holds no table grants).  Two
-- NOLOGIN roles fix that.  Neither is a superuser or BYPASSRLS, neither can
-- create roles, databases or replication, and neither is a member of another
-- role, so the policies are evaluated for every statement a function they own
-- runs.  Only statements that work on hosted Supabase are used (postgres has
-- CREATEROLE there, not SUPERUSER).
--
--   wejammin_cms_definer
--     owns every function whose body reads or writes a forced Slice 09 table
--     (the CMS RPCs, their guards and projections, the MFA registry commands,
--     the notification-intent writer).  Its table access is governed by the RPC
--     context gate and the session-scope policies.
--   wejammin_cms_authority_reader
--     owns the read-only authority lookups (hence "reader"): the three session-scope helpers the
--     policies call and the MFA step-up capability lookup (which the MFA commands
--     call outside any CMS command).  They have to read the authority tables
--     (assignments, reviews, reports, the owner receipt, grants, tenures, the
--     account binding) without being filtered by the very policies that call
--     them or by the CMS command context; the role holds SELECT only and the
--     policies that admit it are SELECT-only.
--
-- `postgres` is made a member with INHERIT and SET so later migrations can
-- CREATE OR REPLACE and ALTER the functions these roles own, exactly as before.
-- Forward-only.
begin;

create role wejammin_cms_definer nologin nosuperuser nobypassrls nocreaterole nocreatedb noreplication noinherit;
create role wejammin_cms_authority_reader nologin nosuperuser nobypassrls nocreaterole nocreatedb noreplication noinherit;
grant wejammin_cms_definer to postgres with inherit true, set true;
grant wejammin_cms_authority_reader to postgres with inherit true, set true;

commit;
