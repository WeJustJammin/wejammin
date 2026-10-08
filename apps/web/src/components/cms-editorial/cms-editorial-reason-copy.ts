/**
 * The closed vocabulary of typed reason tokens a CMS editorial refusal may
 * carry in `details.reasonCode` (BE03b value encodings and error matrix), and
 * the fixed user copy for each. The browser never renders a message the server
 * sent: an unknown token is dropped and the status copy applies instead.
 */
export const CMS_EDITORIAL_REASON_COPY = {
  rich_text_not_canonical:
    'The rich text is not in the supported format. Review the text and save again.',
  object_kind_unspecified:
    'This object field has no declared structure, so it cannot be saved.',
  object_property_invalid:
    'One or more object properties are invalid. Check the highlighted properties.',
  relation_target_unavailable:
    'A linked entry is not available. Remove it or link another entry.',
  taxonomy_source_unavailable:
    'Taxonomy terms cannot be saved yet because the taxonomy source is not available.',
  media_source_unavailable:
    'Media cannot be saved yet because the media source is not available.',
  comparison_too_large:
    'These revisions differ in more than 512 places, so they cannot be compared here.',
  comparison_unavailable:
    'These revisions cannot be compared because a recorded schema version is not available.',
  migration_chain_mismatch:
    'The restore plan changed after this comparison was loaded. Reload the comparison and try again.',
  migration_chain_unavailable:
    'This revision cannot be restored because its migration path is not available.',
  migration_chain_incomplete:
    'This revision cannot be restored because its migration path is incomplete.',
  template_incompatible:
    'This revision uses a template that is no longer compatible, so it cannot be restored.',
} as const;

export type CmsEditorialReasonCode = keyof typeof CMS_EDITORIAL_REASON_COPY;

export const isCmsEditorialReasonCode = (
  value: unknown,
): value is CmsEditorialReasonCode =>
  typeof value === 'string' && Object.hasOwn(CMS_EDITORIAL_REASON_COPY, value);

/** The fixed copy for a verified reason token, or null when there is none. */
export const cmsEditorialReasonMessage = (
  reasonCode: string | null,
): string | null =>
  reasonCode !== null && isCmsEditorialReasonCode(reasonCode)
    ? CMS_EDITORIAL_REASON_COPY[reasonCode]
    : null;
