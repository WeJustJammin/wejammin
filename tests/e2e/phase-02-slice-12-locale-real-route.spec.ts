import { expect, test } from '@playwright/test';

import { authenticateLocalSession } from './support/local-signed-session';

const ENTRY_ID = 'd1000000-0000-4000-8000-000000000001';
const SOURCE_REVISION_ID = 'd1000000-0000-4000-8000-000000000002';
const FIELD_ID = 'd1000000-0000-4000-8000-000000000005';
const PATH = `/api/v1/cms/entries/${ENTRY_ID}/locales/fr-FR/variants`;
const CSRF = 's12-locale-real-route-csrf';
const body = {
  entryId: ENTRY_ID,
  locale: 'fr-FR',
  sourceRevisionId: SOURCE_REVISION_ID,
  fields: [{ fieldId: FIELD_ID, value: 'Titre traduit' }],
  fallbackChain: ['en-US'],
  noFallbackFieldIds: [],
  sourceHash: 'a'.repeat(64),
  expectedVersion: '1',
};

test('CMS-15 sends protected locale drafts through built Astro and Worker routes in Chrome', async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);
  await authenticateLocalSession(context, { csrfToken: CSRF });
  const response = await page.goto(
    '/app/cms-content-modeling/templates/release-note',
    { waitUntil: 'domcontentloaded' },
  );
  expect(response?.status()).toBe(200);

  const author = (expectedVersion: string, attempt: string, csrfToken = CSRF) =>
    page.evaluate(
      async ({ path, requestBody, token, attemptId }) => {
        const result = await fetch(path, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json',
            'idempotency-key': `locale-command-${attemptId}`,
            'if-match': `"${requestBody.expectedVersion}"`,
            'x-csrf-token': token,
          },
          body: JSON.stringify(requestBody),
        });
        return {
          status: result.status,
          etag: result.headers.get('etag'),
          cacheControl: result.headers.get('cache-control'),
          body: await result.json(),
        };
      },
      {
        path: PATH,
        requestBody: { ...body, expectedVersion },
        token: csrfToken,
        attemptId: attempt,
      },
    );

  const denied = await author('1', 'bad-csrf', 'wrong-csrf');
  expect(denied.status).toBe(403);
  expect(denied.body).toMatchObject({ code: 'LOCALE_FORBIDDEN' });

  const first = await author('1', 'first-write');
  expect(first.status).toBe(201);
  expect(first.etag).toBe('"2"');
  expect(first.cacheControl).toBe('no-store');
  expect(first.body).toMatchObject({
    entryId: ENTRY_ID,
    locale: 'fr-FR',
    sourceRevisionId: SOURCE_REVISION_ID,
    state: 'draft',
    fallbackChain: ['en-US'],
    noFallbackFieldIds: [],
  });
  expect(first.body).not.toHaveProperty('ownerId');

  const stale = await author('1', 'stale-write');
  expect(stale.status).toBe(409);
  expect(stale.body).toMatchObject({
    code: 'LOCALE_VERSION_CONFLICT',
    details: { expectedVersion: '1', currentVersion: '2' },
  });

  const rebased = await author('2', 'rebased-write');
  expect(rebased.status).toBe(201);
  expect(rebased.etag).toBe('"3"');
});
