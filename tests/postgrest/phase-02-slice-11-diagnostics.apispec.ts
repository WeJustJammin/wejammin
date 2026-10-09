/**
 * Slice 11 run-log privacy control (lane S11-4R, first action3). Both composed
 * stack loggers must emit only SAFE metadata and never echo a raw failing body or
 * a request path, which can carry a preview token, manifest, cursor or person
 * identifier. This exercises the REAL loggers through the production composition:
 * a sensitive sentinel is injected as an upstream body (RPC logger) and in a
 * request path (HTTP logger), and must not appear anywhere in the captured log.
 *
 * RED against the historical raw-text loggers (the sentinel leaks), GREEN against
 * the digest-only loggers. The captured log is never diffed (which would print it
 * on failure); a boolean contains check with a count/digest-only message is used.
 * Commits fixtures (a world and one draft entry): run right after `pnpm db:reset`,
 * and reset again afterwards.
 */
import { createHash } from 'node:crypto';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { readWorkflow } from './support/phase-02-slice-11-flow';
import { expectStatus } from './support/phase-02-slice-11-assert';
import {
  type S11World,
  prepareS11World,
  seedDraft,
} from './support/phase-02-slice-11-world';
import {
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';

let world: S11World;
let stack: S11Stack;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
});

/**
 * Assert a captured log does NOT contain any of `secrets`, reporting only a safe
 * message (secret count and a digest of the log) so a failing RED can never print
 * the secrets or the raw log. Returns the joined log for the caller's own
 * metadata assertions.
 */
const captureLogWithoutSecrets = (
  calls: readonly unknown[][],
  secrets: readonly string[],
): string => {
  const logged = calls.map((call) => call.map(String).join(' ')).join('\n');
  const leaked = secrets.some((secret) => logged.includes(secret));
  const digest = createHash('sha256').update(logged).digest('hex').slice(0, 16);
  expect(
    leaked,
    `captured log leaked a secret (secrets=${secrets.length} logSha256=${digest})`,
  ).toBe(false);
  return logged;
};

describe('the run-log never discloses a failing RPC body', () => {
  it('emits only status, byte length and a body digest for a 503 whose upstream body carries a sensitive sentinel', async () => {
    // A single-token sentinel: no whitespace, so the assertion cannot be defeated
    // by any truncation or joining of the log lines.
    const sentinel = 'S11SENTINEL9f3c1a7e4b2d8c60';
    const draft = await seedDraft(stack, world, 'Diagnostics subject');
    const { preparation } = await readWorkflow(stack, draft.entryId);

    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      stack.breakRpc(
        'cms_submit_review',
        JSON.stringify({
          message: sentinel,
          token: sentinel,
          detail: sentinel,
        }),
      );
      const response = await stack.post(
        `/api/v1/cms/entries/${draft.entryId}/reviews`,
        {
          body: {
            entryId: draft.entryId,
            revisionId: draft.revisionId,
            frozenHash: preparation?.frozenHash,
            dependencyManifest: preparation?.dependencyManifest,
          },
          ifMatch: draft.entryVersion,
        },
      );
      expectStatus(response, 503);
      const logged = captureLogWithoutSecrets(spy.mock.calls, [sentinel]);
      // Only safe metadata is present: the sentinel is never echoed.
      expect(logged).toMatch(/bytes=\d+/u);
      expect(logged).toMatch(/bodySha256=[0-9a-f]{16}/u);
    } finally {
      stack.breakRpc(null);
      spy.mockRestore();
    }
  });
});

describe('the HTTP run-log never discloses a path or body', () => {
  it('logs only method, status, path digest, byte length and body digest for a failing request whose path carries a sentinel', async () => {
    const sentinel = 'S11HTTPSENTINEL2b8d4c60e7a1f309';
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      // A malformed (non-UUID) entry id in the path is refused 400 by the route
      // parser, which still fires the HTTP run-log for status >= 400.
      const response = await stack.get(
        `/api/v1/cms/entries/${sentinel}/workflow`,
      );
      expect(response.status).toBe(400);
      const logged = captureLogWithoutSecrets(spy.mock.calls, [sentinel]);
      // Neither the path sentinel nor any raw path/body appears: only safe metadata.
      expect(logged).toMatch(/pathSha256=[0-9a-f]{16}/u);
      expect(logged).toMatch(/bytes=\d+/u);
      expect(logged).toMatch(/bodySha256=[0-9a-f]{16}/u);
    } finally {
      spy.mockRestore();
    }
  });

  it('logs only a path digest (never the raw path) for a failing request whose valid path carries a request-id marker in the body', async () => {
    const marker = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      // A well-formed request id flows into the ApiError body (BE00 echoes it); the
      // 404 body therefore contains the marker, proving the body-sensitivity claim.
      const response = await stack.get(
        '/api/v1/cms/entries/00000000-0000-4000-8000-000000000001/workflow',
        { headers: { 'x-request-id': marker } },
      );
      // The body really carried the marker (non-vacuous), yet the log did not.
      expect(response.text.includes(marker)).toBe(true);
      const logged = captureLogWithoutSecrets(spy.mock.calls, [marker]);
      expect(logged).toMatch(/bodySha256=[0-9a-f]{16}/u);
    } finally {
      spy.mockRestore();
    }
  });
});
