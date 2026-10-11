/**
 * The Slice 11 content type, produced by the complete local CMS03A chain.
 *
 * Every Slice 11 suite acts as the ONE operator-bootstrapped owner, so every active compiled
 * type a suite commits is a creatable type of that owner for the rest of the run, and the
 * CMS-03B-14 authoring-context read serves at most 32 of them and refuses the 33rd as
 * INTERNAL_ERROR (BE03b `AuthoringContextResource.creatableTypes.max(32)`, EC-103). A suite that
 * committed its own type would therefore break every later suite once enough files had run,
 * in an order that depends on vitest's result cache. So the default is ONE shared type: the first
 * suite to ask runs the real chain, every later suite finds that type again (read-only SQL).
 * A suite that supersedes or compares types asks for `fresh: true` and owns the one it gets.
 */
import type { EditorialWorld } from './cms-editorial-world';
import {
  activateS11SchemaCandidate,
  prepareS11SchemaCandidate,
} from './phase-02-slice-11-schema-lifecycle';
import { type CmsOwner, psql } from './stack';

/** The type key prefix that marks the shared type (`s11shared_<uuid>`); fresh types use `s11_`. */
export const S11_SHARED_TYPE_PREFIX = 's11shared';

export type S11TypeOptions = Readonly<{
  /** Commit a new type that only the caller uses (it may supersede or retire it). */
  fresh?: boolean;
}>;

/**
 * The shared type when it is still the owner's active compiled version, else `undefined`.
 * Active and compiled are the product's own creatable predicate, so a type this finds is
 * one the authoring-context read already lists.
 */
export const findSharedS11Type = (
  owner: CmsOwner,
): EditorialWorld | undefined => {
  const row = psql(`
    select version_row.content_type_id || '|' || version_row.id || '|' || field.stable_field_id
      from platform_private.cms_content_type_versions version_row
      join platform_private.cms_content_types type_row
        on type_row.id = version_row.content_type_id
      join platform_private.cms_field_definition_versions field
        on field.content_type_version_id = version_row.id and field.field_key = 'title'
     where version_row.owner_id = '${owner.organizationId}'
       and version_row.state::text = 'active'
       and type_row.state = 'active'
       and left(type_row.type_key, ${S11_SHARED_TYPE_PREFIX.length + 1}) = '${S11_SHARED_TYPE_PREFIX}_'
       and exists (
         select 1 from platform_private.cms_schema_artifacts artifact
          where artifact.id = version_row.schema_artifact_id
            and artifact.content_type_version_id = version_row.id
            and artifact.owner_id = version_row.owner_id
            and artifact.artifact_hash = version_row.definition_hash
            and artifact.state::text = 'compiled')
     order by version_row.created_at, version_row.id
     limit 1`);
  if (row === '') return undefined;
  const [contentTypeId = '', contentTypeVersionId = '', titleFieldId = ''] =
    row.split('|');
  return { owner, contentTypeId, contentTypeVersionId, titleFieldId };
};

export const ensureS11ContentType = async (
  owner: CmsOwner,
  options: S11TypeOptions = {},
): Promise<EditorialWorld> => {
  if (options.fresh === true)
    return activateS11SchemaCandidate(await prepareS11SchemaCandidate(owner));
  return (
    findSharedS11Type(owner) ??
    activateS11SchemaCandidate(
      await prepareS11SchemaCandidate(owner, undefined, S11_SHARED_TYPE_PREFIX),
    )
  );
};
