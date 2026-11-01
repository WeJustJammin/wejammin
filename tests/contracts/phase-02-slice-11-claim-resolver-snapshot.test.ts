import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  CLAIM_RESOLVER_TABLES,
  decodeClaimResolverSnapshot,
  type ClaimResolverSnapshot,
} from '../postgrest/support/phase-02-slice-11-claim-resolver-snapshot-core';

const MARKER = 'private-snapshot-value-must-not-enter-diagnostics';
const SHA = 'a'.repeat(64);
const JOBS = 'platform_private.jobs';
const messages = {
  json: 'claim resolver snapshot is not JSON',
  object: 'claim resolver snapshot is not an object',
  groups: 'claim resolver snapshot groups differ from the closed set',
  group: 'claim resolver snapshot group is not an object',
  members: 'claim resolver snapshot group members differ from {count,sha}',
  count: 'claim resolver snapshot group has no safe integer count',
  sha: 'claim resolver snapshot group has no sha256 digest',
};
const payload = (): Record<string, unknown> =>
  Object.fromEntries(
    CLAIM_RESOLVER_TABLES.map((table, index) => [
      table,
      {
        count: index,
        sha: index.toString(16).repeat(64),
      },
    ]),
  );
const encodedGroup = (count: unknown, sha: unknown = SHA): string =>
  JSON.stringify({ ...payload(), [JOBS]: { count, sha } });

// Never hand the rejected payload or caught error to a Vitest failure printer.
const refuses = (raw: string, message: string): void => {
  let caught = false;
  let fixedMessage = false;
  try {
    decodeClaimResolverSnapshot(raw);
  } catch (error) {
    caught = true;
    fixedMessage = error instanceof Error && error.message === message;
  }
  expect(caught, 'decoder refused the payload').toBe(true);
  expect(fixedMessage, 'decoder used the fixed diagnostic').toBe(true);
};

