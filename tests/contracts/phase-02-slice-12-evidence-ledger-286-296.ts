import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 12 evidence ledger, criteria AC286-AC296. Aggregated by
// tests/contracts/phase-02-slice-12-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-12-evidence-guard.test.ts.
// Re-cited 2026-10-24 from the refuted proposals by docs/handoffs/2026-10-22-claude-s12/recite/apply.mjs (a rerun reproduces it).
export const S12_EVIDENCE_LEDGER_286_296: readonly EvidenceLedgerEntry[] = [
  {
    criterion: 'P2-S12-AC-286',
    text: "CMS-03B-10 initial revision derives `template_version_id` server-side from the exact authorized active content-type version's `default_template_version_id`; a non-NULL default is the persisted pin and placement/route-manifest consumers resolve through that pin. Do not select the latest template, first binding, or a client-supplied template operand.",
    clauses: [
      {
        text: "CMS-03B-10 initial revision derives `template_version_id` server-side from the exact authorized active content-type version's `default_template_version_id`;",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-bound: FIRST revision server-derives the exact expected default template, preserving SQL NULL when absent',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-bound: actual immutable first revision binds the exact active schema and creator context',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-bound: strict create request has no client template operand',
          },
        ],
      },
      {
        text: 'a non-NULL default is the persisted pin and placement/route-manifest consumers resolve through that pin.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-bound: FIRST revision server-derives the exact expected default template, preserving SQL NULL when absent',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-bound: literal slot readback follows the FIRST revision pin, never a direct default-template lookup',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title: 'slot-in-template: the placement succeeds',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'slot-not-in-template: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_placement.sql',
            title:
              'root-with-template: exact SQL message token VALIDATION_FAILED',
          },
        ],
      },
      {
        text: 'Do not select the latest template',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edp-sbound: FIRST revision server-derives the exact expected default template, preserving SQL NULL when absent',
          },
        ],
      },
      {
        text: 'first binding',
        citations: [],
      },
      {
        text: 'a client-supplied template operand.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/entry-create.test.ts',
            title:
              'cms entry create body (CMS-03B-10) rejects unknown keys and every caller-supplied authority field',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "first binding": the first-binding exclusion has no test: every fixture is built with an empty bindings list, so a server that picked the first binding would pass identically',
  },
  {
    criterion: 'P2-S12-AC-287',
    text: 'CMS-03B-10 initial revision preserves SQL NULL when the exact active content-type version has no default; a nonempty bindings list, another compatible template, or a newer template version must not supply a fallback.',
    clauses: [
      {
        text: 'CMS-03B-10 initial revision preserves SQL NULL when the exact active content-type version has no default;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-null: FIRST revision server-derives the exact expected default template, preserving SQL NULL when absent',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'EDT14: no-default control is a different genuine active compiled schema, not a missing dependency',
          },
        ],
      },
      {
        text: 'a nonempty bindings list, another compatible template, or a newer template version must not supply a fallback.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "a nonempty bindings list, another compatible template, or a newer template version must not suppl...": missing test: pgTAP in supabase/tests/phase_02_slice_12_entry_default_template/ (new 040-null-fallback.sqlinc): a real active no-default type that ALSO has (a) a nonempty template bindings list, (b) another compatible active template and (c) a newer template version of a compatible lineage; create an entry and assert revision template_version_id IS NULL in each case (DEC-202). The edt-null type has none of the three (its only compatible template is absent), so the existing null case does not exclude a fallback.',
  },
  {
    criterion: 'P2-S12-AC-288',
    text: 'CMS-03B-10 initial revision accepts an authorized, compatible bound default whose lifecycle is superseded, preserving that exact version pin rather than replacing it with a newer active version.',
    clauses: [
      {
        text: 'CMS-03B-10 initial revision accepts an authorized, compatible bound default whose lifecycle is superseded, preserving that exact version pin rather than replacing it with a newer active version.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edp-sbound: FIRST revision server-derives the exact expected default template, preserving SQL NULL when absent',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc',
            title:
              'EDP-S02: real same-key S2 activation supersedes S1; definition IDs and literal slot trees remain distinct',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc',
            title:
              'EDP-S03: actual zero-population C1 still defaults S1, and every original EDT persistent row survives unchanged',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc',
            title:
              'EDP-S16: superseded-default success appends only one complete exact create/effects set',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/030-policy-gate.sqlinc',
            title:
              'EDG-01: a compatible SUPERSEDED default is eligible and the gate returns that exact template version',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-289',
    text: 'CMS-03B-10 missing or concealed default template returns 404 NOT_FOUND without details, template identity, or existence disclosure; the public response is uniform across both cases and leaves no partial create effects.',
    clauses: [
      {
        text: 'CMS-03B-10 missing or concealed default template returns 404 NOT_FOUND without details, template identity, or existence disclosure;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/030-policy-gate.sqlinc',
            title:
              'EDG-05: a missing or concealed default is 404 NOT_FOUND with empty detail and no template identity',
          },
        ],
      },
      {
        text: 'the public response is uniform across both cases and leaves no partial create effects.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "the public response is uniform across both cases and leaves no partial create effects.": missing test: pgTAP (new 040-null-default-public.sqlinc, or apispec) that drives the PUBLIC platform_api.cms_create_entry to the 404 branch for (a) an absent and (b) an other-owner default (the gate pointed at a real other-owner template via a guarded read fixture), asserting byte-identical public error bodies for both and before_rows = after_rows (no entry, revision, value, assignment, event, evidence, refcount or idempotency effect). Existing refusal-effects assertions (EDP-R05, EDP-B09) cover the 409 branches only.',
  },
  {
    criterion: 'P2-S12-AC-290',
    text: 'CMS-03B-10 an incompatible default template returns 422 VALIDATION_FAILED with SQL DETAIL exactly `["/contentTypeVersionId"]`, using the existing public field-error mapping without template metadata or a new request operand.',
    clauses: [
      {
        text: 'CMS-03B-10 an incompatible default template returns 422 VALIDATION_FAILED with SQL DETAIL exactly `["/contentTypeVersionId"]`, using the existing public field-error mapping without template metadata or a new request operand.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/030-policy-gate.sqlinc',
            title:
              'EDG-02: an incompatible default is the existing 422 VALIDATION_FAILED with DETAIL exactly ["/contentTypeVersionId"]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-create-setup.test.tsx',
            title:
              'DEC-202 entry-create setup refusals 422 announces exact neutral copy and retains typed work',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_10_ev_eb_create_validation.sql',
            title:
              'EB create validation: a malformed contentTypeVersionId is VALIDATION_FAILED at /contentTypeVersionId',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-291',
    text: "CMS-03B-10 a retired or blocked default template returns 409 CONFLICT without inventing a template-specific public reason; the create UI renders DEC-202's neutral setup copy and does not expose template identities.",
    clauses: [
      {
        text: 'CMS-03B-10 a retired or blocked default template returns 409 CONFLICT without inventing a template-specific public reason;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc',
            title:
              'EDP-R03: a fresh request against an actually retired default is the existing CONFLICT',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc',
            title:
              'EDP-R04: retired refusal has no detail/resource/replay header and restores its actual SQL context',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc',
            title:
              'EDP-B07: a fresh create against the actually blocked default is the existing CONFLICT',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc',
            title:
              'EDP-B08: blocked refusal leaks no detail/resource/identity and restores SQL context',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/030-policy-gate.sqlinc',
            title: 'EDG-03: a retired default is 409 CONFLICT with no detail',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/030-policy-gate.sqlinc',
            title: 'EDG-04: a blocked default is 409 CONFLICT with no detail',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc',
            title:
              'EDP-R05: fresh retired refusal preserves every frozen-inventory row after retirement',
          },
        ],
      },
      {
        text: "the create UI renders DEC-202's neutral setup copy and does not expose template identities.",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-create-setup.test.tsx',
            title:
              'DEC-202 entry-create setup refusals 409 announces exact neutral copy and retains typed work',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-292',
    text: 'CMS-03B-10 completed exact replay resolves before fresh schema/template dependency validation: after the original default is withdrawn, the same completed request still returns the original canonical entry/revision resource with no duplicate effects; changed payload or scope does not gain replay authority.',
    clauses: [
      {
        text: 'CMS-03B-10 completed exact replay resolves before fresh schema/template dependency validation: after the original default is withdrawn, the same completed request still returns the original canonical entry/revision resource with no duplicate effects;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc',
            title:
              'EDP-R06: the exact completed request still succeeds through the real public RPC after withdrawal',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc',
            title:
              'EDP-R07: replay returns the identical canonical resource and the exact existing replay header',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc',
            title: 'EDP-R08: completed receipt full row remains identical',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc',
            title:
              'EDP-R09: replay leaves all history, timestamps, evidence/refcounts, audit/outbox and reservations identical',
          },
        ],
      },
      {
        text: 'changed payload',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc',
            title:
              'EDP-R10: changed business content gains no replay authority from the completed key',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc',
            title:
              'EDP-R11: fingerprint refusal neither changes the old receipt nor any persistent row',
          },
        ],
      },
      {
        text: 'or scope does not gain replay authority.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "or scope does not gain replay authority.": missing test: pgTAP in supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc: reuse the completed key under another acting party / actor (scope) and assert IDEMPOTENCY_MISMATCH (or the existing scoped miss) with no replay body and no change to the original receipt. Only a changed business payload is asserted.',
  },
  {
    criterion: 'P2-S12-AC-293',
    text: 'CMS-03B-10 ordinary authorized author-only and editor-only callers can create with the schema-derived default without designer capability or direct registry-read permission; real Auth/context/membership and both authorization stores prove least privilege while creator metadata and caller assignment remain correct.',
    clauses: [
      {
        text: 'CMS-03B-10 ordinary authorized author-only and editor-only callers can create with the schema-derived default without designer capability or direct registry-read permission;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-bound:edt-author: FIRST revision server-derives the exact expected default template, preserving SQL NULL when absent',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-bound:edt-editor: FIRST revision server-derives the exact expected default template, preserving SQL NULL when absent',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-author: schema_designer and template_designer are explicitly ABSENT in both actual grant stores',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-editor: schema_designer and template_designer are explicitly ABSENT in both actual grant stores',
          },
        ],
      },
      {
        text: 'real Auth/context/membership and both authorization stores prove least privilege while creator metadata and caller assignment remain correct.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-author: real bound human, confirmed organization membership and freshly produced organization context',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-author: actual live CMS grants contain ONLY the intended entry capability',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-author: actual live identity grant projection contains ONLY the intended entry capability',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-bound:edt-author: persisted first head/owner/creator assignment are server-derived',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-bound:edt-editor: persisted first head/owner/creator assignment are server-derived',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-editor: real bound human, confirmed organization membership and freshly produced organization context',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-editor: actual live CMS grants contain ONLY the intended entry capability',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template.sql',
            title:
              'edt-editor: actual live identity grant projection contains ONLY the intended entry capability',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-294',
    text: 'CMS-03B-10 locks the complete authorized relation-target/caller-assignment set at position 2 in ascending target UUID order, then the exact default template at position 3, then the content-type version at position 4. Deterministic concurrent tests prove authority/visibility and exact schema/default are rechecked after waits, with no invisible/foreign definition lock lever or late position-2 acquisition.',
    clauses: [
      {
        text: 'CMS-03B-10 locks the complete authorized relation-target/caller-assignment set at position 2 in ascending target UUID order, then the exact default template at position 3, then the content-type version at position 4.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/030-policy-gate.sqlinc',
            title:
              'EDG-09: installed create takes relation targets(2), then the default template(3), then the schema version(4) exactly once, then the resolver gate',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template_lock/020-race.mjs',
            title: 'EDTL-A held relation2 leaves exact default3/schema4 free',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template_lock/020-race.mjs',
            title: 'EDTL-B held exact default3 leaves schema4 free',
          },
        ],
      },
      {
        text: 'Deterministic concurrent tests prove authority/visibility and exact schema/default are rechecked after waits, with no invisible/foreign definition lock lever or late position-2 acquisition.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "Deterministic concurrent tests prove authority/visibility and exact schema/default are rechecked ...": missing test: race (extend entry_default_template_lock/020-race.mjs): while a create waits at position 2, (a) revoke the caller assignment / hide the relation target and assert the create refuses after release instead of acting on pre-wait visibility; (b) change the type\'s exact default or schema version under the waiting create and assert the post-wait pin is the re-read one; (c) assert an invisible or foreign definition cannot be locked by the caller (no lock lever) and position 2 is never acquired after position 3. The existing races assert only the lock order and the independent post-release pin (`PIN: actual first revision must independently store exact governed T1`).',
  },
  {
    criterion: 'P2-S12-AC-295',
    text: 'CMS-03B-10 default changes affect only later entry creation. Existing immutable revisions keep their original pin or SQL NULL; append, conflict resolution, restore, and locale carry do not initialize or silently rebind historical pins from the current default.',
    clauses: [
      {
        text: 'CMS-03B-10 default changes affect only later entry creation.',
        citations: [],
      },
      {
        text: 'Existing immutable revisions keep their original pin or SQL NULL;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc',
            title:
              'EDP-S03: actual zero-population C1 still defaults S1, and every original EDT persistent row survives unchanged',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_carry.sql',
            title:
              'RR-TEMPLATE-SOURCE: every historical full row immutable in platform_private.cms_entry_revisions',
          },
        ],
      },
      {
        text: 'append, conflict resolution, restore, and locale carry do not initialize or silently rebind historical pins from the current default.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "CMS-03B-10 default changes affect only later entry creation.": missing test: pgTAP in supabase/tests/phase_02_slice_12_entry_default_template/ (new 040-default-change.sqlinc): create entry E1 under a type version whose default is D1, activate a successor type version whose default is D2, create E2, and assert E1\'s first revision still pins D1 (or NULL) while E2 pins D2. Existing cases supersede the TEMPLATE but the type default stays S1 (EDP-S03), so no case changes a default. "append, conflict resolution, restore, and locale carry do not initialize or silently rebind histo...": missing tests: pgTAP asserting that conflict resolution (cms_resolve_conflict) and locale-variant carry do not initialize or rebind a revision pin from the current type default after the default changed (append and restore are asserted only in the DEC-201 restore gate: phase_02_slice_12_dec201_restore_template_gate.sql `actual appended draft retains T1 binding` and `real destination retains SOURCE T1`, which guard a different rule and are not cited).',
  },
  {
    criterion: 'P2-S12-AC-296',
    text: 'CMS-03B-10 an injected reached late unexpected fault propagates as an unexpected failure and atomically rolls back entry, revision, values, assignment, event, evidence, refcount, and idempotency effects. Retrying the same key after rollback produces exactly one complete create, without blanket template-error relabeling.',
    clauses: [
      {
        text: 'CMS-03B-10 an injected reached late unexpected fault propagates as an unexpected failure and atomically rolls back entry, revision, values, assignment, event, evidence, refcount, and idempotency effects.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/020-policy-fault.sqlinc',
            title:
              'EDP-F03: actual public create reaches that late leaf and propagates its unexpected fault without template relabeling',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/020-policy-fault.sqlinc',
            title:
              'EDP-F04: reached failure rolls back all full rows, values/assignment, effects/evidence/refcounts and even completed201 receipt',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/030-policy-gate.sqlinc',
            title:
              'EDG-06: an unexpected resolver fault propagates unchanged, never relabeled as a template refusal',
          },
        ],
      },
      {
        text: 'Retrying the same key after rollback produces exactly one complete create, without blanket template-error relabeling.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/020-policy-fault.sqlinc',
            title:
              'EDP-F18: same saved key/request retries into exactly one complete allowed append set',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/020-policy-fault.sqlinc',
            title:
              'EDP-F19: retry completion supports the exact original canonical replay/header without a second create',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_entry_default_template/020-policy-fault.sqlinc',
            title:
              'EDP-F20: retry replay leaves the complete persistent image and completed receipt identical',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
];
