import { z } from 'zod';

import {
  BCP47_SHAPE,
  LOCALE_CONFIG_LIMITS,
  LOCALE_CONFIG_MESSAGES,
  isCanonicalLocale,
} from './locale-canonical.ts';
import {
  evaluateLocaleConfig,
  type LocaleConfigInput,
} from './locale-config-rules.ts';

export * from './locale-canonical.ts';
export * from './locale-config-rules.ts';

/** Wire projection of a canonical locale tag (also used by source/default). */
export const CmsCanonicalLocaleSchema = z
  .string()
  .refine(isCanonicalLocale, { message: LOCALE_CONFIG_MESSAGES.canonical })
  .meta({
    minLength: LOCALE_CONFIG_LIMITS.minTagLength,
    maxLength: LOCALE_CONFIG_LIMITS.maxTagLength,
    pattern: BCP47_SHAPE.source,
  });

/**
 * Shape-only wire schemas. The exact table messages and ordering are owned by
 * `refineLocaleConfig`, so the field schemas carry the bounds as OpenAPI
 * metadata and leave the rule evaluation to one ordered pass.
 */
const tagMeta = {
  type: 'string',
  minLength: LOCALE_CONFIG_LIMITS.minTagLength,
  maxLength: LOCALE_CONFIG_LIMITS.maxTagLength,
  pattern: BCP47_SHAPE.source,
};
export const CmsSupportedLocalesSchema = z.array(z.string()).readonly().meta({
  minItems: 1,
  maxItems: LOCALE_CONFIG_LIMITS.maxSupportedLocales,
  items: tagMeta,
});
export const CmsFallbackChainsSchema = z
  .record(z.string(), z.array(z.string()).readonly())
  .readonly()
  .meta({
    maxProperties: LOCALE_CONFIG_LIMITS.maxSupportedLocales - 1,
    propertyNames: tagMeta,
    additionalProperties: {
      type: 'array',
      minItems: 1,
      maxItems: LOCALE_CONFIG_LIMITS.maxChainLength,
      items: tagMeta,
    },
  });

/**
 * One ordered pass over the exact-refusal table of BE03a OD-4, reported to the
 * zod refinement context. The rule evaluation itself lives in
 * `locale-config-rules.ts` so the browser can run it without zod.
 */
export const refineLocaleConfig = (
  config: LocaleConfigInput,
  ctx: z.RefinementCtx,
): void =>
  evaluateLocaleConfig(config, (path, message) =>
    ctx.addIssue({ code: 'custom', path, message }),
  );

const encoder = new TextEncoder();
const utf8Compare = (left: string, right: string): number => {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const shared = Math.min(a.length, b.length);
  for (let index = 0; index < shared; index += 1) {
    const difference = (a[index] as number) - (b[index] as number);
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
};

const jsonString = (value: string): string => JSON.stringify(value);

/**
 * RFC 8785 (JCS) canonical JSON of the hash input that the database function
 * `cms_validate_locale_config` and `localeConfigHash` bind:
 * `{ sourceLocale, defaultLocale, supportedLocales, fallbackChains }`, with
 * `supportedLocales` sorted ascending by UTF-8 byte order and chain order kept.
 * Locale tags are ASCII, so UTF-16 key order equals byte order here.
 */
export const localeConfigCanonicalJson = (
  config: Readonly<{
    sourceLocale: string;
    defaultLocale: string;
    supportedLocales: readonly string[];
    fallbackChains: Readonly<Record<string, readonly string[]>>;
  }>,
): string => {
  const supported = [...config.supportedLocales].sort(utf8Compare);
  const chains = Object.keys(config.fallbackChains)
    .sort(utf8Compare)
    .map(
      (key) =>
        `${jsonString(key)}:[${(config.fallbackChains[key] as readonly string[])
          .map(jsonString)
          .join(',')}]`,
    );
  return [
    `{"defaultLocale":${jsonString(config.defaultLocale)}`,
    `"fallbackChains":{${chains.join(',')}}`,
    `"sourceLocale":${jsonString(config.sourceLocale)}`,
    `"supportedLocales":[${supported.map(jsonString).join(',')}]}`,
  ].join(',');
};
