/**
 * First-party request helpers for the Slice 10 real-route suites. Each call goes
 * through the SAME chain the browser uses (web proxy -> private binding ->
 * production Worker -> production RPC adapter -> Kong -> PostgREST -> SQL) with
 * the session cookies of a Playwright context, so a precondition the specs need
 * (an entry with history, a second author's entry) is produced by the real
 * commands and never by writing rows.
 */
import { test, type BrowserContext } from '@playwright/test';

import type { S10Principal, S10World } from './s10-real-world';
import { s10Session } from './s10-real-world';

export const ENTRIES_API = '/api/v1/cms/entries';
export const ENTRIES_PATH = '/app/cms-content-modeling/entries';

export type ApiResult = Readonly<{
  status: number;
  headers: Readonly<Record<string, string>>;
  body: Record<string, unknown>;
  text: string;
}>;

type WriteOptions = Readonly<{
  idempotencyKey?: string;
  ifMatch?: string;
}>;

const parse = (text: string): Record<string, unknown> => {
  try {
    const value: unknown = text === '' ? {} : JSON.parse(text);
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

/** The loopback web origin of the running real-route harness. */
const origin = (): string => {
  const base = test.info().project.use.baseURL;
  if (base === undefined) throw new Error('baseURL is not configured');
  return base;
};

export const createClient = (
  context: BrowserContext,
  world: S10World,
  principal: S10Principal,
  sessionNumber = 1,
) => {
  const csrf = s10Session(world, principal, sessionNumber).csrfToken;
  const send = async (
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    options: WriteOptions = {},
  ): Promise<ApiResult> => {
    const response = await context.request.fetch(`${origin()}${path}`, {
      method,
      headers: {
        origin: origin(),
        ...(method === 'POST'
          ? {
              'content-type': 'application/json',
              'x-csrf-token': csrf,
              'idempotency-key': options.idempotencyKey ?? crypto.randomUUID(),
              ...(options.ifMatch === undefined
                ? {}
                : { 'if-match': `"${options.ifMatch}"` }),
            }
          : {}),
      },
      ...(method === 'POST' ? { data: JSON.stringify(body) } : {}),
      failOnStatusCode: false,
      maxRedirects: 0,
    });
    const text = await response.text();
    return {
      status: response.status(),
      headers: response.headers(),
      body: parse(text),
      text,
    };
  };
  return {
    get: (path: string) => send('GET', path),
    post: (path: string, body: unknown, options?: WriteOptions) =>
      send('POST', path, body, options),
  };
};

export type S10Client = ReturnType<typeof createClient>;

/** The creatable type of the suite world, as the CMS-03B-14 projection serves it. */
export const readCreatableType = async (
  client: S10Client,
  world: S10World,
): Promise<Record<string, unknown>> => {
  const context = await client.get(`${ENTRIES_API}/authoring-context`);
  if (context.status !== 200)
    throw new Error(
      `CMS-03B-14 refused the author: ${context.status} ${context.text}`,
    );
  const found = (
    context.body.creatableTypes as readonly Record<string, unknown>[]
  ).find(
    (candidate) =>
      candidate.contentTypeVersionId === world.contentTypeVersionId,
  );
  if (found === undefined)
    throw new Error('The suite content type is not creatable by the author.');
  return found;
};

/** A CMS-03B-10 body built from the CMS-03B-14 projection (frozen evidence echoed). */
export const createBody = (
  world: S10World,
  type: Record<string, unknown>,
  values: Readonly<Record<string, unknown>>,
) => ({
  contentTypeId: type.contentTypeId,
  contentTypeVersionId: type.contentTypeVersionId,
  locale: 'en-US',
  changedPaths: Object.keys(values).map((fieldId) => `/fields/${fieldId}`),
  values,
  schemaArtifact: type.schemaArtifact,
  validatorRefs: type.validatorRefs,
  workflowPolicy: type.workflowPolicy,
  activationEvidence: type.activationEvidence,
});

export type SeededEntry = Readonly<{
  entryId: string;
  firstRevisionId: string;
  /** The entry version the next write must send as If-Match. */
  version: string;
  /** The revision number the next write must name as its base. */
  revision: string;
}>;

/** CMS-03B-10 through the real chain: one entry with its first draft revision. */
export const seedEntry = async (
  client: S10Client,
  world: S10World,
  title: string,
): Promise<SeededEntry> => {
  const type = await readCreatableType(client, world);
  const created = await client.post(
    ENTRIES_API,
    createBody(world, type, { [world.fields.title]: title }),
  );
  if (created.status !== 201)
    throw new Error(`CMS-03B-10 refused: ${created.status} ${created.text}`);
  const entry = created.body.entry as { id: string; version: string };
  const revision = created.body.revision as { id: string };
  return {
    entryId: entry.id,
    firstRevisionId: revision.id,
    version: entry.version,
    revision: String(created.body.revisionNumber),
  };
};

/** CMS-03B-01 through the real chain: one more revision on top of `from`. */
export const appendTitle = async (
  client: S10Client,
  world: S10World,
  from: SeededEntry,
  title: string,
): Promise<SeededEntry> => {
  const appended = await client.post(
    `${ENTRIES_API}/${from.entryId}/revisions`,
    {
      entryId: from.entryId,
      baseRevision: from.revision,
      changedPaths: [`/fields/${world.fields.title}`],
      values: { [world.fields.title]: title },
      locale: 'en-US',
      expectedVersion: from.version,
    },
    { ifMatch: from.version },
  );
  if (appended.status !== 201)
    throw new Error(`CMS-03B-01 refused: ${appended.status} ${appended.text}`);
  return {
    ...from,
    version: String(appended.body.entryVersion),
    revision: String(appended.body.revisionNumber),
  };
};
