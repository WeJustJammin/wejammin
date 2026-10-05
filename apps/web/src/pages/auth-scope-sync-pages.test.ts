import { describe, expect, it } from 'vitest';

/**
 * Codex R14c2 #4: the cross-tab auth-scope guard must run in every document the
 * web app serves, because any page can hold step-up state in a tab. A page that
 * owns an `<html>` element loads `lib/auth-scope-sync.ts`; a page rendered
 * inside a shared shell inherits the shell's script.
 */
const documents = import.meta.glob<string>(
  ['./**/*.astro', '../components/**/*.astro'],
  { query: '?raw', import: 'default', eager: true },
);

const SCRIPT =
  /<script\s+src="((?:\.\.\/)+lib\/auth-scope-sync\.ts)"\s*><\/script>/u;

const resolveKey = (pageKey: string, specifier: string): string => {
  const segments = pageKey.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '.') continue;
    if (part === '..') {
      if (segments.length === 1 && segments[0] === '.')
        segments.splice(0, 1, '..');
      else if (segments[segments.length - 1] === '..') segments.push('..');
      else segments.pop();
    } else segments.push(part);
  }
  return segments.join('/');
};

const owners = Object.entries(documents).filter(([, source]) =>
  /<html[\s>]/u.test(source),
);

describe('every served document loads the cross-tab auth-scope guard', () => {
  it('finds the documents that own an html element', () => {
    expect(owners.length).toBeGreaterThanOrEqual(20);
  });

  it.each(owners.map(([key]) => [key] as const))(
    '%s loads lib/auth-scope-sync.ts through a script that resolves',
    (key) => {
      const source = documents[key] ?? '';
      const match = SCRIPT.exec(source);
      expect(match, `${key} has no auth-scope-sync script`).not.toBeNull();
      expect(resolveKey(key, match?.[1] ?? '')).toBe(
        '../lib/auth-scope-sync.ts',
      );
    },
  );
});
