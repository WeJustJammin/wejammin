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
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  PAGE_PATH,
  id,
  listItems,
  mount,
  savedOf,
  submitStub,
  text,
} from './related-content.test-support';

import {
  DRAFT_PATH,
  RULE_PATH,
  PROHIBITED_READ_HEADERS,
  boundField,
  canonicalReads,
  draftAnswer,
  heading,
  json,
  name,
  noRuleAnswer,
  rateLimited,
  reads,
  reviewMessage,
  ruleAnswer,
  sent,
  settle,
} from './related-conflict.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/*
 * FE03 :1224 (form contract) with DEC-242 (a 409 is refetched AUTOMATICALLY, the explicit press is not "refetched"): a
 * 409 reads the protected draft detail (CMS-03B-11) FIRST, then the saved rule (cmsRelatedContentRead, DEC-195), by
 * itself, and shows the verified server snapshot beside the preserved draft, with Review changes (to read again),
 * Reapply when permitted and Discard; it never overwrites automatically. Reapply re-sends the preserved draft on the
 * reviewed rule.version, or on the earlier draft entry.version when the read answered `rule: null`, with a
 * fresh key; the reviewed token is never the 409's `currentVersion` (the blind-adoption defect this suite
 * pins). A failed, aborted or malformed read keeps the draft and its token and offers no Reapply, and a 429
 * on the read keeps the input and disables Review changes until the stated wait elapses.
 */

/**
 * Save a preserved draft (one pin, a rule and an entered bound) into the 409 conflict. The wire the automatic review
 * reads is installed BEFORE the save: the first read is the one the 409 starts.
 */
const conflicted = async (
  submit: ReturnType<typeof submitStub>,
  wire?: ReturnType<typeof vi.fn>,
): Promise<HTMLElement> => {
  if (wire !== undefined) vi.stubGlobal('fetch', wire);
  const { container } = mount({ submit });
  await click(buttonNamed(container, `Pin ${name(1)}`));
  await click(byLabel(container, /Shared terms/u));
  await typeInto(boundField(container), '12');
  await click(buttonNamed(container, 'Save related content'));
  await flush();
  return container;
};

