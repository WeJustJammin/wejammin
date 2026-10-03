import { describe, expect, it } from 'vitest';

import { ContentTypeDraftRequestSchema } from './index';

/**
 * BE03a CMS-03A-01 field matrix: `label` is a string of 2 to 120 Unicode
 * characters, normalized to NFC. The length is counted in Unicode characters
 * after NFC, never in UTF-16 code units and never before normalization.
 */

const draft = {
  typeKey: 'release_notes',
  label: 'Release notes',
  ownerCapability: 'cms.schema_designer',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  fallbackChains: {},
  workflowKey: 'cms.standard',
  workflowVersion: '1',
  defaultTemplateVersionId: null,
  fields: [],
  relations: [],
  templateBindings: [],
  capabilityBindings: [],
};

const parse = (label: string) =>
  ContentTypeDraftRequestSchema.safeParse({ ...draft, label });

const DECOMPOSED_E_ACUTE = 'é';
const COMPOSED_E_ACUTE = 'é';
const EMOJI = '\u{1F600}';

describe('[P2-S09-AC-041] CMS-03A-01 label is 2 to 120 Unicode characters normalized to NFC', () => {
  it('[P2-S09-AC-041] accepts exactly 120 astral characters (240 UTF-16 code units)', () => {
    expect(parse(EMOJI.repeat(120)).success).toBe(true);
  });

  it('[P2-S09-AC-041] rejects 121 astral characters', () => {
    expect(parse(EMOJI.repeat(121)).success).toBe(false);
  });

  it('[P2-S09-AC-041] accepts 120 decomposed characters that compose to 120 NFC characters (240 code points)', () => {
    expect(parse(DECOMPOSED_E_ACUTE.repeat(120)).success).toBe(true);
  });

  it('[P2-S09-AC-041] rejects 121 decomposed characters that compose to 121 NFC characters', () => {
    expect(parse(DECOMPOSED_E_ACUTE.repeat(121)).success).toBe(false);
  });

  it('[P2-S09-AC-041] normalizes the accepted label to NFC', () => {
    const parsed = parse(DECOMPOSED_E_ACUTE.repeat(3));
    expect(parsed.success && parsed.data.label).toBe(
      COMPOSED_E_ACUTE.repeat(3),
    );
  });

  it('[P2-S09-AC-041] counts one decomposed character as one character and rejects it as too short', () => {
    expect(parse(DECOMPOSED_E_ACUTE).success).toBe(false);
  });

  it('[P2-S09-AC-041] accepts exactly two astral characters (four UTF-16 code units)', () => {
    expect(parse(EMOJI.repeat(2)).success).toBe(true);
  });

  it('[P2-S09-AC-041] rejects one astral character (two UTF-16 code units) as too short', () => {
    expect(parse(EMOJI).success).toBe(false);
  });

  it('[P2-S09-AC-041] trims surrounding whitespace before counting', () => {
    const parsed = parse('  ab  ');
    expect(parsed.success && parsed.data.label).toBe('ab');
  });

  it('[P2-S09-AC-041] rejects a label that is only whitespace', () => {
    expect(parse('     ').success).toBe(false);
  });

  it('[P2-S09-AC-041] rejects a label whose trimmed length is one character', () => {
    expect(parse('  a  ').success).toBe(false);
  });

  it('[P2-S09-AC-041] rejects an oversized raw payload without normalizing it', () => {
    expect(parse('a'.repeat(100_000)).success).toBe(false);
  });
});
