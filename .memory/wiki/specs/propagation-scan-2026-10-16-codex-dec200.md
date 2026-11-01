# DEC-200 propagation — historical parent remapping on ordinary carry

Owner confirmed “Remap by parent path (Recommended)” at 2026-10-16T15:59:12Z. Canonical decision is recorded in `../decisions.md`.

Decision summary reconciled against the actual source: 200 distinct decision IDs/titles after DEC200. Existing repeated historical headings are retained; raw heading count is not the logical decision count.

BE03c ordinary-carry obligation4 and phase plan/Slice12 AC245 now require owner/revision-bound parent-path remapping to the newest eligible copied head. Refuse atomically if no eligible parent remains or the remapped graph is not representable. Preserve all other semantics and immediate provenance. No resurrected historical parent, dropped/detached child, cross-revision edge, new status or permission. Restore policy stays separately active-only.

Implementation remains TEST-first. Add a real public successor over a valid guarded legacy parent/child source, literal destination hierarchy/provenance/full-source-image proof, excluded-parent rollback and remapped-cycle refusal. Then release carry420–422. Source propagation clears no criterion or validation gate.
