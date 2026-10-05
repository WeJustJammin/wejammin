import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  S09_AMENDMENT_EVIDENCE,
  S09_PRE_AMENDMENT_CHECKED,
} from './phase-02-slice-09-amendment-evidence';

const ROOT = resolve(import.meta.dirname, '../..');

const phasePlan = readFileSync(
  resolve(ROOT, '.memory/wiki/specs/phases/phase-2.md'),
  'utf8',
);
const slice09Tracker = readFileSync(
  resolve(ROOT, '.memory/pipeline/progress/slices/phase-02-slice-09.md'),
  'utf8',
);

const authoritativeDocuments = [
  ['canonical Phase 2 plan', phasePlan],
  ['current Slice 09 tracker', slice09Tracker],
] as const;

// Verified active = the surviving pre-amendment set plus the index entries; the
// deferred gates are in neither. Computed, never pinned (AC1145).
const verifiedActive =
  S09_PRE_AMENDMENT_CHECKED.length + S09_AMENDMENT_EVIDENCE.length;

const expectedAuthoredIds = Array.from(
  { length: 1239 },
  (_, index) => `P2-S09-AC-${String(index + 1).padStart(3, '0')}`,
).sort();

const acceptanceIds = (source: string): string[] =>
  [...new Set(source.match(/\bP2-S09-AC-\d{3,4}\b/gu) ?? [])].sort();

const acPolicyWindows = (source: string, id: string): string[] =>
  [...source.matchAll(new RegExp(`${id}|AC${id.slice(-3)}`, 'gu'))].map(
    ({ index }) => {
      const start = Math.max(0, (index ?? 0) - 600);
      return source.slice(start, (index ?? 0) + 2_000);
    },
  );