describe('CmsRelatedContentForm: 409 review, reapply and discard', () => {
  it('[P2-S12-AC-271] test correction (DEC-242): keeps the ordered pins, the rule and the entered bound beside the server state the 409 read by itself, and offers Review changes to read again', async () => {
    const submit = submitStub({ kind: 'conflict', currentVersion: '9' });
    const container = await conflicted(
      submit,
      canonicalReads({
        [DRAFT_PATH]: () => draftAnswer('9'),
        [RULE_PATH]: () => ruleAnswer(),
      }),
    );
    expect(heading(container)).toBe('This entry changed');
    expect(text(container)).toContain('Your choices are kept.');
    expect(listItems(container, 'ol.cms-related-rows')).toEqual([id(1)]);
    expect(
      (byLabel(container, /Shared terms/u) as HTMLInputElement).checked,
    ).toBe(true);
    expect(boundField(container).value).toBe('12');
    expect(text(container)).toContain('Entry version4');
    // Beside the draft sits the server state the 409 read by itself: the review section lists the saved rule's pin
    // (not the person's), and nothing else was pressed.
    const review = container.querySelector(
      'section[aria-label="Related content conflict review"]',
    );
    expect(review).not.toBeNull();
    expect(review?.textContent).toContain(id(2));
    expect(review?.textContent).not.toContain(id(1));
    buttonNamed(container, 'Review changes');
  });

  it('[P2-S12-AC-271] test correction (DEC-242): the 409 reads the protected draft detail first and then the saved rule by itself, with no press, no further save and no mutation header', async () => {
    const submit = submitStub({ kind: 'conflict', currentVersion: '9' });
    const fetcher = canonicalReads({
      [DRAFT_PATH]: () => draftAnswer('9'),
      [RULE_PATH]: () => ruleAnswer(),
    });
    const container = await conflicted(submit, fetcher);
    const called = reads(fetcher);
    expect(called.map((call) => call.path)).toEqual([DRAFT_PATH, RULE_PATH]);
    expect(called.every((call) => call.method === 'GET')).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(text(container)).toContain(id(2));
    expect(listItems(container, 'ol.cms-related-rows')).toEqual([id(1)]);
    expect(text(container)).toContain('Entry version4');
    // BOTH reads: a no-store, same-origin GET of the full path with no query, no body and no mutation header.
    for (const call of called) {
      expect(new URL(call.url).search).toBe('');
      expect(call.init?.body ?? null).toBeNull();
      expect(call.init?.credentials).toBe('same-origin');
      expect(call.init?.cache).toBe('no-store');
      for (const prohibited of PROHIBITED_READ_HEADERS)
        expect(call.headers.get(prohibited)).toBeNull();
    }
  });

  it('[P2-S12-AC-271] test correction (DEC-242): Reapply is offered once the automatic read verified; Reapply re-sends on the reviewed rule version with a fresh key and the entered bound', async () => {
    // The reapply CASes on the reviewed rule version (10); its success resource is that + 1.
    const submit = submitStub((call) =>
      call === 0
        ? { kind: 'conflict', currentVersion: '9' }
        : { kind: 'saved', saved: savedOf({ version: '11' }) },
    );
    // The rule read answers the freshest entry token (10) after the earlier draft read (9).
    const container = await conflicted(
      submit,
      canonicalReads({
        [DRAFT_PATH]: () => draftAnswer('9'),
        [RULE_PATH]: () => ruleAnswer({ version: '10' }),
      }),
    );
    await click(buttonNamed(container, /^Reapply/u));
    await flush();
    expect(submit).toHaveBeenCalledTimes(2);
    const [request, , key] = sent(submit, 1);
    expect(request.expectedVersion).toBe('10');
    expect(request.pins).toEqual([id(1)]);
    expect(request.exclusions).toEqual([]);
    expect(request.derivedRule).toMatchObject({
      key: 'shared-terms',
      maxCandidates: 12,
    });
    expect(key).not.toBe(sent(submit, 0)[2]);
    expect(heading(container)).toBe('Related content saved');
    expect(text(container)).toContain('Entry version11');
  });

  it('reapplies on the earlier draft entry version when the reviewed read answers no rule, without a further read', async () => {
    const submit = submitStub((call) =>
      call === 0
        ? { kind: 'conflict', currentVersion: '9' }
        : { kind: 'saved', saved: savedOf({ version: '12' }) },
    );
    const fetcher = canonicalReads({
      [DRAFT_PATH]: () => draftAnswer('11'),
      [RULE_PATH]: () => noRuleAnswer(),
    });
    const container = await conflicted(submit, fetcher);
    expect(reads(fetcher)).toHaveLength(2);
    await click(buttonNamed(container, /^Reapply/u));
    await flush();
    expect(sent(submit, 1)[0].expectedVersion).toBe('11');
  });

  it('[P2-S12-AC-271] test correction (DEC-242): keeps the draft and its token and offers no Reapply when the automatic review read fails', async () => {
    const submit = submitStub((call) =>
      call === 0
        ? { kind: 'conflict', currentVersion: '9' }
        : { kind: 'saved', saved: savedOf() },
    );
    const offline = vi.fn(async () => {
      throw new TypeError('offline');
    });
    const container = await conflicted(submit, offline);
    // The automatic review read WAS attempted (the draft first) and failed.
    expect(offline.mock.calls.length).toBeGreaterThan(0);
    expect(heading(container)).toBe('This entry changed');
    expect(listItems(container, 'ol.cms-related-rows')).toEqual([id(1)]);
    expect(boundField(container).value).toBe('12');
    expect(
      (byLabel(container, /Shared terms/u) as HTMLInputElement).checked,
    ).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(() => buttonNamed(container, /^Reapply/u)).toThrow();
  });

  it('keeps the draft and offers no Reapply when the reviewed rule read is malformed', async () => {
    const submit = submitStub({ kind: 'conflict', currentVersion: '9' });
    const container = await conflicted(
      submit,
      canonicalReads({
        [DRAFT_PATH]: () => draftAnswer('9'),
        [RULE_PATH]: () => json({ rule: { id: id(9) } }),
      }),
    );
    expect(listItems(container, 'ol.cms-related-rows')).toEqual([id(1)]);
    expect(() => buttonNamed(container, /^Reapply/u)).toThrow();
  });

  it('offers Review changes without a current version and keeps the conflict when a reapply answers 409 again', async () => {
    const submit = submitStub({ kind: 'conflict', currentVersion: null });
    const container = await conflicted(
      submit,
      canonicalReads({
        [DRAFT_PATH]: () => draftAnswer('9'),
        [RULE_PATH]: () => ruleAnswer(),
      }),
    );
    buttonNamed(container, 'Review changes');
    await click(buttonNamed(container, /^Reapply/u));
    await flush();
    expect(heading(container)).toBe('This entry changed');
  });

  it('keeps the input and disables Review changes until the stated 429 wait elapses', async () => {
    vi.useFakeTimers();
    const submit = submitStub({ kind: 'conflict', currentVersion: '9' });
    const container = await conflicted(
      submit,
      canonicalReads({
        [DRAFT_PATH]: () => rateLimited(5),
        [RULE_PATH]: () => rateLimited(5),
      }),
    );
    await settle(0);
    expect(buttonNamed(container, 'Review changes').disabled).toBe(true);
    expect(listItems(container, 'ol.cms-related-rows')).toEqual([id(1)]);
    expect(boundField(container).value).toBe('12');
    expect(reviewMessage(container)).toContain('Try again in 5 seconds.');
    await settle(1_000);
    expect(reviewMessage(container)).toContain('Try again in 4 seconds.');
    expect(reviewMessage(container)).not.toContain('Try again in 5 seconds.');
    await settle(3_999);
    expect(buttonNamed(container, 'Review changes').disabled).toBe(true);
    await settle(1);
    expect(buttonNamed(container, 'Review changes').disabled).toBe(false);
    expect(reviewMessage(container)).not.toMatch(
      /Try again in \d+ seconds?\./u,
    );
    expect(reviewMessage(container)).not.toContain('Try again in 5 seconds.');
  });

  it('keeps the conflict while the person edits, and still offers the page reload', async () => {
    const submit = submitStub({ kind: 'conflict', currentVersion: '9' });
    const { container } = mount({ submit });
    await click(buttonNamed(container, 'Save related content'));
    expect(heading(container)).toBe('This entry changed');
    await click(buttonNamed(container, `Pin ${name(1)}`));
    expect(heading(container)).toBe('This entry changed');
    expect(listItems(container, 'ol.cms-related-rows')).toEqual([id(1)]);
    const reload = container.querySelector(
      '.cms-related-status a',
    ) as HTMLAnchorElement;
    expect(reload.getAttribute('href')).toBe(PAGE_PATH);
  });
});
