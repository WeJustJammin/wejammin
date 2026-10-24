#!/usr/bin/env node
/*
 * Mutation battery of the claude_s12_web_patterns fix pass (web surface, FE03 pattern designer).
 *
 * Each mutation replaces ONE exact string in one source file, runs the focused Vitest set under
 * `flock -s /tmp/wejammin-quiet.lock`, and expects the run to FAIL (the mutation is killed). Every
 * source is restored byte-identical in a finally block and its sha256 is verified. A survivor
 * (the run still passes) exits non-zero. Usage, from the worktree root with the pinned PATH:
 *
 *   node docs/handoffs/2026-10-14-claude-s12/lanes/lane-web-patterns-mutations.mjs [--only <substring>]
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = process.cwd();
const WEB = 'apps/web/src/';
const D = `${WEB}components/cms-pattern-designer/`;
const C = `${WEB}components/cms-composition/`;
const SUITES = [
  `${WEB}components/cms-pattern-designer`,
  `${WEB}components/cms-composition`,
  `${WEB}server/cms-pattern`,
];

/** [name, file, exact text to replace, replacement] */
const MUTATIONS = [
  ['stale type: never reported unavailable', `${D}pattern-designer-request.ts`, 'filter((id) => !available.has(id))', 'filter((id) => available.has(id))'],
  ['stale type: forgets the base version types', `${D}use-pattern-designer.ts`, '[...baseTypeIds, ...compatibleTypeIds],', '[...compatibleTypeIds],'],
  ['stale type: checkbox never checked', `${D}CmsPatternFields.tsx`, 'checked={compatibleTypeIds.includes(id)}', 'checked={false}'],
  ['stale type (template): never reported unavailable', `${C}cms-template-designer-request.ts`, 'filter((id) => !available.has(id))', 'filter((id) => available.has(id))'],
  ['stale type (template): forgets the base version types', `${C}CmsTemplateEditDesigner.tsx`, '...state.baseDetail.compatibleTypeIds,', ''],
  ['stale type (template): unavailable message not specific', `${C}cms-template-designer-request.ts`, "if (fields.compatibleTypeIds.some((id) => !allowedTypeIds.has(id)))\n    return { ok: false, message: CMS_TEMPLATE_TYPE_UNAVAILABLE_MESSAGE };", "if (fields.compatibleTypeIds.some((id) => !allowedTypeIds.has(id)))\n    return { ok: false, message: 'Choose at least one available active content type.' };"],
  ['review: a changed node is called same', `${D}pattern-review-outline.ts`, "match.summary === node.summary\n            ? 'same'\n            : 'changed'", "'same'"],
  ['review: nested nodes not compared', `${D}pattern-review-outline.ts`, 'match?.children ?? []', '[]'],
  ['review: compares a side with itself', `${D}CmsPatternReview.tsx`, 'nodes={annotateOutline(theirs, mine)}', 'nodes={annotateOutline(theirs, theirs)}'],
  ['review: draft side empty', `${D}CmsPatternConflictPanel.tsx`, 'draftTree={draftTree}', 'draftTree={[]}'],
  ['review: draft types lost', `${D}CmsPatternVersionDesigner.tsx`, 'draftTypeIds={designer.compatibleTypeIds}', 'draftTypeIds={[]}'],
  ['reconcile: first version expected as version 2', `${D}pattern-outcome-reconcile.ts`, "? '1'", "? '2'"],
  ['reconcile: content not compared', `${D}pattern-outcome-reconcile.ts`, 'cmsJsonEqual(detail.blockTree, attempt.blockTree)', 'true'],
  ['reconcile: types not compared', `${D}pattern-outcome-reconcile.ts`, 'sameTypes(detail.compatibleTypeIds, attempt.compatibleTypeIds) &&', ''],
  ['reconcile: other key accepted as own commit', `${D}pattern-outcome-reconcile.ts`, 'detail.patternKey === attempt.patternKey &&', ''],
  ['reconcile: unchanged version not recognised', `${D}pattern-outcome-reconcile.ts`, 'detail.version === attempt.expectedVersion', 'false'],
  ['reconcile: any rejection means not saved', `${D}pattern-outcome-reconcile.ts`, 'read.status === 404 &&', 'true &&'],
  ['identity: foreign row accepted', `${D}pattern-outcome-reconcile.ts`, 'latest.id === base.id &&', ''],
  ['identity: other content accepted', `${D}pattern-outcome-reconcile.ts`, 'latest.contentHash === base.contentHash', 'true'],
  ['identity: older version accepted', `${D}pattern-outcome-reconcile.ts`, 'BigInt(latest.version) > BigInt(base.version) ||', 'true ||'],
  ['identity: not checked in the hook', `${D}use-pattern-conflict.ts`, 'base !== null && !patternLatestIdentityValid(base, result.detail)', 'false'],
  ['unknown outcome: never reads by itself', `${D}use-pattern-designer.ts`, "if (result.kind !== 'uncertain') return;", 'return;'],
  ['unknown outcome: a conflict reads by itself too', `${D}use-pattern-designer.ts`, "if (result.kind !== 'uncertain') return;", 'if (false) return;'],
  ['unknown outcome: a committed write not shown as saved', `${D}use-pattern-designer.ts`, "if (verdict.kind === 'created') {", 'if (false) {'],
  ['unknown outcome: not-saved not shown', `${D}use-pattern-designer.ts`, "else if (verdict.kind === 'not-saved') {", 'else if (false) {'],
  ['version rule: request past 64 bits', `${D}pattern-designer-request.ts`, '!isCmsVersion(fields.expectedVersion)', '!/^[1-9]\\d{0,18}$/u.test(fields.expectedVersion)'],
  ['version rule: conflict hint past 64 bits', `${D}pattern-designer-submit.ts`, 'typeof current === \'string\' && isCmsVersion(current)', "typeof current === 'string' && /^[1-9]\\d{0,18}$/u.test(current)"],
  ['version rule: server hint past 64 bits', `${WEB}server/cms-pattern-platform-details.ts`, "typeof value === 'string' && isCmsVersion(value)", "typeof value === 'string' && /^[1-9]\\d{0,18}$/u.test(value)"],
  ['grammar: node key length 32', `${D}pattern-tree-rules.ts`, '/^[a-z][a-z0-9_-]{0,63}$/u', '/^[a-z][a-z0-9_-]{0,31}$/u'],
  ['grammar: node key without underscore', `${D}pattern-tree-rules.ts`, '/^[a-z][a-z0-9_-]{0,63}$/u', '/^[a-z][a-z0-9-]{0,63}$/u'],
  ['grammar: block key length 95', `${D}pattern-tree-rules.ts`, '/^[a-z][a-z0-9._-]{0,95}$/u', '/^[a-z][a-z0-9._-]{0,94}$/u'],
  ['grammar: block key without dot', `${D}pattern-tree-rules.ts`, '/^[a-z][a-z0-9._-]{0,95}$/u', '/^[a-z][a-z0-9_-]{0,95}$/u'],
  ['grammar: pattern key minimum 1', `${D}pattern-tree-rules.ts`, '/^[a-z][a-z0-9-]{1,63}$/u', '/^[a-z][a-z0-9-]{0,63}$/u'],
  ['json: container items 127', `${D}pattern-tree-rules.ts`, 'containerItems: 128', 'containerItems: 127'],
  ['json: byte limit 262143', `${D}pattern-tree-rules.ts`, 'bytes: 262_144', 'bytes: 262_143'],
  ['json: prop key length 127', `${D}pattern-tree-rules.ts`, 'propsKeyLength: 128', 'propsKeyLength: 127'],
];

