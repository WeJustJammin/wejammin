import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  FrozenValidatorEntrySchema,
  RICH_TEXT_V1_ARTIFACT_HASH,
  RICH_TEXT_V1_ARTIFACT_REF,
  RICH_TEXT_V1_DESCRIPTOR,
  fieldUsesRichTextGrammar,
  protectedValidatorDescriptor,
  requiredProtectedValidators,
} from './protected-validators.ts';

/**
 * P2-S10-AC-085 / DEC-146 (TypeScript side): the canonical immutable
 * `rich_text.v1`@1 grammar descriptor, its JCS (RFC 8785) SHA-256 and the
 * registry entry that compiled artifacts freeze. The descriptor is ASCII
 * strings, booleans and integers only, so its JCS form is key-sorted compact
 * JSON; the hash is pinned here, in the SQL registry
 * (`platform_private.cms_protected_validator_descriptor`) and in its pgTAP
 * suite, so neither side can drift.
 */

const PINNED_HASH =
  '4fe960667baa6d616e9fe00527d3e1a1d5740013b37f548eec74e20a244f2d15';

/** RFC 8785 for the value shapes the descriptor uses (no floats, no escapes). */
const jcs = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(jcs).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${jcs(entry)}`)
      .join(',')}}`;
  return JSON.stringify(value);
};

const sha256Hex = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

describe('[P2-S10-AC-085] canonical rich_text.v1@1 grammar descriptor', () => {
  it('hashes to the pinned JCS SHA-256 and carries the pinned artifact reference', () => {
    expect(sha256Hex(jcs(RICH_TEXT_V1_DESCRIPTOR))).toBe(PINNED_HASH);
    expect(RICH_TEXT_V1_ARTIFACT_HASH).toBe(PINNED_HASH);
    expect(RICH_TEXT_V1_ARTIFACT_REF).toBe('cms/validators/rich_text.v1/v1');
  });

  it('is the compact key-sorted JSON the SQL registry hashes', () => {
    expect(jcs(RICH_TEXT_V1_DESCRIPTOR)).toBe(
      '{"blockTypes":["heading","list_item","paragraph","quote"],' +
        '"bounds":{"blocks":128,"containerDepth":7,"httpsHrefCharacters":2048,' +
        '"internalRouteCharacters":2048,"mailtoAddressMaxCharacters":254,' +
        '"mailtoAddressMinCharacters":3,"marksPerSpan":3,' +
        '"spanTextCharacters":10000,"spansPerBlock":128},' +
        '"canonical":{"allowedControlCharacters":["U+000A"],' +
        '"linkAbsentNotNull":true,"mergedAdjacentSpans":true,' +
        '"normalization":"NFC","uniqueOrderedMarks":true},' +
        '"format":"rich_text.v1","grammarVersion":1,"headingLevels":[2,3,4],' +
        '"linkKinds":["https","internal","mailto"],"listDepths":[1,2,3],' +
        '"listKinds":["bulleted","numbered"],"marks":["bold","italic","code"],' +
        '"unit":"unicode_character"}',
    );
  });

  it('describes the bounds the TypeScript grammar actually enforces', () => {
    expect(RICH_TEXT_V1_DESCRIPTOR.bounds.spanTextCharacters).toBe(10_000);
    expect(RICH_TEXT_V1_DESCRIPTOR.bounds.httpsHrefCharacters).toBe(2048);
    expect(RICH_TEXT_V1_DESCRIPTOR.bounds.internalRouteCharacters).toBe(2048);
    expect(RICH_TEXT_V1_DESCRIPTOR.unit).toBe('unicode_character');
  });
});

