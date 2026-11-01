// @vitest-environment jsdom
import * as React from 'react';
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
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { CSRF } from '../../server/cms-workflow-platform-command.test-support';
import CmsEditorialReviewDetailIsland from './CmsEditorialReviewDetailIsland';
import CmsEditorialWorkflowIsland from './CmsEditorialWorkflowIsland';
import type { CanonicalReadResult } from './cms-workflow-canonical-read';
import {
  ENTRY_ID,
  INSTANT,
  REVIEW_ID,
  apiError,
  jsonResponse,
  reviewDetailFixture,
  workflowFixture,
} from './cms-workflow-fixtures.test-support';
import { useCanonicalResource } from './use-cms-workflow-canonical';
import { useDraftFields } from './use-cms-workflow-draft-fields';
import { newIdempotencyKey } from './use-cms-workflow-command';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('newIdempotencyKey', () => {
  it('is a printable key of 8 to 128 characters from the platform UUID', () => {
    const key = newIdempotencyKey();
    expect(key).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it('falls back to 32 hex characters from random bytes when randomUUID is missing', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(171),
    });
    expect(newIdempotencyKey()).toBe('ab'.repeat(16));
  });
});

describe('useDraftFields', () => {
  const Probe = ({
    restored,
  }: {
    readonly restored: Readonly<Record<string, string>> | null;
  }): React.ReactElement => {
    const fields = useDraftFields(restored, { zone: 'UTC' });
    return (
      <div>
        <output data-name="a">{fields.value('a')}</output>
        <output data-name="zone">{fields.value('zone')}</output>
        <button type="button" onClick={() => fields.set('a', 'typed')}>
          type
        </button>
        <button type="button" onClick={() => fields.set('a', '')}>
          clear
        </button>
        <button type="button" onClick={() => fields.reset()}>
          reset
        </button>
      </div>
    );
  };
  const read = (container: HTMLElement, name: string): string =>
    container.querySelector(`[data-name="${name}"]`)?.textContent ?? '';

  it('shows the default, then the restored overlay, then what was typed, and reset returns to the overlay', async () => {
    const { container, rerender } = mountElement(<Probe restored={null} />);
    expect(read(container, 'a')).toBe('');
    expect(read(container, 'zone')).toBe('UTC');
    rerender(<Probe restored={{ a: 'restored', zone: 'Europe/Paris' }} />);
    expect(read(container, 'a')).toBe('restored');
    expect(read(container, 'zone')).toBe('Europe/Paris');
    await click(buttonNamed(container, 'type'));
    expect(read(container, 'a')).toBe('typed');
    await click(buttonNamed(container, 'clear'));
    expect(read(container, 'a')).toBe('');
    await click(buttonNamed(container, 'reset'));
    expect(read(container, 'a')).toBe('restored');
  });
});

