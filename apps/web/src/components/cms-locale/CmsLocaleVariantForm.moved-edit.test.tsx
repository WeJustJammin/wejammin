// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { LocaleSourceRefreshResult } from './locale-source-refresh';
import {
  mount,
  refreshStub,
  savedResult,
  sentRequest,
  submitStub,
  text,
} from './locale-variant-form.test-support';
import { HASH, SOURCE_REVISION_ID, TITLE } from './locale-variant.test-support';

/*
 * Review V20 m4: after an unknown outcome the verified read found the entry moved, and the form says "Sending again
 * retries the same request and cannot save it twice." That sentence is true only while the body is the one attempted;
 * an edit makes the next send a different request under a new key, so the notice must go with the edit.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const ready = (version: string): LocaleSourceRefreshResult => ({
  kind: 'ready',
  snapshot: {
    version,
    sourceRevisionId: SOURCE_REVISION_ID,
    sourceHash: HASH,
    texts: { [TITLE]: 'Spring tour' },
  },
});
const NOTICE =
  'Sending again retries the same request and cannot save it twice.';

const unknownThenMoved = async () => {
  const refresh = refreshStub(ready('5'));
  const submit = submitStub((call) =>
    call === 0
      ? { kind: 'uncertain' }
      : savedResult({ version: '6', savedFieldIds: [TITLE] }),
  );
  const view = mount({ submit, refresh });
  await typeInto(byLabel(view.container, 'Title'), 'Un titre');
  await click(buttonNamed(view.container, 'Save translation'));
  await flush();
  return { view, submit };
};

describe('the entry-moved notice after an unknown outcome', () => {
  it('[P2-S12-AC-271] commandState degraded: is shown while the body is the one attempted, and its retry is the same request under the same key', async () => {
    const { view, submit } = await unknownThenMoved();
    expect(text(view.container)).toContain(NOTICE);
    await click(buttonNamed(view.container, 'Save translation'));
    await flush();
    expect(submit.mock.calls[1]?.[2]).toBe(submit.mock.calls[0]?.[2]);
    expect(JSON.stringify(sentRequest(submit, 1))).toBe(
      JSON.stringify(sentRequest(submit, 0)),
    );
  });

  it('goes with the first edit, because the next send is a different request under a new key', async () => {
    const { view, submit } = await unknownThenMoved();
    await typeInto(byLabel(view.container, 'Title'), 'Un autre titre');
    await flush();
    expect(text(view.container)).not.toContain(NOTICE);
    await click(buttonNamed(view.container, 'Save translation'));
    await flush();
    expect(submit.mock.calls[1]?.[2]).not.toBe(submit.mock.calls[0]?.[2]);
    expect(JSON.stringify(sentRequest(submit, 1))).not.toBe(
      JSON.stringify(sentRequest(submit, 0)),
    );
  });
});
