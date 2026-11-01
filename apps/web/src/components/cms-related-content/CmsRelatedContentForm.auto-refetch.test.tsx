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
  SNAPSHOT_SELECTOR,
  boundField,
  canonicalReads,
  dependencyFailure,
  draftAnswer,
  heading,
  localVersion,
  name,
  noRuleAnswer,
  rateLimited,
  reads,
  ruleAnswer,
  sent,
} from './related-conflict.test-support';

/*
 * [P2-S12-AC-271] commandState (FE03 1047 to 1050, DEC-242): a 409 is refetched AUTOMATICALLY (the person's values are
 * kept and compared with the server state, no press needed); an unknown outcome renders pending and is reconciled by a
 * read BEFORE any retry is offered; a verified success refetches the saved rule.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const RECONCILING = 'Checking whether the save went through…';
const pendingRegion = (container: HTMLElement): string =>
  container.querySelector('.cms-related-status[role="status"]')?.textContent ??
  '';

/** Compose a draft (one pin, the shared-terms rule, a bound of 12) and press Save. */
const saving = async (
  submit: ReturnType<typeof submitStub>,
  fetcher?: ReturnType<typeof canonicalReads>,
) => {
  if (fetcher !== undefined) vi.stubGlobal('fetch', fetcher);
  const { container } = mount({ submit });
  await click(buttonNamed(container, `Pin ${name(1)}`));
  await click(byLabel(container, /Shared terms/u));
  await typeInto(boundField(container), '12');
  await click(buttonNamed(container, 'Save related content'));
  await flush();
  return container;
};
const matching = (version: string) =>
  ruleAnswer({
    version,
    pins: [id(1)],
    exclusions: [],
    derivedRule: { key: 'shared-terms', version: '1' },
  });

describe('409: refetched automatically, values kept and compared', () => {
  it('[P2-S12-AC-271] commandState error: a 409 reads the protected draft and then the saved rule by itself and shows the server state beside the kept values', async () => {
    const fetcher = canonicalReads({
      [DRAFT_PATH]: () => draftAnswer('9'),
      [RULE_PATH]: () => ruleAnswer({ version: '10' }),
    });
    const submit = submitStub({ kind: 'conflict', currentVersion: '9' });
    const container = await saving(submit, fetcher);
    expect(reads(fetcher).map((call) => call.path)).toEqual([
      DRAFT_PATH,
      RULE_PATH,
    ]);
    expect(container.querySelector(SNAPSHOT_SELECTOR)).not.toBeNull();
    expect(text(container)).toContain(id(2));
    expect(listItems(container, 'ol.cms-related-rows')).toEqual([id(1)]);
    expect(boundField(container).value).toBe('12');
    expect(
      (byLabel(container, /Shared terms/u) as HTMLInputElement).checked,
    ).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    buttonNamed(container, /^Reapply/u);
  });

  it('[P2-S12-AC-271] commandState error: a 409 whose automatic read fails keeps the values, offers no Reapply and lets Review changes read again', async () => {
    let healthy = false;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (!healthy) return dependencyFailure(false);
      return String(input).endsWith('related-content')
        ? ruleAnswer({ version: '10' })
        : draftAnswer('9');
    });
    vi.stubGlobal('fetch', fetcher);
    const submit = submitStub({ kind: 'conflict', currentVersion: '9' });
    const container = await saving(submit);
    expect(heading(container)).toBe('This entry changed');
    // The automatic review read WAS attempted (the draft first), answered 503 and offered no retry by itself.
    expect(reads(fetcher).map((read) => `${read.method} ${read.path}`)).toEqual(
      [`GET ${DRAFT_PATH}`],
    );
    expect(() => buttonNamed(container, /^Reapply/u)).toThrow();
    expect(boundField(container).value).toBe('12');
    healthy = true;
    await click(buttonNamed(container, 'Review changes'));
    await flush();
    buttonNamed(container, /^Reapply/u);
  });
});

