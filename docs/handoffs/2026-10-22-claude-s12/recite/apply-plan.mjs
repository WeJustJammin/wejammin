// Lane adapters for recite/apply.mjs: turn one lane's proposal + refutation for one criterion into
// a uniform plan of units (final clauses) with their candidate citations and verdicts.
//
//   Unit = { text, existing: Cit[], adds: Add[], missed: Missed[], gaps: string[], notes: string[],
//            withheld: Cit[], rejected: boolean }
//   Add  = { cit, verdict, fix, reason, tag }
//
// Nothing here verifies identities or computes status; apply.mjs does that from the units.

import {
  citation,
  keyOf,
  partsFromAnchors,
  tilingProblems,
} from './apply-lib.mjs';
import {
  B_NEW_SPLITS,
  B_PART_OVERRIDES,
  C_EXISTING_PARTS,
  C_MISSED,
  C_PART_CITATIONS,
  D_RESPLITS,
  MISSED_SKIP,
} from './apply-data.mjs';

export const newUnit = (text) => ({
  text,
  existing: [],
  adds: [],
  missed: [],
  gaps: [],
  notes: [],
  withheld: [],
  rejected: false,
});

/** A missed test the apply rules deliberately do not add (see MISSED_SKIP); recorded on the unit. */
const skipMissed = (criterion, m, units) => {
  const reason = MISSED_SKIP[`${criterion}|${m.citation.title.slice(0, 50)}`];
  if (reason === undefined) return false;
  const unit = units[m.clauseIndex] ?? units[0];
  unit?.notes.push(
    `missed test not added (${reason}): ${m.citation.title.slice(0, 80)}`,
  );
  unit?.withheld.push(citation(m.citation));
  return true;
};

/** Pull the matching refutation citation entries for an add, consuming them in order. */
const takeVerdict = (pool, predicate) => {
  const at = pool.findIndex((entry) => !entry.__used && predicate(entry));
  if (at === -1) return null;
  pool[at].__used = true;
  return pool[at];
};

const fixOf = (ref) => (ref === null ? null : ref.fix);

const addFrom = (cit, ref, tag, problems, context) => {
  if (ref === null) {
    problems.push(
      `${context}: no refutation verdict for ${cit.title.slice(0, 80)}`,
    );
    return {
      cit: citation(cit),
      verdict: 'KEEP',
      fix: null,
      reason: '(no verdict recorded: kept)',
      tag,
    };
  }
  return {
    cit: citation(cit),
    verdict: ref.verdict,
    fix: fixOf(ref),
    reason: ref.reason,
    tag,
  };
};

const baselineCitations = (base, index) =>
  (base.clauses[index]?.citations ?? []).map((c) => citation(c));

/* ----------------------------------------------------------------------------------------------
 * Lane a: restructured clauses carry existing citations by index lists.
 * -------------------------------------------------------------------------------------------- */
export const planA = (base, prop, ref, problems) => {
  const pool = ref.citations.map((c) => ({ ...c }));
  const used = new Map(); // original clause index -> number of units that carry it
  const units = prop.clauses.map((pc) => {
    const unit = newUnit(pc.text);
    const sources = prop.restructured
      ? [
          ...(pc.fromIndexes ?? []),
          ...(pc.carryExistingFromOriginalClauses ?? []),
        ]
      : [pc.index];
    for (const i of new Set(sources)) {
      used.set(i, (used.get(i) ?? 0) + 1);
      unit.existing.push(...baselineCitations(base, i));
    }
    if (pc.heldBackAdd !== undefined) {
      // The lane holds these citations back because a named gap leaves part of the scope unproven.
      unit.withheld.push(...unit.existing, ...pc.heldBackAdd.map(citation));
      unit.existing = [];
      unit.notes.push('held back by the lane (named gap): ' + pc.heldBackNote);
    }
    for (const add of pc.add) {
      const entry = takeVerdict(
        pool,
        (e) =>
          e.clauseIndex === pc.index &&
          keyOf(citation(e)) === keyOf(citation(add)),
      );
      unit.adds.push(
        addFrom(
          add,
          entry,
          `${pc.index}`,
          problems,
          `${prop.criterion} c${pc.index}`,
        ),
      );
    }
    if (pc.gap) unit.gaps.push(pc.gap);
    return unit;
  });
  for (const [i, n] of used) {
    if (n > 1 && base.clauses[i].citations.length > 0) {
      problems.push(
        `${prop.criterion}: original clause ${i} with citations carried by ${n} units`,
      );
    }
  }
  if (prop.restructured) {
    base.clauses.forEach((clause, i) => {
      if (!used.has(i) && clause.citations.length > 0) {
        problems.push(
          `${prop.criterion}: original clause ${i} has citations but no unit carries it`,
        );
      }
    });
  }
  const leftover = pool.filter((e) => !e.__used);
  if (leftover.length > 0)
    problems.push(
      `${prop.criterion}: ${leftover.length} refutation citations matched no proposal add`,
    );
  for (const m of ref.missedTests) {
    if (skipMissed(prop.criterion, m, units)) continue;
    if (units[m.clauseIndex] === undefined)
      problems.push(
        `${prop.criterion}: missed test for unknown clause ${m.clauseIndex}`,
      );
    else
      units[m.clauseIndex].missed.push({
        cit: citation(m.citation),
        evidence: m.evidence,
      });
  }
  return { units, restructured: prop.restructured === true };
};

