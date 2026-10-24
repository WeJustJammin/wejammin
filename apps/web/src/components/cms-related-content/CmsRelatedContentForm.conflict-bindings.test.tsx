// @vitest-environment jsdom
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  EntryDraftDetailEtagSchema,
  EntryDraftDetailResourceSchema,
  RelatedContentRuleReadSchema,
  entryDraftDetailEtagMatchesResource,
} from '@wejammin/contracts';
import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { apiError } from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import {
  ENTRY_ID,
  id,
  listItems,
  submitStub,
  text,
} from './related-content.test-support';
import {
  DRAFT_PATH,
  RULE_PATH,
  SNAPSHOT_SELECTOR,
  boundField,
  canonicalReads,
  conflictedDraft,
  draftAnswer,
  heading,
  localVersion,
  name,
  reads,
  ruleAnswer,
} from './related-conflict.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Stage = 'draft' | 'rule';
const VARIANTS = [
  'wrong-entry',
  'missing-etag',
  'weak-etag',
  'mismatched-etag',
  'malformed',
  'unknown-field',
  403,
  404,
] as const;
type Variant = (typeof VARIANTS)[number];
const CASES = (['draft', 'rule'] as const).flatMap((stage) =>
  VARIANTS.map((variant) => [stage, variant] as const),
);
const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Expected the real-shaped fixture record');
  return value as Record<string, unknown>;
};

/** Corrupt exactly one boundary; ETag and wrong-entry cases keep a valid strict resource shape. */
const invalidAnswer = async (
  stage: Stage,
  variant: Variant,
): Promise<Response> => {
  if (typeof variant === 'number')
    return apiError(
      variant,
      variant === 403
        ? 'RELATED_CONTENT_FORBIDDEN'
        : 'RELATED_CONTENT_NOT_FOUND',
    );
  const original =
    stage === 'draft' ? draftAnswer('17') : ruleAnswer({ version: '19' });
  const body = record(await original.json());
  const headers = new Headers(original.headers);
  const etag = headers.get('etag')!;
  if (variant === 'wrong-entry') {
    if (stage === 'draft') {
      body.entry = { ...record(body.entry), id: id(80) };
      headers.set('etag', etag.replace(ENTRY_ID, id(80)));
    } else {
      body.rule = { ...record(body.rule), sourceEntryId: id(80) };
    }
  }
  if (variant === 'missing-etag') headers.delete('etag');
  if (variant === 'weak-etag') headers.set('etag', `W/${etag}`);
  if (variant === 'mismatched-etag')
    headers.set(
      'etag',
      stage === 'draft' ? etag.replace(':17:', ':18:') : '"20"',
    );
  if (variant === 'malformed') {
    if (stage === 'draft') delete body.locale;
    else {
      const rule = record(body.rule);
      delete rule.pins;
    }
  }
  if (variant === 'unknown-field') body.untrustedAuthority = 'must reject';
  const shapeValid = variant !== 'malformed' && variant !== 'unknown-field';
  expect(
    (stage === 'draft'
      ? EntryDraftDetailResourceSchema
      : RelatedContentRuleReadSchema
    ).safeParse(body).success,
  ).toBe(shapeValid);
  if (stage === 'draft' && variant === 'wrong-entry') {
    const parsed = EntryDraftDetailResourceSchema.parse(body);
    expect(
      entryDraftDetailEtagMatchesResource(headers.get('etag')!, parsed),
    ).toBe(true);
  }
  if (stage === 'draft' && variant === 'mismatched-etag') {
    expect(
      EntryDraftDetailEtagSchema.safeParse(headers.get('etag')).success,
    ).toBe(true);
    expect(
      entryDraftDetailEtagMatchesResource(
        headers.get('etag')!,
        EntryDraftDetailResourceSchema.parse(body),
      ),
    ).toBe(false);
  }
  return new Response(JSON.stringify(body), { status: 200, headers });
};

const serverFact = (region: HTMLElement, label: string): string | null =>
  Array.from(region.querySelectorAll('dt')).find(
    (term) => term.textContent === label,
  )?.nextElementSibling?.textContent ?? null;

