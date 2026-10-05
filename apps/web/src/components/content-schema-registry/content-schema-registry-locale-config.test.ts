import { describe, expect, it } from 'vitest';

import {
  addIntermediate,
  addTag,
  availableIntermediates,
  chainSentence,
  cycleParticipants,
  diffAgainstSource,
  draftFromConfig,
  emptyLocaleDraft,
  issueControlTarget,
  localeControlId,
  moveIntermediate,
  pathFromPointer,
  removeIntermediate,
  removeTag,
  setDefaultLocale,
  setSourceLocale,
  submitConfig,
  validateDraft,
  type LocaleConfigDraft,
} from './content-schema-registry-locale-config';

const filled = (): LocaleConfigDraft =>
  draftFromConfig({
    sourceLocale: 'en-US',
    defaultLocale: 'en-US',
    supportedLocales: ['en-US', 'fr', 'fr-CA'],
    fallbackChains: { fr: ['en-US'], 'fr-CA': ['fr', 'en-US'] },
  });

describe('draft <-> submitted configuration', () => {
  it('derives intermediates by dropping the fixed final default', () => {
    const draft = filled();
    expect(draft.intermediates).toEqual({ fr: [], 'fr-CA': ['fr'] });
    expect(draft.supportedLocales).toEqual(['en-US', 'fr', 'fr-CA']);
  });

  it('submits intermediates plus the default as every chain by construction', () => {
    expect(submitConfig(filled())).toEqual({
      sourceLocale: 'en-US',
      defaultLocale: 'en-US',
      supportedLocales: ['en-US', 'fr', 'fr-CA'],
      fallbackChains: { fr: ['en-US'], 'fr-CA': ['fr', 'en-US'] },
    });
  });

  it('submits an empty chain map for a single-language type', () => {
    const draft = draftFromConfig({
      sourceLocale: 'en',
      defaultLocale: 'en',
      supportedLocales: ['en'],
      fallbackChains: {},
    });
    expect(submitConfig(draft).fallbackChains).toEqual({});
  });

  it('[P2-S09-AC-1227] starts empty with nothing selected', () => {
    expect(emptyLocaleDraft()).toEqual({
      supportedLocales: [],
      sourceLocale: '',
      defaultLocale: '',
      intermediates: {},
    });
  });
});

describe('addTag', () => {
  it('adds a canonical tag and trims surrounding space', () => {
    const result = addTag(emptyLocaleDraft(), '  en-US ');
    expect(result.error).toBeNull();
    expect(result.draft.supportedLocales).toEqual(['en-US']);
  });

  it('[P2-S09-AC-1211] never silently corrects: offers the canonical spelling instead', () => {
    const result = addTag(emptyLocaleDraft(), 'EN-us');
    expect(result.draft.supportedLocales).toEqual([]);
    expect(result.error).toEqual({
      message: 'locale tag must be a canonical-case BCP 47 tag',
      suggestion: 'en-US',
    });
  });

  it('offers no suggestion for a tag that is not BCP 47 shaped', () => {
    expect(addTag(emptyLocaleDraft(), 'en_US').error).toEqual({
      message: 'locale tag must be a canonical-case BCP 47 tag',
      suggestion: null,
    });
    expect(addTag(emptyLocaleDraft(), '').error?.message).toBe(
      'locale tag must be a canonical-case BCP 47 tag',
    );
  });

  it('refuses a repeat with the exact unique message', () => {
    const once = addTag(emptyLocaleDraft(), 'en').draft;
    expect(addTag(once, 'en').error).toEqual({
      message: 'supportedLocales must be unique',
      suggestion: null,
    });
  });

  it('refuses the 33rd language', () => {
    let draft = emptyLocaleDraft();
    for (let index = 0; index < 32; index += 1)
      draft = addTag(
        draft,
        `${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`,
      ).draft;
    expect(draft.supportedLocales).toHaveLength(32);
    const over = addTag(draft, 'zz');
    expect(over.draft.supportedLocales).toHaveLength(32);
    expect(over.error).toEqual({
      message: 'Maximum 32 languages',
      suggestion: null,
    });
  });

  it('pre-selects the first language as both source and default', () => {
    const first = addTag(emptyLocaleDraft(), 'en').draft;
    expect(first.sourceLocale).toBe('');
    expect(first.defaultLocale).toBe('');
  });
});

