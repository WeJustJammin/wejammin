// Identity verification for recite/apply.mjs: which cited tests really ran, once, and passed.
//
// Inputs are machine output only (the newest full vitest JSON and the full verbose pgTAP TAP);
// nothing is typed. pgTAP owners are derived exactly as the collector derives them
// (scripts/evidence/receipts-lib.mjs `parsePgtapTap` in identity mode), against a PRISTINE copy of
// supabase/tests (the description renames this script also applies are reversed in the copy), so a
// rerun after the renames sees the same identities the TAP was produced from.

import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

import {
  buildIdentityReceipts,
  identityKey,
} from '../../../../scripts/evidence/identity-receipts-lib.mjs';
import {
  mergeReports,
  parsePgtapTap,
  parseVitestJson,
} from '../../../../scripts/evidence/receipts-lib.mjs';

const require = createRequire(import.meta.url);

/** Copy supabase/tests and undo the description renames so the TAP and the sources agree. */
export const pristinePgtapRoot = (root, renames) => {
  const dir = mkdtempSync(join(tmpdir(), 'recite-apply-pristine-'));
  cpSync(resolve(root, 'supabase/tests'), join(dir, 'supabase/tests'), {
    recursive: true,
    preserveTimestamps: true,
  });
  for (const edit of renames.flatMap((rename) => rename.edits)) {
    const path = join(dir, edit.file);
    if (!existsSync(path)) continue;
    const source = readFileSync(path, 'utf8');
    const edited = reverseEdit(source, edit);
    if (edited !== source) writeFileSync(path, edited);
  }
  return dir;
};

/** An applied edit back to its original text (the edit's `replace` is unique in its file). */
export const reverseEdit = (source, edit) => {
  const index = source.indexOf(edit.replace);
  if (index === -1) return source;
  return (
    source.slice(0, index) +
    edit.find +
    source.slice(index + edit.replace.length)
  );
};

/**
 * Apply the edits of one file (idempotent). Edits that share a `find` apply from the highest nth down, so each
 * nth keeps counting occurrences of the original text. Returns { text, applied, skipped }.
 */
export const applyEdits = (source, edits) => {
  let text = source;
  const applied = [];
  const skipped = [];
  const ordered = [...edits].sort((a, b) =>
    a.find === b.find ? b.nth - a.nth : 0,
  );
  for (const edit of ordered) {
    if (text.includes(edit.replace)) {
      skipped.push(edit);
      continue;
    }
    let index = -1;
    for (let n = 0; n <= edit.nth; n += 1)
      index = text.indexOf(edit.find, index + 1);
    if (index === -1)
      throw new Error(
        `edit not applicable (find not found at nth ${edit.nth}): ${edit.file}: ${edit.find.slice(0, 80)}`,
      );
    text =
      text.slice(0, index) +
      edit.replace +
      text.slice(index + edit.find.length);
    applied.push(edit);
  }
  return { text, applied, skipped };
};

const collapse = (text) => text.replace(/\s+/gu, ' ').trim();

export const loadIdentity = ({
  root,
  vitestJson,
  tap,
  renames,
  cache = null,
}) => {
  const pristine = pristinePgtapRoot(root, renames);
  if (cache !== null && existsSync(cache)) {
    const saved = JSON.parse(readFileSync(cache, 'utf8'));
    return {
      rows: saved.rows,
      pristine,
      tapMtime: saved.tapMtime,
      vitestMtime: saved.vitestMtime,
      root,
      unverified: [],
      tapText: readFileSync(tap, 'utf8'),
      vitestRows: saved.rows.filter((r) => r.tool === 'vitest'),
    };
  }
  const vitestRows = parseVitestJson(
    JSON.parse(readFileSync(vitestJson, 'utf8')),
    root,
    'vitest-all.json',
  );
  // TAP file headers carry the absolute path of the tree the run used; point them at the pristine copy.
  const tapText = readFileSync(tap, 'utf8').replaceAll(
    `${resolve(root)}/`,
    `${pristine}/`,
  );
  const parsed = parsePgtapTap(tapText, pristine, {
    slice: '12',
    identity: true,
  });
  const rows = mergeReports([vitestRows, parsed.results], []);
  const tapMtime = statSync(tap).mtimeMs;
  const vitestMtime = statSync(vitestJson).mtimeMs;
  if (cache !== null)
    writeFileSync(cache, JSON.stringify({ rows, tapMtime, vitestMtime }));
  return {
    rows,
    pristine,
    tapMtime,
    vitestMtime,
    root,
    unverified: parsed.unverified,
    tapText: readFileSync(tap, 'utf8'),
    vitestRows,
  };
};

