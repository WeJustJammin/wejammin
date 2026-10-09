import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  CMS_EMPTY_SETTINGS_SNAPSHOT_HASH,
  CMS_PUBLICATION_SETTINGS_KEYS,
  CMS_PUBLICATION_SETTINGS_REGISTRY_VERSION,
  CMS_SETTINGS_CONSUMER_KEY,
  SETTINGS_SNAPSHOT_KEYS_MESSAGE,
  SettingsSnapshotEntrySchema,
  SettingsSnapshotSchema,
  createSettingsSnapshotSchema,
} from './index';
import { hash, uid } from './workflow-fixtures.test-support';

type Parser = { safeParse: (value: unknown) => { success: boolean } };
const refused = (schema: Parser, value: unknown): boolean =>
  !schema.safeParse(value).success;

describe('[P2-S11-AC-091][P2-S11-AC-092] settings snapshot authority (E7)', () => {
  it('is registry version 1 with no members and the cms.publication consumer key', () => {
    expect(CMS_PUBLICATION_SETTINGS_REGISTRY_VERSION).toBe(1);
    expect([...CMS_PUBLICATION_SETTINGS_KEYS]).toEqual([]);
    expect(CMS_SETTINGS_CONSUMER_KEY).toBe('cms.publication');
  });

  it('hashes the empty snapshot to the SHA-256 of its JCS form `[]`', () => {
    expect(CMS_EMPTY_SETTINGS_SNAPSHOT_HASH).toBe(
      '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
    );
    expect(createHash('sha256').update('[]').digest('hex')).toBe(
      CMS_EMPTY_SETTINGS_SNAPSHOT_HASH,
    );
  });

  it('accepts exactly the empty snapshot at registry version 1 and refuses every non-empty one', () => {
    // BE03b E7: registry version 1 has no members, so the one valid snapshot is [].
    const entry = {
      key: 'cms.publication.example',
      definitionVersionId: uid(1),
      sourceValueVersionId: uid(2),
      valueHash: hash,
    };
    expect(SettingsSnapshotEntrySchema.parse(entry)).toEqual(entry);
    expect(SettingsSnapshotSchema.parse([])).toEqual([]);
    const a = { ...entry, key: 'a.setting' };
    const b = { ...entry, key: 'b.setting' };
    for (const unregistered of [[entry], [a], [a, b], [b, a], [a, a]])
      expect(
        refused(SettingsSnapshotSchema, unregistered),
        JSON.stringify(unregistered.map(({ key }) => key)),
      ).toBe(true);
    expect(SettingsSnapshotSchema.safeParse([a]).error?.issues).toEqual([
      expect.objectContaining({
        path: [],
        message: SETTINGS_SNAPSHOT_KEYS_MESSAGE,
      }),
    ]);
  });

  it('keeps the registry a unique, ascending key list', () => {
    const keys = [...CMS_PUBLICATION_SETTINGS_KEYS];
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual([...keys].sort());
  });

  it('requires a snapshot to carry exactly the registered keys, in registry order, for any registry', () => {
    const entryFor = (key: string) => ({
      key,
      definitionVersionId: uid(1),
      sourceValueVersionId: null,
      valueHash: null,
    });
    const schema = createSettingsSnapshotSchema(['a.setting', 'b.setting']);
    expect(
      schema.safeParse([entryFor('a.setting'), entryFor('b.setting')]).success,
    ).toBe(true);
    for (const wrong of [
      [],
      [entryFor('a.setting')],
      [entryFor('b.setting')],
      [entryFor('b.setting'), entryFor('a.setting')],
      [entryFor('a.setting'), entryFor('a.setting')],
      [entryFor('a.setting'), entryFor('b.setting'), entryFor('c.setting')],
      [entryFor('a.setting'), entryFor('c.setting')],
    ])
      expect(
        refused(schema, wrong),
        JSON.stringify(wrong.map(({ key }) => key)),
      ).toBe(true);
    // An empty registry admits only the empty snapshot.
    expect(createSettingsSnapshotSchema([]).safeParse([]).success).toBe(true);
    expect(
      createSettingsSnapshotSchema([]).safeParse([entryFor('a.setting')])
        .success,
    ).toBe(false);
  });

  it('records a contract default with a null source value version and value hash', () => {
    const entry = {
      key: 'a.setting',
      definitionVersionId: uid(1),
      sourceValueVersionId: null,
      valueHash: null,
    };
    expect(SettingsSnapshotEntrySchema.parse(entry)).toEqual(entry);
    expect(
      refused(SettingsSnapshotEntrySchema, { ...entry, valueHash: hash }),
    ).toBe(true);
    expect(
      refused(SettingsSnapshotEntrySchema, {
        ...entry,
        sourceValueVersionId: uid(2),
      }),
    ).toBe(true);
    expect(
      refused(SettingsSnapshotEntrySchema, {
        ...entry,
        definitionVersionId: null,
      }),
    ).toBe(true);
    expect(
      refused(SettingsSnapshotEntrySchema, { ...entry, key: 'Not A Key' }),
    ).toBe(true);
    expect(refused(SettingsSnapshotEntrySchema, { ...entry, value: 1 })).toBe(
      true,
    );
  });
});
