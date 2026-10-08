import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsEditorialRevisionCompare from './CmsEditorialRevisionCompare';
import CmsEditorialRestoreForm from './CmsEditorialRestoreForm';
import {
  CHAIN_ID,
  FIELD,
  HASH_A,
  HASH_B,
  HISTORY_ENTRY_ID,
  LEFT_ID,
  RIGHT_ID,
  TOKEN,
  change,
  compareWith,
  historyPage,
  restore,
} from './cms-editorial-history-fixtures.test-support';

const compareOf = (
  changes: readonly Record<string, unknown>[],
  restoreValue: Record<string, unknown> | null = restore(),
) => {
  const compare = historyPage({
    compare: compareWith(changes, restoreValue),
  }).compare;
  if (compare === null) throw new Error('fixture');
  return compare;
};

const renderCompare = (
  compare: ReturnType<typeof compareOf> | null,
  options: {
    refusal?: 'comparison_too_large' | 'comparison_unavailable' | null;
    expectedVersion?: string | null;
  } = {},
): string =>
  renderToStaticMarkup(
    <CmsEditorialRevisionCompare
      compare={compare}
      refusal={options.refusal ?? null}
      entryId={HISTORY_ENTRY_ID}
      expectedVersion={
        options.expectedVersion === undefined ? '7' : options.expectedVersion
      }
    />,
  );

describe('CmsEditorialRevisionCompare: domains and counts', () => {
  const all = [change('relation'), change('field'), change('block')];

  it('names the comparison heading as a focus target and groups changes field, block, relation', () => {
    const html = renderCompare(compareOf(all));
    expect(html).toContain(
      '<h2 id="history-compare-title" tabindex="-1">Comparison</h2>',
    );
    const field = html.indexOf('Field changes');
    const block = html.indexOf('Block changes');
    const relation = html.indexOf('Relation changes');
    expect(field).toBeGreaterThan(-1);
    expect(field).toBeLessThan(block);
    expect(block).toBeLessThan(relation);
  });

  it('announces the change count politely, with the count per domain', () => {
    const html = renderCompare(compareOf(all));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('3 changes: 1 field, 1 block, 1 relation.');
    expect(renderCompare(compareOf([change('field')]))).toContain(
      '1 change: 1 field.',
    );
    expect(renderCompare(compareOf([]))).toContain(
      'No differences between these revisions.',
    );
  });

  it('shows only side hashes, and for a relation only the keyed target token', () => {
    const html = renderCompare(compareOf(all));
    expect(html).toContain(`Before hash: <code>${HASH_A}</code>`);
    expect(html).toContain(`After hash: <code>${HASH_B}</code>`);
    expect(html.match(/Target token/gu)).toHaveLength(1);
    expect(html).toContain(`Target token: <code>${TOKEN}</code>`);
    // The relation pointer's field id is shown; the token is not a resolvable id.
    expect(html).not.toContain(`/relations/${FIELD}/${TOKEN}`);
  });

  it('states an unrecorded side hash in words', () => {
    const html = renderCompare(
      compareOf([change('field', { kind: 'added', leftHash: null })]),
    );
    expect(html).toContain('Before hash: <code>none</code>');
  });
});

describe('CmsEditorialRevisionCompare: typed refusals, never a truncated success', () => {
  it('renders comparison_too_large as its own refusal with no change list', () => {
    const html = renderCompare(null, { refusal: 'comparison_too_large' });
    expect(html).toContain(
      '<h2 id="history-compare-title" tabindex="-1">Comparison</h2>',
    );
    expect(html).toContain('more than 512 places');
    expect(html).not.toContain('Field changes');
    expect(html).not.toContain('<ul');
  });

  it('renders comparison_unavailable as a non-disclosing unavailable state', () => {
    const html = renderCompare(null, { refusal: 'comparison_unavailable' });
    expect(html).toContain('cannot be compared');
    expect(html).not.toContain('Field changes');
  });

  it('renders nothing when nothing was selected', () => {
    expect(renderCompare(null)).toBe('');
  });
});

describe('CmsEditorialRestoreForm', () => {
  const render = (
    compare: ReturnType<typeof compareOf>,
    expectedVersion: string | null = '7',
  ) =>
    renderToStaticMarkup(
      <CmsEditorialRestoreForm
        compare={compare}
        entryId={HISTORY_ENTRY_ID}
        expectedVersion={expectedVersion}
      />,
    );

  it('restores the LEFT revision: the source the chain was derived for, never the right side', () => {
    const html = render(compareOf([change('field')]));
    expect(html).toContain(
      `/api/v1/cms/entries/${HISTORY_ENTRY_ID}/revisions/${LEFT_ID}/restore`,
    );
    expect(html).toContain(`name="revisionId" value="${LEFT_ID}"`);
    expect(html).not.toContain(`revisions/${RIGHT_ID}/restore`);
    expect(html).not.toContain(`name="revisionId" value="${RIGHT_ID}"`);
  });

  it('submits the read-derived chain and the current version, and states the consequence', () => {
    const html = render(compareOf([change('field')]));
    expect(html).toContain(`name="migrationChainId" value="${CHAIN_ID}"`);
    expect(html).toContain('name="expectedVersion" value="7"');
    expect(html).toContain('name="availability" value="available"');
    expect(html).toContain('name="edgeCount" value="3"');
    expect(html).toContain('data-cms-editorial-restore');
    expect(html).toContain(
      'Restoring creates a new draft revision. The source revision stays unchanged.',
    );
  });

  it('states the edge count and availability in the confirmation copy, not only in a hidden control', () => {
    const html = render(compareOf([change('field')], restore('available', 4)));
    expect(html).toContain('Migration steps: 4');
    expect(html).toContain('Availability: available');
    const zero = render(compareOf([change('field')], restore('available', 0)));
    expect(zero).toContain('Migration steps: 0');
  });

  it('is an inline review step: a labelled disclosure, a focus-target heading and an explicit cancel', () => {
    const html = render(compareOf([change('field')]));
    expect(html).toContain('<details');
    expect(html).toContain('<summary>Restore this revision</summary>');
    expect(html).toContain('id="history-restore-title" tabindex="-1"');
    expect(html).toContain('Confirm restore');
    expect(html).toContain('data-cms-editorial-restore-cancel');
    // Committing is one deliberate button inside the review, not the summary.
    expect(html.match(/type="submit"/gu)).toHaveLength(1);
  });

  it.each([
    [
      'chain_unavailable',
      'The migration chain is unavailable for this revision.',
    ],
    ['transform_missing', 'A required transform is missing for this revision.'],
  ])(
    'states %s without any commit affordance or chain internals',
    (availability, copy) => {
      const html = render(compareOf([change('field')], restore(availability)));
      expect(html).toContain(copy);
      expect(html).not.toContain('<form');
      expect(html).not.toContain('<details');
      expect(html).not.toContain(CHAIN_ID);
    },
  );

  it('refuses to offer a restore without the current entry version', () => {
    const html = render(compareOf([change('field')]), null);
    expect(html).toContain('Reload before restoring.');
    expect(html).not.toContain('<form');
  });

  it('offers nothing when the comparison carries no restore verdict', () => {
    const html = render(compareOf([change('field')], null));
    expect(html).toBe('');
  });
});