/** Receipts the collector would write for these citations from the real run. */
export const receiptsFor = (identity, citations) =>
  buildIdentityReceipts(identity.rows, identity.pristine, citations);

const external = (citation) =>
  citation.tool === 'playwright' ||
  citation.tool === 'race' ||
  /\.(?:apispec|dbspec)\.ts$/u.test(citation.file);

/** All static test names a TypeScript test file declares (describe/it/test chains, each-tables unresolved). */
const staticNames = (root, file, separator) => {
  const ts = require('typescript');
  const source = ts.createSourceFile(
    file,
    readFileSync(resolve(root, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const names = new Set();
  const literal = (node) =>
    node !== undefined &&
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      ? node.text
      : null;
  const head = (call) => {
    // The chain of names of the callee: it / test / describe, with .each .skip .only .serial modifiers.
    const chain = [];
    let node = call.expression;
    while (ts.isPropertyAccessExpression(node)) {
      chain.unshift(node.name.text);
      node = node.expression;
    }
    if (ts.isIdentifier(node)) chain.unshift(node.text);
    if (chain.includes('each')) return '';
    if (chain.includes('describe')) return 'describe';
    return chain[0] ?? '';
  };
  const walk = (node, prefix) => {
    if (ts.isCallExpression(node)) {
      const name = head(node);
      const title = literal(node.arguments[0]);
      if (
        (name === 'describe' || name === 'it' || name === 'test') &&
        title !== null
      ) {
        const full = [...prefix, title];
        names.add(full.join(separator));
        node.arguments
          .slice(1)
          .forEach((arg) => walk(arg, name === 'describe' ? full : prefix));
        return;
      }
    }
    ts.forEachChild(node, (child) => walk(child, prefix));
  };
  walk(source, []);
  return { names, text: readFileSync(resolve(root, file), 'utf8') };
};

const staticCache = new Map();
let raceText = null;
const raceOutput = (root) => {
  raceText ??= readFileSync(
    resolve(
      root,
      '.lane-logs/canonical/s09-evidence-20261024T020357Z/db-races.out',
    ),
    'utf8',
  );
  return raceText;
};

/** Source check for a test no JSON run covers (apispec, dbspec, Playwright, race). */
export const sourceCheck = (root, citation) => {
  if (!existsSync(resolve(root, citation.file)))
    return { state: 'missing', note: 'file does not exist' };
  if (citation.tool === 'race') {
    const text = readFileSync(resolve(root, citation.file), 'utf8');
    if (text.includes(citation.title))
      return {
        state: 'listed',
        note: 'race assertion text found in the runner source',
      };
    const out = raceOutput(root);
    return out.includes(`ok - ${citation.title}\n`)
      ? {
          state: 'listed',
          note: 'race assertion composed in the runner; exact "ok - ..." line is in db-races.out',
        }
      : {
          state: 'missing',
          note: 'race assertion text not in the runner source or db-races.out',
        };
  }
  const cacheKey = `${citation.tool}\u0000${citation.file}`;
  if (!staticCache.has(cacheKey))
    staticCache.set(
      cacheKey,
      staticNames(
        root,
        citation.file,
        citation.tool === 'playwright' ? ' > ' : ' ',
      ),
    );
  const { names, text } = staticCache.get(cacheKey);
  if (names.has(citation.title))
    return { state: 'listed', note: 'static title found in the source' };
  // Template-literal or loop-built titles: accept when every static chunk of the title is in the source.
  const chunks = citation.title
    .split(/\s+/u)
    .filter((chunk) => chunk.length > 12);
  if (chunks.length > 0 && chunks.every((chunk) => text.includes(chunk))) {
    return {
      state: 'listed',
      note: 'title composed from loop or template; chunks found in the source',
    };
  }
  return { state: 'missing', note: 'title not found in the source' };
};

/**
 * Classify one citation: verified (one passing receipt identity in the real run), missing,
 * ambiguous (the run shows the identity more than once inside one invocation/entrypoint),
 * listed (an external tool: checked against the source only), stale (file newer than the run).
 */
export const classify = (identity, citation, receiptIndex) => {
  if (external(citation)) return sourceCheck(identity.root, citation);
  const rows =
    receiptIndex.get(
      identityKey(
        citation.tool,
        citation.file,
        citation.title,
        citation.project ?? '',
      ),
    ) ?? [];
  if (rows.length === 0)
    return { state: 'missing', note: 'no passing run row' };
  const nonPassing = rows.filter((row) => row.status !== 'passed');
  if (nonPassing.length > 0)
    return { state: 'missing', note: `status ${nonPassing[0].status}` };
  const occurrences = Math.max(...rows.map((row) => row.occurrences ?? 1));
  if (occurrences > 1)
    return { state: 'ambiguous', note: `occurs ${String(occurrences)} times` };
  return {
    state: 'verified',
    note: rows.length > 1 ? `${String(rows.length)} entrypoints` : '',
  };
};

export const indexReceipts = (receipts) => {
  const index = new Map();
  for (const row of receipts) {
    const key = identityKey(row.tool, row.file, row.title, row.project ?? '');
    index.set(key, [...(index.get(key) ?? []), row]);
  }
  return index;
};

/** Where a pgTAP description lives in the run: [{file, entrypoint, count}] (any owner file). */
export const pgtapOwnersOf = (identity) => {
  const byTitle = new Map();
  for (const row of identity.rows) {
    if (row.tool !== 'pgtap' || row.granularity === 'file') continue;
    const list = byTitle.get(collapse(row.title)) ?? [];
    list.push(row);
    byTitle.set(collapse(row.title), list);
  }
  return byTitle;
};

export const cleanup = (identity) => {
  rmSync(identity.pristine, { recursive: true, force: true });
};

export const filesUnder = (root, dir) =>
  readdirSync(resolve(root, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath ?? entry.path, entry.name));

/** A copy of the pristine tree with every rename edit applied (what the working tree is after the renames). */
export const makePostTree = (pristine, renames) => {
  const dir = mkdtempSync(join(tmpdir(), 'recite-apply-post-'));
  cpSync(join(pristine, 'supabase/tests'), join(dir, 'supabase/tests'), {
    recursive: true,
    preserveTimestamps: true,
  });
  const edits = renames.flatMap((rename) => rename.edits);
  for (const file of new Set(edits.map((e) => e.file))) {
    const path = join(dir, file);
    const { text } = applyEdits(
      readFileSync(path, 'utf8'),
      edits.filter((e) => e.file === file),
    );
    writeFileSync(path, text);
  }
  return dir;
};

const TAP_HEADER = /^(?:psql:)?(\S+\.sql) \.\.+ ?(.*)$/u;
const TAP_OK = /^((?:not ok|ok) \d+ - )(.*?)((?: # (?:SKIP|TODO)\b.*)?)$/iu;

/**
 * The TAP text as the renamed tests would print it: in every file section whose closure holds the renamed file,
 * the rename's `tapNth` occurrence of its description is retitled. Pure text; no file is touched.
 */
export const renameTap = (tapText, root, treeRoot, renameRows, closureOf) => {
  const lines = tapText.split(/\r?\n/u);
  let closure = new Set();
  let seen = new Map();
  for (let i = 0; i < lines.length; i += 1) {
    const header = TAP_HEADER.exec(lines[i]);
    if (header !== null) {
      const entry = header[1].startsWith(root)
        ? header[1].slice(root.length + 1)
        : header[1];
      closure = new Set(closureOf(treeRoot, entry));
      seen = new Map();
      continue;
    }
    const match = TAP_OK.exec(lines[i]);
    if (match === null) continue;
    const title = collapse(match[2]);
    for (const [k, rename] of renameRows.entries()) {
      if (rename.from !== title || !closure.has(rename.file)) continue;
      const key = String(k);
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      if (n === (rename.tapNth ?? rename.nth ?? 0))
        lines[i] = `${match[1]}${rename.to}${match[3]}`;
    }
  }
  return lines.join('\n');
};

/** Identity rows of the renamed tree: the renamed TAP parsed against the renamed sources. */
export const postRenameRows = ({
  identity,
  root,
  postRoot,
  renameRows,
  closureOf,
}) => {
  const renamed = renameTap(
    identity.tapText,
    resolve(root),
    identity.pristine,
    renameRows,
    closureOf,
  );
  const parsed = parsePgtapTap(
    renamed.replaceAll(`${resolve(root)}/`, `${postRoot}/`),
    postRoot,
    { slice: '12', identity: true },
  );
  return mergeReports([identity.vitestRows, parsed.results], []);
};
