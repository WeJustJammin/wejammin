/**
 * AC064 (re-audit): the missing/null distinction of a field default holds across
 * the contract, the Worker and the database.
 *
 * BE03a types `defaultValue` as Json.nullable().optional() and derives hasDefault
 * from the key being present, so { defaultMode: 'literal', defaultValue: null } is
 * a valid literal default (the value is JSON null) and only a missing key is not.
 * The contract and the Worker accepted it while the database refused it with
 * INVALID_REQUEST, so production answered 400 to a request the contract calls
 * valid. Here the request goes browser -> production Hono app -> production RPC
 * adapter -> Kong -> PostgREST -> database, and the database's answer is read back.
 *
 * Commits fixtures (the owner's content types): run right after `pnpm db:reset`.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  type CmsApp,
  createCmsApp,
  draftTypeBody,
  ownerSession,
} from './support/cms-app';
import { type CmsOwner, ensureCmsOwner, psql } from './support/stack';

let owner: CmsOwner;
let app: CmsApp;
let fieldsPath = '';
let versionId = '';

/** `mode|jsonb value|is SQL NULL` of a stored field default, read straight from the table. */
const storedDefault = (version: string, key: string): string =>
  psql(`select default_mode || '|' || coalesce(default_value::text, 'SQL NULL') || '|' || (default_value is null)
          from platform_private.cms_field_definition_versions
         where content_type_version_id = '${version}' and field_key = '${key}'`);

const unique = (prefix: string): string =>
  `${prefix}_${randomUUID().slice(0, 8).replaceAll('-', '')}`;

const fieldBody = (
  key: string,
  overrides: Readonly<Record<string, unknown>>,
): Record<string, unknown> => ({
  key,
  kind: 'short_text',
  constraints: {},
  required: false,
  validatorKey: null,
  validatorVersion: null,
  defaultMode: 'none',
  localizationMode: 'none',
  editorConfig: { label: key, order: 1 },
  lifecycle: 'active',
  migrationPlanId: null,
  ...overrides,
});

beforeAll(async () => {
  owner = ensureCmsOwner();
  app = createCmsApp(
    ownerSession(owner.authUserId, owner.organizationId, [
      'cms.schema_designer',
    ]),
  );
  const created = await app.send('POST', '/api/v1/cms/content-types', {
    body: draftTypeBody(unique('defnull')),
  });
  expect(created.status).toBe(201);
  versionId = String(created.body.id);
  fieldsPath = `/api/v1/cms/content-types/${String(created.body.contentTypeId)}/versions/${versionId}/fields`;
});

describe('AC064 a literal default of JSON null through the production Worker against the real database', () => {
  it('[P2-S09-AC-064] CMS-03A-02 accepts defaultMode literal with an explicit JSON null and returns the null default', async () => {
    app.clearObserved();
    const added = await app.send('POST', fieldsPath, {
      body: fieldBody('nulldef', {
        defaultMode: 'literal',
        defaultValue: null,
      }),
      ifMatch: '1',
    });
    expect(app.observed().map((entry) => entry.message)).toEqual(['']);
    expect(added.status).toBe(201);
    // FieldDefinitionVersionResource (BE03a) carries the mode, never the value.
    expect(added.body).toMatchObject({
      key: 'nulldef',
      defaultMode: 'literal',
    });
    expect(storedDefault(versionId, 'nulldef')).toBe('literal|null|false');
  });

  it('[P2-S09-AC-064] the missing key stays distinct: a literal default without defaultValue, and none or inherited with an explicit null, are refused', async () => {
    const missing = await app.send('POST', fieldsPath, {
      body: fieldBody('nodefval', { defaultMode: 'literal' }),
      ifMatch: '2',
    });
    expect(missing.status).toBe(422);
    for (const defaultMode of ['none', 'inherited']) {
      const present = await app.send('POST', fieldsPath, {
        body: fieldBody(`pres${defaultMode}`, {
          defaultMode,
          defaultValue: null,
        }),
        ifMatch: '2',
      });
      expect(present.status).toBe(422);
    }
  });

  it('[P2-S09-AC-064] CMS-03A-01 commits an initial field whose literal default is JSON null, stored as the JSON value and distinct from a missing default', async () => {
    const body = draftTypeBody(unique('defnull1'));
    const fields = body.fields as Record<string, unknown>[];
    body.fields = [
      ...fields,
      {
        stableFieldId: randomUUID(),
        key: 'nulldef',
        kind: 'short_text',
        constraints: {},
        required: false,
        validatorKey: null,
        validatorVersion: null,
        defaultMode: 'literal',
        defaultValue: null,
        localizationMode: 'none',
        editorConfig: { label: 'Null default', order: 1 },
        lifecycle: 'active',
      },
    ];
    app.clearObserved();
    const created = await app.send('POST', '/api/v1/cms/content-types', {
      body,
    });
    expect(app.observed().map((entry) => entry.message)).toEqual(['']);
    expect(created.status).toBe(201);
    expect(storedDefault(String(created.body.id), 'nulldef')).toBe(
      'literal|null|false',
    );
    expect(storedDefault(String(created.body.id), 'title')).toBe(
      'none|SQL NULL|true',
    );
  });
});