describe('CmsRelatedContentForm: verified conflict snapshot bindings', () => {
  it('shows server-only versions, ordered lists and derived identity inside the named snapshot while local choices stay unchanged', async () => {
    const submit = submitStub({ kind: 'conflict', currentVersion: '99' });
    const { container } = await conflictedDraft(submit);
    await click(buttonNamed(container, `Pin ${name(3)}`));
    await click(buttonNamed(container, `Exclude ${name(2)}`));
    vi.stubGlobal(
      'fetch',
      canonicalReads({
        [DRAFT_PATH]: () => draftAnswer('17'),
        [RULE_PATH]: () =>
          ruleAnswer({
            version: '19',
            pins: [id(71), id(70)],
            exclusions: [id(72), id(73)],
            derivedRule: { key: 'same-type-recent', version: '6' },
            eligibleCount: 7,
          }),
      }),
    );
    await click(buttonNamed(container, 'Review changes'));
    await flush();
    const server = container.querySelector<HTMLElement>(SNAPSHOT_SELECTOR);
    expect(server).not.toBeNull();
    expect(
      server!.querySelector('#cms-related-server-heading')?.textContent,
    ).toBe('Current server state');
    expect(serverFact(server!, 'Reviewed draft entry version')).toBe('17');
    expect(serverFact(server!, 'Reapply entry version')).toBe('19');
    expect(
      Array.from(server!.querySelectorAll('ol li code')).map(
        (node) => node.textContent,
      ),
    ).toEqual([id(71), id(70)]);
    expect(
      Array.from(server!.querySelectorAll('ul li code')).map(
        (node) => node.textContent,
      ),
    ).toEqual([id(72), id(73)]);
    const serverText = text(server!).replace(/\s+/gu, ' ');
    expect(serverText).toContain(
      'Saved rule entry version: 19. Eligible entries: 7.',
    );
    expect(serverText).toContain(
      'Saved derived rule: same-type-recent, version 6.',
    );
    expect(serverText).toContain(
      'Its candidate bound is unavailable in this read.',
    );
    expect(server!.querySelector('input')).toBeNull();
    expect(localVersion(container)).toBe('4');
    expect(listItems(container, 'ol.cms-related-rows')).toEqual([id(1), id(3)]);
    expect(listItems(container, 'ul.cms-related-rows')).toEqual([id(2)]);
    expect(
      (byLabel(container, /Shared terms/u) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (byLabel(container, /Same type, most recent/u) as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(boundField(container).value).toBe('12');
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it.each(CASES)(
    'rejects the %s read with %s without changing the local draft/token or offering Reapply',
    async (stage, variant) => {
      const submit = submitStub({ kind: 'conflict', currentVersion: '99' });
      const { container } = await conflictedDraft(submit);
      // Fixture assertions run outside fetch, so the transport cannot swallow a broken fixture.
      const rejected = await invalidAnswer(stage, variant);
      const fetcher = canonicalReads({
        [DRAFT_PATH]: () => (stage === 'draft' ? rejected : draftAnswer('17')),
        [RULE_PATH]: () =>
          stage === 'rule' ? rejected : ruleAnswer({ version: '19' }),
      });
      vi.stubGlobal('fetch', fetcher);
      await click(buttonNamed(container, 'Review changes'));
      await flush();
      expect(reads(fetcher).map((call) => call.path)).toEqual(
        stage === 'draft' ? [DRAFT_PATH] : [DRAFT_PATH, RULE_PATH],
      );
      expect(heading(container)).toBe('This entry changed');
      expect(container.querySelector(SNAPSHOT_SELECTOR)).toBeNull();
      expect(() => buttonNamed(container, /^Reapply/u)).toThrow();
      expect(localVersion(container)).toBe('4');
      expect(listItems(container, 'ol.cms-related-rows')).toEqual([id(1)]);
      expect(listItems(container, 'ul.cms-related-rows')).toEqual([]);
      expect(
        (byLabel(container, /Shared terms/u) as HTMLInputElement).checked,
      ).toBe(true);
      expect(boundField(container).value).toBe('12');
      expect(submit).toHaveBeenCalledTimes(1);
      expect(text(container)).not.toContain(
        'Server text that must never be shown.',
      );
    },
  );
});