describe('Phase 2 Slice 09 completion policy', () => {
  it('[P2-S09-AC-267] preserves 1239 authored IDs with separate 1235-item Slice 09 and 2974-item Phase 2 implementation denominators', () => {
    for (const [label, source] of authoritativeDocuments) {
      expect(acceptanceIds(source), label).toEqual(expectedAuthoredIds);
      expect(source, label).toMatch(
        /\*{0,2}Phase[ -]2 implementation-completion denominator\*{0,2}\s*:\s*2,?974\b/iu,
      );
      expect(source, label).toMatch(
        /\*{0,2}Slice[ -]09 implementation-completion denominator\*{0,2}\s*:\s*1235\b/iu,
      );
      expect(source, label).toMatch(
        new RegExp(`${verifiedActive}/1235\\s+active`, 'iu'),
      );
      expect(source, label).toMatch(
        /1239 authored[^\n]*(?:AC209|AC211|AC265|AC266|production)/iu,
      );
    }
  });

  it('[P2-S09-AC-209] classifies the production alert gate as a post-deployment evidence gate outside the implementation denominator', () => {
    const combinedPolicy = `${phasePlan}\n${slice09Tracker}`;
    const windows = acPolicyWindows(combinedPolicy, 'P2-S09-AC-209');
    expect(windows.length).toBeGreaterThan(0);

    const gateWindow = windows.find((window) =>
      /production-rollout\/post-deployment/iu.test(window),
    );
    expect(gateWindow, 'AC209 post-deployment classification').toBeDefined();
    expect(gateWindow, 'AC209 post-deployment classification').toMatch(
      /unchecked/iu,
    );
    expect(combinedPolicy, 'AC209 row remains unchecked').toMatch(
      /^\s*-\s*\[ \].*P2-S09-AC-209/mu,
    );
  });

  it('[P2-S09-AC-211] classifies the SLO gate as post-launch operational acceptance outside the implementation denominator', () => {
    const combinedPolicy = `${phasePlan}\n${slice09Tracker}`;
    const windows = acPolicyWindows(combinedPolicy, 'P2-S09-AC-211');
    expect(windows.length).toBeGreaterThan(0);

    const gateWindow = windows.find((window) =>
      /post-launch operational SLO acceptance/iu.test(window),
    );
    expect(gateWindow, 'AC211 post-launch classification').toBeDefined();
    expect(gateWindow, 'AC211 post-launch classification').toMatch(
      /unchecked/iu,
    );
    expect(combinedPolicy, 'AC211 row remains unchecked').toMatch(
      /^\s*-\s*\[ \].*P2-S09-AC-211/mu,
    );
  });

  it('[P2-S09-AC-209] permits the controlled production deployment and Slice 10 while retaining the alerting-readiness condition', () => {
    const combinedPolicy = `${phasePlan}\n${slice09Tracker}`;
    expect(
      combinedPolicy,
      'AC209 must not gate Slice 10 or the controlled deployment',
    ).toMatch(
      /does not gate Slice 10 implementation or the initial controlled production deployment/iu,
    );
    expect(combinedPolicy, 'AC209 keeps its release-safety condition').toMatch(
      /before alerting is declared ready|before declaring alerting ready/iu,
    );
  });

  it('[P2-S09-AC-211] keeps the SLO gate off the initial launch while remaining mandatory after launch', () => {
    const combinedPolicy = `${phasePlan}\n${slice09Tracker}`;
    expect(combinedPolicy, 'AC211 must not gate the initial launch').toMatch(
      /does not gate the initial launch|must not gate the initial launch/iu,
    );
    expect(combinedPolicy, 'AC211 remains mandatory after launch').toMatch(
      /mandatory after (?:initial )?launch/iu,
    );
  });

  it('[P2-S09-AC-265] keeps hosted acceptance pre-release under DEC-132 while Slice 09 completion unblocks Slice 10', () => {
    for (const [label, source] of authoritativeDocuments) {
      expect(source, `${label} AC265 release timing`).toMatch(
        /AC265[^\n]*mandatory pre-release|AC265[^\n]*pre-release[^\n]*mandatory/iu,
      );
      expect(source, `${label} Slice 10 dependency`).toMatch(
        /Slice 10 implementation prerequisites\*\*:\s*Slice 10 implementation is unblocked by Slice 09 active completion at 1235\/1235 under DEC-132\.\s*AC209, AC211, AC265, and AC266 remain separate authored gates on their declared timelines and do not gate Slice 10 implementation/iu,
      );
      expect(source, `${label} AC265 row remains unchecked`).toMatch(
        /^\s*-\s*\[ \].*P2-S09-AC-265/mu,
      );
    }
  });

  it('[P2-S09-AC-266] keeps real-device accessibility evidence unchecked, deferred, and the pre-release gate', () => {
    for (const [label, source] of authoritativeDocuments) {
      const ac266Row = source
        .split(/\r?\n/u)
        .find((line) => /^\s*-\s*\[ \].*P2-S09-AC-266/iu.test(line));
      expect(ac266Row, label).toBeDefined();
      expect(ac266Row, label).toMatch(/^\s*-\s*\[ \]/u);

      const policyWindow = acPolicyWindows(source, 'P2-S09-AC-266').find(
        (window) =>
          /pre-release/iu.test(window) &&
          /(?:not|never)[^\n]*(?:passed|accepted|waived|simulated|inferred)/iu.test(
            window,
          ),
      );
      expect(policyWindow, `${label} AC266 policy`).toBeDefined();
      expect(policyWindow, `${label} AC266 policy`).toMatch(/pre-release/iu);
      expect(policyWindow, `${label} AC266 policy`).toMatch(
        /(?:not|never)[^\n]*(?:passed|accepted|waived|simulated|inferred)/iu,
      );
    }
  });

  it('[P2-S09-AC-266] keeps AC266 pre-release by policy, open, and independent of the production-bound sidecar', () => {
    const combinedPolicy = `${phasePlan}\n${slice09Tracker}`;
    expect(
      combinedPolicy,
      'AC266 must not be described as closing through the production sidecar',
    ).toMatch(
      /hosted-scope acceptance route (?:lands|binds)|hosted-scope acceptance route[^\n]*binds/iu,
    );
    expect(
      combinedPolicy,
      'AC266 must not claim a proven standalone acceptance path',
    ).toMatch(
      /no AC266-only\s+consumer binds both|no AC266-only consumer binds both|hosted-scope acceptance route binds its separate/iu,
    );
    expect(
      combinedPolicy,
      'AC266 must remain open rather than described as closable today',
    ).toMatch(
      /AC266 is (?:still )?open|AC266 remains authored and unchecked, and it is \*\*open\*\*/iu,
    );
    expect(
      combinedPolicy,
      'the combined sidecar must still require all four evidence streams',
    ).toMatch(
      /still requires all four evidence\s+streams|requires all four evidence streams|combined production-release verification/iu,
    );
  });
  it('[P2-S09-AC-266] retains the genuine real-device requirements and the no-substitute rule', () => {
    const combinedPolicy = `${phasePlan}\n${slice09Tracker}`;
    expect(combinedPolicy).toMatch(
      /macOS[^\n]*Safari[^\n]*VoiceOver|VoiceOver[^\n]*Safari[^\n]*macOS/iu,
    );
    expect(combinedPolicy).toMatch(
      /Windows[^\n]*Firefox[^\n]*NVDA|NVDA[^\n]*Firefox[^\n]*Windows/iu,
    );
    expect(combinedPolicy).toMatch(
      /Linux[^\n]*(?:cannot|does not)[^\n]*(?:replace|substitute)/iu,
    );
  });
});

