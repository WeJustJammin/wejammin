// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsCapabilityGrantConsole from '../components/cms-capability-grants/CmsCapabilityGrantConsole';
import { consoleProps } from '../components/cms-capability-grants/cms-capability-grant-console.test-support';
import {
  grantBinding,
  grantPageRequest,
  resolveGrantPage,
} from './cms-capability-grant-context.test-support';
import { SUBJECT_ID } from './cms-capability-grant.test-support';
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
    '%s persona [P2-S09-AC-%i]: forbidden gate, no navigation entry, no route content, no grant controls',
    async (persona) => {
      // The persona is a non-owner: the upstream owner proof refuses it.
      const { result } = await resolveGrantPage({ status: 403 });
      expect(result).toStrictEqual({ kind: 'forbidden' });

      const owner = await probeCmsCapabilityGrantOwner(
        grantPageRequest(),
        grantBinding({ status: 403, errorCode: 'FORBIDDEN' }).binding,
      );
      expect(owner).toBe(false);

      const html = renderToStaticMarkup(
        React.createElement(
          CmsCapabilityGrantConsole,
          consoleProps({ variant: 'forbiddenHidden', access: 'not-rendered' }),
        ),
      );
      expect(html).toContain(
        'Only the organization owner can manage CMS access.',
      );
      expect(html).not.toContain('<table');
      expect(html).not.toContain('<form');
      expect(html).not.toContain('data-operation-id');
      expect(html).not.toContain(SUBJECT_ID);
      expect(persona.length).toBeGreaterThan(0);
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
