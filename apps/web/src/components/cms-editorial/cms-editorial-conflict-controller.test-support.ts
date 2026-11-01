import { ConflictDetailResourceSchema } from '@wejammin/contracts';
import { vi } from 'vitest';

import { describeCmsAuthoringFields } from '../cms-editorial-fields/cms-field-descriptor-decode';
import { fieldUuid } from '../cms-editorial-fields/cms-field-fixtures.test-support';
import { createCmsEditorialConflictController } from './cms-editorial-conflict-controller';
import {
  conflictDetailBody,
  type ConflictPathOptions,
} from './cms-editorial-conflict-fixtures.test-support';
import { conflictInitFrom } from './cms-editorial-conflict-state';
import {
  BLURB,
  CONFLICT_ID,
  ENTRY_ID,
  HASH,
  INSTANT,
  TITLE,
  editorFields,
  json,
} from './cms-editorial-editor-fixtures.test-support';

export type Step = Response | Error;

export const twoPaths: readonly ConflictPathOptions[] = [
  {
    fieldId: TITLE,
    base: { value: 'Base title' },
    theirs: { value: 'Their title' },
    yours: { value: 'My title' },
  },
  {
    fieldId: BLURB,
    base: { value: null },
    theirs: { value: 'Their blurb' },
    yours: { value: 'My blurb' },
  },
];

export const init = (paths: readonly ConflictPathOptions[] = twoPaths) =>
  conflictInitFrom(
    ConflictDetailResourceSchema.parse(conflictDetailBody({ paths })),
    describeCmsAuthoringFields(editorFields()),
  );

export const resolved = (parents = [fieldUuid(0x701), fieldUuid(0x702)]) =>
  json(
    201,
    {
      id: fieldUuid(0x703),
      version: '1',
      entryVersion: '7',
      createdAt: INSTANT,
      updatedAt: INSTANT,
      state: 'draft',
      entryId: ENTRY_ID,
      revisionNumber: '4',
      schemaVersionId: fieldUuid(0x710),
      templateVersionId: null,
      taxonomyVersionIds: [],
      locale: 'en-US',
      contentHash: HASH,
      parentRevisionIds: parents,
      validationState: 'valid',
      conflictId: CONFLICT_ID,
    },
    { etag: '"7"', 'cache-control': 'no-store' },
  );

export const setup = (steps: readonly Step[], start = init()) => {
  const queue = [...steps];
  const calls: Array<{
    url: string;
    method: string;
    headers: Headers;
    body: string | null;
  }> = [];
  const onResolved = vi.fn();
  const controller = createCmsEditorialConflictController({
    init: start,
    csrfToken: () => 'csrf-token',
    newKey: (() => {
      let n = 0;
      return () => `resolve-key-${++n}`;
    })(),
    onResolved,
    fetcher: async (input, requestInit) => {
      calls.push({
        url: String(input),
        method: requestInit?.method ?? 'GET',
        headers: new Headers(requestInit?.headers),
        body: typeof requestInit?.body === 'string' ? requestInit.body : null,
      });
      const step = queue.shift();
      if (step === undefined) throw new Error(`unexpected ${String(input)}`);
      if (step instanceof Error) throw step;
      return step;
    },
  });
  return { controller, calls, onResolved };
};

export const bodyOf = (call: { body: string | null } | undefined) =>
  JSON.parse(call?.body ?? '{}') as Record<string, unknown>;
