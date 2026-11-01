#!/usr/bin/env node
// Slice 12 gap inventory (root, 2026-10-24): every uncited ledger clause with its criterion, status, a coarse class
// from the criterion limitation and that limitation, so gap lanes start from the ledger rather than from memory.
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/gaps/inventory.mjs > docs/handoffs/2026-10-22-claude-s12/gaps/inventory.json
const { S12_EVIDENCE_LEDGER } = await import("../../../../tests/contracts/phase-02-slice-12-evidence-ledger.ts");
const classOf = (seg) =>
  /p95|Tier [12]|hosted|staging|bench/iu.test(seg) ? "hosted"
  : /unbuilt|not implemented|no implementation|implementation (is )?missing|missing implementation|placeholder|no code/iu.test(seg) ? "impl"
  : /race/iu.test(seg) ? "race"
  : /Playwright|real-route|browser/iu.test(seg) ? "playwright"
  : /pgTAP/u.test(seg) ? "pgtap"
  : /apps\/web|jsdom|component|island/iu.test(seg) ? "web"
  : /Worker|vitest/iu.test(seg) ? "worker" : "other";
const out = [];
for (const e of S12_EVIDENCE_LEDGER)
  for (const [index, clause] of e.clauses.entries())
    if (clause.citations.length === 0) {
      const at = e.limitation.indexOf(clause.text.slice(0, 40));
      const segment = at >= 0 ? e.limitation.slice(at, at + 700) : e.limitation.slice(0, 700);
      out.push({ criterion: e.criterion, status: e.status, clauseIndex: index, clause: clause.text, class: classOf(segment), limitation: e.limitation });
    }
console.log(JSON.stringify(out, null, 1));