describe('[P2-S09-AC-1144] DEC-108 amendment criteria in plan and tracker', () => {
  const amendmentIds = Array.from(
    { length: 956 },
    (_, index) => `P2-S09-AC-${String(index + 284).padStart(3, '0')}`,
  );
  const rowFor = (source: string, id: string): string | undefined =>
    source.split(/\r?\n/u).find((line) => line.includes(`**${id}**`));
  // A criterion is [x] exactly when the executable evidence index verifies it.
  const indexVerified = new Set<string>(
    S09_AMENDMENT_EVIDENCE.map(({ criterion }) => criterion),
  );
  const boxFor = (id: string): RegExp =>
    indexVerified.has(id) ? /^- \[x\] \*\*/u : /^- \[ \] \*\*/u;

  it('[P2-S09-AC-1144] mirrors every amendment criterion from P2-S09-AC-284 through P2-S09-AC-1239 as one row with identical text and source in plan and tracker, checked only when the evidence index verifies it', () => {
    for (const id of amendmentIds) {
      const tracker = rowFor(slice09Tracker, id) ?? '';
      const plan = rowFor(phasePlan, id) ?? '';
      expect(tracker, id).toMatch(boxFor(id));
      expect(plan, id).toMatch(boxFor(id));
      const description = (row: string): string =>
        row
          .replace(/^- \[[ x]\] \*\*[^*]+\*\* — /u, '')
          .replace(/\]\([^)]*\)/u, '](link)');
      expect(description(tracker), id).toBe(description(plan));
    }
  });

  it('[P2-S09-AC-1146] reopens the criteria whose universal or exact-shape claim the amendment falsified and scopes the surviving claims to explicit A01-A08 scope', () => {
    for (const id of [
      'P2-S09-AC-019',
      'P2-S09-AC-039',
      'P2-S09-AC-043',
      'P2-S09-AC-054',
      'P2-S09-AC-100',
      'P2-S09-AC-143',
      'P2-S09-AC-181',
      'P2-S09-AC-196',
      'P2-S09-AC-215',
      'P2-S09-AC-222',
      'P2-S09-AC-259',
      'P2-S09-AC-264',
      'P2-S09-AC-273',
    ]) {
      expect(rowFor(slice09Tracker, id), id).toMatch(boxFor(id));
    }
    for (const id of [
      'P2-S09-AC-018',
      'P2-S09-AC-020',
      'P2-S09-AC-021',
      'P2-S09-AC-022',
      'P2-S09-AC-024',
      'P2-S09-AC-025',
      'P2-S09-AC-030',
      'P2-S09-AC-031',
      'P2-S09-AC-032',
      'P2-S09-AC-033',
      'P2-S09-AC-034',
      'P2-S09-AC-035',
      'P2-S09-AC-036',
      'P2-S09-AC-037',
      'P2-S09-AC-165',
      'P2-S09-AC-166',
      'P2-S09-AC-178',
      'P2-S09-AC-180',
      'P2-S09-AC-182',
      'P2-S09-AC-190',
      'P2-S09-AC-192',
      'P2-S09-AC-201',
      'P2-S09-AC-202',
      'P2-S09-AC-205',
      'P2-S09-AC-206',
      'P2-S09-AC-207',
      'P2-S09-AC-208',
      'P2-S09-AC-210',
      'P2-S09-AC-212',
      'P2-S09-AC-214',
      'P2-S09-AC-216',
      'P2-S09-AC-221',
      'P2-S09-AC-255',
      'P2-S09-AC-256',
      'P2-S09-AC-257',
      'P2-S09-AC-258',
      'P2-S09-AC-269',
    ]) {
      const row = rowFor(slice09Tracker, id) ?? '';
      // Scope text is permanent; the box follows the evidence index (a surviving claim may still be open).
      expect(row, id).toMatch(boxFor(id));
      // AC034 carries the owner-ratified DEC-124 scope sentence, which names its operations.
      expect(row, id).toMatch(
        id === 'P2-S09-AC-034' ? /Scope: CMS-03A-01 \(/u : /original|A01-A08/u,
      );
    }
    for (const id of ['P2-S09-AC-089', 'P2-S09-AC-091', 'P2-S09-AC-099']) {
      expect(rowFor(slice09Tracker, id), id).toMatch(boxFor(id));
    }
    expect(rowFor(slice09Tracker, 'P2-S09-AC-099'), 'AC099').toMatch(
      /^- \[[ x]\] \*\*P2-S09-AC-099\*\* — [^\n]*never creates a plan/u,
    );
    expect(rowFor(slice09Tracker, 'P2-S09-AC-089'), 'AC089').toMatch(
      /^- \[[ x]\] \*\*P2-S09-AC-089\*\* — [^\n]*activator's own/u,
    );
  });

  it('[P2-S09-AC-1145] keeps the floor, active denominator and verified count consistent with the ledger', () => {
    const activeVerifiedIds = slice09Tracker
      .split(/\r?\n/u)
      .filter((line) => /^- \[x\] \*\*P2-S09-AC-\d{3,4}\*\*/u.test(line))
      .map((line) => /P2-S09-AC-(\d{3,4})/u.exec(line)?.[1] ?? '')
      .filter((id) => !['209', '211', '265', '266'].includes(id));
    expect(activeVerifiedIds).toHaveLength(verifiedActive);
    expect(slice09Tracker).toMatch(/\*\*Spec depth floor\*\*:\s*1239\b/u);
    expect(phasePlan).toMatch(/\*\*Spec depth floor\*\*:\s*1239 criteria/u);
  });

  it('[P2-S09-AC-1143] records the depth-floor ledger with the delta and floor', () => {
    const ledger = readFileSync(
      resolve(
        ROOT,
        '.memory/pipeline/progress/verification/2026-10-02-slice-09-dec108-depth-floor.md',
      ),
      'utf8',
    );
    expect(ledger).toMatch(/amendment delta is \*\*956\*\* new open criteria/u);
    expect(ledger).toMatch(/floor moves from 283 to \*\*1239\*\*/u);
    const ledgerRows = ledger.match(/^\| P2-S09-AC-\d{3,4} \|/gmu) ?? [];
    expect(ledgerRows).toHaveLength(956);
  });

  it('[P2-S09-AC-1147] gates Slices 10 and 12 on the amended Slice 09 criteria', () => {
    for (const path of [
      '.memory/pipeline/progress/slices/phase-02-slice-10.md',
      '.memory/pipeline/progress/slices/phase-02-slice-12.md',
    ]) {
      const tracker = readFileSync(resolve(ROOT, path), 'utf8');
      expect(tracker, path).toMatch(
        /AC019, AC039, AC043, AC054, AC100, AC143, AC181, AC196, AC215, AC222, AC259, AC264, AC273 and the 956/u,
      );
    }
    expect(phasePlan).toMatch(
      /\*\*Depends on\*\*: Slice 09 implementation completion, which now includes the amended Slice 09 criteria/u,
    );
  });
});
