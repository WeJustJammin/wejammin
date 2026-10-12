// Read-only scan (lane reviewA-2, 2026-10-11): node stale-citations-scan.mjs <worktree>. For every Slice 11 ledger citation whose file differs
// from HEAD, prints the titles present in HEAD but absent from the worktree (a stale citation).
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = process.argv[2];
const frags = ['001-034', '035-066', '067-100', '101-122'];
const norm = (s) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/'{2}/g, "'")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"');
const headCache = new Map();
const head = (f) => {
  if (!headCache.has(f)) {
    let t = null;
    try {
      t = execFileSync('git', ['show', `HEAD:${f}`], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 1 << 28,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      t = null;
    }
    headCache.set(f, t);
  }
  return headCache.get(f);
};
const wt = (f) =>
  existsSync(`${root}/${f}`) ? readFileSync(`${root}/${f}`, 'utf8') : null;
const present = (text, title) => {
  if (text === null) return false;
  const t = norm(title);
  const n = norm(text);
  if (n.includes(t)) return true;
  // vitest "describe test" and split literals: match by a long tail, whitespace-normalised, quotes removed.
  const strip = (x) => x.replace(/['"`+\\]/g, '').replace(/\s+/g, '');
  const tail = strip(t).slice(-40);
  return strip(n).includes(tail);
};
const out = [];
for (const f of frags) {
  const path = `tests/contracts/phase-02-slice-11-evidence-ledger-${f}.ts`;
  const lines = readFileSync(`${root}/${path}`, 'utf8').split('\n');
  let crit = '';
  let clauseIdx = -1;
  let file = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const mc = l.match(/criterion:\s*'(P2-S11-AC-\d+)'/);
    if (mc) {
      crit = mc[1];
      clauseIdx = -1;
    }
    if (/^\s{6}\{\s*$/.test(l) || /^\s{6}\{$/.test(l)) clauseIdx += 1;
    const mf = l.match(/file:\s*'([^']+)'/);
    if (mf) file = mf[1];
    const mt = l.match(/^\s*title:\s*(.*)$/);
    if (mt) {
      let lit = mt[1].trim();
      let ln = i + 1;
      if (lit === '') {
        lit = lines[i + 1].trim();
        ln = i + 2;
      }
      lit = lit.replace(/,$/, '');
      let title;
      try {
        title = new Function(`return ${lit}`)();
      } catch {
        title = null;
      }
      if (title === null || !file) continue;
      const h = head(file);
      const w = wt(file);
      if (h === null) continue;
      if (h === w) continue;
      if (present(h, title) && !present(w, title))
        out.push({ crit, clause: clauseIdx, frag: f, line: ln, file, title });
    }
  }
}
for (const o of out) console.log(JSON.stringify(o));
console.log('COUNT', out.length);
