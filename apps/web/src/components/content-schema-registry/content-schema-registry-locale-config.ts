import {
  LOCALE_CONFIG_MESSAGES,
  evaluateLocaleConfig,
  type LocaleConfigIssue,
} from '@wejammin/contracts/client';

import {
  submitConfig,
  type LocaleConfig,
  type LocaleConfigDraft,
  type LocaleIssue,
} from './content-schema-registry-locale-draft';

export * from './content-schema-registry-locale-draft';

/** Client validation reuses the BE03a rule table so messages cannot drift. */
export const validateDraft = (draft: LocaleConfigDraft): LocaleIssue[] => {
  const issues: LocaleConfigIssue[] = [];
  evaluateLocaleConfig(submitConfig(draft), (path, message) => {
    issues.push({ path, message });
  });
  return issues.filter(
    (issue) =>
      !(
        draft.defaultLocale === '' &&
        issue.message === LOCALE_CONFIG_MESSAGES.chainMissing
      ),
  );
};

/** Languages whose fallback groups sit on a cycle, in supported order. */
export const cycleParticipants = (draft: LocaleConfigDraft): string[] => {
  const reaches = (from: string, goal: string): boolean => {
    const seen = new Set<string>();
    const stack = [...(draft.intermediates[from] ?? [])];
    while (stack.length > 0) {
      const next = stack.pop() as string;
      if (next === goal) return true;
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(...(draft.intermediates[next] ?? []));
    }
    return false;
  };
  return draft.supportedLocales.filter((tag) => reaches(tag, tag));
};

const INDEX_SEGMENT = /^\d{1,2}$/u;

/** RFC 6901 pointer to a typed path; array positions become numbers. */
export const pathFromPointer = (pointer: string): (string | number)[] => {
  if (pointer === '') return [];
  const segments = pointer
    .split('/')
    .slice(1)
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'));
  const indexAt = segments[0] === 'supportedLocales' ? 1 : 2;
  return segments.map((segment, position) =>
    position === indexAt && INDEX_SEGMENT.test(segment)
      ? Number(segment)
      : segment,
  );
};

export type IssueControl =
  | Readonly<{ control: 'tags' | 'source' | 'default' | 'summary' }>
  | Readonly<{ control: 'chain'; target: string; index?: number }>;

export const issueControlTarget = (
  path: readonly (string | number)[],
): IssueControl => {
  const [root, target, index] = path;
  if (root === 'supportedLocales') return { control: 'tags' };
  if (root === 'sourceLocale') return { control: 'source' };
  if (root === 'defaultLocale') return { control: 'default' };
  if (root === 'fallbackChains' && typeof target === 'string')
    return typeof index === 'number'
      ? { control: 'chain', target, index }
      : { control: 'chain', target };
  return { control: 'summary' };
};

const slug = (tag: string): string => tag.replaceAll(/[^A-Za-z0-9]/gu, '-');

/** DOM id of the control that owns an issue; the summary has its own id. */
export const localeControlId = (
  formId: string,
  control: IssueControl,
): string => {
  const base = `${formId}-locale`;
  if (control.control === 'chain')
    return `${base}-chain-${slug(control.target)}`;
  return `${base}-${control.control}`;
};

const sorted = (values: readonly string[]): string[] =>
  [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));

const sourceChain = (config: LocaleConfig, tag: string): readonly string[] =>
  tag === config.defaultLocale ? [] : (config.fallbackChains[tag] ?? []);

export interface LocaleDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly reordered: readonly string[];
}

/** Each added language, removed language and retained language whose order changed. */
export const diffAgainstSource = (
  source: LocaleConfig | null,
  draft: LocaleConfigDraft,
): LocaleDiff => {
  const before = new Set(source?.supportedLocales ?? []);
  const after = new Set(draft.supportedLocales);
  const next = submitConfig(draft);
  const retained = draft.supportedLocales.filter((tag) => before.has(tag));
  return {
    added: sorted(draft.supportedLocales.filter((tag) => !before.has(tag))),
    removed: sorted([...before].filter((tag) => !after.has(tag))),
    reordered: sorted(
      source === null
        ? []
        : retained.filter((tag) => {
            const was = sourceChain(source, tag);
            const now =
              tag === next.defaultLocale
                ? []
                : (next.fallbackChains[tag] ?? []);
            return was.join('\u0000') !== now.join('\u0000');
          }),
    ),
  };
};

export const chainSentence = (
  target: string,
  intermediates: readonly string[],
  defaultLocale: string,
): string => `${target}: ${[...intermediates, defaultLocale].join(' → ')}`;
