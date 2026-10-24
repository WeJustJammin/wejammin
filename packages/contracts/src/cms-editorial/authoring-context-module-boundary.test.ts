import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import * as originalModule from './authoring-context.ts';
import * as barrel from './index.ts';

/**
 * The locked extensibility rule caps each schema file at 150 lines
 * (`.agents/rules/extensibility.md`, File Size Limits table: schema files 150
 * lines). The original `authoring-context.ts` reached 171 lines by carrying two
 * domains: the authoring envelope (query, API request, type, resource, read) and
 * the author-safe field-definition projection. The behavior-preserving fix
 * extracts the field domain into a sibling module, adding no wire member,
 * capability, constructor change or inferred type.
 *
 * These cases pin that boundary without exercising schema behavior: the
 * original module keeps exactly its six runtime schema exports, the extracted
 * module exposes only the single field schema and not its private editor
 * config, and every view of that schema (original module, public barrel,
 * extracted module) is the same object, so no consumer can observe a divergent
 * validator. The extracted module is loaded dynamically so that, while it is
 * still absent, the absence is a case assertion rather than an import-time
 * collection abort. Semantic field coverage stays in `authoring-context.test.ts`.
 */

const SCHEMA_LINE_CAP = 150;

const ORIGINAL_MODULE = new URL('./authoring-context.ts', import.meta.url);
const FIELD_MODULE = new URL('./authoring-context-field.ts', import.meta.url);

/** The original module's complete runtime (value) export set. */
const ORIGINAL_RUNTIME_EXPORTS = [
  'AuthoringContextApiRequestSchema',
  'AuthoringContextFieldSchema',
  'AuthoringContextQuerySchema',
  'AuthoringContextReadSchema',
  'AuthoringContextResourceSchema',
  'AuthoringContextTypeSchema',
] as const;

/** Trim trailing whitespace, then count the newline-delimited lines. */
const lineCount = (moduleUrl: URL): number =>
  readFileSync(moduleUrl, 'utf8').trimEnd().split('\n').length;

describe('[S12-AUTHORING-SCHEMA-CAP] authoring-context schema module boundary', () => {
  it('[S12-AUTHORING-SCHEMA-CAP-01] keeps the original and extracted schema modules at or below the 150-line cap', () => {
    expect(lineCount(ORIGINAL_MODULE)).toBeLessThanOrEqual(SCHEMA_LINE_CAP);
    expect(existsSync(FIELD_MODULE), 'authoring-context-field.ts').toBe(true);
    if (!existsSync(FIELD_MODULE)) return;
    expect(lineCount(FIELD_MODULE)).toBeLessThanOrEqual(SCHEMA_LINE_CAP);
  });

  it('[S12-AUTHORING-SCHEMA-CAP-02] keeps the original six runtime exports and exposes only the field schema from the extracted module', async () => {
    expect(existsSync(FIELD_MODULE), 'authoring-context-field.ts').toBe(true);
    if (!existsSync(FIELD_MODULE)) return;
    expect(Object.keys(originalModule).sort()).toEqual(
      [...ORIGINAL_RUNTIME_EXPORTS].sort(),
    );
    const fieldModule = await vi.importActual<Record<string, unknown>>(
      './authoring-context-field.ts',
    );
    expect(Object.keys(fieldModule)).toEqual(['AuthoringContextFieldSchema']);
    expect(fieldModule).not.toHaveProperty(
      'authoringContextFieldEditorConfigSchema',
    );
  });

  it('[S12-AUTHORING-SCHEMA-CAP-03] shares one field schema object across the original module, the public barrel and the extracted module', async () => {
    expect(existsSync(FIELD_MODULE), 'authoring-context-field.ts').toBe(true);
    if (!existsSync(FIELD_MODULE)) return;
    const fieldModule = await vi.importActual<Record<string, unknown>>(
      './authoring-context-field.ts',
    );
    expect(originalModule.AuthoringContextFieldSchema).toBe(
      barrel.AuthoringContextFieldSchema,
    );
    expect(fieldModule.AuthoringContextFieldSchema).toBe(
      originalModule.AuthoringContextFieldSchema,
    );
    expect(fieldModule.AuthoringContextFieldSchema).toBe(
      barrel.AuthoringContextFieldSchema,
    );
  });
});
