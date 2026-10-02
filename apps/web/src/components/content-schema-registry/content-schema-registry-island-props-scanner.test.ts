import { describe, expect, it } from 'vitest';

import { decodeIslandProps } from './content-schema-registry-island-props-codec';
import {
  readAttribute,
  scanCanonicalWorkbenchIsland,
} from './content-schema-registry-island-props-scanner';

const island = (attrs: string): string =>
  '<astro-island ' + attrs + '></astro-island>';

const URL_OK =
  'component-url="/_astro/ContentSchemaRegistryWorkbenchIsland.Ab12.js"';
const EXPORT_OK = 'component-export="default"';

describe('[P2-S09-AC-250] canonical island scanner', () => {
  it('matches with uppercase tag/attribute names and irregular whitespace', () => {
    const html =
      '<ASTRO-ISLAND\tComponent-Url = "/_astro/ContentSchemaRegistryWorkbenchIsland.Ab12.js"\nCOMPONENT-EXPORT="default" props="{&quot;a&quot;:[0,&quot;b&quot;]}"></ASTRO-ISLAND>';
    const scan = scanCanonicalWorkbenchIsland(html);
    expect(scan.count).toBe(1);
    expect(scan.props).toBe('{"a":[0,"b"]}');
  });

  it('reads unquoted attribute values', () => {
    expect(readAttribute('<x props=[0,"a"]>', 'props')).toBe('[0,"a"]');
  });

  it('does not match a different component-url basename', () => {
    const html = island(
      'component-url="/_astro/OtherWorkbench.Ab12.js" ' +
        EXPORT_OK +
        ' props="x"',
    );
    expect(scanCanonicalWorkbenchIsland(html).count).toBe(0);
  });

  it('does not match when component-export is not default', () => {
    const html = island(URL_OK + ' component-export="named" props="x"');
    expect(scanCanonicalWorkbenchIsland(html).count).toBe(0);
  });

  it('ignores an island-like tag embedded inside a quoted attribute value', () => {
    // A genuinely matching island placed inside a single-quoted attribute value
    // must not be scanned; the real element after it is the only match.
    const embeddedIsland =
      '<astro-island ' +
      URL_OK +
      ' ' +
      EXPORT_OK +
      ' props="evil"></astro-island>';
    const decoy = "<div title='" + embeddedIsland + "'></div>";
    const html =
      decoy +
      '<astro-island ' +
      URL_OK +
      ' ' +
      EXPORT_OK +
      ' props="{&quot;a&quot;:[0,&quot;b&quot;]}"></astro-island>';
    const scan = scanCanonicalWorkbenchIsland(html);
    expect(scan.count).toBe(1);
    expect(scan.props).toBe('{"a":[0,"b"]}');
  });

  it('ignores island-like markup inside comments and raw-text elements', () => {
    const fake =
      '<astro-island ' +
      URL_OK +
      ' ' +
      EXPORT_OK +
      ' props="evil"></astro-island>';
    const html =
      '<!-- ' +
      fake +
      ' --><script>var s = ' +
      JSON.stringify(fake) +
      ';</script>' +
      fake;
    const scan = scanCanonicalWorkbenchIsland(html);
    expect(scan.count).toBe(1);
    expect(scan.props).toBe('evil');
  });

  it('reports a duplicate count so the caller fails closed', () => {
    const one =
      '<astro-island ' +
      URL_OK +
      ' ' +
      EXPORT_OK +
      ' props="{&quot;a&quot;:[0,&quot;b&quot;]}"></astro-island>';
    expect(scanCanonicalWorkbenchIsland(one + one).count).toBe(2);
  });

  it('flags duplicate props attributes on one target tag', () => {
    const html =
      '<astro-island ' +
      URL_OK +
      ' ' +
      EXPORT_OK +
      ' props="{&quot;a&quot;:[0,&quot;b&quot;]}" props="{&quot;a&quot;:[0,&quot;c&quot;]}"></astro-island>';
    expect(scanCanonicalWorkbenchIsland(html).ambiguous).toBe(true);
  });

  it('flags duplicate component-url attributes in either order', () => {
    const first =
      '<astro-island ' +
      URL_OK +
      ' component-url="/_astro/ContentSchemaRegistryWorkbenchIsland.Zz99.js" ' +
      EXPORT_OK +
      ' props="x"></astro-island>';
    const second =
      '<astro-island component-url="/_astro/ContentSchemaRegistryWorkbenchIsland.Zz99.js" ' +
      URL_OK +
      ' ' +
      EXPORT_OK +
      ' props="x"></astro-island>';
    expect(scanCanonicalWorkbenchIsland(first).ambiguous).toBe(true);
    expect(scanCanonicalWorkbenchIsland(second).ambiguous).toBe(true);
  });

  it('ignores iframe, xmp, noembed, noframes, plaintext, and noscript decoys', () => {
    const fake =
      '<astro-island ' +
      URL_OK +
      ' ' +
      EXPORT_OK +
      ' props="evil"></astro-island>';
    const html =
      '<astro-island ' +
      URL_OK +
      ' ' +
      EXPORT_OK +
      ' props="{&quot;a&quot;:[0,&quot;b&quot;]}"></astro-island>' +
      '<iframe>' +
      fake +
      '</iframe>' +
      '<xmp>' +
      fake +
      '</xmp>' +
      '<noembed>' +
      fake +
      '</noembed>' +
      '<noframes>' +
      fake +
      '</noframes>' +
      '<plaintext>' +
      fake +
      '<noscript>' +
      fake +
      '</noscript>';
    const scan = scanCanonicalWorkbenchIsland(html);
    expect(scan.count).toBe(1);
    expect(scan.props).toBe('{"a":[0,"b"]}');
  });

  it('treats an unterminated plaintext raw region as swallowing the rest', () => {
    const fake =
      '<astro-island ' +
      URL_OK +
      ' ' +
      EXPORT_OK +
      ' props="evil"></astro-island>';
    const html = '<plaintext>' + fake;
    expect(scanCanonicalWorkbenchIsland(html).count).toBe(0);
  });

  it('rejects oversized markup', () => {
    const html = 'a'.repeat(2_000_001);
    expect(scanCanonicalWorkbenchIsland(html).count).toBe(0);
  });
});

describe('[P2-S09-AC-250] bounded island props codec', () => {
  it('decodes supported plain and array tuples', () => {
    expect(decodeIslandProps({ a: [0, 'x'], b: [1, [[0, 'y']]] })).toEqual({
      a: 'x',
      b: ['y'],
    });
  });

  it('rejects unsupported special-value tuples', () => {
    for (const code of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      expect(() => decodeIslandProps({ a: [code, 'x'] })).toThrow();
    }
  });

  it('rejects prototype keys', () => {
    expect(() =>
      decodeIslandProps(JSON.parse('{"__proto__":{"x":[0,"y"]}}')),
    ).toThrow();
    expect(() =>
      decodeIslandProps(JSON.parse('{"constructor":[0,"y"]}')),
    ).toThrow();
  });

  it('rejects a non-tuple array', () => {
    expect(() => decodeIslandProps({ a: [1, 2, 3] })).toThrow();
  });

  it('rejects depth beyond the bound', () => {
    let nested: unknown = [0, 'leaf'];
    for (let depth = 0; depth < 40; depth += 1) nested = [0, { child: nested }];
    expect(() => decodeIslandProps({ root: nested })).toThrow();
  });
});