describe('unknown outcome: reconciled by a read before any retry', () => {
  it('[P2-S12-AC-271] commandState degraded: an unknown save renders pending while the entry is read, offers no retry meanwhile and shows the saved result when the read finds it recorded', async () => {
    let release: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => (release = resolve));
    const fetcher = canonicalReads({
      [DRAFT_PATH]: () => held,
      [RULE_PATH]: () => matching('5'),
    });
    const submit = submitStub({ kind: 'uncertain' });
    const container = await saving(submit, fetcher);
    expect(pendingRegion(container)).toBe(RECONCILING);
    expect(buttonNamed(container, 'Save related content').disabled).toBe(true);
    release(draftAnswer('5'));
    await flush();
    expect(heading(container)).toBe('Related content saved');
    expect(localVersion(container)).toBe('5');
    expect(submit).toHaveBeenCalledTimes(1);
    expect(buttonNamed(container, 'Save related content').disabled).toBe(false);
  });

  it('[P2-S12-AC-271] commandState degraded: an unknown save the read finds not recorded keeps the values, says so and only then offers the identical retry under the same key', async () => {
    const fetcher = canonicalReads({
      [DRAFT_PATH]: () => draftAnswer('4'),
      [RULE_PATH]: () => noRuleAnswer(),
    });
    const submit = submitStub((call) =>
      call === 0 ? { kind: 'uncertain' } : { kind: 'saved', saved: savedOf() },
    );
    const container = await saving(submit, fetcher);
    expect(heading(container)).toBe('Save not recorded');
    expect(text(container)).toContain('The save was not recorded.');
    expect(listItems(container, 'ol.cms-related-rows')).toEqual([id(1)]);
    expect(boundField(container).value).toBe('12');
    await click(buttonNamed(container, 'Save related content'));
    await flush();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(sent(submit, 1)[2]).toBe(sent(submit, 0)[2]);
    expect(sent(submit, 1)[0]).toEqual(sent(submit, 0)[0]);
  });

  it('[P2-S12-AC-271] commandState degraded: an unknown save whose read fails offers no retry, only a check again, and the check again settles it', async () => {
    let healthy = false;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (!healthy) return dependencyFailure(false);
      return String(input).endsWith('related-content')
        ? matching('5')
        : draftAnswer('5');
    });
    vi.stubGlobal('fetch', fetcher);
    const submit = submitStub({ kind: 'uncertain' });
    const container = await saving(submit);
    expect(heading(container)).toBe('Save not confirmed');
    expect(buttonNamed(container, 'Save related content').disabled).toBe(true);
    healthy = true;
    await click(buttonNamed(container, 'Check again'));
    await flush();
    expect(heading(container)).toBe('Related content saved');
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

describe('unknown outcome: the reconciling read is limited or outlives the page', () => {
  it('[P2-S12-AC-271] commandState degraded (test correction, V19 m6): a reconciling read answered 429 holds Save and Check again (aria-disabled, still mounted) for the stated wait and keeps the values', async () => {
    const fetcher = canonicalReads({
      [DRAFT_PATH]: () => rateLimited(5),
    });
    const submit = submitStub({ kind: 'uncertain' });
    const container = await saving(submit, fetcher);
    expect(heading(container)).toBe('Save not confirmed');
    expect(buttonNamed(container, 'Save related content').disabled).toBe(true);
    expect(
      buttonNamed(container, 'Check again').getAttribute('aria-disabled'),
    ).toBe('true');
    expect(text(container)).toContain('Waiting before you can save again.');
    expect(boundField(container).value).toBe('12');
  });

  it('[P2-S12-AC-271] commandState degraded: a page that goes away while the save is read back changes nothing and sends nothing more', async () => {
    let release: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => (release = resolve));
    const fetcher = canonicalReads({
      [DRAFT_PATH]: () => held,
      [RULE_PATH]: () => matching('5'),
    });
    const submit = submitStub({ kind: 'uncertain' });
    vi.stubGlobal('fetch', fetcher);
    const mounted = mount({ submit });
    await click(buttonNamed(mounted.container, `Pin ${name(1)}`));
    await click(buttonNamed(mounted.container, 'Save related content'));
    await flush();
    mounted.unmount();
    release(draftAnswer('5'));
    await flush();
    expect(reads(fetcher).map((call) => call.path)).toEqual([DRAFT_PATH]);
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

describe('success: the saved rule is refetched', () => {
  it('[P2-S12-AC-271] commandState success: a verified save reads the saved rule again and takes its entry version as the next one', async () => {
    const fetcher = canonicalReads({
      [DRAFT_PATH]: () => draftAnswer('6'),
      [RULE_PATH]: () => matching('6'),
    });
    const submit = submitStub({
      kind: 'saved',
      saved: savedOf({ version: '5' }),
    });
    const container = await saving(submit, fetcher);
    expect(reads(fetcher).map((call) => call.path)).toEqual([
      DRAFT_PATH,
      RULE_PATH,
    ]);
    expect(heading(container)).toBe('Related content saved');
    expect(localVersion(container)).toBe('6');
  });

  it('[P2-S12-AC-271] commandState success: a refetch that cannot be verified keeps the verified save and its version', async () => {
    const fetcher = vi.fn(async () => dependencyFailure(false));
    vi.stubGlobal('fetch', fetcher);
    const submit = submitStub({
      kind: 'saved',
      saved: savedOf({ version: '5' }),
    });
    const container = await saving(submit);
    // The refetch WAS attempted (a read of the saved rule or draft) and could not be verified.
    expect(reads(fetcher).length).toBeGreaterThan(0);
    expect(reads(fetcher).every((read) => read.method === 'GET')).toBe(true);
    expect(heading(container)).toBe('Related content saved');
    expect(localVersion(container)).toBe('5');
  });
});
