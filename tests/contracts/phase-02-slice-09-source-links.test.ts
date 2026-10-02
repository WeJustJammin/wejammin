import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Contract: every authored Slice 09 acceptance criterion cites a real local
 * source file, and every local link in the tracker resolves on disk. This
 * reads the actual tracker and the filesystem (no mocks) so a renamed or
 * misplaced specification path fails closed instead of passing on a
 * substring match.
 */

const ROOT = resolve(import.meta.dirname, '../..');
const TRACKER_PATH = resolve(
  ROOT,
  '.memory/pipeline/progress/slices/phase-02-slice-09.md',
);
const TRACKER_DIRECTORY = dirname(TRACKER_PATH);
const tracker = readFileSync(TRACKER_PATH, 'utf8');

type LinkTarget = Readonly<{
  href: string;
  path: string;
  anchor: string | null;
}>;

/**
 * Exclude non-file targets: URI schemes (http:, https:, mailto:, data:, ...),
 * protocol-relative URLs (//), and pure-fragment anchors (#). Everything else
 * is a local file target resolved against the tracker directory.
 */
const isLocalTarget = (href: string): boolean =>
  href.length > 0 &&
  !/^[a-z][a-z0-9+.-]*:/iu.test(href) &&
  !href.startsWith('//') &&
  !href.startsWith('#');

const markdownLinks = (source: string): LinkTarget[] => {
  const targets: LinkTarget[] = [];
  const pattern = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const href = match[1] ?? '';
    if (!isLocalTarget(href)) continue;
    const hashIndex = href.indexOf('#');
    const path = hashIndex === -1 ? href : href.slice(0, hashIndex);
    const anchor = hashIndex === -1 ? null : href.slice(hashIndex + 1);
    if (path.length === 0) continue;
    targets.push({ href, path, anchor });
  }
  return targets;
};

const resolvesToFile = (target: LinkTarget): boolean => {
  const absolute = resolve(TRACKER_DIRECTORY, target.path);
  return existsSync(absolute) && statSync(absolute).isFile();
};

const criterionRowPattern = /^\s*- \[[ x/]\] \*\*P2-S09-AC-\d{3,4}\*\*/u;
const criterionRows = tracker
  .split('\n')
  .map((line, index) => ({ line, number: index + 1 }))
  .filter(({ line }) => criterionRowPattern.test(line));

describe('Slice 09 tracker local source links', () => {
  it('keeps every authored criterion row present', () => {
    expect(criterionRows).toHaveLength(1200);
  });

  it('includes a local file citation for every authored criterion', () => {
    const withoutCitation = criterionRows
      .filter(({ line }) => markdownLinks(line).length === 0)
      .map(({ number, line }) => `${number}: ${line.slice(0, 80)}`);
    expect(
      withoutCitation,
      'criterion rows lacking a local file citation',
    ).toEqual([]);
  });

  it('resolves every local criterion citation to a real file', () => {
    const broken: string[] = [];
    for (const { line, number } of criterionRows) {
      for (const target of markdownLinks(line)) {
        if (!resolvesToFile(target)) broken.push(`${number}: ${target.href}`);
      }
    }
    expect(broken, `${broken.length} broken criterion citations`).toEqual([]);
  });

  it('resolves every local tracker file target to a real file', () => {
    const broken: string[] = [];
    for (const target of markdownLinks(tracker)) {
      if (!resolvesToFile(target)) broken.push(target.href);
    }
    expect(broken, `${broken.length} broken tracker file targets`).toEqual([]);
  });
});
