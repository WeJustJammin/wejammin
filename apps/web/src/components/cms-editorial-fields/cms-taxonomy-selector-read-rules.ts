import type {
  TaxonomySelectorPage,
  TaxonomySelectorTerm,
} from '@wejammin/contracts';
import {
  CMS_FIELD_KEY_PATTERN,
  CMS_TYPE_KEY_PATTERN,
  isCmsUuid,
  isCmsVersion,
} from '@wejammin/contracts/client';

import {
  TAXONOMY_KEY_REGEX,
  TAXONOMY_SHAPES,
  type TaxonomyShape,
} from '../cms-taxonomy-designer/taxonomy-vocabulary-core';
import {
  LABEL_MAX_CHARACTERS,
  TERM_KEY_REGEX,
  isLocale,
} from '../cms-taxonomy-terms/term-rules';

/*
 * The zod-free rules of CMS-03C-17 (FE03 :1618/:1747, AC261): the strict admission of the
 * selector query and the structural verification of one `TaxonomySelectorPage`. The same-origin
 * proxy has already parsed the strict contract, so the browser repeats the rules and accepts a 200
 * only as the page of THIS request whose quoted ETag is its `pageVersion`. Every grammar is the
 * shared rule the generated contract is built from, so the two cannot drift.
 */

/** The typed selector query the control reads for; `limit` and `cursor` are optional. */
export interface TaxonomySelectorQueryInput {
  readonly typeKey: string;
  readonly fieldKey: string;
  readonly locale: string;
  readonly limit?: number | undefined;
  readonly cursor?: string | null | undefined;
}

/** The admitted query: the resolved limit and the signed cursor (null when absent). */
export interface ResolvedSelectorQuery {
  readonly typeKey: string;
  readonly fieldKey: string;
  readonly locale: string;
  readonly limit: number;
  readonly cursor: string | null;
}

/**
 * The proxy and the Worker route answer a missing, unknown or unusable member with a 400
 * (INVALID_REQUEST) and a type key, field key or locale outside its grammar or a limit outside
 * 1-100 with a 422; the local admission mirrors that split.
 */
export type ParsedSelectorQuery =
  | { readonly ok: true; readonly value: ResolvedSelectorQuery }
  | { readonly ok: false; readonly status: 400 | 422 };

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_CURSOR = 512;
const MAX_ITEMS = 100;
const QUERY_KEYS = ['typeKey', 'fieldKey', 'locale', 'limit', 'cursor'];
const PAGE_MEMBERS = ['items', 'nextCursor', 'pageVersion'];
const TERM_MEMBERS = [
  'taxonomyId',
  'taxonomyVersionId',
  'taxonomyKey',
  'shape',
  'termId',
  'termKey',
  'parentId',
  'label',
];

type Json = Readonly<Record<string, unknown>>;

const isJson = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnly = (record: Json, allowed: readonly string[]): boolean =>
  Object.keys(record).every((key) => allowed.includes(key));

const hasAll = (record: Json, required: readonly string[]): boolean =>
  required.every((key) => Object.hasOwn(record, key));

/**
 * The input query's `cursor`: absent or null, or a string of 1 to 512 code units (the signed
 * cursor is opaque and passed through unchanged). A page's `nextCursor` has its own wider rule.
 */
const readCursor = (value: unknown): string | null | undefined => {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > MAX_CURSOR
  )
    return undefined;
  return value;
};

/**
 * The page's `nextCursor`: an exact null, or a string of 0 to 512 code units (empty allowed).
 */
const readPageCursor = (value: unknown): string | null | undefined => {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > MAX_CURSOR) return undefined;
  return value;
};

const uuidOrNull = (value: unknown): string | null | undefined => {
  if (value === null) return null;
  return typeof value === 'string' && isCmsUuid(value) ? value : undefined;
};

/** The selector label is the requested locale's own: 1 to 160 code units, or null (no NFC rule). */
const labelOrNull = (value: unknown): string | null | undefined => {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const length = value.length;
  return length >= 1 && length <= LABEL_MAX_CHARACTERS ? value : undefined;
};

