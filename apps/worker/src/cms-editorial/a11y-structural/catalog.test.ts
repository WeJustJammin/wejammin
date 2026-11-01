import { describe, expect, it } from 'vitest';

import {
  ACCESSIBILITY_FINDINGS_STORED_MAX,
  ACCESSIBILITY_RULE_CATALOG,
  ACCESSIBILITY_RULE_IDS,
  catalogEntry,
} from './catalog';

/**
 * BE05c "Rules of version 1": a code-owned catalog keyed by ruleId. The Phase 2
 * surface is the structure, heading, link and landmark rules; the media rules
 * are inert until Slice 14 and must have no catalog entry.
 */

const EXPECTED_SEVERITY: Readonly<Record<string, 'blocking' | 'warning'>> = {
  'structure.rich_text_invalid': 'blocking',
  'structure.block_unregistered': 'blocking',
  'heading.empty': 'blocking',
  'heading.first_level': 'blocking',
  'heading.level_skipped': 'blocking',
  'link.text_empty': 'blocking',
  'link.text_generic': 'blocking',
  'link.text_is_url': 'warning',
  'link.text_unchecked_language': 'warning',
  'landmark.name_missing': 'blocking',
  'landmark.name_duplicate': 'warning',
};

// The ruleId grammar of the BE05c QualityFinding model.
const RULE_ID_GRAMMAR = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){1,3}$/u;
const MESSAGE_MAX_CHARACTERS = 256;

describe('accessibility rule catalog', () => {
  it('holds exactly the eleven Phase 2 rules', () => {
    expect([...ACCESSIBILITY_RULE_IDS].sort()).toEqual(
      Object.keys(EXPECTED_SEVERITY).sort(),
    );
    expect(Object.keys(ACCESSIBILITY_RULE_CATALOG).sort()).toEqual(
      [...ACCESSIBILITY_RULE_IDS].sort(),
    );
  });

  it.each(Object.entries(EXPECTED_SEVERITY))(
    '%s has the BE05c severity %s',
    (ruleId, severity) => {
      expect(catalogEntry(ruleId as never).severity).toBe(severity);
    },
  );

  it.each(ACCESSIBILITY_RULE_IDS)(
    '%s has a bounded static message and a valid ruleId',
    (ruleId) => {
      const { message } = catalogEntry(ruleId);
      expect(ruleId).toMatch(RULE_ID_GRAMMAR);
      expect(message.length).toBeGreaterThan(0);
      expect(message.length).toBeLessThanOrEqual(MESSAGE_MAX_CHARACTERS);
      expect(message).not.toMatch(/[{}<>"]|https?:|mailto:/u);
    },
  );

  it('has unique messages so a finding is identified by its rule', () => {
    const messages = ACCESSIBILITY_RULE_IDS.map(
      (ruleId) => catalogEntry(ruleId).message,
    );
    expect(new Set(messages).size).toBe(messages.length);
  });

  it('does not define the inert media rules', () => {
    for (const inert of [
      'alt.missing',
      'media.accessibility_not_approved',
      'media.captions_missing',
    ])
      expect(ACCESSIBILITY_RULE_IDS).not.toContain(inert);
  });

  it('stores at most the BE05c FINDINGS_STORED_MAX findings', () => {
    expect(ACCESSIBILITY_FINDINGS_STORED_MAX).toBe(500);
  });
});