const sha = (text) => createHash('sha256').update(text).digest('hex');
const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]
  : null;
const survivors = [];
let killed = 0;
let run = 0;
for (const [name, file, find, replace] of MUTATIONS) {
  if (only !== null && !name.includes(only)) continue;
  const path = `${ROOT}/${file}`;
  const original = readFileSync(path, 'utf8');
  const hash = sha(original);
  if (original.split(find).length !== 2) {
    console.log(`SKIP  ${name}: the target text is not present exactly once in ${file}`);
    survivors.push(`${name} (target not found)`);
    continue;
  }
  run += 1;
  try {
    writeFileSync(path, original.replace(find, () => replace));
    const result = spawnSync(
      'flock',
      ['-s', '/tmp/wejammin-quiet.lock', 'pnpm', 'exec', 'vitest', 'run', ...SUITES],
      { cwd: ROOT, encoding: 'utf8' },
    );
    if (result.status === 0) survivors.push(name);
    else killed += 1;
    console.log(`${result.status === 0 ? 'SURVIVED' : 'killed  '} ${name}`);
  } finally {
    writeFileSync(path, original);
    if (sha(readFileSync(path, 'utf8')) !== hash) {
      console.error(`RESTORE FAILED for ${file}`);
      process.exit(2);
    }
  }
}
console.log(`\n${run} mutations run, ${killed} killed, ${survivors.length} survivors`);
for (const name of survivors) console.log(`  survivor: ${name}`);
process.exit(survivors.length === 0 ? 0 : 1);
