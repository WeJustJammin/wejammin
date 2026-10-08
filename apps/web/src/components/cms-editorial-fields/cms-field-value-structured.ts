import {
  CmsUuidSchema,
  CmsVersionSchema,
  isObjectValueForStructure,
  isRichTextV1,
  validateRichTextV1,
  richTextTotalCharacters,
  type JsonValue,
} from '@wejammin/contracts';

import type {
  CmsListDescriptor,
  CmsObjectDescriptor,
  CmsObjectPropertyDescriptor,
  CmsRelationDescriptor,
  CmsRichTextDescriptor,
  CmsScalarConstraints,
} from './cms-field-descriptor';
import { CMS_EDITORIAL_REASON_COPY } from '../cms-editorial/cms-editorial-reason-copy';
import { cmsIssue, type CmsFieldIssue } from './cms-field-issue';
import {
  cmsCharacterCount,
  validateCmsScalarValue,
} from './cms-field-value-scalar';

/** A JSON object (not an array, not null), as a narrowing guard. */
export const isJsonRecord = (
  value: unknown,
): value is Readonly<Record<string, JsonValue>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The document the rich text editor starts from when a field has no value. */
export const CMS_EMPTY_RICH_TEXT: JsonValue = {
  format: 'rich_text.v1',
  blocks: [{ type: 'paragraph', spans: [] }],
};

const LIST_ITEMS_MAX = 128;
const RELATION_TARGETS_MAX = 512;

const richTextIssues = (
  constraints: CmsScalarConstraints,
  value: JsonValue,
): CmsFieldIssue[] => {
  // The refusal carries the token PostgreSQL emits (AC-084), with the one fixed
  // copy every layer shows for it.
  const verdict = validateRichTextV1(value);
  if (!verdict.ok)
    return [
      cmsIssue(verdict.reason, CMS_EDITORIAL_REASON_COPY[verdict.reason]),
    ];
  const total = richTextTotalCharacters(value);
  const issues: CmsFieldIssue[] = [];
  if (constraints.minLength !== undefined && total < constraints.minLength)
    issues.push(
      cmsIssue(
        'too_short',
        `Enter at least ${constraints.minLength} characters.`,
      ),
    );
  if (constraints.maxLength !== undefined && total > constraints.maxLength)
    issues.push(
      cmsIssue(
        'too_long',
        `Enter at most ${constraints.maxLength} characters.`,
      ),
    );
  return issues;
};

export const validateCmsRichText = (
  descriptor: CmsRichTextDescriptor,
  value: JsonValue,
): CmsFieldIssue[] => richTextIssues(descriptor.constraints, value);

export const validateCmsList = (
  descriptor: CmsListDescriptor,
  value: JsonValue,
): CmsFieldIssue[] => {
  if (!Array.isArray(value))
    return [cmsIssue('invalid_list', 'Enter a list of values.')];
  if (value.length > LIST_ITEMS_MAX)
    return [
      cmsIssue('too_many_items', `Enter at most ${LIST_ITEMS_MAX} items.`),
    ];
  // Item text honours the list's own minLength/maxLength; every other item
  // kind is its plain scalar encoding (cms_list_item_value_valid).
  const itemConstraints: CmsScalarConstraints =
    descriptor.itemKind === 'short_text' ||
    descriptor.itemKind === 'long_text' ||
    descriptor.itemKind === 'enum'
      ? descriptor.constraints
      : {};
  return value.flatMap((item, index) =>
    item === null
      ? [cmsIssue('required', 'Enter a value or remove this item.', { index })]
      : validateCmsScalarValue(descriptor.itemKind, itemConstraints, item).map(
          (issue) => ({ ...issue, index }),
        ),
  );
};

