/**
 * Fixed copy of the vocabulary designer (FE03 "Form contract": a field copy states the rule
 * and the correction). Written here, never taken from a response; the keys are closed
 * vocabularies, so a new rule fails to compile until it has its sentence.
 */
export type DesignerIssueCode =
  | 'taxonomy_key_invalid'
  | 'shape_required'
  | 'type_keys_required'
  | 'type_keys_exceeded'
  | 'type_keys_duplicate'
  | 'type_keys_invalid'
  | 'field_keys_required'
  | 'field_keys_exceeded'
  | 'field_keys_duplicate'
  | 'field_keys_invalid'
  | 'domain_duplicate'
  | 'domain_unknown'
  | 'version_invalid'
  | 'request_too_large';

export const DESIGNER_ISSUE_COPY: Readonly<Record<DesignerIssueCode, string>> =
  {
    taxonomy_key_invalid:
      'Use 2 to 64 lowercase letters, digits or hyphens, starting with a letter.',
    shape_required: 'Choose flat or hierarchical.',
    type_keys_required: 'Add at least one content type key.',
    type_keys_exceeded:
      'A vocabulary names at most 64 content type keys. Remove some.',
    type_keys_duplicate: 'A content type key appears twice. Remove the repeat.',
    type_keys_invalid:
      'A content type key must be 2 to 64 lowercase letters, digits or underscores, starting with a letter. Remove or retype it.',
    field_keys_required: 'Add at least one field key.',
    field_keys_exceeded:
      'A vocabulary names at most 64 field keys. Remove some.',
    field_keys_duplicate: 'A field key appears twice. Remove the repeat.',
    field_keys_invalid:
      'A field key must be 2 to 64 lowercase letters, digits or underscores, starting with a letter. Remove or retype it.',
    domain_duplicate: 'A canonical domain is declared twice. Clear one.',
    domain_unknown:
      'A declared canonical domain is not one of the six. Reload the page.',
    version_invalid: 'The parent version could not be read. Reload the page.',
    request_too_large:
      'The vocabulary is too large to send (256 KiB at most). Remove keys.',
  };

export const TAG_PROBLEM_COPY = {
  tag_invalid:
    'is not a valid key. Use lowercase letters, digits or underscores, starting with a letter (2 to 64 characters).',
  tag_duplicate: 'is already in the list.',
  tag_limit: 'was not added: the list already holds 64 keys.',
} as const;

export const DOMAIN_PROVIDER_COPY = {
  built: 'Checks available',
  unbuilt: 'Not available yet; this vocabulary cannot activate while declared',
} as const;
