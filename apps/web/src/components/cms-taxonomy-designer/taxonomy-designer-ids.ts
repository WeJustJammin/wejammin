import type { IssueField } from './taxonomy-designer-request';

/** DOM ids of the designer: every error summary link points at one of these. */
export const TAXONOMY_KEY_ID = 'cms-taxonomy-key';
export const TAXONOMY_SHAPE_ID = 'cms-taxonomy-shape';
export const TAXONOMY_TYPES_ID = 'cms-taxonomy-types';
export const TAXONOMY_FIELDS_ID = 'cms-taxonomy-fields';
export const TAXONOMY_DOMAINS_ID = 'cms-taxonomy-domains';
export const TAXONOMY_FORM_ID = 'cms-taxonomy-form';
export const TAXONOMY_STATUS_ID = 'cms-taxonomy-status';
export const TAXONOMY_RESULT_HEADING_ID = 'cms-taxonomy-result-heading';

/** The control a summary link focuses for an issue field. */
export const issueDomId = (field: IssueField): string => {
  switch (field) {
    case 'taxonomyKey':
      return TAXONOMY_KEY_ID;
    case 'shape':
      return TAXONOMY_SHAPE_ID;
    case 'allowedTypeKeys':
      return TAXONOMY_TYPES_ID;
    case 'allowedFieldKeys':
      return TAXONOMY_FIELDS_ID;
    case 'canonicalOverlapDomains':
      return TAXONOMY_DOMAINS_ID;
    case 'form':
      return TAXONOMY_FORM_ID;
  }
};
