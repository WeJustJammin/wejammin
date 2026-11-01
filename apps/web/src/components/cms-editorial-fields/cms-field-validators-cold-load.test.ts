import { relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { staticLocalFiles } from './static-files.test-support';

/*
 * The value validators are needed only after a save was refused or a command is sent, so the entry editor's cold load
 * must not reach them statically (FE03 "Performance budgets and loading strategy"; P2-S11-AC-106): the save chunk
 * (`cms-editorial-entry-editor-save`, a listed on-demand chunk) imports them and loads them with itself.
 */
const COMPONENTS = resolve(import.meta.dirname, '..');
const ENTRY = resolve(
  COMPONENTS,
  'cms-editorial/CmsEditorialEntryEditorIsland.tsx',
);
const VALIDATOR_MODULES = [
  'cms-editorial-fields/cms-field-value.ts',
  'cms-editorial-fields/cms-field-value-structured.ts',
  'cms-editorial-fields/cms-field-value-scalar.ts',
  'cms-editorial-fields/cms-field-taxonomy-value.ts',
];

describe('the entry editor cold load', () => {
  const closure = [...staticLocalFiles(ENTRY)].map((file) =>
    relative(COMPONENTS, file),
  );

  it('walks the island and the field editors it renders', () => {
    expect(closure).toContain('cms-editorial-fields/CmsFieldEditor.tsx');
    expect(closure).toContain('cms-editorial-fields/cms-field-basics.ts');
    expect(closure).toContain('cms-editorial-fields/cms-field-validation.ts');
  });

  it.each(VALIDATOR_MODULES)('does not reach %s statically', (module) => {
    expect(closure).not.toContain(module);
  });

  it('still reaches the validators through the save chunk', () => {
    const save = [
      ...staticLocalFiles(
        resolve(COMPONENTS, 'cms-editorial/cms-editorial-entry-editor-save.ts'),
      ),
    ].map((file) => relative(COMPONENTS, file));
    expect(save).toContain('cms-editorial-fields/cms-field-value.ts');
  });
});
