import {
  LOCALE_CONFIG_LIMITS,
  LOCALE_CONFIG_MESSAGES,
  isCanonicalLocale,
} from './locale-canonical.ts';

/**
 * The zod-free half of the BE03a OD-4 locale rules. The browser registry
 * island validates drafts with this file so the exact messages and their
 * order cannot drift from the server, without shipping zod to the route.
 *
 * `sourceLocale`/`defaultLocale` are `null` only for CMS-03A-09, which
 * inherits them from the immutable source version that the Worker cannot see;
 * the source/default rules are then left to the database validator.
 */
export type LocaleConfigInput = Readonly<{
  sourceLocale: string | null;
  defaultLocale: string | null;
  supportedLocales: readonly string[];
  fallbackChains: Readonly<Record<string, readonly string[]>>;
}>;

export type LocaleConfigIssuePath = (string | number)[];

export type LocaleConfigIssue = Readonly<{
  path: readonly (string | number)[];
  message: string;
}>;

const hasCycle = (edges: ReadonlyMap<string, readonly string[]>): boolean => {
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (node: string): boolean => {
    const current = state.get(node);
    if (current === 'visiting') return true;
    if (current === 'done') return false;
    state.set(node, 'visiting');
    for (const next of edges.get(node) ?? []) if (visit(next)) return true;
    state.set(node, 'done');
    return false;
  };
  for (const node of edges.keys()) if (visit(node)) return true;
  return false;
};

/**
 * One ordered pass over the exact-refusal table of BE03a OD-4. Issues are
 * grouped by rule in table order, then by position, so a request with several
 * defects returns every issue in a deterministic order.
 */
export const evaluateLocaleConfig = (
  config: LocaleConfigInput,
  report: (path: LocaleConfigIssuePath, message: string) => void,
): void => {
  const m = LOCALE_CONFIG_MESSAGES;
  const add = report;
  const { sourceLocale, defaultLocale, supportedLocales, fallbackChains } =
    config;
  const supported = new Set(supportedLocales);
  const keys = Object.keys(fallbackChains);
  const chainOf = (key: string): readonly string[] =>
    fallbackChains[key] as readonly string[];
  // A chain is evaluated only for a well-formed target: a supported locale
  // that is not the default, so one defect never reports twice.
  const targets = keys.filter(
    (key) => supported.has(key) && key !== defaultLocale,
  );

  if (
    supportedLocales.length < 1 ||
    supportedLocales.length > LOCALE_CONFIG_LIMITS.maxSupportedLocales
  )
    add(['supportedLocales'], m.size);

  supportedLocales.forEach((tag, index) => {
    if (!isCanonicalLocale(tag)) add(['supportedLocales', index], m.canonical);
  });
  for (const key of keys)
    if (!isCanonicalLocale(key)) add(['fallbackChains', key], m.canonical);
  for (const key of keys)
    chainOf(key).forEach((tag, index) => {
      if (!isCanonicalLocale(tag))
        add(['fallbackChains', key, index], m.canonical);
    });

  const seen = new Set<string>();
  supportedLocales.forEach((tag, index) => {
    if (seen.has(tag)) add(['supportedLocales', index], m.unique);
    seen.add(tag);
  });

  if (sourceLocale !== null && !supported.has(sourceLocale))
    add(['supportedLocales'], m.missingSource);
  if (defaultLocale !== null && !supported.has(defaultLocale))
    add(['supportedLocales'], m.missingDefault);

  for (const key of keys)
    if (!supported.has(key))
      add(['fallbackChains', key], m.chainKeyUnsupported);
  if (defaultLocale !== null && Object.hasOwn(fallbackChains, defaultLocale))
    add(['fallbackChains', defaultLocale], m.chainForDefault);
  if (
    defaultLocale !== null &&
    supportedLocales.some(
      (tag) => tag !== defaultLocale && !Object.hasOwn(fallbackChains, tag),
    )
  )
    add(['fallbackChains'], m.chainMissing);

  for (const target of targets)
    if (
      chainOf(target).length < 1 ||
      chainOf(target).length > LOCALE_CONFIG_LIMITS.maxChainLength
    )
      add(['fallbackChains', target], m.chainSize);
  for (const target of targets)
    chainOf(target).forEach((tag, index) => {
      if (!supported.has(tag))
        add(['fallbackChains', target, index], m.chainUnsupported);
    });
  for (const target of targets) {
    const chainSeen = new Set<string>();
    chainOf(target).forEach((tag, index) => {
      if (chainSeen.has(tag))
        add(['fallbackChains', target, index], m.chainUnique);
      chainSeen.add(tag);
    });
  }
  for (const target of targets)
    chainOf(target).forEach((tag, index) => {
      if (tag === target) add(['fallbackChains', target, index], m.chainSelf);
    });
  if (defaultLocale !== null)
    for (const target of targets) {
      const chain = chainOf(target);
      if (chain.length > 0 && chain[chain.length - 1] !== defaultLocale)
        add(['fallbackChains', target], m.chainEnd);
    }

  const edges = new Map<string, readonly string[]>();
  for (const target of targets)
    edges.set(
      target,
      chainOf(target).filter((tag) => tag !== target && supported.has(tag)),
    );
  if (hasCycle(edges)) add(['fallbackChains'], m.chainCycle);
};
