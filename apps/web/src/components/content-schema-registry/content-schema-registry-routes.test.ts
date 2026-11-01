import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

describe('content schema registry protected Astro routes', () => {
  it('keeps list and detail routes server-first and protected', () => {
    const list = readFileSync(
      fromHere('../../pages/app/cms-content-modeling/index.astro'),
      'utf8',
    );
    const detail = readFileSync(
      fromHere(
        '../../pages/app/cms-content-modeling/[contentTypeId]/versions/[versionId].astro',
      ),
      'utf8',
    );
    for (const source of [list, detail]) {
      expect(source).toContain('export const prerender = false');
      expect(source).toContain(
        "Astro.response.headers.set('Cache-Control', 'no-store')",
      );
      expect(source).toContain('resolveContentSchemaRegistryPage');
      expect(source).toContain('cmsRedirectResponse(');
      expect(source).toContain('returnTo');
      expect(source).toContain('tabindex="-1"');
      expect(source).toContain('id="page-title"');
      expect(source).toContain('route-heading-focus.ts');
      expect(source).toContain('<h1');
      expect(source).toContain('ContentSchemaRegistryWorkbenchIsland');
      expect(source).toContain('client:load');
      expect(source).not.toContain('client:visible');
      expect(source).not.toContain('content-schema-registry-runtime-dom.ts');
      expect(source).not.toContain('ReleaseEnvelopeHeaders');
    }
    expect(detail).toContain('contentTypeId');
    expect(detail).toContain('versionId');
    expect(detail).toContain('detailTitle');
    expect(detail).toContain('detailHeading');
  });
});