/* ----------------------------------------------------------------------------------------------
 * Lane b: per-clause split[] with keepExisting; removals of separator-only clauses.
 * -------------------------------------------------------------------------------------------- */
export const planB = (base, prop, ref, problems) => {
  const pool = ref.citations.map((c) => ({ ...c }));
  const units = [];
  const splitVerdict = (index) =>
    ref.splits.find((s) => s.clauseIndex === index);
  for (const pc of prop.clauses) {
    const baseCits = baselineCitations(base, pc.index);
    const sv = splitVerdict(pc.index);
    if (pc.proposeRemoval !== undefined) {
      if (sv !== undefined && sv.verdict === 'OK' && baseCits.length === 0)
        continue;
      problems.push(
        `${prop.criterion} c${pc.index}: removal not applied (${sv?.verdict ?? 'no verdict'}, ${baseCits.length} existing)`,
      );
    }
    const newSplit = B_NEW_SPLITS[`${prop.criterion}#${pc.index}`];
    // parts: [{ text, existing, laneAdds: [{ add, splitIndex }], gap }]
    let parts;
    if (newSplit !== undefined) {
      const texts = partsFromAnchors(pc.text, newSplit.anchors);
      if (pc.split !== undefined) {
        if (pc.split.length !== texts.length)
          problems.push(
            `${prop.criterion} c${pc.index}: new split has ${texts.length} parts, lane split ${pc.split.length}`,
          );
        parts = texts.map((text, k) => ({
          text,
          existing: pc.split[k]?.keepExisting === true ? baseCits : [],
          laneAdds: (pc.split[k]?.add ?? []).map((add) => ({
            add,
            splitIndex: k,
          })),
          gap: pc.split[k]?.gap ?? null,
        }));
      } else {
        parts = texts.map((text, k) => ({
          text,
          existing: k === (newSplit.addsTo ?? 0) ? baseCits : [],
          laneAdds:
            k === (newSplit.addsTo ?? 0)
              ? pc.add.map((add) => ({ add, splitIndex: undefined }))
              : [],
          gap: newSplit.gaps?.[k] ?? null,
        }));
      }
    } else if (pc.split !== undefined && sv?.verdict === 'OK') {
      parts = pc.split.map((part, k) => ({
        text: part.text,
        existing: part.keepExisting === true ? baseCits : [],
        laneAdds: part.add.map((add) => ({ add, splitIndex: k })),
        gap: part.gap ?? null,
      }));
    } else if (pc.split !== undefined) {
      problems.push(
        `${prop.criterion} c${pc.index}: split ${sv?.verdict ?? 'unreviewed'} with no corrected split: clause kept whole`,
      );
    }
    if (parts === undefined) {
      parts = [
        {
          text: pc.text,
          existing: baseCits,
          laneAdds: pc.add.map((add) => ({ add, splitIndex: undefined })),
          gap: pc.gap ?? null,
        },
      ];
    }
    parts.forEach((part, k) => {
      if (
        parts.length > 1 &&
        tilingProblems(
          pc.text,
          parts.map((p) => p.text),
        ).length > 0 &&
        k === 0
      ) {
        problems.push(
          `${prop.criterion} c${pc.index}: parts do not tile: ${tilingProblems(
            pc.text,
            parts.map((p) => p.text),
          ).join('; ')}`,
        );
      }
      const unit = newUnit(part.text);
      unit.existing.push(...part.existing);
      for (const { add, splitIndex } of part.laneAdds) {
        const entry = takeVerdict(
          pool,
          (e) =>
            e.clauseIndex === pc.index &&
            e.splitIndex === splitIndex &&
            keyOf(citation(e)) === keyOf(citation(add)),
        );
        unit.adds.push(
          addFrom(
            add,
            entry,
            `${pc.index}.${k}`,
            problems,
            `${prop.criterion} c${pc.index}.${k}`,
          ),
        );
      }
      if (part.gap) unit.gaps.push(part.gap);
      if (parts.length === 1 && pc.gap) unit.gaps.push(pc.gap);
      units.push({ unit, clause: pc.index, part: k });
    });
  }
  const leftover = pool.filter((e) => !e.__used);
  if (leftover.length > 0)
    problems.push(
      `${prop.criterion}: ${leftover.length} refutation citations unmatched: ${leftover.map((e) => `${e.clauseIndex}/${e.splitIndex ?? '-'}:${e.title.slice(0, 40)}`).join('; ')}`,
    );
  // Missed tests: onto the unit of the clause; a split clause needs a part override.
  for (const m of ref.missedTests) {
    if (
      skipMissed(
        prop.criterion,
        m,
        units.map((u) => u.unit),
      )
    )
      continue;
    const candidates = units.filter((u) => u.clause === m.clauseIndex);
    if (candidates.length === 0) {
      problems.push(
        `${prop.criterion}: missed test for removed/unknown clause ${m.clauseIndex}`,
      );
      continue;
    }
    let target = candidates[0];
    if (candidates.length > 1) {
      const part =
        B_PART_OVERRIDES[
          `${prop.criterion}#${m.clauseIndex}|${m.citation.title.slice(0, 50)}`
        ];
      if (part === undefined) {
        problems.push(
          `${prop.criterion}: missed test on split clause ${m.clauseIndex} has no part override: ${m.citation.title.slice(0, 60)}`,
        );
        continue;
      }
      target = candidates[part];
    }
    target.unit.missed.push({
      cit: citation(m.citation),
      evidence: m.evidence,
    });
  }
  return { units: units.map((u) => u.unit) };
};

