-- DEC-108 capability registry additions (BE03a "Grantable capability registry
-- consistency", CMS-03A-12/14, DEC-110).  Forward-only.  The closed registry
-- keeps every existing member at version 1 and adds only the keys the schema
-- review chain and the owner capability grants name:
--   cms.schema_review          assignment-only reviewer authority (never granted)
--   cms.schema_review.assign   owner-only assignment authority (never granted)
--   cms.reviewer.policy|legal|security|financial   specialist reviewer slots
--   cms.publisher              BE03b publication scope
--   cms.taxonomy_curator       BE03c taxonomy curator scope
begin;

create or replace function platform_private.cms_capability_registry_valid(
  p_key text, p_version bigint default null
)
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select exists (
    select 1 from (values
      ('cms.schema_designer', 1::bigint),
      ('cms.schema_registry.read', 1::bigint),
      ('cms.public_content.read', 1::bigint),
      ('cms.content.article', 1::bigint),
      ('cms.article.card', 1::bigint),
      ('cms.author', 1::bigint),
      ('cms.editor', 1::bigint),
      ('cms.reviewer', 1::bigint),
      ('cms.template_designer', 1::bigint),
      ('cms.schema_review', 1::bigint),
      ('cms.schema_review.assign', 1::bigint),
      ('cms.reviewer.policy', 1::bigint),
      ('cms.reviewer.legal', 1::bigint),
      ('cms.reviewer.security', 1::bigint),
      ('cms.reviewer.financial', 1::bigint),
      ('cms.publisher', 1::bigint),
      ('cms.taxonomy_curator', 1::bigint)
    ) as registry(key, version)
    where registry.key = p_key
      and (p_version is null or registry.version = p_version)
  )
$body$;

comment on function platform_private.cms_capability_registry_valid(text, bigint) is
  'Closed CMS capability registry (all members v1). DEC-108 adds cms.schema_review, cms.schema_review.assign, the four cms.reviewer.* specialist slots, cms.publisher and cms.taxonomy_curator; membership is code plus forward migration, never caller input.';

revoke all on function platform_private.cms_capability_registry_valid(text, bigint)
  from public, anon, authenticated, service_role;

commit;
