import type { GrantableCmsCapability } from './cms-capability-grant-types';

const LABELS: Readonly<Record<GrantableCmsCapability, string>> = {
  'cms.schema_registry.read': 'View schema registry',
  'cms.schema_designer': 'Design schemas',
  'cms.template_designer': 'Design templates',
  'cms.taxonomy_curator': 'Curate taxonomies',
  'cms.author': 'Author entries',
  'cms.editor': 'Edit and return entries',
  'cms.publisher': 'Publish entries',
  'cms.navigation_editor': 'Edit navigation and routes',
  'cms.media_contributor': 'Contribute media',
  'cms.media_curator': 'Curate media',
  'cms.reviewer': 'Review entries',
  'cms.reviewer.policy': 'Policy specialist reviewer',
  'cms.reviewer.legal': 'Legal specialist reviewer',
  'cms.reviewer.security': 'Security specialist reviewer',
  'cms.reviewer.financial': 'Financial specialist reviewer',
};

export interface CmsCapabilityGroup {
  readonly label: string;
  readonly capabilities: readonly GrantableCmsCapability[];
}

/** FE03 control order: four labelled groups over the generated closed set. */
export const CMS_CAPABILITY_GROUPS: readonly CmsCapabilityGroup[] = [
  {
    label: 'Design',
    capabilities: [
      'cms.schema_registry.read',
      'cms.schema_designer',
      'cms.template_designer',
      'cms.taxonomy_curator',
    ],
  },
  {
    label: 'Authoring',
    capabilities: ['cms.author', 'cms.editor', 'cms.publisher'],
  },
  {
    label: 'Delivery and media',
    capabilities: [
      'cms.navigation_editor',
      'cms.media_contributor',
      'cms.media_curator',
    ],
  },
  {
    label: 'Review',
    capabilities: [
      'cms.reviewer',
      'cms.reviewer.policy',
      'cms.reviewer.legal',
      'cms.reviewer.security',
      'cms.reviewer.financial',
    ],
  },
];

export const capabilityLabel = (capability: GrantableCmsCapability): string =>
  LABELS[capability];

/** Plain label plus the key; the key is never the only text of an option. */
export const capabilityOptionText = (
  capability: GrantableCmsCapability,
): string => `${LABELS[capability]} (${capability})`;
