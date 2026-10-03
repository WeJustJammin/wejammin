/**
 * Replays every GRANT and REVOKE EXECUTE statement on `platform_api` functions
 * across the migrations in filename order, starting from the foundation's
 * default privileges (EXECUTE revoked from PUBLIC, anon and authenticated), and
 * returns the effective EXECUTE holders per function. A grant that a later
 * statement revokes is therefore never counted: this is what the live catalog
 * ends with, computed from the repository alone.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const MIGRATIONS = join(ROOT, 'supabase/migrations');

const stripComments = (sql: string): string =>
  sql.replace(/\/\*[\s\S]*?\*\//gu, ' ').replace(/--[^\n]*/gu, ' ');

/** Splits on semicolons outside dollar-quoted bodies and single-quoted strings. */
const statements = (sql: string): string[] => {
  const out: string[] = [];
  let current = '';
  let dollar: string | null = null;
  let quote = false;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index] as string;
    if (dollar === null && !quote && char === '$') {
      const tag = /^\$[A-Za-z0-9_]*\$/u.exec(sql.slice(index))?.[0];
      if (tag !== undefined) {
        dollar = tag;
        current += tag;
        index += tag.length - 1;
        continue;
      }
    }
    if (dollar !== null && sql.startsWith(dollar, index)) {
      current += dollar;
      index += dollar.length - 1;
      dollar = null;
      continue;
    }
    if (dollar === null && char === "'") quote = !quote;
    if (dollar === null && !quote && char === ';') {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim() !== '') out.push(current.trim());
  return out;
};

const roleList = (text: string): string[] =>
  text
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter((role) => role !== '');

export type ExecuteAcl = ReadonlyMap<string, ReadonlySet<string>>;

export const replayExecuteAcl = (
  schema = 'platform_api',
  prefix = 'cms_',
  options: Readonly<{ ignoreRevokes?: boolean }> = {},
): ExecuteAcl => {
  const acl = new Map<string, Set<string>>();
  const known = new Set<string>();
  const files = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const created = new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?function\\s+${schema}\\.["']?(${prefix}[a-z0-9_]+)["']?\\s*\\(`,
    'iu',
  );
  const dropped = new RegExp(
    `drop\\s+function\\s+(?:if\\s+exists\\s+)?${schema}\\.["']?(${prefix}[a-z0-9_]+)["']?`,
    'iu',
  );
  const names = (text: string): string[] =>
    [
      ...text.matchAll(
        new RegExp(`${schema}\\.["']?(${prefix}[a-z0-9_]+)["']?\\s*\\(`, 'giu'),
      ),
    ].map((match) => match[1] as string);
  for (const file of files) {
    for (const statement of statements(
      stripComments(readFileSync(join(MIGRATIONS, file), 'utf8')),
    )) {
      const createdName = created.exec(statement)?.[1];
      if (createdName !== undefined) {
        known.add(createdName);
        if (!acl.has(createdName)) acl.set(createdName, new Set());
        continue;
      }
      const droppedName = dropped.exec(statement)?.[1];
      if (droppedName !== undefined) {
        known.delete(droppedName);
        acl.delete(droppedName);
        continue;
      }
      const match =
        /^(grant|revoke)\s+(?:execute|all(?:\s+privileges)?)\s+on\s+(function|all\s+functions\s+in\s+schema)\s+([\s\S]+?)\s+(to|from)\s+([\s\S]+)$/iu.exec(
          statement,
        );
      if (match === null) continue;
      const [, verb, scope, target, , roles] = match;
      const touched = /all\s+functions/iu.test(scope as string)
        ? new RegExp(`^${schema}$`, 'iu').test((target as string).trim())
          ? [...known]
          : []
        : names(target as string);
      for (const name of touched) {
        const holders = acl.get(name) ?? new Set<string>();
        for (const role of roleList(
          (roles as string).replace(/\bwith\s+grant\s+option\b/giu, ''),
        )) {
          if ((verb as string).toLowerCase() === 'grant') holders.add(role);
          else if (options.ignoreRevokes !== true) holders.delete(role);
        }
        acl.set(name, holders);
      }
    }
  }
  return acl;
};

export const holders = (acl: ExecuteAcl, role: string): string[] =>
  [...acl.entries()]
    .filter(([, roles]) => roles.has(role))
    .map(([name]) => name)
    .sort();
