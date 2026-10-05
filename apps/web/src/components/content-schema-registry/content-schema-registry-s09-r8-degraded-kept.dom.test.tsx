// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER,
  CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER,
  CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER,
} from '@wejammin/contracts';

import { resolveContentSchemaRegistryPage } from '../../server/content-schema-registry-context';
import { createContentSchemaRegistryPlatformPorts } from '../../server/content-schema-registry-platform-api';
import ContentSchemaRegistryWorkbenchIsland from './ContentSchemaRegistryWorkbenchIsland';
import {
  commandForm,
  definitionValue,
  regionNamed,
} from './content-schema-review-dec108-render.test-support';
import {
  ACTOR_ID,
  PARTY_ID,
  REQUEST_ID,
  draftDetail,
} from './content-schema-review-dec108.test-support';
import { passedDryRunPreparation } from './content-schema-registry-activation-preparation.test-support';
import {
  TYPE_ID,
  VERSION_ID,
  islandMarkup,
  islandPropsFixture,
  mountView,
  settle,
  unmountMountedViews,
} from './content-schema-registry-island-refetch.test-support';

/**
 * [P2-S09-AC-966] Dry-run status degraded: the last verified dryRunRef is kept
 * with lastVerifiedAt and submit-review stays disabled. The state is produced
 * through the production path, never by a prop: the island hydrates a verified
 * detail, a canonical refetch answers with the page the real server builds when
 * the detail body fails the contract (authority resolved, detail degraded), and
 * the production projection keeps the verified detail.
 */

const T_HYDRATED = '2026-10-02T12:00:00.000Z';
const T_VERIFIED = '2026-10-02T12:00:30.000Z';
const T_DEGRADED = '2026-10-02T12:05:00.000Z';

const DETAIL_URL = `https://app.example.test/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}`;

const authorityHeaders = {
  'content-type': 'application/json',
  [CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER]: 'cms.schema_designer',
  [CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER]: 'ownerFull',
  [CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER]: ACTOR_ID,
  [CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER]: PARTY_ID,
  [CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER]: new Date(
    Date.now() + 60 * 60 * 1000,
  ).toISOString(),
};

const detail = () => draftDetail(passedDryRunPreparation);

/** The real server page for a detail read whose body breaks the contract. */
const degradedServerPage = async (): Promise<Record<string, unknown>> => {
  const binding = {
    fetch: vi.fn(async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      if (request.url.includes('/acting-contexts'))
        return Response.json({
          projectionVersion: '1',
          items: [],
          nextCursor: null,
          hasMore: false,
        });
      return Response.json(
        { not: 'a registry detail' },
        { headers: authorityHeaders },
      );
    }),
  };
  const result = await resolveContentSchemaRegistryPage({
    request: new Request(DETAIL_URL, {
      headers: { cookie: 'wj_access=opaque; wj_csrf=csrf-cookie' },
    }),
    route: 'detail',
    contentTypeId: TYPE_ID,
    versionId: VERSION_ID,
    ports: createContentSchemaRegistryPlatformPorts(binding),
    requestId: REQUEST_ID,
  });
  if (result.kind !== 'degraded')
    throw new Error(`expected a degraded page, got ${result.kind}`);
  return result.page as unknown as Record<string, unknown>;
};

const verifiedMarkup = (): string =>
  islandMarkup({
    state: 'ready',
    variant: 'ownerFull',
    access: 'full',
    actingContextLabel: 'Northwind Collective',
    stepUpState: 'verified',
    stepUpFreshUntil: '2026-10-02T13:00:00.000Z',
    supportReference: 'r',
    initialList: { status: 'empty', reason: 'no-records' },
    initialDetail: {
      status: 'success',
      data: detail(),
      version: '4',
      stale: false,
    },
    initialReview: null,
  });

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(T_HYDRATED));
});

afterEach(() => {
  unmountMountedViews();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const hydrate = async (degradedMarkup: string) => {
  const reads: string[] = [verifiedMarkup(), degradedMarkup];
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const body = reads.shift() ?? degradedMarkup;
      const degraded = reads.length === 0;
      if (degraded) vi.setSystemTime(new Date(T_DEGRADED));
      return new Response(body, { status: degraded ? 503 : 200 });
    }),
  );
  const view = mountView(
    <ContentSchemaRegistryWorkbenchIsland
      {...islandPropsFixture({
        initialDetail: {
          status: 'success',
          data: detail(),
          version: '4',
          stale: false,
        },
        initialReview: null,
      })}
    />,
  );
  // Mount read: the canonical read re-verifies the detail at T_VERIFIED.
  vi.setSystemTime(new Date(T_VERIFIED));
  await settle();
  // A reconnect now answers with the degraded server page.
  await act(async () => {
    window.dispatchEvent(new Event('online'));
  });
  await settle();
  return view;
};

describe('[P2-S09-AC-966] the dry-run panel keeps the last verified dryRunRef when the canonical read degrades', () => {
  it('[P2-S09-AC-966] the server builds a degraded detail page that holds no data of its own', async () => {
    const page = await degradedServerPage();
    expect(page.access).toBe('full');
    expect(page.initialDetail).toMatchObject({
      status: 'degraded',
      data: null,
      lastVerifiedAt: null,
    });
  });

  it('[P2-S09-AC-966] keeps the verified sealed dry-run result in the preparation panel', async () => {
    const view = await hydrate(islandMarkup(await degradedServerPage()));
    const region = regionNamed(
      view.container.ownerDocument,
      /activation preparation/iu,
    );
    expect(region).not.toBeNull();
    expect(definitionValue(region as HTMLElement, /result/iu)).toBe('passed');
  });

  it('[P2-S09-AC-966] shows lastVerifiedAt as the instant the kept detail was last verified', async () => {
    const view = await hydrate(islandMarkup(await degradedServerPage()));
    const region = regionNamed(
      view.container.ownerDocument,
      /activation preparation/iu,
    );
    const stamp = (region as HTMLElement).querySelector('time');
    expect(stamp?.getAttribute('datetime')).toBe(T_VERIFIED);
  });

  it('[P2-S09-AC-966] states that the dry run is the last verified one', async () => {
    const view = await hydrate(islandMarkup(await degradedServerPage()));
    const region = regionNamed(
      view.container.ownerDocument,
      /activation preparation/iu,
    );
    expect((region as HTMLElement).textContent).toMatch(/last verified/iu);
  });

  it('[P2-S09-AC-966] keeps submit-review disabled although the kept dry run passed', async () => {
    const view = await hydrate(islandMarkup(await degradedServerPage()));
    expect(commandForm(view.container.ownerDocument, 'CMS-03A-11')).toBeNull();
    expect(
      regionNamed(view.container.ownerDocument, /activation preparation/iu)
        ?.textContent,
    ).toMatch(/submit review is disabled/iu);
  });

  it('[P2-S09-AC-966] offers no dry-run start while degraded', async () => {
    const view = await hydrate(islandMarkup(await degradedServerPage()));
    expect(commandForm(view.container.ownerDocument, 'CMS-03A-10')).toBeNull();
  });
});
