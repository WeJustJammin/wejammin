import { ApiErrorSchema } from '@wejammin/contracts';

import { forwardCmsEditorialConflictResolution } from './cms-editorial-platform-conflict';
import { forwardCmsEditorialEntryCreateMutation } from './cms-editorial-platform-mutation';
import {
  forwardCmsEditorialAuthoringContextRead,
  forwardCmsEditorialConflictDetailRead,
  forwardCmsEditorialEntryDraftDetailRead,
  forwardCmsEditorialEntryListRead,
  forwardCmsEditorialRevisionHistoryRead,
} from './cms-editorial-platform-reads';
import { forwardCmsEditorialRevisionRestore } from './cms-editorial-platform-restore';
import { forwardCmsEditorialRevisionMutation } from './cms-editorial-platform-revision';
import {
  bindingWith,
  csrf,
  idempotencyKey,
  origin,
  uuid,
  uuid2,
  validCreateBody,
} from './cms-editorial-platform-proxies-hardening-test-support';

/**
 * Shared matrix for the Slice 10 web boundary hardening suites: the four
 * command proxies and the five read proxies driven with valid browser requests
 * against a faked private binding.
 */

export { bindingWith, idempotencyKey, origin, uuid, uuid2, validCreateBody };

export const uuid3 = '123e4567-e89b-42d3-a456-426614174002';
export const requestId = '123e4567-e89b-42d3-a456-426614174099';
export const HOSTILE = 'SQLSTATE 23505 duplicate key tenant=acme-secret';

export const writeHeaders = (extra: Record<string, string> = {}) => ({
  cookie: `wj_csrf=${csrf}`,
  'x-csrf-token': csrf,
  'idempotency-key': idempotencyKey,
  'content-type': 'application/json',
  ...extra,
});
export const write = (
  path: string,
  body: unknown,
  extra: Record<string, string> = {},
  signal?: AbortSignal,
) =>
  new Request(`${origin}${path}`, {
    method: 'POST',
    headers: writeHeaders(extra),
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...(signal === undefined ? {} : { signal }),
  });
export const read = (path: string, signal?: AbortSignal) =>
  new Request(`${origin}${path}`, {
    method: 'GET',
    ...(signal === undefined ? {} : { signal }),
  });

export const revisionBody = {
  entryId: uuid,
  baseRevision: '1',
  changedPaths: [`/fields/${uuid2}`],
  values: { [uuid2]: { title: 'x' } },
  locale: 'en-US',
  expectedVersion: '1',
};
export const conflictBody = {
  entryId: uuid,
  conflictId: uuid2,
  baseRevision: '1',
  choices: [{ path: `/fields/${uuid2}`, choice: 'theirs' }],
  expectedVersion: '1',
};
export const restoreBody = {
  entryId: uuid,
  revisionId: uuid2,
  migrationChainId: uuid3,
  expectedVersion: '1',
};

export type Binding = ReturnType<typeof bindingWith>;
export type Proxy = Readonly<{
  name: string;
  call: (binding: Binding, signal?: AbortSignal) => Promise<Response>;
}>;

export const WRITES: readonly Proxy[] = [
  {
    name: 'create',
    call: (binding, signal) =>
      forwardCmsEditorialEntryCreateMutation(
        write('/api/v1/cms/entries', validCreateBody, {}, signal),
        binding,
      ),
  },
  {
    name: 'revision',
    call: (binding, signal) =>
      forwardCmsEditorialRevisionMutation(
        write(
          `/api/v1/cms/entries/${uuid}/revisions`,
          revisionBody,
          { 'if-match': '"1"' },
          signal,
        ),
        uuid,
        binding,
      ),
  },
  {
    name: 'conflict',
    call: (binding, signal) =>
      forwardCmsEditorialConflictResolution(
        write(
          `/api/v1/cms/entries/${uuid}/conflicts/${uuid2}/resolve`,
          conflictBody,
          { 'if-match': '"1"' },
          signal,
        ),
        uuid,
        uuid2,
        binding,
      ),
  },
  {
    name: 'restore',
    call: (binding, signal) =>
      forwardCmsEditorialRevisionRestore(
        write(
          `/api/v1/cms/entries/${uuid}/revisions/${uuid2}/restore`,
          restoreBody,
          { 'if-match': '"1"' },
          signal,
        ),
        uuid,
        uuid2,
        binding,
      ),
  },
];

export const READS: readonly Proxy[] = [
  {
    name: 'draft detail',
    call: (binding, signal) =>
      forwardCmsEditorialEntryDraftDetailRead(
        read(`/api/v1/cms/entries/${uuid}`, signal),
        binding,
        uuid,
      ),
  },
  {
    name: 'history',
    call: (binding, signal) =>
      forwardCmsEditorialRevisionHistoryRead(
        read(`/api/v1/cms/entries/${uuid}/revisions`, signal),
        binding,
        uuid,
      ),
  },
  {
    name: 'conflict detail',
    call: (binding, signal) =>
      forwardCmsEditorialConflictDetailRead(
        read(`/api/v1/cms/entries/${uuid}/conflicts/${uuid2}`, signal),
        uuid,
        uuid2,
        binding,
      ),
  },
  {
    name: 'entry list',
    call: (binding, signal) =>
      forwardCmsEditorialEntryListRead(
        read('/api/v1/cms/entries', signal),
        binding,
      ),
  },
  {
    name: 'authoring context',
    call: (binding, signal) =>
      forwardCmsEditorialAuthoringContextRead(
        read('/api/v1/cms/entries/authoring-context', signal),
        binding,
      ),
  },
];

export const apiError = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
  message = HOSTILE,
): Response => Response.json({ code, message, details, requestId }, { status });

export const bodyOf = async (response: Response) =>
  ApiErrorSchema.parse(await response.json());
