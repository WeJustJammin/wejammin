import {
  LOCALE_CONFIG_LIMITS,
  LOCALE_CONFIG_MESSAGES,
  canonicalizeBcp47,
  isCanonicalLocale,
} from '@wejammin/contracts';

/**
 * Pure FE03 "Locale configuration fields (OD-4)" model. BE03a owns the rules
 * and the exact messages; this module owns the editing state so the browser
 * can only build configurations that satisfy the chain rules by construction:
 * a group edits the intermediate entries and the submitted chain is those
 * entries plus the fixed final default.
 */

export interface LocaleConfig {
  readonly sourceLocale: string;
  readonly defaultLocale: string;
  readonly supportedLocales: readonly string[];
  readonly fallbackChains: Readonly<Record<string, readonly string[]>>;
}

export interface LocaleConfigDraft {
  /** Tags in entry order; the server stores them sorted. */
  readonly supportedLocales: readonly string[];
  /** Empty string means "not selected". */
  readonly sourceLocale: string;
  readonly defaultLocale: string;
  /** Intermediate entries (0..15) for every supported tag except the default. */
  readonly intermediates: Readonly<Record<string, readonly string[]>>;
}

export interface LocaleIssue {
  readonly path: readonly (string | number)[];
  readonly message: string;
}

export interface TagError {
  readonly message: string;
  /** The canonical spelling, offered only through an explicit button. */
  readonly suggestion: string | null;
}

export const MAX_LANGUAGES_MESSAGE = 'Maximum 32 languages';

/** Rebuild the intermediates so they hold only entries that can still be valid. */
const normalized = (
  base: Omit<LocaleConfigDraft, 'intermediates'>,
  previous: Readonly<Record<string, readonly string[]>>,
): LocaleConfigDraft => {
  const supported = new Set(base.supportedLocales);
  const intermediates: Record<string, readonly string[]> = {};
  for (const target of base.supportedLocales) {
    if (target === base.defaultLocale) continue;
    const kept: string[] = [];
    for (const tag of previous[target] ?? [])
      if (
        supported.has(tag) &&
        tag !== target &&
        tag !== base.defaultLocale &&
        !kept.includes(tag)
      )
        kept.push(tag);
    intermediates[target] = kept;
  }
  return { ...base, intermediates };
};

export const emptyLocaleDraft = (): LocaleConfigDraft => ({
  supportedLocales: [],
  sourceLocale: '',
  defaultLocale: '',
  intermediates: {},
});

export const draftFromConfig = (config: LocaleConfig): LocaleConfigDraft => {
  const previous: Record<string, readonly string[]> = {};
  for (const [target, chain] of Object.entries(config.fallbackChains))
    previous[target] = chain.filter((tag) => tag !== config.defaultLocale);
  return normalized(
    {
      supportedLocales: config.supportedLocales,
      sourceLocale: config.sourceLocale,
      defaultLocale: config.defaultLocale,
    },
    previous,
  );
};

const chainFor = (draft: LocaleConfigDraft, target: string): string[] => [
  ...(draft.intermediates[target] ?? []),
  draft.defaultLocale,
];

export const submitConfig = (draft: LocaleConfigDraft): LocaleConfig => {
  const fallbackChains: Record<string, readonly string[]> = {};
  if (draft.defaultLocale !== '')
    for (const target of draft.supportedLocales)
      if (target !== draft.defaultLocale)
        fallbackChains[target] = chainFor(draft, target);
  return {
    sourceLocale: draft.sourceLocale,
    defaultLocale: draft.defaultLocale,
    supportedLocales: draft.supportedLocales,
    fallbackChains,
  };
};

