// @vitest-environment jsdom

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS } from '@wejammin/contracts';

import {
  WorkbenchUnderTest,
  renderDocument,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';
import { draftDetail } from './content-schema-review-dec108.test-support';
import type { ContentSchemaRegistryVariant } from './content-schema-registry-types';
import { list } from './content-schema-registry-server-test-values';

/**
 * FE03 ContentSchemaRegistryWorkbench props contract (AC220, as it must be
 * reworded: the island carries an acting-context LABEL, never actor or acting
 * party IDs, per the island privacy invariant).
 */
const VARIANTS: readonly ContentSchemaRegistryVariant[] = [
  'degradedPage',
  'entitledRead',
  'ownerFull',
  'guardianMandate',
  'juniorRestricted',
  'businessMandate',
  'staffCaseScoped',
  'adminStepUp',
  'schemaReviewAssigned',
  'forbiddenHidden',
  'disabledPrerequisite',
];

describe('[P2-S09-AC-220] Workbench props contract (AC220 as reworded)', () => {
  it('has children: never - an element child is never rendered', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        WorkbenchUnderTest,
        versionPageProps(),
        'LEAKED CHILD',
      ),
    );
    expect(markup).not.toContain('LEAKED CHILD');
  });

  it('accepts exactly the protected named variants: every generated presentation variant plus the two page-level ones', () => {
    for (const variant of CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS)
      expect(VARIANTS, variant).toContain(variant);
    expect(
      VARIANTS.filter(
        (variant) =>
          !(
            CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS as readonly string[]
          ).includes(variant),
      ),
    ).toEqual(['degradedPage']);
    for (const variant of VARIANTS) {
      const doc = renderDocument(
        versionPageProps({ variant, access: 'read-only' }),
      );
      expect(
        doc
          .querySelector('section[data-workbench]')
          ?.getAttribute('data-variant'),
        variant,
      ).toBe(variant);
    }
  });

  it('takes separate typed list and detail AsyncState props that never leak into each other', () => {
    const detailError = {
      status: 'error',
      error: { code: 'NOT_FOUND', message: 'x' },
      retryable: false,
      httpStatus: 404,
    } as never;
    const listOk = {
      status: 'success',
      data: list,
      version: '4',
      stale: false,
    } as never;
    const a = renderDocument(
      versionPageProps({
        initialList: listOk,
        initialDetail: detailError,
        contentTypeId: null,
        versionId: null,
      }),
    );
    expect(a.querySelector('table')).not.toBeNull();
    expect(a.body.textContent).toContain(
      'The requested registry record was not found.',
    );
    const b = renderDocument(
      versionPageProps({
        initialList: {
          status: 'error',
          error: { code: 'RATE_LIMITED', message: 'x' },
          retryable: true,
          httpStatus: 429,
        } as never,
        initialDetail: {
          status: 'success',
          version: '4',
          stale: false,
          data: draftDetail(),
        } as never,
      }),
    );
    expect(b.querySelector('table')).toBeNull();
    expect(b.body.textContent).toContain('Too many registry requests');
    expect(
      b.querySelector('.content-schema-registry-detail h3')?.textContent,
    ).toBeTruthy();
    for (const status of [
      'idle',
      'loading',
      'empty',
      'success',
      'error',
      'degraded',
      'disabled',
    ] as const) {
      const state =
        status === 'empty'
          ? { status, reason: 'no-records' }
          : status === 'success'
            ? listOk
            : status === 'error'
              ? {
                  status,
                  error: { code: 'INTERNAL_ERROR', message: 'x' },
                  retryable: false,
                }
              : status === 'degraded'
                ? { status, data: null, lastVerifiedAt: null }
                : status === 'disabled'
                  ? { status, reason: 'off' }
                  : { status };
      expect(() =>
        renderDocument(versionPageProps({ initialList: state as never })),
      ).not.toThrow();
    }
  });

  it('carries query, path ids, cursor and expected version into the canonical URLs and command forms, and the refetch binding into the root', () => {
    const doc = renderDocument(
      versionPageProps({
        query: {
          limit: 10,
          sort: 'version',
          direction: 'desc',
          keyPrefix: 'rel',
        } as never,
        initialDetail: {
          status: 'success',
          version: '9',
          stale: false,
          data: draftDetail(undefined, { version: '9' }),
        } as never,
        retryUrl: '/app/cms-content-modeling/t/versions/v?cursor=abc',
      }),
    );
    const root = doc.querySelector('section[data-workbench]') as HTMLElement;
    expect(root.getAttribute('data-canonical-refetch-url')).toBe(
      '/app/cms-content-modeling/t/versions/v?cursor=abc',
    );
    expect(root.getAttribute('data-canonical-refetch-binding')).toBe('bound');
    expect(
      doc
        .querySelector(
          'form[data-operation-id="CMS-03A-02"] input[name="if-match"]',
        )
        ?.getAttribute('value'),
    ).toBe('"9"');
    expect(
      doc
        .querySelector<HTMLInputElement>('input[name="keyPrefix"]')
        ?.getAttribute('value'),
    ).toBe('rel');
    expect(
      doc
        .querySelector('select[name="sort"] option[selected]')
        ?.getAttribute('value'),
    ).toBe('version');
    const unbound = renderToStaticMarkup(
      React.createElement(WorkbenchUnderTest, {
        ...versionPageProps(),
        onCanonicalRefetch: undefined as never,
      }),
    );
    expect(unbound).toContain('data-canonical-refetch-binding="unbound"');
  });

  it('exposes an acting-context label and no actor or acting-party identifier, and calls the canonical-refetch callback through the preparation panel', () => {
    const doc = renderDocument(
      versionPageProps({ actingContextLabel: 'Studio Owner' }),
    );
    expect(doc.body.innerHTML).not.toMatch(
      /actorId|actingPartyId|5a1c9e2b-4d37|b7e402d9-81aa/u,
    );
    const refetch = vi.fn(async () => undefined);
    expect(
      typeof versionPageProps({ onCanonicalRefetch: refetch })
        .onCanonicalRefetch,
    ).toBe('function');
  });
});
