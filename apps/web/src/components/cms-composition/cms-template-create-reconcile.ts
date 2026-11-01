import type {
  TemplateVersionDetail,
  TemplateVersionRequest,
  TemplateVersionResource,
} from '@wejammin/contracts';

import type { CmsTemplateLatestResult } from './cms-template-edit-reconcile';

/**
 * What the template read says about a create (`expectedVersion: null`) whose outcome was unknown (FE03 1048
 * `commandState` degraded: "reconciles by refetching ... before any retry"; DEC-242 item 3). The key is the
 * identity of the attempt, and the first version of a key is version 1:
 * - `created`: the key holds version 1 with exactly the attempted definition, so the write committed.
 * - `absent`: the read answered 404 for the key, so nothing committed and the unchanged request may be replayed
 *   with its own idempotency key.
 * - `existing`: the key holds something else (another definition, or a later version); nothing is guessed.
 * - `undetermined`: the read could not answer; the retry stays held.
 */
export type CreateOutcomeVerdict =
  | { readonly kind: 'created'; readonly resource: TemplateVersionResource }
  | { readonly kind: 'absent' }
  | { readonly kind: 'existing'; readonly latest: TemplateVersionDetail }
  | { readonly kind: 'undetermined' };

const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, inner: unknown) =>
    typeof inner === 'object' && inner !== null && !Array.isArray(inner)
      ? Object.fromEntries(
          // Keys of one object are unique, so two never compare equal.
          Object.entries(inner).sort(([left], [right]) =>
            left < right ? -1 : 1,
          ),
        )
      : inner,
  );

const definitionOf = (
  value: Pick<
    TemplateVersionRequest,
    | 'templateKey'
    | 'compatibleTypeIds'
    | 'slots'
    | 'reservedRegions'
    | 'bindings'
    | 'locale'
    | 'audience'
  >,
): string =>
  stable([
    value.templateKey,
    value.compatibleTypeIds,
    value.slots,
    value.reservedRegions,
    value.bindings,
    value.locale,
    value.audience,
  ]);

export const reconcileUnknownCreate = (
  attempt: TemplateVersionRequest,
  read: CmsTemplateLatestResult,
): CreateOutcomeVerdict => {
  if (read.kind === 'rejected' && read.status === 404)
    return { kind: 'absent' };
  if (read.kind !== 'loaded') return { kind: 'undetermined' };
  const latest = read.detail;
  if (
    latest.templateKey === attempt.templateKey &&
    latest.version === '1' &&
    definitionOf(latest) === definitionOf(attempt)
  )
    return {
      kind: 'created',
      resource: {
        id: latest.id,
        version: latest.version,
        templateVersion: latest.templateVersion,
        contentHash: latest.contentHash,
        createdAt: latest.createdAt,
        updatedAt: latest.updatedAt,
        state: latest.state,
        templateId: latest.templateId,
        templateKey: latest.templateKey,
        compatibleTypeIds: latest.compatibleTypeIds,
        reservedRegions: latest.reservedRegions,
        blockRegistryDigest: latest.blockRegistryDigest,
      },
    };
  return { kind: 'existing', latest };
};
