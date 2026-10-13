import { describe, expect, it, vi } from 'vitest';

import {
  ENTRY_ID,
  REVISION_ID,
  SCHEMA_VERSION_ID,
  apiError,
  jsonResponse,
  workflowFixture,
} from '../cms-editorial-workflow/cms-workflow-fixtures.test-support';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import { loadWorkflowPage } from './load-workflow-page';

const ROUTE = `/app/cms-content-modeling/entries/${ENTRY_ID}/workflow`;

const load = (
  response: Response | undefined,
  search = '',
  entryId = ENTRY_ID,
) => {
  const workflow = vi.fn(async () => response as Response);
  const outcome = loadWorkflowPage({
    request: new Request(`https://web.test${ROUTE}${search}`),
    entryId,
    reads: { workflow } as unknown as CmsEditorialPageReads,
  });
  return { outcome, workflow };
};

describe('loadWorkflowPage', () => {
  it('returns the verified workflow with the URL-owned revision for the island', async () => {
    const resource = workflowFixture();
    const { outcome, workflow } = load(
      jsonResponse(200, resource, { etag: '"x"' }),
      `?revisionId=${REVISION_ID}`,
    );
    const result = await outcome;
    expect(workflow).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe('view');
    if (result.kind !== 'view') return;
    expect(result).toMatchObject({
      status: 200,
      title: 'Review and publish',
      heading: 'Review and publish',
    });
    expect(result.view).toMatchObject({
      entryId: ENTRY_ID,
      revisionId: REVISION_ID,
      routePath: ROUTE,
    });
    expect(result.view.workflow).toEqual(resource);
    expect(new Date(result.view.verifiedAt).toISOString()).toBe(
      result.view.verifiedAt,
    );
  });

  it('carries no revision when the URL names none', async () => {
    const result = await load(jsonResponse(200, workflowFixture())).outcome;
    expect(result.kind === 'view' && result.view.revisionId).toBeNull();
  });

  it('refuses a malformed entry id as 400 without an upstream call', async () => {
    const { outcome, workflow } = load(undefined, '', 'nope');
    const result = await outcome;
    expect(result.kind === 'notice' && result.notice.status).toBe(400);
    expect(result.kind === 'notice' && result.notice.heading).toBe(
      'Invalid request',
    );
    expect(workflow).not.toHaveBeenCalled();
  });

  it('returns an expired session to this exact workflow position', async () => {
    const result = await load(
      new Response('x', { status: 401 }),
      `?revisionId=${REVISION_ID}`,
    ).outcome;
    expect(result).toEqual({
      kind: 'redirect',
      location: `/auth/sign-in?returnTo=${encodeURIComponent(`${ROUTE}?revisionId=${REVISION_ID}`)}`,
    });
  });

  it.each([
    [403, 'Access denied', 'This account cannot read this entry workflow.'],
    [404, 'Not found', 'This entry or revision is not available.'],
    [429, 'Too many requests', 'Too many requests. Try again shortly.'],
    [
      503,
      'Temporarily unavailable',
      'The editorial service is not responding. Nothing was loaded; try again shortly.',
    ],
  ])('renders a %i as one closed state', async (status, heading, message) => {
    const result = await load(jsonResponse(status, apiError('X'))).outcome;
    expect(result.kind === 'notice' && result.notice.heading).toBe(heading);
    expect(result.kind === 'notice' && result.notice.message).toBe(message);
  });

  it('restarts a refused query at the bare workflow route', async () => {
    const result = await load(
      jsonResponse(400, apiError('INVALID_REQUEST')),
      '?revisionId=bogus',
    ).outcome;
    expect(result.kind === 'notice' && result.notice.retryHref).toBe(ROUTE);
  });

  it('refuses a 200 that is not the strict workflow or names another entry', async () => {
    for (const response of [
      jsonResponse(200, { entry: 1 }),
      new Response('nope', { status: 200 }),
      jsonResponse(
        200,
        workflowFixture({
          entry: {
            id: SCHEMA_VERSION_ID,
            version: '7',
            createdAt: '2026-10-08T12:00:00Z',
            updatedAt: '2026-10-08T12:00:00Z',
          },
        }),
      ),
    ]) {
      const result = await load(response).outcome;
      expect(result.kind === 'notice' && result.notice.status).toBe(502);
    }
  });
});