describe('additional claim resolver snapshot decoder', () => {
  it('observes exactly the thirteen additional resolver tables', () => {
    expect(CLAIM_RESOLVER_TABLES).toEqual([
      'platform_private.jobs',
      'platform_private.processed_events',
      'platform_private.cms_content_types',
      'platform_private.cms_content_type_versions',
      'platform_private.cms_field_definition_versions',
      'platform_private.cms_relation_definitions',
      'platform_private.cms_content_type_template_bindings',
      'platform_private.cms_content_type_capability_bindings',
      'platform_private.cms_schema_artifacts',
      'platform_private.cms_schema_migration_plans',
      'platform_private.cms_schema_dry_run_reports',
      'platform_private.cms_schema_dry_run_row_evidence',
      'platform_private.cms_schema_migration_target_rows',
    ]);
  });
  it('decodes every exact group to its typed count and full digest', () => {
    const decoded = decodeClaimResolverSnapshot(JSON.stringify(payload()));
    expectTypeOf(decoded).toEqualTypeOf<ClaimResolverSnapshot>();
    expect(decoded).toEqual(
      Object.fromEntries(
        CLAIM_RESOLVER_TABLES.map((table, index) => [
          table,
          `${index}:${index.toString(16).repeat(64)}`,
        ]),
      ),
    );
    expect(Object.isFrozen(decoded)).toBe(true);
  });
  it('accepts reordered closed groups and reordered count-sha members', () => {
    const reordered = Object.fromEntries(
      [...CLAIM_RESOLVER_TABLES]
        .reverse()
        .map((table) => [table, { sha: SHA, count: 2 }]),
    );
    expect(decodeClaimResolverSnapshot(JSON.stringify(reordered))).toEqual(
      Object.fromEntries(
        CLAIM_RESOLVER_TABLES.map((table) => [table, `2:${SHA}`]),
      ),
    );
  });
  it('accepts zero-count groups without omitting any digest', () => {
    const raw = JSON.stringify(
      Object.fromEntries(
        CLAIM_RESOLVER_TABLES.map((table) => [table, { count: 0, sha: SHA }]),
      ),
    );
    expect(decodeClaimResolverSnapshot(raw)).toEqual(
      Object.fromEntries(
        CLAIM_RESOLVER_TABLES.map((table) => [table, `0:${SHA}`]),
      ),
    );
  });
  it('preserves the largest exactly representable integer count', () => {
    const decoded = decodeClaimResolverSnapshot(
      encodedGroup(Number.MAX_SAFE_INTEGER),
    );
    expect(decoded[JOBS]).toBe(`9007199254740991:${SHA}`);
  });

  it.each([
    { label: 'empty text', raw: '' },
    { label: 'truncated object', raw: '{' },
    { label: 'private marker', raw: MARKER },
  ])('rejects malformed JSON: $label', ({ raw }) =>
    refuses(raw, messages.json),
  );
  it.each([
    { label: 'null', value: null },
    { label: 'array', value: [] },
    { label: 'number', value: 1 },
    { label: 'boolean', value: true },
    { label: 'private string', value: MARKER },
  ])('rejects nonrecord outer $label', ({ value }) => {
    refuses(JSON.stringify(value), messages.object);
  });
  it.each(CLAIM_RESOLVER_TABLES)('rejects omitted group %s', (table) => {
    const value = payload();
    delete value[table];
    refuses(JSON.stringify(value), messages.groups);
  });
  it.each(CLAIM_RESOLVER_TABLES)(
    'rejects renamed group %s at unchanged group count',
    (table) => {
      const value = payload();
      const removed = value[table];
      delete value[table];
      value[MARKER] = removed;
      expect(Object.keys(value)).toHaveLength(13);
      refuses(JSON.stringify(value), messages.groups);
    },
  );
  it('rejects an additional group without exposing its name or contents', () => {
    refuses(
      JSON.stringify({ ...payload(), [MARKER]: MARKER }),
      messages.groups,
    );
  });

  describe.each(CLAIM_RESOLVER_TABLES)('%s group boundary', (table) => {
    it.each([
      { label: 'null', value: null },
      { label: 'array', value: [] },
      { label: 'number', value: 1 },
      { label: 'boolean', value: false },
      { label: 'private string', value: MARKER },
    ])('rejects $label instead of a count-sha object', ({ value }) => {
      refuses(JSON.stringify({ ...payload(), [table]: value }), messages.group);
    });
    it.each(['count', 'sha'])('rejects missing member %s', (member) => {
      const group: Record<string, unknown> = { count: 1, sha: SHA };
      delete group[member];
      refuses(
        JSON.stringify({ ...payload(), [table]: group }),
        messages.members,
      );
    });
    it('rejects an extra group member without exposing its name', () => {
      refuses(
        JSON.stringify({
          ...payload(),
          [table]: { count: 1, sha: SHA, [MARKER]: MARKER },
        }),
        messages.members,
      );
    });
    it('rejects an extra member sorting after sha with valid count and digest', () => {
      const group = { count: 1, sha: SHA, zPrivateExtra: MARKER };
      expect(Object.keys(group).sort()).toEqual([
        'count',
        'sha',
        'zPrivateExtra',
      ]);
      refuses(
        JSON.stringify({ ...payload(), [table]: group }),
        messages.members,
      );
    });
    it.each(['count', 'sha'])(
      'rejects renamed member %s at unchanged member count',
      (member) => {
        const group: Record<string, unknown> = { count: 1, sha: SHA };
        const removed = group[member];
        delete group[member];
        group[MARKER] = removed;
        expect(Object.keys(group)).toHaveLength(2);
        refuses(
          JSON.stringify({ ...payload(), [table]: group }),
          messages.members,
        );
      },
    );
  });

  it.each([
    { label: 'negative', value: -1 },
    { label: 'fraction', value: 0.5 },
    { label: 'numeric string', value: '1' },
    { label: 'null', value: null },
    { label: 'boolean', value: true },
    { label: 'object', value: {} },
    { label: 'array', value: [] },
    { label: 'unsafe integer', value: Number.MAX_SAFE_INTEGER + 1 },
    { label: 'private string', value: MARKER },
  ])('rejects invalid count $label', ({ value }) => {
    refuses(encodedGroup(value), messages.count);
  });
  it.each(['1e400', '-1e400'])(
    'rejects JSON numeric overflow %s',
    (literal) => {
      const raw = encodedGroup('overflow-count').replace(
        '"overflow-count"',
        literal,
      );
      refuses(raw, messages.count);
    },
  );
  it.each([
    { label: 'uppercase', value: 'A'.repeat(64) },
    { label: 'short', value: 'a'.repeat(63) },
    { label: 'long', value: 'a'.repeat(65) },
    { label: 'nonhex', value: 'g'.repeat(64) },
    { label: 'terminal newline', value: `${SHA}\n` },
    { label: 'number', value: 1 },
    { label: 'null', value: null },
    { label: 'boolean', value: true },
    { label: 'object', value: {} },
    { label: 'array', value: [] },
    { label: 'empty string', value: '' },
    { label: 'private string', value: MARKER },
  ])('rejects invalid digest $label', ({ value }) => {
    refuses(encodedGroup(1, value), messages.sha);
  });
});
