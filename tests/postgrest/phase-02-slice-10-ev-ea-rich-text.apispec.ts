/**
 * Slice 10 evidence lane EA, CMS-03B-01 `rich_text` through the real stack: browser request ->
 * first-party proxy -> production Worker -> production RPC adapter -> Kong -> PostgREST -> newest
 * SQL, against an active content type whose `body` field is a `rich_text` bound to the protected
 * `rich_text.v1` validator pair.
 *
 * A `rich_text` value is accepted only as the canonical `rich_text.v1` AST; every other document
 * is a typed 422 `rich_text_not_canonical` naming the field pointer, echoing nothing the caller
 * sent, and leaving the entry, revisions, audit and outbox untouched.
 *
 * Commits fixtures; run right after `pnpm db:reset` and reset again afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  type EditorialWorld,
  authorSession,
  prepareEditorialWorld,
} from './support/cms-editorial-world';
import { createIsolatedCmsOwner } from './support/cms-isolated-owner';
import {
  type EditorialStack,
  createEditorialStack,
} from './support/cms-editorial-stack';
import {
  type RichWorld,
  canonicalRichText,
  expectRefusal,
  prepareRichTextType,
  violation,
  snapshot,
} from './support/ev-ea-support';

let world: EditorialWorld;
let stack: EditorialStack;

beforeAll(async () => {
  world = await prepareEditorialWorld(createIsolatedCmsOwner());
  stack = createEditorialStack(authorSession(world));
});

describe('CMS-03B-01 rich_text through the real stack', () => {
  let rich: RichWorld;
  let richEntryId = '';
  let richVersion = '1';

  beforeAll(async () => {
    rich = await prepareRichTextType(world);
    const context = await stack.authoringContext();
    const type = (
      context.body.creatableTypes as readonly Record<string, unknown>[]
    ).find(
      (candidate) =>
        candidate.contentTypeVersionId === rich.contentTypeVersionId,
    ) as Record<string, unknown>;
    const created = await stack.create({
      contentTypeId: type.contentTypeId,
      contentTypeVersionId: type.contentTypeVersionId,
      locale: 'en-US',
      changedPaths: [
        `/fields/${rich.titleFieldId}`,
        `/fields/${rich.bodyFieldId}`,
      ],
      values: {
        [rich.titleFieldId]: 'Rich entry',
        [rich.bodyFieldId]: canonicalRichText('First body'),
      },
      schemaArtifact: type.schemaArtifact,
      validatorRefs: type.validatorRefs,
      workflowPolicy: type.workflowPolicy,
      activationEvidence: type.activationEvidence,
    });
    expect(created.status, created.text).toBe(201);
    richEntryId = (created.body.entry as { id: string }).id;
  });

  const richBody = (value: unknown) => ({
    entryId: richEntryId,
    baseRevision: '1',
    changedPaths: [`/fields/${rich.bodyFieldId}`],
    values: { [rich.bodyFieldId]: value },
    locale: 'en-US',
    expectedVersion: richVersion,
  });

  const nonCanonical: Readonly<Record<string, unknown>> = {
    'a raw string': '<p>raw html</p>',
    'a document with an unknown top-level key': {
      ...canonicalRichText('x'),
      extra: 1,
    },
    'a document with an empty block list': {
      format: 'rich_text.v1',
      blocks: [],
    },
    'a level-1 heading': {
      format: 'rich_text.v1',
      blocks: [
        { type: 'heading', level: 1, spans: [{ text: 'x', marks: [] }] },
      ],
    },
    'adjacent spans with equal marks that are not merged': {
      format: 'rich_text.v1',
      blocks: [
        {
          type: 'paragraph',
          spans: [
            { text: 'a', marks: [] },
            { text: 'b', marks: [] },
          ],
        },
      ],
    },
    'a javascript: link': {
      format: 'rich_text.v1',
      blocks: [
        {
          type: 'paragraph',
          spans: [
            {
              text: 'a',
              marks: [],
              link: { kind: 'https', href: 'javascript:alert(1)' },
            },
          ],
        },
      ],
    },
  };

  it.each(Object.entries(nonCanonical))(
    '%s is a typed 422 rich_text_not_canonical at the field pointer and nothing is written',
    async (_label, value) => {
      const before = snapshot(richEntryId);
      const response = await stack.append(richEntryId, richBody(value), {
        ifMatch: richVersion,
      });
      expectRefusal(
        response,
        {
          status: 422,
          code: 'VALIDATION_FAILED',
          violations: [
            violation(`/fields/${rich.bodyFieldId}`, 'rich_text_not_canonical'),
          ],
          details: { reasonCode: 'rich_text_not_canonical' },
        },
        richEntryId,
        before,
      );
      expect(response.text).not.toContain('raw html');
      expect(response.text).not.toContain('alert(1)');
    },
  );

  it('a canonical rich_text.v1 document is stored: 201 with the next entry version as the strong ETag', async () => {
    const response = await stack.append(
      richEntryId,
      richBody(canonicalRichText('Changed body')),
      { ifMatch: richVersion },
    );
    expect(response.status, response.text).toBe(201);
    richVersion = String(response.body.entryVersion);
    expect(richVersion).toBe('2');
    expect(response.headers.get('etag')).toBe('"2"');
    expect(response.body.validationState).toBe('valid');
  });
});
