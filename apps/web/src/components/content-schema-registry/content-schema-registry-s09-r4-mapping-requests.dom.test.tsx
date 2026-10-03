// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import * as C from '@wejammin/contracts';

import { vi } from 'vitest';

import { CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS } from '../../server/content-schema-registry-platform-operations';
import { forwardContentSchemaRegistryMutation } from '../../server/content-schema-registry-platform-api';
import {
  CASES,
  bodyControls,
  closeMounted,
  createForm,
  inputKeys,
} from './content-schema-registry-s09-r4-mapping-forms.test-support';

/**
 * FE03 "Form-by-source completeness" for BE03a CMS-03A-01 to CMS-03A-04 and
 * CMS-03A-09 to CMS-03A-14: the controls of each real form are exactly the
 * fields of the generated request schema (plus named transport and UI-only
 * controls).
 */

afterEach(closeMounted);

describe('form controls are exactly the generated request fields', () => {
  it.each(
    CASES.map(
      (c) =>
        [c.id + (c.variant === undefined ? '' : `#${c.variant}`), c] as const,
    ),
  )('[P2-S09-AC-259] [P2-S09-AC-264] %s', (_label, c) => {
    const keys = inputKeys(c.schema)[c.variant ?? 0] as string[];
    const controls = bodyControls(c.form());
    expect([...controls].sort()).toStrictEqual([...keys].sort());
  });

  it('[P2-S09-AC-222] the create form sends every ContentTypeDraftRequest field including supportedLocales and fallbackChains, and nothing else', () => {
    const controls = bodyControls(createForm());
    expect(controls).toContain('supportedLocales');
    expect(controls).toContain('fallbackChains');
    expect([...controls].sort()).toStrictEqual(
      inputKeys(C.ContentTypeDraftRequestSchema)[0]!.slice().sort(),
    );
  });

  it('[P2-S09-AC-259] no owner, actor, party, binding or release evidence control exists in any form', () => {
    for (const c of CASES) {
      const names = [...c.form().elements].map(
        (element) => (element as HTMLInputElement).name,
      );
      for (const forbidden of [
        'ownerId',
        'actorId',
        'actingPartyId',
        'bindingId',
        'releaseNonceHash',
        'propsSchemaSnapshot',
        'signature',
      ])
        expect(names, `${c.id} ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe('release-only operations have no browser surface', () => {
  const RELEASE_ONLY = ['CMS-03A-05', 'CMS-03A-08'] as const;

  it('[P2-S09-AC-259] [P2-S09-AC-264] CMS-03A-05 and CMS-03A-08 are not browser command operations and no rendered form targets them', () => {
    const operations = Object.keys(CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS);
    for (const id of RELEASE_ONLY) {
      expect(operations).not.toContain(id);
      expect(CASES.map((c) => c.id)).not.toContain(id);
    }
  });

  it.each(RELEASE_ONLY)(
    '[P2-S09-AC-259] [P2-S09-AC-264] a forged browser request for %s is refused and never reaches the platform',
    async (operationId) => {
      const binding = { fetch: vi.fn() };
      const response = await forwardContentSchemaRegistryMutation(
        new Request('https://app.test/app/cms-content-modeling', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: 'wj_access=s; wj_csrf=csrf-token-value',
            'x-csrf-token': 'csrf-token-value',
            'idempotency-key': 'cms-forged-release-key',
          },
          body: JSON.stringify({ operationId }),
        }),
        binding,
        { operationId: operationId as never },
      ).catch((error: unknown) => error);
      expect(binding.fetch).not.toHaveBeenCalled();
      if (response instanceof Response)
        expect(response.status).toBeGreaterThanOrEqual(400);
    },
  );
});
