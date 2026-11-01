// Limitation text for a partial or unverified entry, composed from the FINAL clause structure:
// each uncited clause is named with why it is unproven (override, the lane's gap for that clause,
// the reasons of the citations the refutation dropped, or the lane's own limitation as a last resort).

import { excerpt } from './apply-lib.mjs';
import {
  CAVEATS,
  CLAUSE_REASONS,
  LIMITATION_OVERRIDES,
} from './apply-data.mjs';

const unique = (list) => [
  ...new Set(list.map((s) => s.trim()).filter((s) => s !== '')),
];

const reasonFor = (clause, plan, criterion) => {
  const unit = clause.unit;
  const explicit = CLAUSE_REASONS.find(
    ([id, start]) => id === criterion && clause.text.startsWith(start),
  );
  if (explicit !== undefined) return explicit[2];
  const reasons = [...unique(unit.gaps)];
  if (reasons.length === 0) {
    const drops = unit.adds
      .filter((a) => a.verdict === 'DROP')
      .map((a) => a.reason);
    if (drops.length > 0)
      reasons.push(
        `the cited tests were refuted: ${unique(drops).join(' | ')}`,
      );
  }
  if (reasons.length === 0 && unit.rejected) reasons.push(unit.notes.join(' '));
  if (reasons.length === 0)
    reasons.push(
      plan.prop.proposedLimitation ||
        plan.ref.limitation ||
        'no test proves it',
    );
  return reasons.join(' ');
};

export const composeLimitation = ({ criterion, status, clauses, plan }) => {
  if (LIMITATION_OVERRIDES[criterion] !== undefined)
    return LIMITATION_OVERRIDES[criterion];
  const uncited = clauses.filter((c) => c.citations.length === 0);
  const lead =
    status === 'unverified'
      ? 'No test is cited. Unproven:'
      : 'Unproven (uncited clauses):';
  // Identical reasons (one gap covering several uncited parts) are stated once.
  const groups = [];
  for (const c of uncited) {
    const reason = reasonFor(c, plan, criterion);
    const group = groups.find((g) => g.reason === reason);
    if (group === undefined) groups.push({ reason, clauses: [c] });
    else group.clauses.push(c);
  }
  const body = groups
    .map(
      (g) =>
        `${g.clauses.map((c) => `"${excerpt(c.text, 100)}"`).join(' and ')}: ${g.reason}`,
    )
    .join(' ');
  const caveat =
    CAVEATS[criterion] === undefined
      ? ''
      : ` Further limits of cited clauses: ${CAVEATS[criterion]}`;
  return `${lead} ${body}${caveat}`.replace(/\s+/gu, ' ').trim();
};
