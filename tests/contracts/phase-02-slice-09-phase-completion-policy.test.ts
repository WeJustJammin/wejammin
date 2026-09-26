import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

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

const expectedAuthoredIds = Array.from(
  { length: 283 },
  (_, index) => `P2-S09-AC-${String(index + 1).padStart(3, '0')}`,
);

const acceptanceIds = (source: string): string[] =>
  [...new Set(source.match(/\bP2-S09-AC-\d{3}\b/gu) ?? [])].sort();

const acPolicyWindows = (source: string, id: string): string[] =>
  [...source.matchAll(new RegExp(`${id}|AC${id.slice(-3)}`, 'gu'))].map(
    ({ index }) => {
      const start = Math.max(0, (index ?? 0) - 600);
      return source.slice(start, (index ?? 0) + 2_000);
    },
  );

describe('Phase 2 Slice 09 completion policy', () => {
  it('[P2-S09-AC-267] preserves 283 authored IDs with separate 279-item Slice 09 and 1996-item Phase 2 implementation denominators', () => {
    for (const [label, source] of authoritativeDocuments) {
      expect(acceptanceIds(source), label).toEqual(expectedAuthoredIds);
      expect(source, label).toMatch(
        /\*{0,2}Phase[ -]2 implementation-completion denominator\*{0,2}\s*:\s*1,?996\b/iu,
      );
      expect(source, label).toMatch(
        /\*{0,2}Slice[ -]09 implementation-completion denominator\*{0,2}\s*:\s*279\b/iu,
      );
      expect(source, label).toMatch(/279\/279\s+active/iu);
      expect(source, label).toMatch(
        /283 authored[^\n]*(?:AC209|AC211|AC265|AC266|production)/iu,
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

  it('[P2-S09-AC-265] defers genuine hosted acceptance to pre-release without gating Slice 10 implementation', () => {
    for (const [label, source] of authoritativeDocuments) {
      expect(source, `${label} AC265 release timing`).toMatch(
        /AC265[^\n]*mandatory pre-release|AC265[^\n]*pre-release[^\n]*mandatory/iu,
      );
      expect(source, `${label} Slice 10 dependency`).toMatch(
        /AC265[^\n]*does not (?:block|gate) Slice 10 implementation|Slice 10 implementation[^\n]*no AC265 prerequisite/iu,
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
        (window) => /deferred/iu.test(window),
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
