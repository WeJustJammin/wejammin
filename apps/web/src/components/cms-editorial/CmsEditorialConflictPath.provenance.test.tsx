import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { describeCmsAuthoringFields } from '../cms-editorial-fields/cms-field-descriptor';
import CmsEditorialConflictPath from './CmsEditorialConflictPath';
import {
  TITLE,
  editorFields,
} from './cms-editorial-editor-fixtures.test-support';

/**
 * Codex final review (s10-final-4): a conflict side is rendered BY ITS PROVENANCE. The contract
 * refuses a `missing` or `explicit_null` side that carries a value, but the UI does not rely on it
 * alone: it never renders a value for a side whose provenance says there is none, so an upstream
 * inconsistency cannot become a disclosure.
 */

const descriptor = describeCmsAuthoringFields(editorFields()).find(
  (entry) => entry.fieldId === TITLE,
)!;

const side = (value: unknown, provenance: string) => ({
  value: value as never,
  provenance,
  valueHash: null,
});

const render = (base: ReturnType<typeof side>): string =>
  renderToStaticMarkup(
    <CmsEditorialConflictPath
      path={{
        fieldId: TITLE,
        base,
        theirs: side('Theirs', 'authored'),
        yours: side('Yours', 'authored'),
      }}
      descriptor={descriptor}
      choice={{ choice: null, explicit: null }}
      issues={[]}
      disabled={false}
      onChoose={() => undefined}
      onExplicit={() => undefined}
      onInputError={() => undefined}
    />,
  );

describe('conflict side rendering follows provenance', () => {
  it('renders the value of a value-bearing side', () => {
    expect(render(side('Visible base', 'authored'))).toContain('Visible base');
  });

  it.each(['missing', 'explicit_null'])(
    'does not render a value carried by a %s side',
    (provenance) => {
      const html = render(side('hidden upstream value', provenance));
      expect(html).not.toContain('hidden upstream value');
    },
  );

  it('says "No value" for a missing side and "Cleared" for an explicit null', () => {
    expect(render(side('x', 'missing'))).toContain('No value');
    expect(render(side('x', 'explicit_null'))).toContain('Cleared');
  });
});
