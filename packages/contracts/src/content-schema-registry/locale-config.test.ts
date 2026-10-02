import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  CmsCanonicalLocaleSchema,
  LOCALE_CONFIG_MESSAGES,
  canonicalizeBcp47,
  localeConfigCanonicalJson,
  refineLocaleConfig,
  type LocaleConfigInput,
} from './locale-config';

type Issue = Readonly<{ path: readonly (string | number)[]; message: string }>;

const issuesFor = (config: LocaleConfigInput): readonly Issue[] => {
  const schema = z.object({}).superRefine((_value, ctx) => {
    refineLocaleConfig(config, ctx);
  });
  const result = schema.safeParse({});
  return result.success
    ? []
    : result.error.issues.map((issue) => ({
        path: issue.path.map((entry) =>
          typeof entry === 'symbol' ? String(entry) : entry,
        ),
        message: issue.message,
      }));
};

const tag = (index: number): string =>
  `${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`;

const valid: LocaleConfigInput = {
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US', 'fr-FR', 'pt-BR'],
  fallbackChains: { 'fr-FR': ['en-US'], 'pt-BR': ['fr-FR', 'en-US'] },
};

describe('canonicalizeBcp47', () => {
  it.each([
    ['EN-us', 'en-US'],
    ['zh-hant-tw', 'zh-Hant-TW'],
    ['ZH-HANT', 'zh-Hant'],
    ['es-419', 'es-419'],
    ['de-DE-1996', 'de-DE-1996'],
    ['sl-ROZAJ-BISKE', 'sl-rozaj-biske'],
    ['en-X-Twain', 'en-x-twain'],
    ['en-U-CA-Gregory', 'en-u-ca-gregory'],
    ['EN', 'en'],
    ['fil', 'fil'],
    ['en-GB-oed', 'en-GB-oed'],
    ['EN-A1B', 'en-a1b'],
    ['ZH-YUE-hk', 'zh-yue-HK'],
  ])('maps %s to %s', (input, expected) => {
    expect(canonicalizeBcp47(input)).toBe(expected);
  });

  it('is idempotent', () => {
    for (const sample of ['en-us', 'ZH-hant-tw', 'x-private', 'sr-latn-rs'])
      expect(canonicalizeBcp47(canonicalizeBcp47(sample))).toBe(
        canonicalizeBcp47(sample),
      );
  });
});

describe('CmsCanonicalLocaleSchema', () => {
  it.each(['en', 'en-US', 'zh-Hant-TW', 'es-419', 'de-DE-1996', 'sr-Latn'])(
    'accepts %s',
    (tag) => {
      expect(CmsCanonicalLocaleSchema.parse(tag)).toBe(tag);
    },
  );

  it.each([
    'en-us',
    'EN-US',
    'zh-hant-TW',
    'en_US',
    'e',
    '',
    'en-',
    'en-US-',
    'a'.repeat(36),
    'en-US-x-aaaaaaaa-bbbbbbbb-cccccccc-dddddddd',
    'en US',
    'en-é',
    'en-us-',
  ])('refuses %j with the exact canonical message', (tag) => {
    const result = CmsCanonicalLocaleSchema.safeParse(tag);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      LOCALE_CONFIG_MESSAGES.canonical,
    ]);
  });

  it('accepts exactly 35 characters and refuses 36', () => {
    const at35 = `en-${'a'.repeat(8)}-${'b'.repeat(8)}-${'c'.repeat(8)}-ddddd`;
    expect(at35).toHaveLength(35);
    expect(CmsCanonicalLocaleSchema.safeParse(at35).success).toBe(true);
    expect(CmsCanonicalLocaleSchema.safeParse(`${at35}d`).success).toBe(false);
  });
});