export const addTag = (
  draft: LocaleConfigDraft,
  raw: string,
): Readonly<{ draft: LocaleConfigDraft; error: TagError | null }> => {
  const tag = raw.trim();
  if (draft.supportedLocales.includes(tag))
    return {
      draft,
      error: { message: LOCALE_CONFIG_MESSAGES.unique, suggestion: null },
    };
  if (!isCanonicalLocale(tag)) {
    const suggestion = canonicalizeBcp47(tag);
    return {
      draft,
      error: {
        message: LOCALE_CONFIG_MESSAGES.canonical,
        suggestion: isCanonicalLocale(suggestion) ? suggestion : null,
      },
    };
  }
  if (draft.supportedLocales.length >= LOCALE_CONFIG_LIMITS.maxSupportedLocales)
    return {
      draft,
      error: { message: MAX_LANGUAGES_MESSAGE, suggestion: null },
    };
  return {
    draft: normalized(
      { ...draft, supportedLocales: [...draft.supportedLocales, tag] },
      draft.intermediates,
    ),
    error: null,
  };
};

export const removeTag = (
  draft: LocaleConfigDraft,
  tag: string,
): Readonly<{ draft: LocaleConfigDraft; announcement: string }> => {
  if (!draft.supportedLocales.includes(tag)) return { draft, announcement: '' };
  const affected = draft.supportedLocales.filter((target) =>
    (draft.intermediates[target] ?? []).includes(tag),
  );
  const next = normalized(
    {
      supportedLocales: draft.supportedLocales.filter((entry) => entry !== tag),
      sourceLocale: draft.sourceLocale === tag ? '' : draft.sourceLocale,
      defaultLocale: draft.defaultLocale === tag ? '' : draft.defaultLocale,
    },
    draft.intermediates,
  );
  return {
    draft: next,
    announcement:
      affected.length === 0
        ? `Removed ${tag}.`
        : `Removed ${tag} from the fallback order for ${affected.join(', ')}`,
  };
};

export const setSourceLocale = (
  draft: LocaleConfigDraft,
  tag: string,
): LocaleConfigDraft =>
  draft.supportedLocales.includes(tag)
    ? { ...draft, sourceLocale: tag }
    : draft;

export const setDefaultLocale = (
  draft: LocaleConfigDraft,
  tag: string,
): LocaleConfigDraft =>
  draft.supportedLocales.includes(tag)
    ? normalized({ ...draft, defaultLocale: tag }, draft.intermediates)
    : draft;

export const availableIntermediates = (
  draft: LocaleConfigDraft,
  target: string,
): string[] =>
  draft.supportedLocales.filter(
    (tag) =>
      tag !== target &&
      tag !== draft.defaultLocale &&
      !(draft.intermediates[target] ?? []).includes(tag),
  );

const withIntermediates = (
  draft: LocaleConfigDraft,
  target: string,
  entries: readonly string[],
): LocaleConfigDraft => ({
  ...draft,
  intermediates: { ...draft.intermediates, [target]: entries },
});

export const addIntermediate = (
  draft: LocaleConfigDraft,
  target: string,
  tag: string,
): LocaleConfigDraft =>
  availableIntermediates(draft, target).includes(tag) &&
  (draft.intermediates[target] ?? []).length <
    LOCALE_CONFIG_LIMITS.maxChainLength - 1
    ? withIntermediates(draft, target, [
        ...(draft.intermediates[target] ?? []),
        tag,
      ])
    : draft;

export const removeIntermediate = (
  draft: LocaleConfigDraft,
  target: string,
  tag: string,
): LocaleConfigDraft =>
  withIntermediates(
    draft,
    target,
    (draft.intermediates[target] ?? []).filter((entry) => entry !== tag),
  );

export const moveIntermediate = (
  draft: LocaleConfigDraft,
  target: string,
  tag: string,
  direction: -1 | 1,
): Readonly<{ draft: LocaleConfigDraft; announcement: string | null }> => {
  const entries = [...(draft.intermediates[target] ?? [])];
  const from = entries.indexOf(tag);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= entries.length)
    return { draft, announcement: null };
  entries.splice(from, 1);
  entries.splice(to, 0, tag);
  return {
    draft: withIntermediates(draft, target, entries),
    announcement: `${tag} is now ${to + 1} of ${entries.length + 1} in the fallback order for ${target}`,
  };
};