describe('[P2-S10-AC-085] protected validator registry entry', () => {
  it('resolves rich_text.v1 version 1 to the exact entry shape the SQL registry returns', () => {
    const entry = protectedValidatorDescriptor('rich_text.v1', '1');
    expect(entry).toEqual({
      key: 'rich_text.v1',
      version: 1,
      artifactRef: 'cms/validators/rich_text.v1/v1',
      artifactHash: PINNED_HASH,
    });
    expect(FrozenValidatorEntrySchema.safeParse(entry).success).toBe(true);
    expect(protectedValidatorDescriptor('rich_text.v1', 1)).toEqual(entry);
  });

  it('has no entry for an unregistered key or version', () => {
    for (const [key, version] of [
      ['rich_text.v1', '2'],
      ['rich_text.v2', '1'],
      ['cms.slug', '1'],
      [null, '1'],
      ['rich_text.v1', null],
    ] as const)
      expect(protectedValidatorDescriptor(key, version)).toBeNull();
  });

  it('refuses a frozen entry that is not exactly key, numeric version, reference and hash', () => {
    const entry = protectedValidatorDescriptor('rich_text.v1', 1);
    for (const bad of [
      { ...entry, version: '1' },
      { ...entry, artifactHash: 'A'.repeat(64) },
      { ...entry, extra: true },
      { key: 'rich_text.v1', version: 1, artifactRef: 'x' },
      { ...entry, key: 'pii.safety' },
    ])
      expect(FrozenValidatorEntrySchema.safeParse(bad).success).toBe(false);
  });
});

describe('[P2-S10-AC-085] which definitions freeze the validator', () => {
  const richField = { kind: 'rich_text' };
  const plainField = { kind: 'short_text' };
  const objectWith = (propertyKind: string) => ({
    kind: 'object',
    constraints: {
      objectStructure: {
        properties: [{ key: 'intro', kind: propertyKind }],
      },
    },
  });

  it('freezes the descriptor once for a rich_text field, an explicit pair or an object with a rich_text property', () => {
    const entry = protectedValidatorDescriptor('rich_text.v1', 1);
    expect(requiredProtectedValidators([richField])).toEqual([entry]);
    expect(
      requiredProtectedValidators([
        { kind: 'rich_text', validatorKey: 'rich_text.v1' },
      ]),
    ).toEqual([entry]);
    expect(requiredProtectedValidators([objectWith('rich_text')])).toEqual([
      entry,
    ]);
    expect(
      requiredProtectedValidators([
        richField,
        objectWith('rich_text'),
        { kind: 'rich_text', validatorKey: 'rich_text.v1' },
      ]),
    ).toEqual([entry]);
  });

  it('freezes nothing for a definition that does not use the grammar', () => {
    expect(requiredProtectedValidators([])).toEqual([]);
    expect(requiredProtectedValidators([plainField])).toEqual([]);
    expect(requiredProtectedValidators([objectWith('scalar')])).toEqual([]);
    expect(requiredProtectedValidators([objectWith('enum')])).toEqual([]);
    expect(fieldUsesRichTextGrammar({ kind: 'object' })).toBe(false);
    expect(
      fieldUsesRichTextGrammar({ kind: 'object', constraints: null }),
    ).toBe(false);
  });
});

const MIGRATIONS = new URL('../../../../supabase/migrations/', import.meta.url);

describe('[P2-S10-AC-085] TypeScript and SQL registries hold the same descriptor', () => {
  const sqlDefinitions = existsSync(MIGRATIONS)
    ? readdirSync(MIGRATIONS)
        .filter((name) => name.endsWith('.sql'))
        .map((name) => ({
          name,
          text: readFileSync(new URL(name, MIGRATIONS), 'utf8'),
        }))
        .filter((file) =>
          file.text.includes(
            'create or replace function platform_private.cms_protected_validator_descriptor',
          ),
        )
    : [];

  // The SQL registry migration is lane H's; this guard activates the moment it
  // exists and then pins every constant of the TypeScript mirror against it.
  it.runIf(sqlDefinitions.length > 0)(
    'the SQL registry migration carries the artifact reference, key and every descriptor value',
    () => {
      const sql = sqlDefinitions.map((file) => file.text).join('\n');
      expect(sql).toContain(RICH_TEXT_V1_ARTIFACT_REF);
      expect(sql).toContain("'rich_text.v1'");
      const descriptorText = JSON.stringify(RICH_TEXT_V1_DESCRIPTOR);
      for (const match of descriptorText.matchAll(/"([A-Za-z0-9_+.]+)"/gu)) {
        // every key name and string value of the descriptor appears verbatim
        expect(sql, match[1]).toContain(match[1]);
      }
      // The hash is either recomputed in SQL (cms_jcs_sha256 of the body) or
      // spelled out; any 64-hex literal in the registry migration must be the
      // pinned descriptor hash.
      for (const literal of new Set(sql.match(/[a-f0-9]{64}/gu) ?? []))
        expect(literal).toBe(PINNED_HASH);
    },
  );
});
