import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsRegistryChangeNotice from './CmsRegistryChangeNotice';
import type { RegistryReadState } from './registry-read-types';

const html = (state: RegistryReadState, waiting = false): string =>
  renderToStaticMarkup(
    <CmsRegistryChangeNotice
      state={state}
      waiting={waiting}
      onRead={() => undefined}
    />,
  );

describe('CmsRegistryChangeNotice', () => {
  it('renders only the empty polite region, with no landmark name, before any read', () => {
    const none = html({ kind: 'none' });
    expect(none).toContain('role="status"');
    expect(none).toContain('aria-live="polite"');
    expect(none).not.toContain('aria-label');
    expect(none).not.toContain('<p');
  });

  it('shows no result and no failure while the read runs (the skeleton appears after 250 ms)', () => {
    const running = html({ kind: 'checking' });
    expect(running).toContain('aria-label="Block registry"');
    expect(running).not.toContain('Added:');
    expect(running).not.toContain('role="alert"');
  });

  it('writes the lines of a read into the one polite region (V20 m8)', () => {
    const read = html({ kind: 'read', lines: ['one', 'Added: a@2'] });
    expect(read).toContain('aria-label="Block registry"');
    expect(read.match(/role="status"/gu)).toHaveLength(1);
    expect(read).toContain('>one Added: a@2</div>');
  });

  it('says why the read failed, as an alert, or as a polite status for a rate limit, and disables the repeat while waiting', () => {
    const alert = html({ kind: 'failed', message: 'x', rateLimited: false });
    expect(alert).toContain('role="alert"');
    const limited = html(
      { kind: 'failed', message: 'wait', rateLimited: true },
      true,
    );
    expect(limited).toContain('role="status"');
    expect(limited).toContain('disabled');
    expect(alert).not.toContain('disabled');
  });
});
