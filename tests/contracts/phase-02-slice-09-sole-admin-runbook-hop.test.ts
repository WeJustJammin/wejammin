import { describe, expect, it } from 'vitest';

import { read } from './phase-02-slice-09-amendment-evidence.test-support';

const RUNBOOK = 'docs/runbooks/platform/sole-admin-mfa-lockout.md';
const STEP_UP_SERVICE = 'apps/worker/src/authentication/step-up-service.ts';
const RETRY_SCHEDULE = 'apps/worker/src/event-consumers/retry-schedule.ts';

const flat = (text: string): string => text.replace(/[ \t]*\n[ \t]*/gu, ' ');

const sections = (raw: string): Map<string, string> => {
  const found = new Map<string, string>();
  const parts = raw.split(/^## /mu).slice(1);
  for (const part of parts) {
    const [heading = '', ...body] = part.split('\n');
    found.set(heading.trim(), flat(body.join('\n')));
  }
  return found;
};

describe('sole-administrator runbook follows the real recovery path', () => {
  const raw = read(RUNBOOK);
  const parts = sections(raw);
  const procedure = parts.get('Procedure') ?? '';
  const failure = parts.get('Verification and failure') ?? '';

  it('[P2-S09-AC-1150] still derives the hop from the code: a provider 404 on a step-up challenge marks the factor reconciling and answers no_verified_factor, and the reconciler polls at 15, 60 and 300 seconds', () => {
    const service = read(STEP_UP_SERVICE);
    expect(service).toContain('markFactorReconciling');
    expect(service).toContain("'no_verified_factor'");
    expect(service).toContain("'enroll_factor'");
    expect(read(RETRY_SCHEDULE)).toContain('[15, 60, 300]');
  });

  it('[P2-S09-AC-1150] has the step-up reconciliation hop between the dashboard removal and the new enrollment, as numbered steps', () => {
    const numbered = [...procedure.matchAll(/(?:^|\s)(\d+)\. /gu)].map(
      ([, n]) => Number(n),
    );
    expect(numbered).toEqual(numbered.map((_, index) => index + 1));
    expect(numbered.length).toBeGreaterThanOrEqual(6);
    const at = (needle: RegExp): number => procedure.search(needle);
    const removal = at(/Remove every MFA factor/u);
    const hop = at(/\/step-up/u);
    const checking = at(/Checking status/u);
    const enroll = at(/AUTH-API-17/u);
    expect(removal).toBeGreaterThanOrEqual(0);
    expect(hop).toBeGreaterThan(removal);
    expect(checking).toBeGreaterThan(hop);
    expect(enroll).toBeGreaterThan(checking);
    expect(procedure).toMatch(/no_verified_factor|Add an authenticator/u);
    expect(procedure).toMatch(/marks? (?:the|that) (?:removed )?factor/iu);
    expect(procedure).toMatch(/15, 60 and 300 seconds/u);
  });

  it('[P2-S09-AC-1150] names the first-enrollment 401 as expected in both of its forms and the 600 second primary sign-in window', () => {
    expect(procedure).toMatch(/401/u);
    expect(procedure).toMatch(/600 seconds/u);
    expect(procedure).toMatch(/sign in again/u);
    expect(procedure).toMatch(/expected|normal/iu);
  });

  it('[P2-S09-AC-1150] escalates only on states that are not part of the normal recovery', () => {
    const escalation = failure;
    // A reconciling row and the first-enrollment 401 are intermediate states.
    expect(escalation).not.toMatch(
      /If a removed factor still appears, or enrollment is refused,\s*stop/u,
    );
    expect(escalation).toMatch(/Checking status/u);
    expect(escalation).toMatch(/15, 60 and 300 seconds|three polls/u);
    expect(escalation).toMatch(/escalate/iu);
    expect(escalation).toMatch(/do not edit identity rows by hand/iu);
  });
});