describe('refineLocaleConfig exact refusals', () => {
  it('accepts a valid total acyclic configuration', () => {
    expect(issuesFor(valid)).toEqual([]);
  });

  it('accepts a single-locale type with an empty chain map', () => {
    expect(
      issuesFor({
        sourceLocale: 'en-US',
        defaultLocale: 'en-US',
        supportedLocales: ['en-US'],
        fallbackChains: {},
      }),
    ).toEqual([]);
  });

  it('accepts source different from default when both are supported', () => {
    expect(
      issuesFor({
        sourceLocale: 'fr-FR',
        defaultLocale: 'en-US',
        supportedLocales: ['en-US', 'fr-FR'],
        fallbackChains: { 'fr-FR': ['en-US'] },
      }),
    ).toEqual([]);
  });

  it('accepts 32 supported locales and a 16-entry chain', () => {
    const others = Array.from({ length: 31 }, (_unused, index) => tag(index));
    const supported = ['en-US', ...others];
    expect(supported).toHaveLength(32);
    const chain = [...others.slice(1, 16), 'en-US'];
    expect(chain).toHaveLength(16);
    const first = others[0] as string;
    const chains: Record<string, string[]> = {};
    for (const other of others) chains[other] = ['en-US'];
    chains[first] = chain;
    expect(
      issuesFor({
        sourceLocale: 'en-US',
        defaultLocale: 'en-US',
        supportedLocales: supported,
        fallbackChains: chains,
      }),
    ).toEqual([]);
  });

  it('refuses 0 supported locales', () => {
    expect(
      issuesFor({ ...valid, supportedLocales: [], fallbackChains: {} }).map(
        (issue) => issue.message,
      ),
    ).toContain(LOCALE_CONFIG_MESSAGES.size);
    expect(
      issuesFor({ ...valid, supportedLocales: [], fallbackChains: {} }).find(
        (issue) => issue.message === LOCALE_CONFIG_MESSAGES.size,
      )?.path,
    ).toEqual(['supportedLocales']);
  });

  it('refuses 33 supported locales', () => {
    const supported = [
      'en-US',
      ...Array.from({ length: 32 }, (_unused, index) => tag(index)),
    ];
    const issues = issuesFor({
      ...valid,
      supportedLocales: supported,
      fallbackChains: {},
    });
    expect(issues[0]).toEqual({
      path: ['supportedLocales'],
      message: 'supportedLocales must contain 1 to 32 locales',
    });
  });

  it('refuses non-canonical tags at their own paths', () => {
    expect(
      issuesFor({
        ...valid,
        supportedLocales: ['en-US', 'fr-fr', 'pt-BR'],
        fallbackChains: {
          'fr-fr': ['en-US'],
          'pt-BR': ['fr-fr', 'en-US'],
        },
      }).filter((issue) => issue.message === LOCALE_CONFIG_MESSAGES.canonical),
    ).toEqual([
      {
        path: ['supportedLocales', 1],
        message: 'locale tag must be a canonical-case BCP 47 tag',
      },
      {
        path: ['fallbackChains', 'fr-fr'],
        message: 'locale tag must be a canonical-case BCP 47 tag',
      },
      {
        path: ['fallbackChains', 'pt-BR', 0],
        message: 'locale tag must be a canonical-case BCP 47 tag',
      },
    ]);
  });

  it('refuses a repeated supported locale at the repeat index', () => {
    expect(
      issuesFor({
        ...valid,
        supportedLocales: ['en-US', 'fr-FR', 'pt-BR', 'fr-FR'],
      }),
    ).toEqual([
      {
        path: ['supportedLocales', 3],
        message: 'supportedLocales must be unique',
      },
    ]);
  });

  it('refuses a source and a default that are not members', () => {
    expect(
      issuesFor({
        sourceLocale: 'de-DE',
        defaultLocale: 'es-ES',
        supportedLocales: ['en-US'],
        fallbackChains: {},
      }),
    ).toEqual([
      {
        path: ['supportedLocales'],
        message: 'supportedLocales must include sourceLocale',
      },
      {
        path: ['supportedLocales'],
        message: 'supportedLocales must include defaultLocale',
      },
      {
        path: ['fallbackChains'],
        message:
          'every supported locale other than defaultLocale needs a fallback chain',
      },
    ]);
  });

  it('refuses chain keys that are unsupported or the default', () => {
    expect(
      issuesFor({
        ...valid,
        fallbackChains: { ...valid.fallbackChains, 'de-DE': ['en-US'] },
      }),
    ).toEqual([
      {
        path: ['fallbackChains', 'de-DE'],
        message: 'fallbackChains key must be a supported locale',
      },
    ]);
    expect(
      issuesFor({
        ...valid,
        fallbackChains: { ...valid.fallbackChains, 'en-US': ['fr-FR'] },
      }),
    ).toEqual([
      {
        path: ['fallbackChains', 'en-US'],
        message: 'defaultLocale must not have a fallback chain',
      },
    ]);
  });

  it('refuses a missing chain with one issue at the map', () => {
    expect(
      issuesFor({
        ...valid,
        fallbackChains: { 'fr-FR': ['en-US'] },
      }),
    ).toEqual([
      {
        path: ['fallbackChains'],
        message:
          'every supported locale other than defaultLocale needs a fallback chain',
      },
    ]);
  });

  it('refuses an empty and an over-long chain', () => {
    expect(
      issuesFor({
        ...valid,
        fallbackChains: { 'fr-FR': [], 'pt-BR': ['fr-FR', 'en-US'] },
      }).filter((issue) => issue.path.length > 0),
    ).toEqual([
      {
        path: ['fallbackChains', 'fr-FR'],
        message: 'fallback chain must contain 1 to 16 locales',
      },
    ]);
    const supported = [
      'en-US',
      ...Array.from({ length: 17 }, (_unused, index) => tag(index)),
    ];
    const chains: Record<string, string[]> = {};
    for (const other of supported.slice(1)) chains[other] = ['en-US'];
    chains.aa = [...supported.slice(2), 'en-US'];
    const issues = issuesFor({
      sourceLocale: 'en-US',
      defaultLocale: 'en-US',
      supportedLocales: supported,
      fallbackChains: chains,
    });
    expect(issues).toContainEqual({
      path: ['fallbackChains', 'aa'],
      message: 'fallback chain must contain 1 to 16 locales',
    });
  });

  it('refuses unsupported, repeated and self chain members', () => {
    expect(
      issuesFor({
        ...valid,
        fallbackChains: {
          'fr-FR': ['de-DE', 'en-US'],
          'pt-BR': ['fr-FR', 'fr-FR', 'en-US'],
        },
      }),
    ).toEqual([
      {
        path: ['fallbackChains', 'fr-FR', 0],
        message: 'fallback chain locale must be a supported locale',
      },
      {
        path: ['fallbackChains', 'pt-BR', 1],
        message: 'fallback chain locales must be unique',
      },
    ]);
    expect(
      issuesFor({
        ...valid,
        fallbackChains: {
          'fr-FR': ['fr-FR', 'en-US'],
          'pt-BR': ['fr-FR', 'en-US'],
        },
      }),
    ).toEqual([
      {
        path: ['fallbackChains', 'fr-FR', 0],
        message: 'fallback chain must not include its own target locale',
      },
    ]);
  });

  it('refuses a chain that does not end at the default', () => {
    expect(
      issuesFor({
        ...valid,
        fallbackChains: { 'fr-FR': ['en-US', 'pt-BR'], 'pt-BR': ['en-US'] },
      }),
    ).toEqual([
      {
        path: ['fallbackChains', 'fr-FR'],
        message: 'fallback chain must end at defaultLocale',
      },
    ]);
  });

  it('refuses a cycle with one issue at the map', () => {
    expect(
      issuesFor({
        ...valid,
        fallbackChains: {
          'fr-FR': ['pt-BR', 'en-US'],
          'pt-BR': ['fr-FR', 'en-US'],
        },
      }),
    ).toEqual([
      {
        path: ['fallbackChains'],
        message: 'fallback chains must not form a cycle',
      },
    ]);
  });

  it('accepts a diamond that is not a cycle', () => {
    expect(
      issuesFor({
        sourceLocale: 'en',
        defaultLocale: 'en',
        supportedLocales: ['aa', 'bb', 'cc', 'en'],
        fallbackChains: {
          aa: ['bb', 'cc', 'en'],
          bb: ['en'],
          cc: ['en'],
        },
      }),
    ).toEqual([]);
  });

  it('returns every defect ordered by the exact-refusal table', () => {
    const issues = issuesFor({
      sourceLocale: 'de-DE',
      defaultLocale: 'en-US',
      supportedLocales: ['en-US', 'fr-fr', 'en-US'],
      fallbackChains: {
        'es-ES': ['en-US'],
        'en-US': ['fr-FR'],
      },
    });
    expect(issues.map((issue) => issue.message)).toEqual([
      LOCALE_CONFIG_MESSAGES.canonical,
      LOCALE_CONFIG_MESSAGES.unique,
      LOCALE_CONFIG_MESSAGES.missingSource,
      LOCALE_CONFIG_MESSAGES.chainKeyUnsupported,
      LOCALE_CONFIG_MESSAGES.chainForDefault,
      LOCALE_CONFIG_MESSAGES.chainMissing,
    ]);
  });

  it('skips source/default rules when they are inherited and unknown', () => {
    expect(
      issuesFor({
        sourceLocale: null,
        defaultLocale: null,
        supportedLocales: ['en-US', 'fr-FR'],
        fallbackChains: { 'fr-FR': ['en-US'] },
      }),
    ).toEqual([]);
    expect(
      issuesFor({
        sourceLocale: null,
        defaultLocale: null,
        supportedLocales: ['en-US', 'fr-FR'],
        fallbackChains: { 'fr-FR': ['de-DE'] },
      }),
    ).toEqual([
      {
        path: ['fallbackChains', 'fr-FR', 0],
        message: 'fallback chain locale must be a supported locale',
      },
    ]);
  });
});

