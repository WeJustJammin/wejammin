import type { TaxonomyVersionFacts } from './taxonomy-versions-read';
import {
  CANONICAL_DOMAIN_LABEL,
  type CanonicalDomain,
  type TaxonomyShape,
} from './taxonomy-vocabulary';

/** The unsent rules of the form, as the comparison reads them. */
export interface DraftRules {
  readonly shape: TaxonomyShape | '';
  readonly typeKeys: readonly string[];
  readonly fieldKeys: readonly string[];
  readonly domains: readonly CanonicalDomain[];
}

export interface ReviewRow {
  readonly setting: string;
  readonly yours: string;
  readonly latest: string;
  readonly difference: string;
}

const SHAPE_LABEL: Readonly<Record<TaxonomyShape, string>> = {
  flat: 'Flat',
  hierarchical: 'Hierarchical',
};

const join = (values: readonly string[]): string =>
  values.length === 0 ? 'None' : values.join(', ');

/** "Same", or the members that are on one side only, or a changed order. */
const listDifference = (
  yours: readonly string[],
  latest: readonly string[],
  name: (value: string) => string = (value) => value,
): string => {
  const onlyYours = yours.filter((value) => !latest.includes(value));
  const onlyLatest = latest.filter((value) => !yours.includes(value));
  if (onlyYours.length === 0 && onlyLatest.length === 0)
    return JSON.stringify(yours) === JSON.stringify(latest)
      ? 'Same'
      : 'Same keys in a different order.';
  return [
    onlyYours.length === 0
      ? null
      : `Only in your draft: ${onlyYours.map(name).join(', ')}.`,
    onlyLatest.length === 0
      ? null
      : `Only in the latest version: ${onlyLatest.map(name).join(', ')}.`,
  ]
    .filter((part): part is string => part !== null)
    .join(' ');
};

/** Your unsent draft beside the newer version, one row per setting, in words. */
export const reviewRows = (
  draft: DraftRules,
  latest: TaxonomyVersionFacts,
): ReviewRow[] => {
  const domainName = (value: string): string =>
    CANONICAL_DOMAIN_LABEL[value as CanonicalDomain];
  return [
    {
      setting: 'Shape',
      yours: draft.shape === '' ? 'Not chosen' : SHAPE_LABEL[draft.shape],
      latest: SHAPE_LABEL[latest.shape],
      difference: draft.shape === latest.shape ? 'Same' : 'Changed',
    },
    {
      setting: 'Content type keys',
      yours: join(draft.typeKeys),
      latest: join(latest.allowedTypeKeys),
      difference: listDifference(draft.typeKeys, latest.allowedTypeKeys),
    },
    {
      setting: 'Field keys',
      yours: join(draft.fieldKeys),
      latest: join(latest.allowedFieldKeys),
      difference: listDifference(draft.fieldKeys, latest.allowedFieldKeys),
    },
    {
      setting: 'Canonical domains declared',
      yours: join(draft.domains.map(domainName)),
      latest: join(latest.canonicalOverlapDomains.map(domainName)),
      difference: listDifference(
        draft.domains,
        latest.canonicalOverlapDomains,
        domainName,
      ),
    },
  ];
};
