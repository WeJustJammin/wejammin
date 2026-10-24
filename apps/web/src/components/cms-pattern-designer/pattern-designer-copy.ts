import type { PatternTreeIssueCode } from './pattern-tree-rules';
import type { WireIssueCode } from './pattern-tree-state';

/**
 * Fixed copy of the pattern designer (FE03 "Form contract": a field copy states the
 * rule and the correction). Written here, never taken from a response; the keys are
 * closed vocabularies, so a new rule fails to compile until it has its sentence.
 */
export type FormIssueCode =
  | 'pattern_key_invalid'
  | 'key_reserved'
  | 'compatible_required'
  | 'compatible_unavailable'
  | 'block_unavailable'
  | 'version_invalid'
  | 'request_too_large'
  | 'nested_pattern_suspect';

export type DesignerIssueCode =
  PatternTreeIssueCode | WireIssueCode | FormIssueCode;

export const PATTERN_ISSUE_COPY: Readonly<Record<DesignerIssueCode, string>> = {
  tree_empty: 'Add at least one node.',
  roots_exceeded: 'A pattern has at most 32 top-level nodes. Remove some.',
  children_exceeded: 'A node has at most 32 children. Remove some.',
  node_key_invalid:
    'Use 1 to 64 lowercase letters, digits, hyphens or underscores, starting with a letter.',
  node_key_duplicate:
    'Another node at this level already uses this key. Rename one.',
  pattern_depth_exceeded:
    'This node is nested deeper than 8 levels. Move it up a level or remove it.',
  pattern_nodes_exceeded:
    'The tree has more than 512 nodes and this is the first one past the limit. Remove nodes.',
  block_key_invalid:
    'This block reference is not valid. Choose the block again.',
  block_version_invalid:
    'This block version is not valid. Choose the block again.',
  pattern_id_invalid: 'This nested pattern reference is not valid. Remove it.',
  pattern_version_invalid:
    'This nested pattern version is not valid. Remove it.',
  props_key_limit: 'Props may have at most 64 keys. Remove some.',
  props_depth_limit: 'Props may be nested at most 8 levels. Flatten them.',
  props_invalid:
    'Props must be plain data: text, finite numbers, true, false, null, and lists or objects of at most 128 entries.',
  props_not_json: 'Props must be valid JSON.',
  props_not_object: 'Props must be a JSON object, for example {}.',
  block_required: 'Choose a registered block.',
  block_unavailable:
    'This block is no longer registered. Reload to refresh the block choices.',
  pattern_key_invalid:
    'Use 2 to 64 lowercase letters, digits or hyphens, starting with a letter.',
  key_reserved:
    'That key is reserved because it names a page or a route. Choose another.',
  compatible_required: 'Choose at least one content type.',
  compatible_unavailable:
    'A chosen content type is no longer active. Clear the box marked "no longer available", then save.',
  version_invalid: 'The parent version could not be read. Reload the page.',
  nested_pattern_suspect:
    'This nested pattern may be the cause; the server did not say which nested pattern it is. Remove it, or check its state.',
  request_too_large:
    'The pattern is too large to send (256 KiB at most). Shorten props or remove nodes.',
};
