-- CMS-03C-03: a term key identifies one durable term within a taxonomy
-- version. The earlier (taxonomy_version_id, term_key, version) uniqueness
-- allowed a second term to take the key after the first term's CAS version
-- advanced. Keep the version index for existing readers, and add the missing
-- stable-identity constraint without rewriting or deleting any term.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $body$
begin
  if exists (
    select 1
    from platform_private.cms_terms
    group by taxonomy_version_id, term_key
    having count(*) > 1
  ) then
    raise exception 'CMS_TAXONOMY_DUPLICATE_STABLE_TERM_KEY'
      using errcode = 'P0001';
  end if;
end;
$body$;

alter table platform_private.cms_terms
  add constraint cms_terms_taxonomy_stable_key_key
  unique (taxonomy_version_id, term_key);

commit;
