// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  grantBinding,
  grantPageRequest,
  resolveGrantPage,
} from './cms-capability-grant-context.test-support';
import { SUBJECT_ID } from './cms-capability-grant.test-support';
import {
  cmsAccessNavigationVisible,
  cmsCapabilityGrantRefusalResponse,
  isCmsCapabilityGrantRefusal,
} from './cms-capability-grant-page-response';
import { probeCmsCapabilityGrantOwner } from './cms-capability-grant-platform-api';

/**
 * FE03 conditional-rendering matrix, CMS capability grant console row: the
 * console is full only for the receipt-derived owner, so every persona cell is
 * not-rendered. The server resolves ownership from the upstream CMS-03A-18
 * proof alone; a persona label is never an input, so each persona that is not
 * the owner reaches the same 403 gate with no navigation entry and no grant
 * control.
 */

/** Persona and the ledger criterion owning its not-rendered matrix cell. */
const NON_OWNER_PERSONAS = [
  ['Free', 1050],
  ['Paid', 1051],
  ['Creator', 1052],
  ['Guardian', 1053],
  ['Junior', 1054],
  ['Business', 1055],
  ['Staff', 1056],
] as const;

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('grant console persona cells are not-rendered for every non-owner persona', () => {
  it.each(NON_OWNER_PERSONAS)(
    '%s persona [P2-S09-AC-%i]: the production route answers a bare 403 with no console, no navigation entry and no grant controls',
    async () => {
      // Ownership comes only from the upstream CMS-03A-18 proof, so every
      // persona that is not the owner takes this one path. The refusal below
      // is the Response the page route itself returns (never a rendered
      // forbiddenHidden console, which the route does not produce).
      const { result } = await resolveGrantPage({ status: 403 });
      expect(result).toStrictEqual({ kind: 'forbidden' });
      if (!isCmsCapabilityGrantRefusal(result))
        throw new Error('a non-owner must be refused');
      const refusal = cmsCapabilityGrantRefusalResponse(result);
      expect(refusal.status).toBe(403);
      expect(refusal.headers.get('cache-control')).toBe('no-store');
      const body = await refusal.text();
      expect(body).toBe('Forbidden');
      expect(body).not.toContain('<');
      expect(body).not.toContain(SUBJECT_ID);

      const owner = await probeCmsCapabilityGrantOwner(
        grantPageRequest(),
        grantBinding({ status: 403, errorCode: 'FORBIDDEN' }).binding,
      );
      expect(owner).toBe(false);
      // No navigation entry: a failed ownership probe hides it on the owner
      // variant, and a non-owner registry variant never shows it.
      expect(cmsAccessNavigationVisible('ownerFull', owner)).toBe(false);
      expect(cmsAccessNavigationVisible('entitledRead', true)).toBe(false);
      expect(cmsAccessNavigationVisible('ownerFull', true)).toBe(true);
    },
  );

  it('[P2-S09-AC-991] [P2-S09-AC-992] keeps ownership independent of any persona label in the server resolver, probe and page', () => {
    for (const source of [
      read('./cms-capability-grant-context.ts'),
      read('./cms-capability-grant-platform-api.ts'),
      read('../pages/app/cms-content-modeling/capability-grants.astro'),
    ])
      expect(source).not.toMatch(
        /\b(?:persona|isFree|isPaid|isCreator|isGuardian|isJunior|isBusiness|isStaff)\b/iu,
      );
  });
});
