import { capabilityLabel } from './cms-capability-grant-labels';
import type { CmsCapabilityGrantQueryState } from './cms-capability-grant-types';

const titleCase = (value: string): string =>
  `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;

/**
 * Polite result-count and filter summary for the grant list (FE03 a11y). It
 * names the filters but never the person filter's value, so no person
 * identifier reaches an announcement.
 */
export const grantListSummary = (
  count: number,
  query: CmsCapabilityGrantQueryState,
  personFilterActive: boolean,
): string => {
  const shown = `${count} ${count === 1 ? 'grant' : 'grants'} shown.`;
  const parts: string[] = [];
  if (query.capability !== undefined)
    parts.push(`capability ${capabilityLabel(query.capability)}`);
  if (query.state !== undefined) parts.push(`state ${titleCase(query.state)}`);
  if (personFilterActive) parts.push('a person filter');
  return parts.length === 0
    ? `${shown} No filters applied.`
    : `${shown} Filtered by ${parts.join(', ')}.`;
};