/* ----------------------------------------------------------------------------------------------
 * Lane c: one unit per clause; the refutation's OK splits give parts (+ partCitations).
 * -------------------------------------------------------------------------------------------- */
export const planC = (base, prop, ref, problems) => {
  const pool = ref.citations.filter((c) => !c.existing).map((c) => ({ ...c }));
  const existingVerdicts = ref.citations.filter((c) => c.existing);
  const units = [];
  for (const pc of prop.clauses) {
    const sv = ref.splits.find((s) => s.clauseIndex === pc.index);
    const baseCits = baselineCitations(base, pc.index);
    const adds = pc.add.map((add, i) => {
      const entry = takeVerdict(
        pool,
        (e) =>
          e.clauseIndex === pc.index &&
          keyOf(citation(e)) === keyOf(citation(add)),
      );
      return addFrom(
        add,
        entry,
        `${pc.index}.${i}`,
        problems,
        `${prop.criterion} c${pc.index}`,
      );
    });
    // existing citations with a refutation verdict
    const existing = baseCits.map((cit) => {
      const entry = existingVerdicts.find(
        (e) =>
          e.clauseIndex === pc.index &&
          !e.__used &&
          cit.title.startsWith(e.title.replace(/\.\.\.$/u, '')),
      );
      if (entry !== undefined) entry.__used = true;
      return {
        cit,
        verdict: entry?.verdict ?? 'KEEP',
        fix: entry?.fix ?? null,
        reason: entry?.reason ?? '',
      };
    });
    const missed = ref.missedTests.filter((m) => m.clauseIndex === pc.index);
    if (sv !== undefined && sv.verdict === 'REJECT') {
      const unit = newUnit(pc.text);
      unit.rejected = true;
      unit.withheld.push(
        ...adds.map((a) => a.cit),
        ...existing.map((e) => e.cit),
      );
      unit.notes.push(`split rejected: ${sv.reason}`);
      if (pc.gap) unit.gaps.push(pc.gap);
      unit.rejectedMissed = missed;
      units.push(unit);
      continue;
    }
    if (sv !== undefined && sv.verdict === 'OK') {
      const parts = sv.parts;
      const partUnits = parts.map((text) => newUnit(text));
      const mapping =
        sv.partCitations ??
        C_PART_CITATIONS[`${prop.criterion}#${pc.index}`] ??
        null;
      if (mapping === null)
        problems.push(
          `${prop.criterion} c${pc.index}: OK split without partCitations`,
        );
      const assigned = new Set();
      for (const [partIndex, addIndexes] of Object.entries(mapping ?? {})) {
        for (const i of addIndexes) {
          assigned.add(i);
          if (adds[i] === undefined)
            problems.push(
              `${prop.criterion} c${pc.index}: partCitations index ${i} out of range`,
            );
          else partUnits[Number(partIndex)].adds.push(adds[i]);
        }
      }
      adds.forEach((add, i) => {
        // The refutation maps only the adds that prove a part; the rest prove an uncited part and stay uncited.
        if (assigned.has(i)) return;
        if (add.verdict === 'DROP') partUnits[0].adds.push(add);
        else partUnits[0].withheld.push(add.cit);
      });
      const existingMap = C_EXISTING_PARTS[`${prop.criterion}#${pc.index}`];
      existing.forEach((e, i) => {
        const target = existingMap?.[i];
        if (target === undefined) {
          problems.push(
            `${prop.criterion} c${pc.index}: existing citation ${i} on a split clause has no part mapping`,
          );
          partUnits[0].withheld.push(e.cit);
        } else if (target === null) partUnits[0].withheld.push(e.cit);
        else
          partUnits[target].adds.push({
            cit: e.cit,
            verdict: e.verdict,
            fix: e.fix,
            reason: e.reason,
            tag: `x${i}`,
          });
      });
      if (tilingProblems(pc.text, parts).length > 0)
        problems.push(
          `${prop.criterion} c${pc.index}: refutation parts do not tile: ${tilingProblems(pc.text, parts).join('; ')}`,
        );
      for (const unit of partUnits) if (pc.gap) unit.gaps.push(pc.gap);
      // missed tests on split clauses go by C_PART_CITATIONS.missed
      for (const m of missed) {
        if (skipMissed(prop.criterion, m, [partUnits[0]])) continue;
        const to =
          C_MISSED[
            `${prop.criterion}#${pc.index}|${m.citation.title.slice(0, 50)}`
          ] ?? C_MISSED[`${prop.criterion}#${pc.index}`];
        if (to === undefined)
          problems.push(
            `${prop.criterion} c${pc.index}: missed test on split clause has no part: ${m.citation.title.slice(0, 60)}`,
          );
        else
          partUnits[to].missed.push({
            cit: citation(m.citation),
            evidence: m.evidence,
          });
      }
      units.push(...partUnits);
      continue;
    }
    const unit = newUnit(pc.text);
    unit.existing.push(...[]);
    unit.adds.push(
      ...existing.map((e, i) => ({
        cit: e.cit,
        verdict: e.verdict,
        fix: e.fix,
        reason: e.reason,
        tag: `x${i}`,
      })),
      ...adds,
    );
    if (pc.gap) unit.gaps.push(pc.gap);
    for (const m of missed) {
      if (skipMissed(prop.criterion, m, [unit])) continue;
      unit.missed.push({ cit: citation(m.citation), evidence: m.evidence });
    }
    units.push(unit);
  }
  const leftover = pool.filter((e) => !e.__used);
  if (leftover.length > 0)
    problems.push(
      `${prop.criterion}: ${leftover.length} refutation citations unmatched: ${leftover.map((e) => `${e.clauseIndex}:${e.title.slice(0, 40)}`).join('; ')}`,
    );
  const leftEx = existingVerdicts.filter((e) => !e.__used);
  if (leftEx.length > 0)
    problems.push(
      `${prop.criterion}: ${leftEx.length} existing verdicts unmatched: ${leftEx.map((e) => e.title.slice(0, 40)).join('; ')}`,
    );
  return { units };
};