const propertyIssues = (
  property: CmsObjectPropertyDescriptor,
  value: JsonValue,
): CmsFieldIssue[] => {
  const where = { propertyKey: property.key };
  if (property.kind === 'rich_text')
    return richTextIssues(property.constraints, value).map((issue) => ({
      ...issue,
      ...where,
    }));
  if (typeof value === 'boolean')
    return property.kind === 'scalar'
      ? []
      : [cmsIssue('not_in_choices', 'Choose one of the listed values.', where)];
  const kind =
    property.kind === 'enum'
      ? 'enum'
      : typeof value === 'number'
        ? 'decimal'
        : 'short_text';
  return validateCmsScalarValue(kind, property.constraints, value).map(
    (issue) => ({ ...issue, ...where }),
  );
};

export const validateCmsObject = (
  descriptor: CmsObjectDescriptor,
  value: JsonValue,
): CmsFieldIssue[] => {
  if (!isJsonRecord(value))
    return [cmsIssue('invalid_object', 'Fill in the fields below.')];
  const known = new Set(descriptor.properties.map((property) => property.key));
  const issues: CmsFieldIssue[] = Object.keys(value)
    .filter((key) => !known.has(key))
    .map((key) =>
      cmsIssue('unknown_property', 'This property is not part of the field.', {
        propertyKey: key,
      }),
    );
  for (const property of descriptor.properties) {
    const present = Object.hasOwn(value, property.key);
    const propertyValue = present ? value[property.key] : undefined;
    if (
      propertyValue === undefined ||
      propertyValue === null ||
      propertyValue === ''
    ) {
      if (property.required)
        issues.push(
          cmsIssue('required', 'This property is required.', {
            propertyKey: property.key,
          }),
        );
      continue;
    }
    issues.push(...propertyIssues(property, propertyValue));
  }
  // The shared contract predicate is the final authority: whatever the
  // per-property copy above misses, an invalid structure never passes.
  if (
    issues.length === 0 &&
    !isObjectValueForStructure(descriptor.structure, value)
  )
    issues.push(
      cmsIssue(
        'invalid_object',
        'The values do not match the field structure.',
      ),
    );
  return issues;
};

export const validateCmsRelation = (
  descriptor: CmsRelationDescriptor,
  value: JsonValue,
): CmsFieldIssue[] => {
  if (!isJsonRecord(value) || !Array.isArray(value.targets))
    return [cmsIssue('invalid_relation', 'Choose the entries to link.')];
  const targets = value.targets;
  const max = Math.min(descriptor.max, RELATION_TARGETS_MAX);
  const issues: CmsFieldIssue[] = [];
  if (targets.length > max)
    issues.push(cmsIssue('too_many_targets', `Link at most ${max} entries.`));
  if (targets.length < descriptor.min && targets.length > 0)
    issues.push(
      cmsIssue('too_few_targets', `Link at least ${descriptor.min} entries.`),
    );
  const seen = new Set<string>();
  targets.forEach((target, index) => {
    if (!isJsonRecord(target) || typeof target.targetId !== 'string') {
      issues.push(cmsIssue('invalid_uuid', 'Enter an entry id.', { index }));
      return;
    }
    if (!CmsUuidSchema.safeParse(target.targetId).success)
      issues.push(
        cmsIssue('invalid_uuid', 'Enter the entry id as a UUID.', { index }),
      );
    else if (seen.has(target.targetId))
      issues.push(
        cmsIssue('duplicate_target', 'This entry is already linked.', {
          index,
        }),
      );
    else seen.add(target.targetId);
    const pinned = target.expectedTargetVersion;
    if (
      pinned !== null &&
      pinned !== undefined &&
      (typeof pinned !== 'string' ||
        !CmsVersionSchema.safeParse(pinned).success)
    )
      issues.push(
        cmsIssue(
          'invalid_target_version',
          'Enter the pinned version as a positive whole number.',
          { index },
        ),
      );
  });
  return issues;
};

/**
 * A rich_text value is empty only when it is a valid document with no text. A
 * document the grammar refuses is not "empty": it is invalid, and must reach
 * validation instead of being mistaken for the absence of a value.
 */
export const cmsRichTextIsEmpty = (value: JsonValue): boolean =>
  isRichTextV1(value) && richTextTotalCharacters(value) === 0;

export const cmsTextIsEmpty = (value: JsonValue): boolean =>
  typeof value === 'string' && cmsCharacterCount(value) === 0;
