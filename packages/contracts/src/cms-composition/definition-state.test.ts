import { describe, expect, it } from 'vitest';

import {
  CMS_DEFINITION_VERSION_STATES,
  CmsDefinitionVersionStateSchema,
} from './definition-state';
import { TemplateVersionResourceSchema } from './template';

describe('definition version lifecycle', () => {
  it('[P2-S12-AC-088] lists the eight states of the subject state machine, in lifecycle order', () => {
    expect([...CMS_DEFINITION_VERSION_STATES]).toEqual([
      'draft',
      'review',
      'approved',
      'scheduled',
      'active',
      'superseded',
      'retired',
      'blocked',
    ]);
    for (const state of CMS_DEFINITION_VERSION_STATES)
      expect(CmsDefinitionVersionStateSchema.safeParse(state).success).toBe(
        true,
      );
    for (const state of ['published', 'archived', 'Draft', ''])
      expect(CmsDefinitionVersionStateSchema.safeParse(state).success).toBe(
        false,
      );
  });

  it('[P2-S12-AC-088] is the exact state enum the shipped template resource already uses', () => {
    expect(TemplateVersionResourceSchema.shape.state.options).toEqual([
      ...CMS_DEFINITION_VERSION_STATES,
    ]);
  });
});
