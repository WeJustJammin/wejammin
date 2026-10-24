-- Slice 12 lane locale, outbox relay claim tuple for the locale aggregate (BE03c Event schemas 1555 and
-- Fan-out bound and event key (D12) 1395; tracker P2-S12-AC-237, AC-248 for the locale event only).
--
-- cms.localization.changed.v1 is now produced under aggregate type `cms_locale_variant` (the locale
-- aggregate (entry, locale), UUIDv5 id, the variant row version) by the author command and the
-- source-change fan-out.  claim_outbox_batch is a closed allowlist of (event type, aggregate type) tuples, so
-- without the new tuple no consumer would ever receive the event and the relay would never drain it.  This
-- migration ADDS the tuple by a guarded anchored amendment of the LIVE source (the anchor occurs exactly once,
-- the inverse replacement restores the installed source byte for byte, every pg_proc attribute except the
-- source is unchanged).  The former tuple (cms.localization.changed.v1, cms_content_entry) is KEPT so events
-- already in the outbox under it are still CLAIMED and cannot starve the batch; they do not reach the
-- consumer: parseOutboxClaim now refuses that aggregate, so the relay drains each legacy row through its
-- poison path (a consumer dead letter INVALID_QUEUE_PAYLOAD, then complete_outbox_event).  A fresh database
-- holds no such row.  Narrowing the allowlist to the exact tuples of all Slice 12
-- events (AC-248) is the root's closing migration, which covers the template, pattern and taxonomy tuples
-- other lanes own.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.claim_outbox_batch(uuid,integer,integer)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  definition text;
  comment_text text;
  anchor_old constant text := $a$('cms.localization.changed.v1', 'cms_content_entry')$a$;
  anchor_new constant text := $a$('cms.localization.changed.v1', 'cms_content_entry'),
          ('cms.localization.changed.v1', 'cms_locale_variant')$a$;
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'outbox claim missing: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if not original.prosecdef or original.prokind <> 'f'
     or original.proconfig is distinct from array['search_path=""']::text[] then
    raise exception 'outbox claim: unexpected attributes' using errcode = '55000';
  end if;
  if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, anchor_old, '')))
       / pg_catalog.length(anchor_old) <> 1
     or pg_catalog.strpos(old_source, 'cms_locale_variant') <> 0 then
    raise exception 'outbox claim: unexpected anchor' using errcode = '55000';
  end if;
  new_source := pg_catalog.replace(old_source, anchor_old, anchor_new);
  if pg_catalog.replace(new_source, anchor_new, anchor_old) <> old_source then
    raise exception 'outbox claim: non-anchor change' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'outbox claim: ambiguous definition' using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc <> new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' <> pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'outbox claim: replacement changed more than the source' using errcode = '55000';
  end if;
end;
$migration$;

commit;
