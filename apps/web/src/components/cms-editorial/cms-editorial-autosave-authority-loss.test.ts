// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createCmsEditorialAutosaveScheduler,
  type CmsEditorialAutosaveClock,
} from './cms-editorial-autosave';
import {
  buildCmsEditorialEntryRevisionRequest,
  collectCmsEditorialChangedValues,
  isCmsEditorialDraftDirty,
} from './cms-editorial-entry-draft';
import {
  executeCmsEditorialRevisionMutation,
  type CmsEditorialMutationOutcome,
} from './cms-editorial-runtime';
import { cmsEditorialOutcomeMessage } from './cms-editorial-runtime-dom-feedback';
import type {
  CmsEditorialDraftField,
  CmsEditorialEntryDraft,
} from './cms-editorial-types';

/*
 * IA03 Edge Cases, "Authority revoked during autosave/review": the server
 * rejects the commit (removing the active presence and assignment) and the
 * browser must "preserve local unsent value". BE03b: "Local unsent values remain
 * client-side when server authority changes." FE03 keeps presence physical-only,
 * so the client contract is only this: a 401/403/404 refusal yields nothing to
 * adopt, leaves the dirty draft and its request untouched, and an owner that
 * stops saving gets no automatic replay from the scheduler.
 *
 * The autosave runtime is a library; the draft-detail island is a read-only
 * summary and does not own an autosaving draft yet. The owner below is the
 * smallest stand-in that applies the documented adoption rule (adopt only a
 * verified 201), so these assertions pin the library behavior a future owner
 * relies on rather than an island that does not exist.
 */

const FIELD_A = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';
const SCHEMA_VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132de';
const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d9';
const UNSENT_VALUE = 'a paragraph typed after the grant was revoked';

const field = (value: string): CmsEditorialDraftField => ({
  fieldId: FIELD_A,
  fieldKey: 'body',
  value,
});

const baseFields = [field('the last saved paragraph')] as const;
const localDraft: CmsEditorialEntryDraft = {
  entryId: ENTRY_ID,
  entryLifecycle: 'active',
  baseRevision: '4',
  expectedVersion: '11',
  locale: 'en-US',
  schemaVersionId: SCHEMA_VERSION_ID,
  fields: [field(UNSENT_VALUE)],
};

const refusal = (status: number, code: string): Response =>
  new Response(
    JSON.stringify({
      code,
      message: 'Safe message',
      requestId: REQUEST_ID,
      details: {},
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );

const manualClock = () => {
  const pending = new Map<number, () => void>();
  let nextHandle = 1;
  const clock: CmsEditorialAutosaveClock = {
    setTimer: (callback) => {
      const handle = nextHandle;
      nextHandle += 1;
      pending.set(handle, callback);
      return handle;
    },
    clearTimer: (handle) => {
      pending.delete(handle as number);
    },
  };
  return {
    clock,
    flush: (): void => {
      for (const [handle, callback] of [...pending]) {
        pending.delete(handle);
        callback();
      }
    },
  };
};

const settle = async (): Promise<void> => {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
};

/** A stand-in owner: adopts only a verified 201 and stops saving on a refusal. */
const runOwner = async (response: Response) => {
  const fetcher = vi.fn(async () => response.clone());
  const { clock, flush } = manualClock();
  let canSave = true;
  let adopted = 0;
  const outcomes: CmsEditorialMutationOutcome[] = [];
  const requests: unknown[] = [];
  const scheduler = createCmsEditorialAutosaveScheduler({
    isDirty: () => isCmsEditorialDraftDirty(baseFields, localDraft.fields),
    canSave: () => canSave,
    onSave: async () => {
      const request = buildCmsEditorialEntryRevisionRequest({
        draft: localDraft,
        base: baseFields,
      });
      requests.push(request);
      const result = await executeCmsEditorialRevisionMutation({
        path: '/api/v1/cms/entries/' + ENTRY_ID + '/revisions',
        request,
        csrfToken: 'csrf-token',
        idempotencyKey: 'idem-key-1',
        fetcher,
      });
      outcomes.push(result.outcome);
      if (result.resource !== null) adopted += 1;
      else if (
        result.outcome === 'unauthenticated' ||
        result.outcome === 'forbidden' ||
        result.outcome === 'not-found'
      )
        canSave = false;
      return undefined;
    },
    clock,
  });
  scheduler.markDirty();
  flush();
  await settle();
  // The author keeps typing after the refusal: the dirty draft must not replay.
  scheduler.markDirty();
  flush();
  await settle();
  return { scheduler, fetcher, adopted, outcomes, requests };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('autosave when server authority is revoked', () => {
  it.each([
    [401, 'UNAUTHENTICATED', 'unauthenticated'],
    [403, 'FORBIDDEN', 'forbidden'],
    [404, 'NOT_FOUND', 'not-found'],
  ] as const)(
    'keeps the unsent value and never replays after a %i %s refusal',
    async (status, code, outcome) => {
      const { scheduler, fetcher, adopted, outcomes, requests } =
        await runOwner(refusal(status, code));

      expect(outcomes).toEqual([outcome]);
      expect(adopted).toBe(0);
      expect(fetcher).toHaveBeenCalledOnce();

      // The local draft is still the author's, still dirty, and still carries
      // exactly the value that was never accepted.
      expect(localDraft.fields).toEqual([field(UNSENT_VALUE)]);
      expect(scheduler.isDirty()).toBe(true);
      expect(
        collectCmsEditorialChangedValues(baseFields, localDraft.fields),
      ).toEqual({ [FIELD_A]: UNSENT_VALUE });
      expect(localDraft.baseRevision).toBe('4');
      expect(localDraft.expectedVersion).toBe('11');

      // The request that was refused is the one built from that value.
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        entryId: ENTRY_ID,
        baseRevision: '4',
        expectedVersion: '11',
        values: { [FIELD_A]: UNSENT_VALUE },
      });
    },
  );

  it('tells the author the edits are kept when assignment is revoked', () => {
    expect(
      cmsEditorialOutcomeMessage('forbidden', 'FORBIDDEN', null),
    ).toContain('Your unsent edits are kept in this browser only.');
  });

  it('positive control: a verified 201 is adopted, which the refusals above never are', async () => {
    const accepted = await runOwner(
      new Response(
        JSON.stringify({
          id: '018f0c45-73fe-7dc2-9c09-68f7ecf132df',
          version: '1',
          entryVersion: '12',
          createdAt: '2026-09-26T12:00:00+00:00',
          updatedAt: '2026-09-26T12:00:00+00:00',
          state: 'draft',
          entryId: ENTRY_ID,
          revisionNumber: '5',
          schemaVersionId: SCHEMA_VERSION_ID,
          templateVersionId: null,
          taxonomyVersionIds: [],
          locale: 'en-US',
          contentHash: 'a'.repeat(64),
          parentRevisionIds: [],
          validationState: 'valid',
          conflictId: null,
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
    expect(accepted.outcomes[0]).toBe('success');
    expect(accepted.adopted).toBeGreaterThan(0);
  });
});
