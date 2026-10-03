import { describe, expect, it } from 'vitest';

import { S09_AMENDMENT_EVIDENCE } from './phase-02-slice-09-amendment-evidence';
import {
  ROOT,
  carriedIds,
  evidenceFilesOnDisk,
  hasParameterizedTitle,
  read,
} from './phase-02-slice-09-amendment-evidence.test-support';

const numberOf = (criterion: string): number =>
  Number(/(\d{3,4})$/u.exec(criterion)?.[1] ?? Number.NaN);

const cited = new Map(
  S09_AMENDMENT_EVIDENCE.map((entry) => [
    numberOf(entry.criterion),
    new Set([...entry.testFiles, ...(entry.supplementary ?? [])]),
  ]),
);

// Fixtures are assembled at run time so this file does not itself carry a marker.
const q = "'";
const mark = (n: string): string => `[P2-S09-AC-${n}]`;
const call = (head: string, title: string): string =>
  `${head}(${q}${title}${q}, () => {});\n`;

describe('Slice 09 marker and citation agreement', () => {
  it('[P2-S09-AC-1149] every test file that carries a verified criterion marker in a title is cited by that criterion, and every cited file carries it', () => {
    const missing: string[] = [];
    for (const file of evidenceFilesOnDisk()) {
      if (file.endsWith('.mjs') && !file.startsWith('supabase/tests/'))
        continue;
      const source = read(file);
      for (const id of carriedIds(file, source)) {
        const files = cited.get(id);
        if (files !== undefined && !files.has(file)) {
          missing.push(`AC${id} is carried by ${file} but not cited`);
        }
      }
    }
    expect(missing, missing.slice(0, 40).join('\n')).toEqual([]);

    const uncarried: string[] = [];
    for (const entry of S09_AMENDMENT_EVIDENCE) {
      const id = numberOf(entry.criterion);
      for (const file of [...entry.testFiles, ...(entry.supplementary ?? [])]) {
        if (!/\.(?:test\.tsx?|spec\.ts|sql|sqlinc|mjs)$/u.test(file)) continue;
        const source = read(file);
        if (
          !carriedIds(file, source).has(id) &&
          !hasParameterizedTitle(source, id)
        ) {
          uncarried.push(
            `${entry.criterion} cites ${file}, which carries no marker in a title`,
          );
        }
      }
    }
    expect(uncarried, uncarried.slice(0, 40).join('\n')).toEqual([]);
    expect(ROOT.length).toBeGreaterThan(0);
  });
});

describe('Slice 09 marker carrier detection', () => {
  const ids = (file: string, source: string): number[] =>
    [...carriedIds(file, source)].sort((a, b) => a - b);

  it('reads a vitest title, a describe title and a grouped marker', () => {
    const source =
      call('it', `${mark('001')} first`) +
      call('describe', `${mark('002')} group`) +
      call('test.skip', `[P2-S09-AC-${'003'}, AC-004] grouped`);
    expect(ids('apps/x/a.test.ts', source)).toEqual([1, 2, 3, 4]);
  });

  it('ignores a marker in a comment, in data or in a guard assertion string', () => {
    const source = [
      `// ${mark('010')} comment`,
      `const data = ${q}${mark('011')}${q};`,
      `expect(text).toContain(${q}${mark('012')}${q});`,
      call('it', 'plain title'),
    ].join('\n');
    expect(ids('apps/x/a.test.ts', source)).toEqual([]);
  });

  it('reads an it.each title and the marker inside the table', () => {
    const titled = `it.each([1, 2])(${q}${mark('020')} row %s${q}, () => {});`;
    const tabled = `it.each([[${q}${mark('021')} row${q}]])(${q}%s${q}, () => {});`;
    expect(ids('apps/x/a.test.ts', titled)).toEqual([20]);
    expect(ids('apps/x/a.test.ts', tabled)).toEqual([21]);
  });

  it('reads a pgTAP assertion description and ignores an SQL comment', () => {
    const source = `-- ${mark('030')}\nselect ok(true, ${q}${mark('031')} works${q});\n`;
    expect(ids('supabase/tests/x.sql', source)).toEqual([31]);
    expect(ids('supabase/tests/x/001.sqlinc', source)).toEqual([31]);
  });

  it('reads a race-runner assertion string and ignores its comments', () => {
    const source = `// ${mark('040')}\nconsole.log(${q}ok - ${mark('041')} serialized${q});\n`;
    expect(ids('supabase/tests/x/010.mjs', source)).toEqual([41]);
  });
});
