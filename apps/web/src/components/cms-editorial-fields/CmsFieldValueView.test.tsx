import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsFieldValueView from './CmsFieldValueView';
import {
  describeCmsAuthoringFields,
  type CmsFieldDescriptor,
} from './cms-field-descriptor';
import { allKindFields, fieldUuid } from './cms-field-fixtures.test-support';

const descriptor = (key: string): CmsFieldDescriptor => {
  const found = describeCmsAuthoringFields(allKindFields()).find(
    (entry) => entry.key === key,
  );
  if (found === undefined) throw new Error(`fixture missing ${key}`);
  return found;
};

const html = (key: string, value: unknown, provenance = 'authored') =>
  renderToStaticMarkup(
    <CmsFieldValueView
      descriptor={descriptor(key)}
      value={value as never}
      provenance={provenance}
    />,
  );

describe('CmsFieldValueView', () => {
  it('states the absence of a value, and an explicit clear, in words', () => {
    expect(html('title', null, 'missing')).toContain('No value');
    expect(html('title', null, 'explicit_null')).toContain('Cleared');
  });

  it('escapes text instead of rendering markup', () => {
    const out = html('title', '<img src=x onerror=alert(1)>');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });

  it('renders scalar kinds in their own terms', () => {
    expect(html('featured', true)).toContain('Yes');
    expect(html('featured', false)).toContain('No');
    expect(html('rating', 7)).toContain('7');
    const instant = html('starts_at', '2026-10-05T12:00:00Z');
    expect(instant).toContain('<time');
    expect(instant).toContain('2026-10-05T12:00:00Z</time>');
    expect(html('category', 'news')).toContain('news');
  });

  it('renders rich text through the typed renderer, never as JSON', () => {
    const out = html('body', {
      format: 'rich_text.v1',
      blocks: [
        {
          type: 'paragraph',
          spans: [
            { text: 'Hello ', marks: [] },
            { text: 'world', marks: ['bold'] },
          ],
        },
      ],
    });
    expect(out).toContain('<p>');
    expect(out).toContain('<strong>world</strong>');
    expect(out).not.toContain('rich_text.v1');
  });

  it('renders a list as an ordered list of its items', () => {
    const out = html('tags', ['a', 'b']);
    expect(out).toContain('<ol>');
    expect(out).toContain('<li>');
    expect(out.match(/<li>/gu)).toHaveLength(2);
  });

  it('renders an object as a definition list of its declared properties', () => {
    const out = html('meta', {
      headline: 'Launch',
      tone: 'formal',
      priority: 3,
    });
    expect(out).toContain('<dl>');
    expect(out).toContain('<dt>Headline</dt>');
    expect(out).toContain('<dd><span>Launch</span></dd>');
    expect(out).toContain('<dt>Tone</dt>');
    expect(out).not.toContain('{"');
  });

  it('renders a relation as its linked entries and shows no more than the value carries', () => {
    const out = html('related', {
      targets: [
        { targetId: fieldUuid(1), expectedTargetVersion: '3' },
        { targetId: fieldUuid(2), expectedTargetVersion: null },
      ],
    });
    expect(out).toContain(fieldUuid(1));
    expect(out).toContain('pinned to version 3');
    expect(out.match(/<li>/gu)).toHaveLength(2);
  });

  it('says plainly when a kind has no representation here', () => {
    expect(html('topics', { termIds: [] })).toContain('Not available');
  });
});
