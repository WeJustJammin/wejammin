import type { EntryDraftDetailResource, JsonValue } from '@wejammin/contracts';

import type { CmsFieldDescriptor } from '../cms-editorial-fields/cms-field-descriptor';

/** The closed per-field provenance vocabulary of the draft detail (CMS-03B-11). */
export type CmsEditorialFieldProvenance =
  EntryDraftDetailResource['fields'][number]['provenance'];

export interface CmsEditorialDraftValues {
  /** The draft's values by stable field id; no value is null. */
  readonly values: Readonly<Record<string, JsonValue | null>>;
  /**
   * Where each non-relation field's value came from, as the server reported it;
   * a field the draft holds no value for is `missing`.
   */
  readonly provenance: Readonly<Record<string, CmsEditorialFieldProvenance>>;
  /** Fields that must not be edited here, with the reason shown in place. */
  readonly readOnlyNotices: Readonly<Record<string, string>>;
}

/**
 * Projects a verified CMS-03B-11 draft onto the schema version's fields. Only
 * values of the draft's locale count, only fields the definition declares are
 * kept, and a relation is assembled from its ordered normalized rows. A
 * relation with an unavailable target (an opaque placeholder) is read-only:
 * saving the field replaces the whole value, which would silently drop a target
 * the author cannot see.
 */
export const draftValuesFromDetail = (
  detail: EntryDraftDetailResource,
  descriptors: readonly CmsFieldDescriptor[],
): CmsEditorialDraftValues => {
  const stored = new Map<string, JsonValue | null>();
  const storedProvenance = new Map<string, CmsEditorialFieldProvenance>();
  for (const field of detail.fields)
    if (field.locale === detail.locale) {
      stored.set(field.fieldId, field.value);
      storedProvenance.set(field.fieldId, field.provenance);
    }
  const provenance: Record<string, CmsEditorialFieldProvenance> = {};
  const values: Record<string, JsonValue | null> = {};
  const readOnlyNotices: Record<string, string> = {};
  for (const descriptor of descriptors) {
    if (descriptor.kind !== 'relation') {
      values[descriptor.fieldId] = stored.get(descriptor.fieldId) ?? null;
      provenance[descriptor.fieldId] =
        storedProvenance.get(descriptor.fieldId) ?? 'missing';
      continue;
    }
    const rows = detail.relations
      .filter((row) => row.fieldId === descriptor.fieldId)
      .sort((left, right) => left.position - right.position);
    const unavailable = rows.filter((row) => row.unavailable !== null).length;
    values[descriptor.fieldId] = {
      targets: rows.flatMap((row) =>
        row.unavailable === null
          ? [
              {
                targetId: row.targetId,
                expectedTargetVersion: row.expectedTargetVersion,
              },
            ]
          : [],
      ),
    };
    if (unavailable > 0)
      readOnlyNotices[descriptor.fieldId] =
        `${unavailable} linked ${unavailable === 1 ? 'entry is' : 'entries are'} unavailable to you, so this relation cannot be edited here.`;
  }
  return { values, provenance, readOnlyNotices };
};
