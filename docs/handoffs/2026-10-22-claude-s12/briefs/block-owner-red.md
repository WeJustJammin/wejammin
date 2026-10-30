# Lane `claude_s12_block_owner` — RED proof: a released block never reaches an organization designer's chooser

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`.
zsh does not word-split; `/bin/ls`, never bare `ls`. Report `docs/handoffs/2026-10-22-claude-s12/lane-block-owner-report.md`.
ALT pgTAP through the staged runner only. No product change, no WIP migration — root and the owner decide the fix.

## Root's finding (verify every line yourself)

- CMS-03A-05 registration stores `owner_id = actor_id` where `actor_id = platform_private.cms_release_actor(p_request)` = the
  signed **release principal** (`supabase/migrations/20261003130600_cms_register_block_resource_meta.sql:34,67-77`;
  `cms_release_actor` in `20260902080000_content_schema_registry_authority.sql`).
- `cmsTemplateContextRead` (`platform_private.cms_template_context`, `20261013100500_cms_template_context_rpc_flag.sql:99-111`)
  lists blocks `where block_row.owner_id = acting_party_id` (the designer's organization).
- The CMS-03C-01/-12 validators read a block by key and version without an owner predicate.
- So on the real stack no organization designer ever sees a released block in the template or pattern designer chooser
  (lane pw7's AC-105 page tests hit this), while the validators accept any registered block.

## Work

1. RED pgTAP in a NEW file `supabase/tests/phase_02_slice_12_block_owner_red.sql`: register a block through the REAL CMS-03A-05
   RPC path (signed release principal, as the existing Slice 09 block-registration suites do), then call the context read as an
   organization designer holding `cms.template_designer` and assert the block IS listed — expected to FAIL today. Controls: the
   same block is accepted by CMS-03C-12 (pattern create) for that designer; a block row whose `owner_id` is the organization is
   listed (shows the filter). Context-cleared case for the definer RPC (PAT-031). Run it on ALT; keep it RED.
2. Spec map (cite lines): IA03 (CMS-10, CMS-11, CMS-12; "code-owned"), BE03a (block registry ownership, RLS/visibility rows
   ~2530-2570, release principal semantics), BE03c (202 "owned registered, currently supported block selectors"; the validators),
   FE03 (designer block choosers). State exactly what each says about WHO may see/use a registered block and whether any spec
   binds a release principal to an organization.
3. For each fix option root names — (A) the context read lists every registered, supported block (code-owned, platform-wide);
   (B) a release principal is bound to an owning organization and blocks are owned by it (validators then owner-scoped too);
   (C) anything better you find — list the files/functions/tests each would touch and what changes for existing behaviour and
   security (cross-organization visibility, the validators today).

Final message to root: RED confirmed / NOT reproduced, report path + SHA-256, TAP + SHA-256, the spec map in one paragraph, the
option table.