describe('removeTag', () => {
  it('[P2-S09-AC-1224] removes the tag from every fallback group in the same action', () => {
    const result = removeTag(filled(), 'fr');
    expect(result.draft.supportedLocales).toEqual(['en-US', 'fr-CA']);
    expect(result.draft.intermediates).toEqual({ 'fr-CA': [] });
    expect(result.announcement).toBe(
      'Removed fr from the fallback order for fr-CA',
    );
  });

  it('[P2-S09-AC-1224] names every affected group and says nothing extra when none use it', () => {
    const draft = draftFromConfig({
      sourceLocale: 'en',
      defaultLocale: 'en',
      supportedLocales: ['en', 'aa', 'bb', 'cc'],
      fallbackChains: {
        aa: ['cc', 'en'],
        bb: ['cc', 'en'],
        cc: ['en'],
      },
    });
    expect(removeTag(draft, 'cc').announcement).toBe(
      'Removed cc from the fallback order for aa, bb',
    );
    expect(removeTag(draft, 'bb').announcement).toBe('Removed bb.');
  });

  it('clears an unselected source or default when its language is removed', () => {
    const result = removeTag(filled(), 'en-US');
    expect(result.draft.sourceLocale).toBe('');
    expect(result.draft.defaultLocale).toBe('');
  });

  it('leaves the draft unchanged for an unknown tag', () => {
    expect(removeTag(filled(), 'zz').draft).toEqual(filled());
  });
});

describe('source, default and group editing', () => {
  it('[P2-S09-AC-1216] changing the default keeps every still-valid intermediate', () => {
    const next = setDefaultLocale(filled(), 'fr');
    expect(next.defaultLocale).toBe('fr');
    expect(next.intermediates['en-US']).toEqual([]);
    expect(next.intermediates['fr-CA']).toEqual([]);
    expect(next.intermediates.fr).toBeUndefined();
  });

  it('[P2-S09-AC-1216] keeps a retained intermediate when the default moves elsewhere', () => {
    const draft = draftFromConfig({
      sourceLocale: 'en',
      defaultLocale: 'en',
      supportedLocales: ['en', 'aa', 'bb', 'cc'],
      fallbackChains: { aa: ['bb', 'en'], bb: ['en'], cc: ['en'] },
    });
    const next = setDefaultLocale(draft, 'cc');
    expect(next.intermediates.aa).toEqual(['bb']);
    expect(next.intermediates.en).toEqual([]);
  });

  it('selects a source only from the supported tags', () => {
    expect(setSourceLocale(filled(), 'fr').sourceLocale).toBe('fr');
    expect(setSourceLocale(filled(), 'xx').sourceLocale).toBe('en-US');
    expect(setDefaultLocale(filled(), 'xx').defaultLocale).toBe('en-US');
  });

  it('[P2-S09-AC-1218] offers only supported tags that are not target, default or listed', () => {
    const draft = draftFromConfig({
      sourceLocale: 'en',
      defaultLocale: 'en',
      supportedLocales: ['en', 'aa', 'bb', 'cc'],
      fallbackChains: { aa: ['bb', 'en'], bb: ['en'], cc: ['en'] },
    });
    expect(availableIntermediates(draft, 'aa')).toEqual(['cc']);
    expect(availableIntermediates(draft, 'cc')).toEqual(['aa', 'bb']);
  });

  it('[P2-S09-AC-1219] [P2-S09-AC-1235] adds, removes and reorders intermediates with ordinal announcements', () => {
    let draft = draftFromConfig({
      sourceLocale: 'en',
      defaultLocale: 'en',
      supportedLocales: ['en', 'aa', 'bb', 'cc'],
      fallbackChains: { aa: ['en'], bb: ['en'], cc: ['en'] },
    });
    draft = addIntermediate(draft, 'aa', 'bb');
    draft = addIntermediate(draft, 'aa', 'cc');
    expect(draft.intermediates.aa).toEqual(['bb', 'cc']);
    const moved = moveIntermediate(draft, 'aa', 'cc', -1);
    expect(moved.draft.intermediates.aa).toEqual(['cc', 'bb']);
    expect(moved.announcement).toBe(
      'cc is now 1 of 3 in the fallback order for aa',
    );
    const edge = moveIntermediate(moved.draft, 'aa', 'cc', -1);
    expect(edge.draft.intermediates.aa).toEqual(['cc', 'bb']);
    expect(edge.announcement).toBeNull();
    expect(
      removeIntermediate(moved.draft, 'aa', 'cc').intermediates.aa,
    ).toEqual(['bb']);
  });

  it('ignores an intermediate that is not allowed', () => {
    const draft = filled();
    expect(addIntermediate(draft, 'fr', 'fr').intermediates.fr).toEqual([]);
    expect(addIntermediate(draft, 'fr', 'en-US').intermediates.fr).toEqual([]);
    expect(
      addIntermediate(draft, 'fr-CA', 'fr').intermediates['fr-CA'],
    ).toEqual(['fr']);
  });
});

