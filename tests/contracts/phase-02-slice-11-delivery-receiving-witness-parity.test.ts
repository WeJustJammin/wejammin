import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * DEC-197 test-only replay transport. Unlike the older marked-region taxonomy
 * witnesses, this copy includes EVERY byte: comments, BEGIN, COMMIT and final LF.
 * Source parity does not prove an upgrade, a refusal or transaction atomicity.
 * A separate runner must replay these exact bytes in real pre-migration stores.
 */
const MIGRATION = '20261016030000_delivery_receiving_contracts.sql';
const path = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));
const PROMOTED = path(`../../supabase/migrations/${MIGRATION}`);
const WITNESS = path(
  '../../supabase/tests/phase_02_slice_11_delivery_receiving/080-forward-migration.sqlinc',
);

type ReadOptional = (source: string) => Buffer | undefined;
type MigrationSource = { path: string; bytes: Buffer };

const sha256 = (bytes: Buffer): string =>
  createHash('sha256').update(bytes).digest('hex');

/** The migration is promoted and immutable: it has no other home, so absence refuses. */
const selectMigration = (
  promoted: string,
  read: ReadOptional,
): MigrationSource => {
  const bytes = read(promoted);
  if (bytes === undefined) {
    throw new Error('DEC197_SOURCE_MISSING: promoted migration does not exist');
  }
  return { path: promoted, bytes };
};

const readOptional: ReadOptional = (source) => {
  try {
    return readFileSync(source);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return undefined;
    }
    throw error;
  }
};
const migration = (): MigrationSource =>
  selectMigration(PROMOTED, readOptional);

const assertByteParity = (source: Buffer, witness: Buffer): void => {
  if (!source.equals(witness)) {
    throw new Error(
      `DEC197_WITNESS_DRIFT: source=${sha256(source)} witness=${sha256(witness)}`,
    );
  }
};

const sources =
  (promoted: Buffer | undefined): ReadOptional =>
  (source) => {
    if (source === PROMOTED) return promoted;
    throw new Error(`DEC197_UNEXPECTED_SOURCE: ${source}`);
  };

const replaceText = (bytes: Buffer, before: string, after: string): Buffer => {
  const text = bytes.toString('utf8');
  if (!text.includes(before)) throw new Error('DEC197_MUTATION_TARGET_MISSING');
  return Buffer.from(text.replace(before, after));
};

describe('DEC-197 complete forward-migration witness parity', () => {
  it('DR-UP-P01 compares all source bytes with the mounted replay copy', () => {
    const actual = migration();
    const witness = readFileSync(WITNESS);
    expect(actual.path).toBe(PROMOTED);
    expect(() => assertByteParity(actual.bytes, witness)).not.toThrow();
  });

  it('DR-UP-P02 returns the promoted bytes when the promoted file exists', () => {
    const bytes = migration().bytes;
    expect(selectMigration(PROMOTED, sources(bytes))).toEqual({
      path: PROMOTED,
      bytes,
    });
  });

  // DR-UP-P03..P06 were retired with the WIP fallback (2026-10-23); their ids are not reused.
  it('DR-UP-P07 refuses an absent source instead of skipping or fabricating SQL', () => {
    expect(() => selectMigration(PROMOTED, sources(undefined))).toThrow(
      'DEC197_SOURCE_MISSING',
    );
  });

  it('DR-UP-P08 propagates a source-read failure instead of falling back silently', () => {
    const readFailure = new Error('DEC197_READ_DENIED');
    expect(() =>
      selectMigration(PROMOTED, () => {
        throw readFailure;
      }),
    ).toThrow(readFailure);
  });

  const mutations: Array<[string, (bytes: Buffer) => Buffer]> = [
    [
      'DR-UP-P09 body constraint byte',
      (b) => replaceText(b, 'version_no > 0', 'version_no > 1'),
    ],
    ['DR-UP-P10 missing BEGIN', (b) => replaceText(b, 'begin;\n', '')],
    ['DR-UP-P11 missing COMMIT', (b) => replaceText(b, 'commit;\n', '')],
    [
      'DR-UP-P12 modified header',
      (b) => replaceText(b, '-- DEC-197', '-- DEC-19X'),
    ],
    [
      'DR-UP-P13 omitted explanation',
      (b) =>
        replaceText(b, 'Any pre-COMMIT error rolls back all this DDL.', ''),
    ],
    ['DR-UP-P14 added newline', (b) => Buffer.concat([b, Buffer.from('\n')])],
    ['DR-UP-P15 missing final byte', (b) => b.subarray(0, b.length - 1)],
    [
      'DR-UP-P16 CRLF substitution',
      (b) => Buffer.from(b.toString('utf8').replaceAll('\n', '\r\n')),
    ],
    [
      'DR-UP-P17 truncated body',
      (b) => b.subarray(0, Math.floor(b.length / 2)),
    ],
  ];

  it.each(mutations)(
    '%s is rejected by the actual full-byte parity guard',
    (_, mutate) => {
      const original = migration().bytes;
      const changed = mutate(original);
      expect(changed.equals(original)).toBe(false);
      expect(() => assertByteParity(original, changed)).toThrow(
        'DEC197_WITNESS_DRIFT',
      );
    },
  );
});
