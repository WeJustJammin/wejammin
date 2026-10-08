/**
 * Slice 10 evidence lane EA (AC-008, AC-014): the typed 422 value reasons of BE03b "Value encodings
 * by field kind" through the real stack: browser request -> first-party proxy -> production Worker
 * -> production RPC adapter -> Kong -> PostgREST -> newest SQL, against an ACTIVE content type
 * with one field of every kind that carries a reason (`rich_text`, DEC-133 `object`, `taxonomy`,
 * `media` and a domain-kind `relation`).
 *
 * Each reason is a typed 422 `VALIDATION_FAILED` whose `reasonCode` is that reason and whose single
 * violation names the field pointer and carries the reason as its stable code; nothing the caller
 * sent is echoed and the database-wide snapshot (entries, revisions, values, relations, conflicts,
 * reservations, outbox, audit) is unchanged. CMS-03B-01 carries all five; CMS-03B-02 carries the
 * two whose field can be in conflict with an admitted value (`rich_text`, `object`). The same
 * request with an ADMITTED value is the 201, so every refusal depends on the value.
 *
 * Commits fixtures; run right after `pnpm db:reset` and reset again afterwards.
 */
import { randomUUID } from 'node:crypto';

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
  canonicalRichText,
  expectRefusal,
  snapshot,
  violation,
} from './support/ev-ea-support';
import {
  type TypedWorld,
  createTypedEntry,
  prepareTypedValueType,
} from './support/ev-ea-typed-support';

let world: EditorialWorld;
let stack: EditorialStack;
let typed: TypedWorld;

beforeAll(async () => {
  world = await prepareEditorialWorld(createIsolatedCmsOwner());
  stack = createEditorialStack(authorSession(world));
  typed = await prepareTypedValueType(world);
});

const path = (key: keyof TypedWorld['fields']): string =>
  `/fields/${typed.fields[key]}`;

const appendBody = (
  entryId: string,
  values: Readonly<Record<string, unknown>>,
  expectedVersion: string,
  baseRevision = '1',
) => ({
  entryId,
  baseRevision,
  changedPaths: Object.keys(values).map((id) => `/fields/${id}`),
  values,
  locale: 'en-US',
  expectedVersion,
});

type Reason = Readonly<{
  label: string;
  reason: string;
  field: keyof TypedWorld['fields'];
  value: () => unknown;
}>;

const REASONS: readonly Reason[] = [
  {
    label: 'a raw string for a rich_text field',
    reason: 'rich_text_not_canonical',
    field: 'body',
    value: () => '<p>raw</p>',
  },
  {
    label: 'an object with an undeclared property',
    reason: 'object_property_invalid',
    field: 'meta',
    value: () => ({ label: 'x', extra: 1 }),
  },
  {
    label: 'a non-empty taxonomy value',
    reason: 'taxonomy_source_unavailable',
    field: 'tags',
    value: () => ({ termIds: [randomUUID()] }),
  },
  {
    label: 'a non-empty media value',
    reason: 'media_source_unavailable',
    field: 'hero',
    value: () => ({ assetId: randomUUID(), assetVersion: '1' }),
  },
  {
    label: 'a non-empty relation to a domain target with no projection',
    reason: 'relation_target_unavailable',
    field: 'people',
    value: () => ({
      targets: [{ targetId: randomUUID(), expectedTargetVersion: null }],
    }),
  },
];

describe('CMS-03B-01 typed value reasons through the real stack', () => {
  let entryId = '';

  beforeAll(async () => {
    entryId = await createTypedEntry(stack, typed);
  });

  it.each(REASONS)(
    '$label is the typed 422 $reason at its field pointer and nothing is written',
    async (testCase) => {
      const before = snapshot(entryId);
      const response = await stack.append(
        entryId,
        appendBody(
          entryId,
          { [typed.fields[testCase.field]]: testCase.value() },
          '1',
        ),
        { ifMatch: '1' },
      );
      expectRefusal(
        response,
        {
          status: 422,
          code: 'VALIDATION_FAILED',
          violations: [violation(path(testCase.field), testCase.reason)],
          details: { reasonCode: testCase.reason },
        },
        entryId,
        before,
      );
      expect(response.text).not.toContain('<p>raw</p>');
    },
  );

  it('the same fields with ADMITTED values commit: a canonical document, a structure-valid object, empty taxonomy and relation', async () => {
    const response = await stack.append(
      entryId,
      appendBody(
        entryId,
        {
          [typed.fields.body]: canonicalRichText('Second body'),
          [typed.fields.meta]: { label: 'Second' },
          [typed.fields.tags]: { termIds: [] },
          [typed.fields.people]: { targets: [] },
        },
        '1',
      ),
      { ifMatch: '1' },
    );
    expect(response.status, response.text).toBe(201);
    expect(response.headers.get('etag')).toBe('"2"');
  });
});

describe('CMS-03B-02 typed value reasons through the real stack', () => {
  let entryId = '';
  let conflictId = '';

  beforeAll(async () => {
    entryId = await createTypedEntry(stack, typed);
    const theirs = await stack.append(
      entryId,
      appendBody(
        entryId,
        {
          [typed.fields.body]: canonicalRichText('Theirs'),
          [typed.fields.meta]: { label: 'Theirs' },
        },
        '1',
      ),
      { ifMatch: '1' },
    );
    expect(theirs.status, theirs.text).toBe(201);
    const clash = await stack.append(
      entryId,
      appendBody(
        entryId,
        {
          [typed.fields.body]: canonicalRichText('Mine'),
          [typed.fields.meta]: { label: 'Mine' },
        },
        '2',
      ),
      { ifMatch: '2' },
    );
    expect(clash.status, clash.text).toBe(409);
    const draft = await stack.draftDetail(entryId);
    expect(draft.status, draft.text).toBe(200);
    conflictId = (draft.body.openConflict as { conflictId: string }).conflictId;
  });

  const resolveBody = (choices: readonly unknown[]) => ({
    entryId,
    conflictId,
    baseRevision: '1',
    choices,
    expectedVersion: '2',
  });

  const EXPLICIT = REASONS.filter(
    (candidate) => candidate.field === 'body' || candidate.field === 'meta',
  );

  it.each(EXPLICIT)(
    'an explicit choice with $label is the typed 422 $reason at its field pointer and nothing is written',
    async (testCase) => {
      const other = testCase.field === 'body' ? 'meta' : 'body';
      const before = snapshot(entryId);
      const response = await stack.resolve(
        entryId,
        conflictId,
        resolveBody([
          {
            path: path(testCase.field),
            choice: 'explicit',
            value: testCase.value(),
          },
          { path: path(other), choice: 'theirs' },
        ]),
        { ifMatch: '2' },
      );
      expectRefusal(
        response,
        {
          status: 422,
          code: 'VALIDATION_FAILED',
          violations: [violation(path(testCase.field), testCase.reason)],
          details: { reasonCode: testCase.reason },
        },
        entryId,
        before,
      );
    },
  );

  it('explicit choices with ADMITTED values resolve the same conflict once', async () => {
    const response = await stack.resolve(
      entryId,
      conflictId,
      resolveBody([
        {
          path: path('body'),
          choice: 'explicit',
          value: canonicalRichText('Merged'),
        },
        {
          path: path('meta'),
          choice: 'explicit',
          value: { label: 'Merged' },
        },
      ]),
      { ifMatch: '2' },
    );
    expect(response.status, response.text).toBe(201);
    expect(response.headers.get('etag')).toBe('"3"');
  });
});
