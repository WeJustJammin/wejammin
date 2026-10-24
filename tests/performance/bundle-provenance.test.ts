import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  distProvenanceFailures,
  pinnedNodeFailure,
} from '../../scripts/verify-bundle-budget.mjs';
import {
  createBundleFixture,
  removeBundleFixtures,
} from './bundle-fixture.test-support';

/*
 * `pnpm bundle:check` measures gzip bytes, and the bytes depend on two things the script does not
 * choose: the Node version (zlib: every CMS route grew 660 to 801 bytes under Node 26 against the
 * pinned 22.23.1) and which build `apps/web/dist` holds (a development-mode staging build had
 * replaced the production one and failed every route, V11 L1). The gate therefore records the
 * version it measured with, refuses any version but the pinned one, and refuses a dist that is
 * not a production build.
 */
afterEach(removeBundleFixtures);

describe('the Node version the gate measures with', () => {
  it('accepts exactly the version `.node-version` pins', () => {
    expect(pinnedNodeFailure('v22.23.1', '22.23.1\n')).toBeNull();
  });

  it.each(['v26.11.1', 'v22.23.2', 'v22.22.0', 'v23.0.0'])(
    'refuses %s and names both versions',
    (actual) => {
      const failure = pinnedNodeFailure(actual, '22.23.1\n');
      expect(failure).toContain(actual);
      expect(failure).toContain('22.23.1');
    },
  );

  it('refuses a pin file it cannot read', () => {
    expect(pinnedNodeFailure('v22.23.1', '')).toContain('.node-version');
    expect(pinnedNodeFailure('v22.23.1', null)).toContain('.node-version');
  });
});

describe('the build the gate measures', () => {
  const withServer = (
    wrangler: Record<string, unknown> | null,
    assets: Readonly<Record<string, string>> = {},
  ): string => {
    const root = createBundleFixture({
      'app.js': 'export const a = 1;',
      ...assets,
    });
    if (wrangler !== null) {
      mkdirSync(join(root, 'server'), { recursive: true });
      writeFileSync(
        join(root, 'server', 'wrangler.json'),
        JSON.stringify(wrangler),
      );
    }
    return root;
  };

  it('accepts a production build: no target environment, no development runtime', () => {
    expect(
      distProvenanceFailures(withServer({ name: 'wejammin-web' })),
    ).toEqual([]);
  });

  it('refuses a build for a named environment such as staging', () => {
    const failures = distProvenanceFailures(
      withServer({
        name: 'wejammin-web-staging',
        targetEnvironment: 'staging',
      }),
    );
    expect(failures.join(' ')).toContain('staging');
  });

  it('refuses a build that carries the React development runtime', () => {
    const failures = distProvenanceFailures(
      withServer(
        { name: 'wejammin-web' },
        { 'client.js': 'import "react/jsx-dev-runtime";' },
      ),
    );
    expect(failures.join(' ')).toContain('jsx-dev-runtime');
  });

  it('refuses a dist with no server build, which no production build lacks', () => {
    const failures = distProvenanceFailures(withServer(null));
    expect(failures.join(' ')).toContain('wrangler.json');
  });
});
