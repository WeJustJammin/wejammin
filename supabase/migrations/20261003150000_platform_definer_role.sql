-- SEC-2 (second sweep): a third dedicated definer role.
--
-- Codex review R14 found the administrative MFA reset still owned by the
-- BYPASSRLS platform role.  The sweep over every schema found 33 more SECURITY
-- DEFINER functions, created or redefined by Slice 09 migrations, that read or
-- write a forced table under that bypass owner.  Most belong to the two roles
-- from 20261003120000 (the MFA commands to wejammin_cms_definer, the read-only
-- authority and identity lookups to wejammin_cms_authority_reader).  Five are
-- neither CMS nor MFA work: the authentication rate limiter, the consumer
-- dead-letter writer, the outbox lease claim, the configuration value resolver
-- and the profile claim conversion.  They get their own role so the CMS role
-- does not accumulate the profile claim tables or the outbox lease verbs.
--
-- wejammin_platform_definer is NOLOGIN, NOSUPERUSER, NOBYPASSRLS, cannot create
-- roles, databases or replication, and is a member of no role, exactly like the
-- other two.  `postgres` is a member WITH INHERIT and SET so later migrations can
-- CREATE OR REPLACE and ALTER what it owns.  Forward-only.
begin;

create role wejammin_platform_definer nologin nosuperuser nobypassrls nocreaterole nocreatedb noreplication noinherit;
grant wejammin_platform_definer to postgres with inherit true, set true;

commit;
