import { sanitizeConfigurationValue } from './platform-configuration-presentation-security';
import type {
  PlatformConfigurationAsyncState,
  PlatformConfigurationBreakpoint,
  PlatformConfigurationError,
  PlatformConfigurationRecord,
} from './platform-configuration-workbench-types';
import type { SortState } from './settings-flags-runtime-record-utils';

export const getBreakpoint = (): PlatformConfigurationBreakpoint => {
  if (typeof window === 'undefined') return 'desktop';
  if (window.innerWidth <= 768) return 'mobile';
  if (window.innerWidth <= 1024) return 'tablet';
  return 'desktop';
};

export const subscribeToBreakpoint = (notify: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener('resize', notify);
  return () => window.removeEventListener('resize', notify);
};

export const canonicalUrl = (value: string | undefined): URL =>
  new URL(value ?? '/app/platform-configuration-admin', 'https://wejamm.in');

const SETTINGS_RUNTIME_CONTEXT_KEYS = [
  'tab',
  'key',
  'view',
  'cursor',
  'state',
  'projection',
  'workbench',
  'responsive',
  'contract',
  'registry',
] as const;

type SettingsRuntimeQuery = Readonly<Record<string, string | null | undefined>>;

const SETTINGS_RUNTIME_SORT_KEYS = [
  'key',
  'state',
  'version',
  'source',
] as const;
type SettingsRuntimeSortKey = (typeof SETTINGS_RUNTIME_SORT_KEYS)[number];

const copySettingsRuntimeContext = (
  url: URL,
  query: SettingsRuntimeQuery,
): void => {
  for (const name of SETTINGS_RUNTIME_CONTEXT_KEYS) {
    const value = query[name];
    if (typeof value === 'string' && value.length > 0)
      url.searchParams.set(name, value);
  }
};

/** Build a bookmarkable settings URL without dropping server-provided context. */
export const settingsRuntimeUrl = (
  base: string | undefined,
  query: SettingsRuntimeQuery,
  filter: string,
  selectedId: string | null,
  sort: SortState | null = null,
): string => {
  const url = canonicalUrl(base);
  copySettingsRuntimeContext(url, query);
  const nextFilter = filter.trim();
  if (nextFilter.length > 0) url.searchParams.set('query', nextFilter);
  else url.searchParams.delete('query');
  if (selectedId === null) url.searchParams.delete('selected');
  else url.searchParams.set('selected', selectedId);
  if (sort === null) url.searchParams.delete('sort');
  else url.searchParams.set('sort', serializeSettingsRuntimeSort(sort));
  return `${url.pathname}${url.search}${url.hash}`;
};

export const settingsRuntimeResetUrl = (
  base: string | undefined,
  query: SettingsRuntimeQuery,
): string => settingsRuntimeUrl(base, query, '', null);

export const selectedFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  return new URL(window.location.href).searchParams.get('selected');
};

export const parseSettingsRuntimeSort = (
  value: string | null | undefined,
): SortState | null => {
  if (typeof value !== 'string') return null;
  const match = /^([a-z][a-z0-9_.-]*)_(asc|desc)$/u.exec(value);
  if (match === null) return null;
  const key = match[1] as SettingsRuntimeSortKey;
  if (!SETTINGS_RUNTIME_SORT_KEYS.includes(key)) return null;
  return {
    key,
    direction: match[2] === 'asc' ? 'ascending' : 'descending',
  };
};

export const serializeSettingsRuntimeSort = (sort: SortState): string =>
  `${sort.key}_${sort.direction === 'ascending' ? 'asc' : 'desc'}`;

export const sortFromUrl = (): SortState | null =>
  typeof window === 'undefined'
    ? null
    : parseSettingsRuntimeSort(
        new URL(window.location.href).searchParams.get('sort'),
      );

export const normalizedVersion = (
  value: string | null | undefined,
): string | null => {
  if (value === null || value === undefined) return null;
  const stripped = value.trim().replace(/^W\//u, '').replace(/^"|"$/gu, '');
  return /^[1-9][0-9]{0,17}$/u.test(stripped) ? stripped : null;
};

export const ifMatchHeader = (
  value: string | null | undefined,
): string | null => {
  const version = normalizedVersion(value);
  return version === null ? null : `"${version}"`;
};

export const recordFromEffectiveResponse = async (
  value: unknown,
): Promise<PlatformConfigurationRecord | null> => {
  const { Cfg05a02EffectiveValueResponseSchema } =
    await import('@wejammin/contracts/platform-configuration/validators');
  const parsed = Cfg05a02EffectiveValueResponseSchema.safeParse(value);
  if (!parsed.success) return null;
  const response = parsed.data;
  return {
    id: response.definitionId,
    version: response.evaluatorVersion,
    state:
      response.compatibility === 'exact' ? 'effective' : 'compatible-fallback',
    provenance: [
      {
        source: 'settings-flags-runtime',
        evidence: `canonical-effective-value:${response.correlationId}`,
        at: response.evaluatedAt,
        visibility: 'disclosed',
      },
    ],
    projection: {
      definitionId: response.definitionId,
      definitionVersionId: response.definitionVersionId,
      key: response.key,
      valueKind: response.valueKind,
      typedValue: sanitizeConfigurationValue(response.typedValue),
      sourceScope: response.sourceScope,
      sourceSubjectId: response.sourceSubjectId,
      sourceValueVersionId: response.sourceValueVersionId,
      isDefault: response.isDefault,
      effectiveFrom: response.effectiveFrom,
      effectiveTo: response.effectiveTo,
      evaluatedAt: response.evaluatedAt,
      evaluatorVersion: response.evaluatorVersion,
      correlationId: response.correlationId,
      compatibility: response.compatibility,
    },
  };
};

export const safeMutationEndpoint = (endpoint: string): boolean => {
  try {
    const target = new URL(
      endpoint,
      typeof window === 'undefined'
        ? 'https://wejamm.in'
        : window.location.href,
    );
    const origin =
      typeof window === 'undefined'
        ? 'https://wejamm.in'
        : window.location.origin;
    return target.origin === origin && target.pathname.startsWith('/api/v1/');
  } catch {
    return false;
  }
};

export const requestError = (
  code: string,
  message: string,
): PlatformConfigurationError => ({
  code,
  message,
  requestId: 'platform-configuration-client',
});

export const stateWithError = (
  current: PlatformConfigurationAsyncState,
  error: PlatformConfigurationError,
  status: PlatformConfigurationAsyncState['status'] = 'error',
): PlatformConfigurationAsyncState => ({
  ...current,
  status,
  error,
  retryable: status === 'degraded' || error.code === 'RATE_LIMITED',
});

export const queryValue = (key: string): string =>
  typeof window === 'undefined'
    ? ''
    : (new URL(window.location.href).searchParams.get(key) ?? '');
