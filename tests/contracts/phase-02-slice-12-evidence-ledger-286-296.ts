import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 12 evidence ledger, criteria AC286-AC296. Aggregated by
// tests/contracts/phase-02-slice-12-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-12-evidence-guard.test.ts.
export const S12_EVIDENCE_LEDGER_286_296: readonly EvidenceLedgerEntry[] = [
  {
    criterion: 'P2-S12-AC-286',
    text: "CMS-03B-10 initial revision derives `template_version_id` server-side from the exact authorized active content-type version's `default_template_version_id`; a non-NULL default is the persisted pin and placement/route-manifest consumers resolve through that pin. Do not select the latest template, first binding, or a client-supplied template operand.",
    clauses: [
      {
        text: "CMS-03B-10 initial revision derives `template_version_id` server-side from the exact authorized active content-type version's `default_template_version_id`;",
        citations: [],
      },
      {
        text: 'a non-NULL default is the persisted pin and placement/route-manifest consumers resolve through that pin.',
        citations: [],
      },
      {
        text: 'Do not select the latest template, first binding, or a client-supplied template operand.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-287',
    text: 'CMS-03B-10 initial revision preserves SQL NULL when the exact active content-type version has no default; a nonempty bindings list, another compatible template, or a newer template version must not supply a fallback.',
    clauses: [
      {
        text: 'CMS-03B-10 initial revision preserves SQL NULL when the exact active content-type version has no default;',
        citations: [],
      },
      {
        text: 'a nonempty bindings list, another compatible template, or a newer template version must not supply a fallback.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-288',
    text: 'CMS-03B-10 initial revision accepts an authorized, compatible bound default whose lifecycle is superseded, preserving that exact version pin rather than replacing it with a newer active version.',
    clauses: [
      {
        text: 'CMS-03B-10 initial revision accepts an authorized, compatible bound default whose lifecycle is superseded, preserving that exact version pin rather than replacing it with a newer active version.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-289',
    text: 'CMS-03B-10 missing or concealed default template returns 404 NOT_FOUND without details, template identity, or existence disclosure; the public response is uniform across both cases and leaves no partial create effects.',
    clauses: [
      {
        text: 'CMS-03B-10 missing or concealed default template returns 404 NOT_FOUND without details, template identity, or existence disclosure;',
        citations: [],
      },
      {
        text: 'the public response is uniform across both cases and leaves no partial create effects.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-290',
    text: 'CMS-03B-10 an incompatible default template returns 422 VALIDATION_FAILED with SQL DETAIL exactly `["/contentTypeVersionId"]`, using the existing public field-error mapping without template metadata or a new request operand.',
    clauses: [
      {
        text: 'CMS-03B-10 an incompatible default template returns 422 VALIDATION_FAILED with SQL DETAIL exactly `["/contentTypeVersionId"]`, using the existing public field-error mapping without template metadata or a new request operand.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-291',
    text: "CMS-03B-10 a retired or blocked default template returns 409 CONFLICT without inventing a template-specific public reason; the create UI renders DEC-202's neutral setup copy and does not expose template identities.",
    clauses: [
      {
        text: 'CMS-03B-10 a retired or blocked default template returns 409 CONFLICT without inventing a template-specific public reason;',
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 0 (a retired or blocked default template returns 409 CONFLICT without inventing a template-specific public reason) needs the create-entry change and is pgTAP (not cited this pass). Clause 1 is cited from the create-island setup-refusal test: a 409 announces the exact neutral DEC-202 copy, retains typed work and exposes no template or content-type-version input.',
  },
  {
    criterion: 'P2-S12-AC-292',
    text: 'CMS-03B-10 completed exact replay resolves before fresh schema/template dependency validation: after the original default is withdrawn, the same completed request still returns the original canonical entry/revision resource with no duplicate effects; changed payload or scope does not gain replay authority.',
    clauses: [
      {
        text: 'CMS-03B-10 completed exact replay resolves before fresh schema/template dependency validation: after the original default is withdrawn, the same completed request still returns the original canonical entry/revision resource with no duplicate effects;',
        citations: [],
      },
      {
        text: 'changed payload or scope does not gain replay authority.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-293',
    text: 'CMS-03B-10 ordinary authorized author-only and editor-only callers can create with the schema-derived default without designer capability or direct registry-read permission; real Auth/context/membership and both authorization stores prove least privilege while creator metadata and caller assignment remain correct.',
    clauses: [
      {
        text: 'CMS-03B-10 ordinary authorized author-only and editor-only callers can create with the schema-derived default without designer capability or direct registry-read permission;',
        citations: [],
      },
      {
        text: 'real Auth/context/membership and both authorization stores prove least privilege while creator metadata and caller assignment remain correct.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-294',
    text: 'CMS-03B-10 locks the complete authorized relation-target/caller-assignment set at position 2 in ascending target UUID order, then the exact default template at position 3, then the content-type version at position 4. Deterministic concurrent tests prove authority/visibility and exact schema/default are rechecked after waits, with no invisible/foreign definition lock lever or late position-2 acquisition.',
    clauses: [
      {
        text: 'CMS-03B-10 locks the complete authorized relation-target/caller-assignment set at position 2 in ascending target UUID order, then the exact default template at position 3, then the content-type version at position 4.',
        citations: [],
      },
      {
        text: 'Deterministic concurrent tests prove authority/visibility and exact schema/default are rechecked after waits, with no invisible/foreign definition lock lever or late position-2 acquisition.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
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
        citations: [],
      },
      {
        text: 'append, conflict resolution, restore, and locale carry do not initialize or silently rebind historical pins from the current default.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-296',
    text: 'CMS-03B-10 an injected reached late unexpected fault propagates as an unexpected failure and atomically rolls back entry, revision, values, assignment, event, evidence, refcount, and idempotency effects. Retrying the same key after rollback produces exactly one complete create, without blanket template-error relabeling.',
    clauses: [
      {
        text: 'CMS-03B-10 an injected reached late unexpected fault propagates as an unexpected failure and atomically rolls back entry, revision, values, assignment, event, evidence, refcount, and idempotency effects.',
        citations: [],
      },
      {
        text: 'Retrying the same key after rollback produces exactly one complete create, without blanket template-error relabeling.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
];
