import {
  AuthoringContextFieldSchema,
  AuthoringContextTypeSchema,
  type AuthoringContextField,
} from '@wejammin/contracts';

/**
 * Field fixtures are parsed through the real CMS-03B-14 contract schema, so a
 * fixture that drifts from the contract fails here instead of inside a render.
 */
export const fieldUuid = (n: number): string =>
  `018f0c45-73fe-7dc2-9c09-68f7ecf1${n.toString(16).padStart(4, '0')}`;

export interface AuthoringFieldOptions {
  readonly n: number;
  readonly key: string;
  readonly kind: AuthoringContextField['kind'];
  readonly label?: string;
  readonly helpText?: string;
  readonly required?: boolean;
  readonly order?: number;
  readonly constraints?: Readonly<Record<string, unknown>>;
  readonly relationDefinition?: unknown;
  readonly defaultValue?: unknown;
}

export const authoringField = (
  options: AuthoringFieldOptions,
): AuthoringContextField =>
  AuthoringContextFieldSchema.parse({
    stableFieldId: fieldUuid(options.n),
    key: options.key,
    kind: options.kind,
    constraints: options.constraints ?? {},
    required: options.required ?? false,
    defaultMode: options.defaultValue === undefined ? 'none' : 'literal',
    ...(options.defaultValue === undefined
      ? {}
      : { defaultValue: options.defaultValue }),
    localizationMode: 'none',
    editorConfig: {
      label: options.label ?? options.key,
      ...(options.helpText === undefined ? {} : { helpText: options.helpText }),
      order: options.order ?? options.n,
    },
    relationDefinition: options.relationDefinition ?? null,
  });

export const RELATION_DEFINITION = {
  fieldId: fieldUuid(0x900),
  targetKind: 'content',
  targetType: 'release_note',
  projectionKey: 'cms.content.summary',
  cardinality: 'many',
  min: 0,
  max: 3,
  ordered: true,
  onUnavailable: 'omit',
} as const;

export const OBJECT_STRUCTURE = {
  properties: [
    {
      key: 'headline',
      kind: 'scalar',
      required: true,
      constraints: { minLength: 3, maxLength: 20 },
    },
    {
      key: 'priority',
      kind: 'scalar',
      required: false,
      constraints: { minimum: 1, maximum: 5 },
    },
    {
      key: 'tone',
      kind: 'enum',
      required: true,
      constraints: { enumValues: ['formal', 'casual'] },
    },
    {
      key: 'summary',
      kind: 'rich_text',
      required: false,
      constraints: { maxLength: 200 },
    },
  ],
} as const;

/** One field of every kind the editor must render, in authoring order. */
export const allKindFields = (): readonly AuthoringContextField[] => [
  authoringField({
    n: 1,
    key: 'title',
    kind: 'short_text',
    label: 'Title',
    required: true,
    constraints: { minLength: 2, maxLength: 40 },
  }),
  authoringField({ n: 2, key: 'blurb', kind: 'long_text', label: 'Blurb' }),
  authoringField({
    n: 3,
    key: 'body',
    kind: 'rich_text',
    label: 'Body',
    constraints: { maxLength: 500 },
  }),
  authoringField({ n: 4, key: 'featured', kind: 'boolean', label: 'Featured' }),
  authoringField({
    n: 5,
    key: 'rating',
    kind: 'integer',
    label: 'Rating',
    constraints: { minimum: 1, maximum: 10 },
  }),
  authoringField({ n: 6, key: 'price', kind: 'decimal', label: 'Price' }),
  authoringField({ n: 7, key: 'published_on', kind: 'date', label: 'Date' }),
  authoringField({
    n: 8,
    key: 'starts_at',
    kind: 'datetime',
    label: 'Starts at',
  }),
  authoringField({
    n: 9,
    key: 'category',
    kind: 'enum',
    label: 'Category',
    constraints: { enumValues: ['news', 'tutorial', 'event'] },
  }),
  authoringField({
    n: 10,
    key: 'tags',
    kind: 'list',
    label: 'Tags',
    constraints: { itemKind: 'short_text', maxLength: 12 },
  }),
  authoringField({
    n: 11,
    key: 'meta',
    kind: 'object',
    label: 'Meta',
    constraints: { objectStructure: OBJECT_STRUCTURE },
  }),
  authoringField({
    n: 12,
    key: 'related',
    kind: 'relation',
    label: 'Related entries',
    relationDefinition: RELATION_DEFINITION,
  }),
  authoringField({ n: 13, key: 'topics', kind: 'taxonomy', label: 'Topics' }),
  authoringField({ n: 14, key: 'cover', kind: 'media', label: 'Cover' }),
];

const HASH = 'a'.repeat(64);
const POLICY = {
  key: 'editorial.standard',
  version: '1',
  policyHash: HASH,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: HASH,
} as const;

export const CONTENT_TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
export const CONTENT_TYPE_VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';

/** The CMS-03B-14 selected type (frozen evidence) the create form echoes back. */
export const selectedType = () =>
  AuthoringContextTypeSchema.parse({
    contentTypeId: CONTENT_TYPE_ID,
    contentTypeVersionId: CONTENT_TYPE_VERSION_ID,
    label: 'Release note',
    sourceLocale: 'en-US',
    defaultLocale: 'en-US',
    supportedLocales: ['en-US', 'fr-FR'],
    schemaArtifact: {
      id: CONTENT_TYPE_ID,
      contentTypeVersionId: CONTENT_TYPE_VERSION_ID,
      artifactHash: HASH,
      compilerVersion: '1.0.0',
      zodContractRef: '03a.content-type-version.v1',
    },
    validatorRefs: [],
    workflowPolicy: POLICY,
    activationEvidence: POLICY,
  });