const shapeOrNull = (value: unknown): TaxonomyShape | null => {
  if (typeof value !== 'string') return null;
  for (const shape of TAXONOMY_SHAPES) if (shape === value) return shape;
  return null;
};

/** Strictly admit the query before any dispatch; nothing the caller invented reaches the proxy. */
export const parseSelectorQuery = (candidate: unknown): ParsedSelectorQuery => {
  if (!isJson(candidate)) return { ok: false, status: 400 };
  for (const key of Object.keys(candidate))
    if (!QUERY_KEYS.includes(key)) return { ok: false, status: 400 };
  const { typeKey, fieldKey, locale } = candidate;
  if (
    typeof typeKey !== 'string' ||
    typeKey === '' ||
    typeof fieldKey !== 'string' ||
    fieldKey === '' ||
    typeof locale !== 'string' ||
    locale === ''
  )
    return { ok: false, status: 400 };
  const limit = candidate.limit === undefined ? DEFAULT_LIMIT : candidate.limit;
  if (typeof limit !== 'number' || !Number.isInteger(limit))
    return { ok: false, status: 400 };
  const cursor = readCursor(candidate.cursor);
  if (cursor === undefined) return { ok: false, status: 400 };
  if (
    !CMS_TYPE_KEY_PATTERN.test(typeKey) ||
    !CMS_FIELD_KEY_PATTERN.test(fieldKey) ||
    !isLocale(locale) ||
    limit < 1 ||
    limit > MAX_LIMIT
  )
    return { ok: false, status: 422 };
  return { ok: true, value: { typeKey, fieldKey, locale, limit, cursor } };
};

/** One author-facing row: every UUID is a UUID and a flat term declares no parent. */
const verifiedTerm = (candidate: unknown): TaxonomySelectorTerm | null => {
  if (
    !isJson(candidate) ||
    !hasOnly(candidate, TERM_MEMBERS) ||
    !hasAll(candidate, TERM_MEMBERS)
  )
    return null;
  const { taxonomyId, taxonomyVersionId, taxonomyKey, termId, termKey } =
    candidate;
  const shape = shapeOrNull(candidate.shape);
  const parentId = uuidOrNull(candidate.parentId);
  const label = labelOrNull(candidate.label);
  if (
    typeof taxonomyId !== 'string' ||
    !isCmsUuid(taxonomyId) ||
    typeof taxonomyVersionId !== 'string' ||
    !isCmsUuid(taxonomyVersionId) ||
    typeof taxonomyKey !== 'string' ||
    !TAXONOMY_KEY_REGEX.test(taxonomyKey) ||
    typeof termId !== 'string' ||
    !isCmsUuid(termId) ||
    typeof termKey !== 'string' ||
    !TERM_KEY_REGEX.test(termKey) ||
    shape === null ||
    parentId === undefined ||
    label === undefined ||
    (shape === 'flat' && parentId !== null)
  )
    return null;
  return {
    taxonomyId,
    taxonomyVersionId,
    taxonomyKey,
    shape,
    termId,
    termKey,
    parentId,
    label,
  };
};

/** The page of THIS request whose strong ETag is its `pageVersion`, or null. */
export const verifiedTaxonomySelectorPage = (
  candidate: unknown,
  etag: string | null,
): TaxonomySelectorPage | null => {
  if (
    !isJson(candidate) ||
    !hasOnly(candidate, PAGE_MEMBERS) ||
    !hasAll(candidate, PAGE_MEMBERS)
  )
    return null;
  const { items, pageVersion } = candidate;
  const nextCursor = readPageCursor(candidate.nextCursor);
  if (
    !Array.isArray(items) ||
    items.length > MAX_ITEMS ||
    nextCursor === undefined ||
    typeof pageVersion !== 'string' ||
    !isCmsVersion(pageVersion) ||
    etag !== `"${pageVersion}"`
  )
    return null;
  const verified: TaxonomySelectorTerm[] = [];
  for (const entry of items as unknown[]) {
    const term = verifiedTerm(entry);
    if (term === null || verified.some((item) => item.termId === term.termId))
      return null;
    verified.push(term);
  }
  return { items: verified, nextCursor, pageVersion };
};