describe('useCanonicalResource', () => {
  type Data = { readonly n: number };
  const Probe = ({
    reads,
  }: {
    readonly reads: (() => Promise<CanonicalReadResult<Data>>)[];
  }): React.ReactElement => {
    const queue = React.useRef(reads);
    const canonical = useCanonicalResource<Data>(
      { n: 0 },
      INSTANT,
      () =>
        (queue.current.shift() as () => Promise<CanonicalReadResult<Data>>)(),
      () => '2026-10-08T13:00:00Z',
    );
    return (
      <div>
        <output data-name="data">
          {canonical.data === null ? 'none' : canonical.data.n}
        </output>
        <output data-name="status">{canonical.status}</output>
        <output data-name="verified">{canonical.lastVerifiedAt}</output>
        <output data-name="request">{canonical.requestId ?? ''}</output>
        <button type="button" onClick={() => void canonical.refetch()}>
          refetch
        </button>
      </div>
    );
  };
  const read = (container: HTMLElement, name: string): string =>
    container.querySelector(`[data-name="${name}"]`)?.textContent ?? '';

  it('starts from the verified resource and replaces it only by a later verified read', async () => {
    const { container } = mountElement(
      <Probe reads={[async () => ({ kind: 'ok', resource: { n: 7 } })]} />,
    );
    expect(read(container, 'data')).toBe('0');
    expect(read(container, 'verified')).toBe(INSTANT);
    await click(buttonNamed(container, 'refetch'));
    await flush();
    expect(read(container, 'data')).toBe('7');
    expect(read(container, 'status')).toBe('ready');
    expect(read(container, 'verified')).toBe('2026-10-08T13:00:00Z');
  });

  it('keeps the last verified resource when a read cannot be verified and records the request id', async () => {
    const { container } = mountElement(
      <Probe
        reads={[async () => ({ kind: 'degraded', requestId: 'req-1' })]}
      />,
    );
    await click(buttonNamed(container, 'refetch'));
    await flush();
    expect(read(container, 'data')).toBe('0');
    expect(read(container, 'status')).toBe('degraded');
    expect(read(container, 'request')).toBe('req-1');
    expect(read(container, 'verified')).toBe(INSTANT);
  });

  it('removes the data for a vanished record or an ended session', async () => {
    const gone = mountElement(
      <Probe reads={[async () => ({ kind: 'gone' })]} />,
    );
    await click(buttonNamed(gone.container, 'refetch'));
    await flush();
    expect(read(gone.container, 'data')).toBe('none');
    expect(read(gone.container, 'status')).toBe('gone');
    const out = mountElement(
      <Probe reads={[async () => ({ kind: 'signed-out' })]} />,
    );
    await click(buttonNamed(out.container, 'refetch'));
    await flush();
    expect(read(out.container, 'status')).toBe('signed-out');
  });

  it('applies only the latest of two overlapping reads', async () => {
    let releaseFirst: (value: CanonicalReadResult<Data>) => void = () =>
      undefined;
    const first = new Promise<CanonicalReadResult<Data>>((resolve) => {
      releaseFirst = resolve;
    });
    const { container } = mountElement(
      <Probe
        reads={[() => first, async () => ({ kind: 'ok', resource: { n: 2 } })]}
      />,
    );
    await click(buttonNamed(container, 'refetch'));
    await click(buttonNamed(container, 'refetch'));
    await flush();
    expect(read(container, 'data')).toBe('2');
    releaseFirst({ kind: 'ok', resource: { n: 1 } });
    await flush();
    expect(read(container, 'data')).toBe('2');
  });
});

describe('default seams of the islands', () => {
  it('the workflow island refetches through the first-party path with the page revision', async () => {
    const workflow = workflowFixture();
    const fetchStub = vi.fn(async () =>
      jsonResponse(200, workflow, { etag: '"x"' }),
    );
    vi.stubGlobal('fetch', fetchStub);
    const { container } = mountElement(
      <CmsEditorialWorkflowIsland
        init={{
          workflow,
          entryId: ENTRY_ID,
          revisionId: null,
          verifiedAt: INSTANT,
        }}
        environment={{
          transport: {
            fetcher: vi.fn(async () =>
              jsonResponse(409, apiError('CONFLICT', {})),
            ),
            documentRef: { cookie: `wj_csrf=${CSRF}` },
          },
          newKey: () => 'idem-key-seam-000001',
          storage: () => null,
          navigate: () => undefined,
        }}
      />,
    );
    await click(buttonNamed(container, /Submit for review \(/u));
    await vi.waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
    expect((fetchStub.mock.calls[0] as unknown as [string])[0]).toBe(
      `/api/v1/cms/entries/${ENTRY_ID}/workflow`,
    );
  });

  it('the review island refetches through the first-party review path', async () => {
    const review = reviewDetailFixture();
    const fetchStub = vi.fn(async () =>
      jsonResponse(200, review, { etag: '"2"' }),
    );
    vi.stubGlobal('fetch', fetchStub);
    const { container } = mountElement(
      <CmsEditorialReviewDetailIsland
        init={{ review, reviewId: REVIEW_ID, verifiedAt: INSTANT }}
        environment={{
          transport: {
            fetcher: vi.fn(async () =>
              jsonResponse(409, apiError('CONFLICT', {})),
            ),
            documentRef: { cookie: `wj_csrf=${CSRF}` },
          },
          newKey: () => 'idem-key-seam-000002',
          storage: () => null,
          navigate: () => undefined,
        }}
      />,
    );
    await click(
      container.querySelector('input[value="approve"]') as HTMLElement,
    );
    const area = container.querySelector('textarea') as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    await React.act(async () => {
      setter?.call(area, 'Fine.');
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(buttonNamed(container, /Record approval/u));
    await vi.waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
    expect((fetchStub.mock.calls[0] as unknown as [string])[0]).toBe(
      `/api/v1/cms/reviews/${REVIEW_ID}`,
    );
  });
});
