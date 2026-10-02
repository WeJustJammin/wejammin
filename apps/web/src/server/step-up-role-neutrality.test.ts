import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * FE01 role matrix for the step-up and MFA pages: the self-account surface is
 * identical for every role. Acting context, alias, mandate or representation
 * never changes whose factor is verified, so no page, context resolver or
 * island reads or branches on any of them. Astro pages are asserted as source,
 * the repository convention, because the page shell needs the Astro runtime.
 */

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const STEP_UP_PAGE = read('../pages/step-up.astro');
const MFA_PAGE = read('../pages/settings/security/mfa.astro');
const STEP_UP_CONTEXT = read('./step-up-page-context.ts');
const MFA_CONTEXT = read('./mfa-settings-page-context.ts');
const ISLANDS = [
  '../components/identity-authority/step-up-mfa/StepUpChallengeForm.tsx',
  '../components/identity-authority/step-up-mfa/StepUpPhases.tsx',
  '../components/identity-authority/step-up-mfa/MfaEnrollmentWizard.tsx',
  '../components/identity-authority/step-up-mfa/MfaFactorList.tsx',
].map(read);

const ROLE_INPUTS =
  /\b(?:acting-?context\w*|actingParty\w*|actorId|persona|mandate\w*|alias(?:es)?|entitled\w*|guardian|junior|business|staffCase\w*|adminStepUp|ownerFull)\b/iu;

describe('step-up and MFA pages are role-neutral self-account surfaces', () => {
  it('[P2-S09-AC-1099] [P2-S09-AC-1100] never read acting context, alias, mandate or a role in a page or resolver', () => {
    for (const source of [
      STEP_UP_PAGE,
      MFA_PAGE,
      STEP_UP_CONTEXT,
      MFA_CONTEXT,
      ...ISLANDS,
    ])
      expect(source).not.toMatch(ROLE_INPUTS);
  });

  it('[P2-S09-AC-1099] [P2-S09-AC-1100] render the one authPage variant to every role', () => {
    expect(STEP_UP_PAGE).toContain('variant="authPage"');
    expect(MFA_PAGE).toContain('variant="authPage"');
    expect(STEP_UP_PAGE).not.toMatch(/variant=\{/u);
    expect(MFA_PAGE).not.toMatch(/variant=\{/u);
  });

  it('[P2-S09-AC-1099] says "your account" in the heading area and help of both pages', () => {
    expect(STEP_UP_PAGE).toContain('Your account');
    expect(MFA_PAGE).toMatch(/Authenticators protect your account/u);
    expect(MFA_PAGE).toMatch(
      /Your own account is always\s+the\s+one changed here, whichever profile or role you are acting as/u,
    );
  });

  it('[P2-S09-AC-1100] gives Staff and Admin nothing extra: the page reads only the AUTH-API-16 factors for the session', () => {
    expect(STEP_UP_CONTEXT).toMatch(/AUTH-API-16|\/api\/v1\/auth\/mfa/u);
    expect(STEP_UP_CONTEXT).not.toMatch(/capabilit/iu);
  });
});
