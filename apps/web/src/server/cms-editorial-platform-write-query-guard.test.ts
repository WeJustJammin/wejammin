import { describe, expect, it, vi } from 'vitest';

import { forwardCmsEditorialConflictResolution } from './cms-editorial-platform-conflict';
import { forwardCmsEditorialEntryCreateMutation } from './cms-editorial-platform-mutation';
import {
  bindingWith,
  csrf,
  hash,
  idempotencyKey,
  instant,
  jsonResponse,
  origin,
  uuid,
  uuid2,
  validCreateBody,
  validCreateResource,
} from './cms-editorial-platform-proxies-hardening-test-support';
import { forwardCmsEditorialRevisionMutation } from './cms-editorial-platform-revision';

/*
 * CMS-03B-01, CMS-03B-02, and CMS-03B-10 declare no query member at all. The
 * BE03b registry row gives each one a request schema and a headers schema,
 * `querySchema` is reserved for the two safe reads, and the locked FE03
 * transport state pins `query: null` for these writes. A query string on one
 * of these commands is therefore unparsed caller input, so the first-party
 * proxy refuses it locally instead of dropping it on the way to the Worker.
 * cms-composition-platform-mutation, -pattern, -locale, and -detail already
 * hold this line, and cms-editorial-platform-restore holds it in this
 * directory; these cases extend the same boundary to the remaining three
 * CMS editorial writes.
 */

const thirdUuid = '123e4567-e89b-42d3-a456-426614174002';
const fourthUuid = '123e4567-e89b-42d3-a456-426614174003';

const revisionPath = `/app/cms-content-modeling/entries/${uuid}/revisions`;
const conflictPath = `/app/cms-content-modeling/entries/${uuid}/conflicts/${uuid2}/resolve`;
const createPath = '/app/cms-content-modeling/entries/new';

const mutationHeaders = (extra: Record<string, string> = {}) => ({
  origin,
  cookie: 'wj_csrf=' + csrf,
  'x-csrf-token': csrf,
  'idempotency-key': idempotencyKey,
  'content-type': 'application/json',
  'if-match': '"1"',
  ...extra,
});

/* CMS-03B-10 declares no If-Match member at all; a create never sends one. */
const createHeaders = (extra: Record<string, string> = {}) => ({
  origin,
  cookie: 'wj_csrf=' + csrf,
  'x-csrf-token': csrf,
  'idempotency-key': idempotencyKey,
  'content-type': 'application/json',
  ...extra,
});

const revisionBody = JSON.stringify({
  entryId: uuid,
  baseRevision: '1',
  changedPaths: [`/fields/${uuid2}`],
  values: { [uuid2]: { title: 'Hello' } },
  locale: 'en-US',
  expectedVersion: '1',
});

const conflictBody = JSON.stringify({
  entryId: uuid,
  conflictId: uuid2,
  baseRevision: '1',
  choices: [{ path: `/fields/${uuid2}`, choice: 'theirs' }],
  expectedVersion: '1',
});

const revisionResource = {
  id: uuid2,
  version: '1',
  entryVersion: '2',
  createdAt: instant,
  updatedAt: instant,
  state: 'draft',
  entryId: uuid,
  revisionNumber: '1',
  schemaVersionId: thirdUuid,
  templateVersionId: null,
  taxonomyVersionIds: [],
  locale: 'en-US',
  contentHash: hash,
  parentRevisionIds: [],
  validationState: 'valid',
  conflictId: null,
} as const;

const conflictRevisionResource = {
  ...revisionResource,
  id: fourthUuid,
  parentRevisionIds: [uuid, uuid2],
  conflictId: uuid2,
} as const;

const revisionUpstream = async () =>
  jsonResponse(revisionResource, {
    status: 201,
    headers: {
      etag: '"2"',
      location: `/api/v1/cms/entries/${uuid}/revisions/${uuid2}`,
    },
  });

const conflictUpstream = async () =>
  jsonResponse(conflictRevisionResource, {
    status: 201,
    headers: {
      etag: '"2"',
      location: `/api/v1/cms/entries/${uuid}/revisions/${fourthUuid}`,
    },
  });

const createUpstream = async () =>
  jsonResponse(validCreateResource, {
    status: 201,
    headers: { location: `/api/v1/cms/entries/${uuid}` },
  });

/* The locked refusal: 400 INVALID_REQUEST, no-store, and no upstream call. */
const expectRefusedBeforeForwarding = async (
  response: Response,
  upstream: { fetch: unknown },
): Promise<void> => {
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    code: 'INVALID_REQUEST',
    details: {},
  });
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(upstream.fetch).not.toHaveBeenCalled();
};

describe('CMS-03B-01 revision proxy undeclared query', () => {
  it('refuses ?ownerId before forwarding the revision write', async () => {
    const upstream = bindingWith(vi.fn(revisionUpstream));
    const request = new Request(`${origin}${revisionPath}?ownerId=${uuid}`, {
      method: 'POST',
      headers: mutationHeaders(),
      body: revisionBody,
    });

    const response = await forwardCmsEditorialRevisionMutation(
      request,
      uuid,
      upstream,
    );

    await expectRefusedBeforeForwarding(response, upstream);
  });

  it('still forwards the declared revision command with no query', async () => {
    const request = new Request(`${origin}${revisionPath}`, {
      method: 'POST',
      headers: mutationHeaders(),
      body: revisionBody,
    });

    const response = await forwardCmsEditorialRevisionMutation(
      request,
      uuid,
      bindingWith(vi.fn(revisionUpstream)),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/entries/${uuid}/revisions/${uuid2}`,
    );
  });
});

describe('CMS-03B-02 conflict resolution proxy undeclared query', () => {
  it('refuses ?ownerId before forwarding the resolution write', async () => {
    const upstream = bindingWith(vi.fn(conflictUpstream));
    const request = new Request(`${origin}${conflictPath}?ownerId=${uuid}`, {
      method: 'POST',
      headers: mutationHeaders(),
      body: conflictBody,
    });

    const response = await forwardCmsEditorialConflictResolution(
      request,
      uuid,
      uuid2,
      upstream,
    );

    await expectRefusedBeforeForwarding(response, upstream);
  });

  it('still forwards the declared resolution command with no query', async () => {
    const request = new Request(`${origin}${conflictPath}`, {
      method: 'POST',
      headers: mutationHeaders(),
      body: conflictBody,
    });

    const response = await forwardCmsEditorialConflictResolution(
      request,
      uuid,
      uuid2,
      bindingWith(vi.fn(conflictUpstream)),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/entries/${uuid}/revisions/${fourthUuid}`,
    );
  });
});

describe('CMS-03B-10 entry create proxy undeclared query', () => {
  it('refuses ?ownerId before forwarding the create write', async () => {
    const upstream = bindingWith(vi.fn(createUpstream));
    const request = new Request(`${origin}${createPath}?ownerId=${uuid}`, {
      method: 'POST',
      headers: createHeaders(),
      body: validCreateBody,
    });

    const response = await forwardCmsEditorialEntryCreateMutation(
      request,
      upstream,
    );

    await expectRefusedBeforeForwarding(response, upstream);
  });

  it('still forwards the declared create command with no query', async () => {
    const request = new Request(`${origin}${createPath}`, {
      method: 'POST',
      headers: createHeaders(),
      body: validCreateBody,
    });

    const response = await forwardCmsEditorialEntryCreateMutation(
      request,
      bindingWith(vi.fn(createUpstream)),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/entries/${uuid}`,
    );
  });
});
