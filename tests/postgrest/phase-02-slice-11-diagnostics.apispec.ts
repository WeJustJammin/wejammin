/**
 * Slice 11 run-log privacy control (lane S11-4R). The composed stack's ACTUAL
 * `[s11-rpc]` and `[s11-http]` loggers must emit only SAFE metadata and never echo
 * a raw failing body or a request path, which can carry a preview token, manifest,
 * cursor or person identifier. Unrelated structured Worker telemetry also writes to
 * `console.info`, so this captures ONLY the calls recorded during the one request
 * under test and selects the EXACT expected target tuple within the actual logger
 * namespace (by rpc name or method + status); every argument of the selected tuple
 * is preserved and inspected. A missing expected target fails (non-vacuous), and
 * all metadata/leak checks are booleans/digests only, so no raw log line is printed.
 *
 * Commits fixtures (a world and one draft entry): run right after `pnpm db:reset`,
 * and reset again afterwards.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { readWorkflow } from './support/phase-02-slice-11-flow';
import { expectStatus } from './support/phase-02-slice-11-assert';
import {
  selectTargetCalls,
  captureNamespace,
} from './support/phase-02-slice-11-log-capture';
import {
  expectMetadata,
  inspectTargetCalls,
} from './support/phase-02-slice-11-meta-controls';
import {
  type S11World,
  prepareS11World,
  seedDraft,
} from './support/phase-02-slice-11-world';
import {
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';

/**
 * The console calls captured from `fromIndex` onward: the slice recorded during the
 * one request under test, so only that request's logger tuples are selected (the
 * HTTP log line digests the path, so a marker cannot select it by text).
 */
const during = (
  calls: readonly unknown[][],
  fromIndex: number,
): readonly unknown[][] => calls.slice(fromIndex);

let world: S11World;
let stack: S11Stack;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
});

describe('the run-log never discloses a failing RPC body', () => {
  it('logs only status, byte length and a body digest for a 503 whose upstream body carries a sensitive sentinel', async () => {
    // A single-token sentinel: no whitespace, so the assertion cannot be defeated
    // by any truncation or joining of the log lines.
    const sentinel = 'S11SENTINEL9f3c1a7e4b2d8c60';
    const draft = await seedDraft(stack, world, 'Diagnostics subject');
    const { preparation } = await readWorkflow(stack, draft.entryId);

    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const start = spy.mock.calls.length;
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
      // The EXACT expected tuple: the actual [s11-rpc] logger line for the failed
      // cms_submit_review 503, selected by namespace + status + the exact rpc name.
      const target = selectTargetCalls(
        during(spy.mock.calls, start),
        '[s11-rpc]',
        ['cms_submit_review'],
        503,
      );
      const expectation = inspectTargetCalls(
        target,
        [sentinel],
        [/bytes=\d+/u, /bodySha256=[0-9a-f]{16}/u],
      );
      expectMetadata(expectation, 'RPC 503 run-log');
      // Every namespace call was inspected for the sentinel (any argument, nested).
      const wholeNamespace = inspectTargetCalls(
        captureNamespace(during(spy.mock.calls, start), '[s11-rpc]'),
        [sentinel],
        [/bytes=\d+/u],
      );
      expectMetadata(wholeNamespace, 'RPC namespace leak sweep');
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
    const start = spy.mock.calls.length;
    try {
      // A malformed (non-UUID) entry id in the path is refused 400 by the route
      // parser, which still fires the HTTP run-log for status >= 400. The tuple is
      // selected from the calls this request produced, in the [s11-http] namespace
      // with method GET and status 400; the sentinel is only ever a leak marker.
      const response = await stack.get(
        `/api/v1/cms/entries/${sentinel}/workflow`,
      );
      expect(response.status).toBe(400);
      const target = selectTargetCalls(
        during(spy.mock.calls, start),
        '[s11-http]',
        ['GET'],
        400,
      );
      const expectation = inspectTargetCalls(
        target,
        [sentinel],
        [/pathSha256=[0-9a-f]{16}/u, /bytes=\d+/u, /bodySha256=[0-9a-f]{16}/u],
      );
      expectMetadata(expectation, 'HTTP 400 run-log');
      // Whole-namespace leak sweep across the same request slice: EVERY [s11-http]
      // argument (any nested string) is inspected, matching the RPC sweep.
      const wholeNamespace = inspectTargetCalls(
        captureNamespace(during(spy.mock.calls, start), '[s11-http]'),
        [sentinel],
        [/pathSha256=[0-9a-f]{16}/u],
      );
      expectMetadata(wholeNamespace, 'HTTP 400 namespace leak sweep');
    } finally {
      spy.mockRestore();
    }
  });

  it('logs only a path digest (never the raw path) for a failing request whose valid path carries a request-id marker in the body', async () => {
    const marker = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const start = spy.mock.calls.length;
    try {
      // A well-formed request id flows into the ApiError body (BE00 echoes it), so
      // the 404 body contains the marker. The tuple is selected from this request's
      // calls in the [s11-http] namespace with method GET and status 404; the marker
      // is only a leak marker, and the composed logger never prints the raw body.
      const response = await stack.get(
        '/api/v1/cms/entries/00000000-0000-4000-8000-000000000001/workflow',
        { headers: { 'x-request-id': marker } },
      );
      expect(response.text.includes(marker)).toBe(true);
      const target = selectTargetCalls(
        during(spy.mock.calls, start),
        '[s11-http]',
        ['GET'],
        404,
      );
      const expectation = inspectTargetCalls(
        target,
        [marker],
        [/bodySha256=[0-9a-f]{16}/u],
      );
      expectMetadata(expectation, 'HTTP 404 run-log');
      // Whole-namespace leak sweep across the same request slice.
      const wholeNamespace = inspectTargetCalls(
        captureNamespace(during(spy.mock.calls, start), '[s11-http]'),
        [marker],
        [/bodySha256=[0-9a-f]{16}/u],
      );
      expectMetadata(wholeNamespace, 'HTTP 404 namespace leak sweep');
    } finally {
      spy.mockRestore();
    }
  });
});