describe('localeConfigCanonicalJson', () => {
  it('orders keys bytewise and keeps stored supportedLocales and chain order', () => {
    expect(
      localeConfigCanonicalJson({
        sourceLocale: 'en-US',
        defaultLocale: 'en-US',
        supportedLocales: ['en-US', 'fr-FR', 'pt-BR'],
        fallbackChains: { 'pt-BR': ['fr-FR', 'en-US'], 'fr-FR': ['en-US'] },
      }),
    ).toBe(
      '{"defaultLocale":"en-US","fallbackChains":{"fr-FR":["en-US"],"pt-BR":["fr-FR","en-US"]},"sourceLocale":"en-US","supportedLocales":["en-US","fr-FR","pt-BR"]}',
    );
  });

  it('sorts supportedLocales by UTF-8 byte order and is request-order independent', () => {
    const base = {
      sourceLocale: 'en-US',
      defaultLocale: 'en-US',
      fallbackChains: { 'fr-FR': ['en-US'], de: ['en-US'] },
    };
    const a = localeConfigCanonicalJson({
      ...base,
      supportedLocales: ['fr-FR', 'en-US', 'de'],
    });
    const b = localeConfigCanonicalJson({
      ...base,
      supportedLocales: ['de', 'fr-FR', 'en-US'],
    });
    expect(a).toBe(b);
    expect(a).toContain('"supportedLocales":["de","en-US","fr-FR"]');
  });

  it('orders a shorter tag before a longer tag it prefixes', () => {
    expect(
      localeConfigCanonicalJson({
        sourceLocale: 'en',
        defaultLocale: 'en',
        supportedLocales: ['en-US', 'en'],
        fallbackChains: { 'en-US': ['en'] },
      }),
    ).toContain('"supportedLocales":["en","en-US"]');
  });

  it('pins the hash vector the database function must reproduce', () => {
    const json = localeConfigCanonicalJson({
      sourceLocale: 'en-US',
      defaultLocale: 'en-US',
      supportedLocales: ['en-US'],
      fallbackChains: {},
    });
    expect(json).toBe(
      '{"defaultLocale":"en-US","fallbackChains":{},"sourceLocale":"en-US","supportedLocales":["en-US"]}',
    );
    expect(createHash('sha256').update(json, 'utf8').digest('hex')).toBe(
      '604d53ba01396a82109c25c8a156b96d1ccf3af7cda0777b55579ef6d1a38860',
    );
    expect(
      createHash('sha256')
        .update(localeConfigCanonicalJson(valid), 'utf8')
        .digest('hex'),
    ).toBe('74f1ad73d3f4bd74643824e7669afe78e44490419f3cfe34ba7cc8cc1fce4557');
  });
});
