import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import * as barrel from './index.ts';
import { AuthReturnTargetSchema } from './authentication/primitives.ts';
import {
  AUTH_RETURN_TARGET_MAX_LENGTH,
  CONTENT_SCHEMA_REGISTRY_OPERATION_IDS,
  CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER,
  LOCALE_CONFIG_LIMITS,
  LOCALE_CONFIG_MESSAGES,
  TEMPLATE_BINDING_MESSAGES,
  canonicalizeBcp47,
  evaluateLocaleConfig,
  isAuthReturnTarget,
  isCanonicalLocale,
  isRelativeFirstPartyPath,
  type LocaleConfigInput,
  type LocaleConfigIssue,
} from './client.ts';
import { refineLocaleConfig } from './content-schema-registry/locale-config.ts';
import * as validators from './content-schema-registry/validators.ts';

/**
 * AC261: the browser registry island must not ship zod. `client.ts` is the
 * zod-free entry for the constants and pure rules the island needs, and
 * `validators.ts` is the entry the island loads lazily when it must validate
 * an unseen payload. Both are curated entries, never the package barrel.
 */

const STATIC_IMPORT =
  /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\s+from\s+)?['"]([^'"]+)['"]/gu;

const staticValueImports = (entry: string): string[] => {
  const seen = new Set<string>();
  const external = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      if (match[1] !== undefined) continue;
      const specifier = match[2] as string;
      if (!specifier.startsWith('.')) {
        external.add(specifier);
        continue;
      }
      const target = resolve(dirname(file), specifier);
      if (existsSync(target) && statSync(target).isFile()) pending.push(target);
    }
  }
  return [...external].sort();
};

const issuesOf = (config: LocaleConfigInput): LocaleConfigIssue[] => {
  const issues: LocaleConfigIssue[] = [];
  evaluateLocaleConfig(config, (path, message) => {
    issues.push({ path, message });
  });
  return issues;
};

const refinedIssuesOf = (config: LocaleConfigInput): LocaleConfigIssue[] => {
  const result = z
    .object({})
    .superRefine((_value, ctx) => refineLocaleConfig(config, ctx))
    .safeParse({});
  return result.success
    ? []
    : result.error.issues.map((issue) => ({
        path: issue.path.map((entry) =>
          typeof entry === 'symbol' ? String(entry) : entry,
        ),
        message: issue.message,
      }));
};

const CONFIGS: readonly LocaleConfigInput[] = [
  {
    sourceLocale: 'en-US',
    defaultLocale: 'en-US',
    supportedLocales: ['en-US', 'fr-FR', 'pt-BR'],
    fallbackChains: { 'fr-FR': ['en-US'], 'pt-BR': ['fr-FR', 'en-US'] },
  },
  {
    sourceLocale: 'en-US',
    defaultLocale: 'en-US',
    supportedLocales: ['en-US', 'en-US', 'xx-bad-Tag'],
    fallbackChains: { 'fr-FR': ['de-DE'], 'en-US': [] },
  },
  {
    sourceLocale: 'de-DE',
    defaultLocale: 'fr-FR',
    supportedLocales: ['fr-FR', 'pt-BR', 'es-ES'],
    fallbackChains: {
      'pt-BR': ['es-ES', 'pt-BR', 'es-ES'],
      'es-ES': ['pt-BR'],
    },
  },
  {
    sourceLocale: null,
    defaultLocale: null,
    supportedLocales: [],
    fallbackChains: {},
  },
];

describe('[P2-S09-AC-261] zod-free registry client entry', () => {
  it('[P2-S09-AC-261] re-exports exactly the barrel values, so no message or rule can drift', () => {
    expect(LOCALE_CONFIG_MESSAGES).toBe(barrel.LOCALE_CONFIG_MESSAGES);
    expect(LOCALE_CONFIG_LIMITS).toBe(barrel.LOCALE_CONFIG_LIMITS);
    expect(TEMPLATE_BINDING_MESSAGES).toBe(barrel.TEMPLATE_BINDING_MESSAGES);
    expect(CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER).toBe(
      barrel.CONTENT_SCHEMA_REGISTRY_RETRYABLE_HEADER,
    );
    expect(CONTENT_SCHEMA_REGISTRY_OPERATION_IDS).toBe(
      barrel.CONTENT_SCHEMA_REGISTRY_OPERATION_IDS,
    );
    expect(canonicalizeBcp47).toBe(barrel.canonicalizeBcp47);
    expect(isCanonicalLocale).toBe(barrel.isCanonicalLocale);
  });

  it('[P2-S09-AC-261] evaluates the OD-4 table with the same issues and order as the zod refinement', () => {
    for (const config of CONFIGS)
      expect(issuesOf(config)).toEqual(refinedIssuesOf(config));
    expect(issuesOf(CONFIGS[1] as LocaleConfigInput).length).toBeGreaterThan(3);
    expect(issuesOf(CONFIGS[0] as LocaleConfigInput)).toEqual([]);
  });

  it('[P2-S09-AC-261] applies the same return-target rule as the authentication schema', () => {
    const values: unknown[] = [
      '/app',
      '/app?returnTo=%2Fapp',
      '/',
      '',
      '/outside',
      '//evil.example',
      '/app?next=https://evil.example',
      `/app/${'a'.repeat(AUTH_RETURN_TARGET_MAX_LENGTH)}`,
      `/${'a'.repeat(AUTH_RETURN_TARGET_MAX_LENGTH - 1)}`,
      '/app\\evil',
      '/app?x=%E0%A4%A',
      null,
      42,
    ];
    for (const value of values)
      expect(isAuthReturnTarget(value)).toBe(
        AuthReturnTargetSchema.safeParse(value).success,
      );
    expect(isAuthReturnTarget('/app')).toBe(true);
    expect(isAuthReturnTarget(`/app/${'a'.repeat(600)}`)).toBe(false);
    expect(isRelativeFirstPartyPath).toBe(barrel.isRelativeFirstPartyPath);
  });

  it('[P2-S09-AC-261] imports no zod anywhere in its static closure', () => {
    expect(
      staticValueImports(resolve(import.meta.dirname, 'client.ts')),
    ).toEqual([]);
  });

  it('[P2-S09-AC-261] exposes the lazily loaded payload validators without the barrel', () => {
    expect(Object.keys(validators).sort()).toEqual([
      'CmsStepUpRequiredErrorSchema',
      'ContentSchemaRegistryDetailSchema',
      'ContentSchemaRegistryListPageSchema',
      'SchemaActivationResourceSchema',
      'SchemaReviewAssignmentRequestSchema',
      'SchemaReviewResourceSchema',
    ]);
    expect(validators.ContentSchemaRegistryListPageSchema).toBe(
      barrel.ContentSchemaRegistryListPageSchema,
    );
    expect(
      staticValueImports(
        resolve(import.meta.dirname, 'content-schema-registry/validators.ts'),
      ),
    ).toEqual(['zod']);
  });
});