describe('validation', () => {
  it('[P2-S09-AC-1220] reports no issue for a valid draft', () => {
    expect(validateDraft(filled())).toEqual([]);
  });

  it('[P2-S09-AC-1213] [P2-S09-AC-1214] [P2-S09-AC-1215] reports the exact BE03a messages for an empty list and no selection', () => {
    expect(validateDraft(emptyLocaleDraft()).map((i) => i.message)).toEqual([
      'supportedLocales must contain 1 to 32 locales',
      'supportedLocales must include sourceLocale',
      'supportedLocales must include defaultLocale',
    ]);
  });

  it('[P2-S09-AC-1221] reports a cycle and names the languages involved', () => {
    const draft: LocaleConfigDraft = {
      supportedLocales: ['en', 'aa', 'bb'],
      sourceLocale: 'en',
      defaultLocale: 'en',
      intermediates: { aa: ['bb'], bb: ['aa'] },
    };
    expect(validateDraft(draft)).toEqual([
      {
        path: ['fallbackChains'],
        message: 'fallback chains must not form a cycle',
      },
    ]);
    expect(cycleParticipants(draft)).toEqual(['aa', 'bb']);
    expect(cycleParticipants(filled())).toEqual([]);
  });
});

describe('server issue mapping', () => {
  it('turns a pointer into a typed path and unescapes segments', () => {
    expect(pathFromPointer('/supportedLocales')).toEqual(['supportedLocales']);
    expect(pathFromPointer('/supportedLocales/2')).toEqual([
      'supportedLocales',
      2,
    ]);
    expect(pathFromPointer('/fallbackChains/fr-CA/0')).toEqual([
      'fallbackChains',
      'fr-CA',
      0,
    ]);
    expect(pathFromPointer('/fallbackChains/a~1b')).toEqual([
      'fallbackChains',
      'a/b',
    ]);
    expect(pathFromPointer('')).toEqual([]);
  });

  it('maps a path to the control that owns it, else the summary only', () => {
    expect(issueControlTarget(['supportedLocales'])).toEqual({
      control: 'tags',
    });
    expect(issueControlTarget(['supportedLocales', 1])).toEqual({
      control: 'tags',
    });
    expect(issueControlTarget(['sourceLocale'])).toEqual({ control: 'source' });
    expect(issueControlTarget(['defaultLocale'])).toEqual({
      control: 'default',
    });
    expect(issueControlTarget(['fallbackChains', 'fr-CA', 0])).toEqual({
      control: 'chain',
      target: 'fr-CA',
      index: 0,
    });
    expect(issueControlTarget(['fallbackChains', 'fr-CA'])).toEqual({
      control: 'chain',
      target: 'fr-CA',
    });
    expect(issueControlTarget(['fallbackChains'])).toEqual({
      control: 'summary',
    });
    expect(issueControlTarget(['workflowKey'])).toEqual({ control: 'summary' });
  });
});

describe('review diff and sentences', () => {
  it('[P2-S09-AC-1225] lists added, removed and reordered languages against the source', () => {
    const source = {
      sourceLocale: 'en-US',
      defaultLocale: 'en-US',
      supportedLocales: ['en-US', 'fr', 'de'],
      fallbackChains: { fr: ['en-US'], de: ['fr', 'en-US'] },
    };
    let draft = draftFromConfig(source);
    draft = removeTag(draft, 'fr').draft;
    draft = addTag(draft, 'es').draft;
    draft = addIntermediate(draft, 'es', 'de');
    expect(diffAgainstSource(source, draft)).toEqual({
      added: ['es'],
      removed: ['fr'],
      reordered: ['de'],
    });
  });

  it('[P2-S09-AC-1225] treats every language as added when there is no source', () => {
    expect(diffAgainstSource(null, filled())).toEqual({
      added: ['en-US', 'fr', 'fr-CA'],
      removed: [],
      reordered: [],
    });
  });

  it('[P2-S09-AC-1225] reports a changed default as a reorder of every retained language', () => {
    const source = {
      sourceLocale: 'en',
      defaultLocale: 'en',
      supportedLocales: ['en', 'aa'],
      fallbackChains: { aa: ['en'] },
    };
    const draft = setDefaultLocale(draftFromConfig(source), 'aa');
    expect(diffAgainstSource(source, draft).reordered).toEqual(['aa', 'en']);
  });

  it('writes the chain as target colon arrows ending at the default', () => {
    expect(chainSentence('fr-CA', ['fr'], 'en-US')).toBe('fr-CA: fr → en-US');
    expect(chainSentence('fr', [], 'en-US')).toBe('fr: en-US');
  });
});

describe('control ids', () => {
  it('derives stable ids per control from the form id', () => {
    expect(localeControlId('f', { control: 'tags' })).toBe('f-locale-tags');
    expect(localeControlId('f', { control: 'source' })).toBe('f-locale-source');
    expect(localeControlId('f', { control: 'default' })).toBe(
      'f-locale-default',
    );
    expect(localeControlId('f', { control: 'summary' })).toBe(
      'f-locale-summary',
    );
    expect(localeControlId('f', { control: 'chain', target: 'fr-CA' })).toBe(
      'f-locale-chain-fr-CA',
    );
    expect(
      localeControlId('f', {
        control: 'chain',
        target: 'zh-Hans-CN',
        index: 1,
      }),
    ).toBe('f-locale-chain-zh-Hans-CN');
  });
});
