import {
  LOCALE_CONFIG_MESSAGES,
  TEMPLATE_BINDING_MESSAGES,
  WORKFLOW_MEMBER_MESSAGES,
} from '@wejammin/contracts';

/**
 * Every refusal the database re-evaluates for CMS-03A-09: the locale
 * exact-refusal table (BE03a OD-4), the workflow member pair and the template
 * binding pair and uniqueness. The Worker evaluates the same text from the
 * contract schema, but only the database knows the inherited source and
 * default locale.
 */
const DATABASE_REEVALUATED: ReadonlySet<string> = new Set([
  ...Object.values(LOCALE_CONFIG_MESSAGES),
  ...Object.values(WORKFLOW_MEMBER_MESSAGES),
  TEMPLATE_BINDING_MESSAGES.pair,
  TEMPLATE_BINDING_MESSAGES.unique,
]);

const isPresent = (value: unknown, key: string): boolean =>
  typeof value === 'object' &&
  value !== null &&
  (value as Readonly<Record<string, unknown>>)[key] != null;

/**
 * AC1182: a successor that replaces the locale configuration (both members
 * present) can only be refused completely by the database, because several
 * rules read the inherited source and default locale. When every Zod issue is
 * one of the database's own re-evaluated rules the request is forwarded, so the
 * database returns every issue of the request in table order.
 */
export const successorDeferredToDatabase = (
  value: unknown,
  issues: readonly Readonly<{ code?: string; message: string }>[],
): boolean =>
  isPresent(value, 'supportedLocales') &&
  isPresent(value, 'fallbackChains') &&
  issues.length > 0 &&
  issues.every(
    (issue) =>
      issue.code === 'custom' && DATABASE_REEVALUATED.has(issue.message),
  );
