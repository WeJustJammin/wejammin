-- Slice 12 CMS-03C-04/05: private append-only locale and relation records.
-- Named author/curator RPCs and publication checks remain separate work.
begin;

create table platform_private.cms_locale_variants (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references platform_private.party(id),
  state text not null default 'draft' check (state in (
    'untranslated','draft','review','approved','stale'
  )),
  version bigint not null check (version between 1 and 2147483647),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  entry_id uuid not null references platform_private.cms_content_entries(id),
  revision_id uuid not null references platform_private.cms_entry_revisions(id),
  source_revision_id uuid not null
    references platform_private.cms_entry_revisions(id),
  locale text not null check (locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'),
  source_locale text not null
    check (source_locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'),
  source_hash char(64) not null check (source_hash ~ '^[a-f0-9]{64}$'),
  fallback_chain jsonb not null default '[]'::jsonb check (
    jsonb_typeof(fallback_chain) = 'array'
    and platform_private.cms_json_bounded(fallback_chain, 4096, 2, 16, 16)
  ),
  no_fallback_field_ids jsonb not null default '[]'::jsonb check (
    jsonb_typeof(no_fallback_field_ids) = 'array'
    and platform_private.cms_json_bounded(no_fallback_field_ids, 16384, 2, 128, 128)
  ),
  approval_evidence jsonb check (
    approval_evidence is null or (
      jsonb_typeof(approval_evidence) = 'object'
      and platform_private.cms_json_bounded(approval_evidence, 8192, 4, 16, 16)
    )
  ),
  created_by uuid not null references auth.users(id),
  constraint cms_locale_variants_different_locale_check
    check (lower(locale) <> lower(source_locale)),
  constraint cms_locale_variants_snapshot_time_check
    check (updated_at = created_at),
  constraint cms_locale_variants_entry_locale_source_version_key
    unique (entry_id, locale, source_revision_id, version)
);

create index cms_locale_variants_owner_entry_locale_state_idx
  on platform_private.cms_locale_variants(owner_id, entry_id, locale, state);
create index cms_locale_variants_source_hash_idx
  on platform_private.cms_locale_variants(source_revision_id, source_hash);

create table platform_private.cms_related_content_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references platform_private.party(id),
  state text not null default 'active' check (state in ('active','revoked')),
  version bigint not null check (version between 1 and 2147483647),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_entry_id uuid not null
    references platform_private.cms_content_entries(id),
  target_entry_id uuid references platform_private.cms_content_entries(id),
  rule_key text check (
    rule_key is null or rule_key ~ '^[a-z][a-z0-9._-]{0,127}$'
  ),
  rule_version bigint check (rule_version between 1 and 2147483647),
  mode text not null check (mode in ('pin','exclude','derived')),
  reason_code text not null check (reason_code ~ '^[A-Z][A-Z0-9_]{0,63}$'),
  position integer check (position between 0 and 127),
  created_by uuid not null references auth.users(id),
  constraint cms_related_content_rules_target_mode_check check (
    (mode = 'derived' and target_entry_id is null)
    or (mode in ('pin','exclude') and target_entry_id is not null)
  ),
  constraint cms_related_content_rules_rule_pair_check
    check ((rule_key is null) = (rule_version is null)),
  constraint cms_related_content_rules_snapshot_time_check
    check (updated_at = created_at),
  constraint cms_related_content_rules_source_target_mode_version_key
    unique (source_entry_id, target_entry_id, mode, version)
);

create unique index cms_related_content_rules_derived_version_key
  on platform_private.cms_related_content_rules(source_entry_id, mode, version)
  where mode = 'derived';
create index cms_related_content_rules_owner_source_state_mode_position_idx
  on platform_private.cms_related_content_rules
  (owner_id, source_entry_id, state, mode, position);
create index cms_related_content_rules_target_state_idx
  on platform_private.cms_related_content_rules(target_entry_id, state);

create trigger cms_locale_variants_write_guard
before insert or update or delete on platform_private.cms_locale_variants
for each row execute function platform_private.cms_write_guard();
create trigger cms_related_content_rules_write_guard
before insert or update or delete on platform_private.cms_related_content_rules
for each row execute function platform_private.cms_write_guard();
create trigger cms_locale_variants_immutable_guard
before update or delete on platform_private.cms_locale_variants
for each row execute function platform_private.cms_immutable_guard();
create trigger cms_related_content_rules_immutable_guard
before update or delete on platform_private.cms_related_content_rules
for each row execute function platform_private.cms_immutable_guard();

do $body$
declare table_name text;
begin
  foreach table_name in array array[
    'cms_locale_variants', 'cms_related_content_rules'
  ] loop
    execute format('alter table platform_private.%I enable row level security', table_name);
    execute format('alter table platform_private.%I force row level security', table_name);
    execute format(
      'revoke all on table platform_private.%I from public, anon, authenticated, service_role',
      table_name
    );
    execute format(
      'create policy %I on platform_private.%I for all to public using (platform_private.cms_rpc_context_valid()) with check (platform_private.cms_rpc_context_valid())',
      table_name || '_rpc_policy', table_name
    );
  end loop;
end;
$body$;

commit;