/* ----------------------------------------------------------------------------------------------
 * Lane d: proposedSplit parts; refutation tags; hand-coded re-splits for REJECTed splits.
 * -------------------------------------------------------------------------------------------- */
export const planD = (base, prop, ref, problems) => {
  const byTag = new Map(ref.citations.map((c) => [c.tag, c]));
  const used = new Set();
  const verdictFor = (tag, cit, context) => {
    const entry = byTag.get(tag);
    if (entry === undefined) {
      // The reviewer recorded verdicts for 36 of the retained existing citations only; the rest stay (KEEP).
      if (!tag.startsWith('x'))
        problems.push(`${context}: no refutation verdict for tag ${tag}`);
      return {
        cit,
        verdict: 'KEEP',
        fix: null,
        reason: '(no verdict recorded: kept)',
        tag,
      };
    }
    used.add(tag);
    return {
      cit,
      verdict: entry.verdict,
      fix: entry.fix,
      reason: entry.reason,
      tag,
    };
  };
  const units = [];
  for (const pc of prop.clauses) {
    const sv = ref.splits.find((s) => s.clauseIndex === pc.index);
    const baseCits = baselineCitations(base, pc.index);
    const resplit = D_RESPLITS[`${prop.criterion}#${pc.index}`];
    const laneAdds =
      (pc.proposedSplit ?? []).length > 0
        ? pc.proposedSplit.map((part, p) =>
            part.add.map((a, i) => ({ a, tag: `${pc.index}.${p}.${i}` })),
          )
        : [pc.add.map((a, i) => ({ a, tag: `${pc.index}.${i}` }))];
    const existing = baseCits.map((cit, i) =>
      verdictFor(`x${pc.index}.${i}`, cit, `${prop.criterion} c${pc.index}`),
    );
    let partTexts;
    let partOf; // lane part index -> final part index(es)
    if (resplit !== undefined) {
      partTexts = partsFromAnchors(pc.text, resplit.anchors);
      partOf = resplit.map;
    } else if (pc.proposedSplit !== undefined && sv?.verdict === 'OK') {
      partTexts = pc.proposedSplit.map((p) => p.text);
      partOf = pc.proposedSplit.map((_, p) => [p]);
    } else if (pc.proposedSplit !== undefined) {
      problems.push(
        `${prop.criterion} c${pc.index}: split ${sv?.verdict ?? 'no verdict'} without a re-split table: clause kept whole`,
      );
    }
    if (partTexts === undefined) {
      const unit = newUnit(pc.text);
      unit.adds.push(...existing);
      laneAdds[0].forEach(({ a, tag }) =>
        unit.adds.push(
          verdictFor(tag, citation(a), `${prop.criterion} c${pc.index}`),
        ),
      );
      if (pc.gap) unit.gaps.push(pc.gap);
      if (pc.note) unit.notes.push(pc.note);
      for (const m of ref.missedTests.filter(
        (x) => x.clauseIndex === pc.index,
      )) {
        if (skipMissed(prop.criterion, m, [unit])) continue;
        unit.missed.push({ cit: citation(m.citation), evidence: m.evidence });
      }
      units.push(unit);
      continue;
    }
    const partUnits = partTexts.map((text) => newUnit(text));
    if (resplit?.unitsFor === 'clause') {
      // lane tags have no parts: map by add index
      laneAdds[0].forEach(({ a, tag }, i) => {
        const targets = partOf[i] ?? [];
        const add = verdictFor(
          tag,
          citation(a),
          `${prop.criterion} c${pc.index}`,
        );
        if (targets.length === 0) {
          if (add.verdict === 'DROP') partUnits[0].adds.push(add);
          else partUnits[0].withheld.push(add.cit);
        }
        targets.forEach((t) => partUnits[t].adds.push(add));
      });
    } else {
      laneAdds.forEach((list, p) => {
        list.forEach(({ a, tag }) => {
          const add = verdictFor(
            tag,
            citation(a),
            `${prop.criterion} c${pc.index}`,
          );
          const detail = resplit?.addMap?.[tag];
          const targets = detail ?? partOf[p] ?? [];
          if (targets.length === 0) {
            if (add.verdict === 'DROP') partUnits[0].adds.push(add);
            else partUnits[0].withheld.push(add.cit);
          }
          targets.forEach((t) => partUnits[t].adds.push(add));
        });
      });
    }
    existing.forEach((e) => partUnits[resplit?.existingTo ?? 0].adds.push(e));
    const partGapped = (pc.proposedSplit ?? []).some((part) => part.gap);
    (pc.proposedSplit ?? []).forEach((part, p) => {
      if (part.gap)
        (resplit?.gapTo?.[p] ?? partOf[p] ?? []).forEach((t) =>
          partUnits[t].gaps.push(part.gap),
        );
    });
    if (pc.gap && !partGapped) partUnits.forEach((u) => u.gaps.push(pc.gap));
    for (const m of ref.missedTests.filter((x) => x.clauseIndex === pc.index)) {
      if (skipMissed(prop.criterion, m, [partUnits[0]])) continue;
      const part = m.splitPart ?? 0;
      const targets = resplit?.missedMap?.[part] ?? partOf?.[part] ?? [part];
      targets.forEach((t) =>
        partUnits[t].missed.push({
          cit: citation(m.citation),
          evidence: m.evidence,
        }),
      );
    }
    if (resplit !== undefined)
      partUnits.forEach((u, k) => {
        if (resplit.gaps?.[k]) u.gaps.push(resplit.gaps[k]);
      });
    units.push(...partUnits);
  }
  const unusedTags = [...byTag.keys()].filter((t) => !used.has(t));
  if (unusedTags.length > 0)
    problems.push(
      `${prop.criterion}: refutation tags unused: ${unusedTags.join(',')}`,
    );
  return { units };
};
