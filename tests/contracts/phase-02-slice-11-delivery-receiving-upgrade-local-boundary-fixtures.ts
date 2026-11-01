import { Buffer } from 'node:buffer';
import { EventEmitter } from 'node:events';
import { dirname, resolve } from 'node:path';

import { vi } from 'vitest';

export const INSPECT_TEMPLATE =
  '{"id":{{json .Id}},"projectId":{{json (index .Config.Labels "com.supabase.cli.project")}},"dbPort":{{json (index (index (index .NetworkSettings.Ports "5432/tcp") 0) "HostPort")}}}';
export const ALT_TARGET_SQL = [
  "select pg_catalog.jsonb_build_object('witness','DEC197_ALT_TARGET_V1',",
  "'clusterId',(select system_identifier::text from pg_catalog.pg_control_system()),",
  "'databaseOid',d.oid::text,'owner',pg_catalog.pg_get_userbyid(d.datdba),",
  "'encoding',pg_catalog.pg_encoding_to_char(d.encoding),'collation',d.datcollate,",
  "'connectionLimit',d.datconnlimit,'databaseAcl',d.datacl,",
  "'configurationRows',(select count(*) from pg_catalog.pg_db_role_setting s where s.setdatabase=d.oid),",
  "'configurationKeys',(select coalesce(pg_catalog.jsonb_agg(k.key order by k.key),'[]'::jsonb) from (",
  "select distinct pg_catalog.split_part(v.setting,'=',1) as key from pg_catalog.pg_db_role_setting s ",
  'cross join lateral pg_catalog.unnest(s.setconfig) as v(setting) where s.setdatabase=d.oid) k))::text ',
  'from pg_catalog.pg_database d where d.datname=pg_catalog.current_database();\n',
].join('');
export const APPLIED_HISTORY_SQL = [
  "select pg_catalog.jsonb_build_object('witness','DEC197_APPLIED_HISTORY_V1','appliedMigrations',",
  "coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('version',m.version,'name',m.name) ",
  'order by m.version collate "C",m.name collate "C"),\'[]\'::jsonb))::text ',
  'from supabase_migrations.schema_migrations m;\n',
].join('');

// Only explicit importActual fixture reads may touch the host filesystem.
// Every process family is blocked, including module-import side effects.
const hostMocks = vi.hoisted(() => {
  const blockedProcess = () => {
    throw new Error('DEC197_LOCAL_HOST_PROCESS_FORBIDDEN');
  };
  const blockedFs = () => {
    throw new Error('DEC197_LOCAL_HOST_FS_FORBIDDEN');
  };
  const processMethods = {
    spawn: blockedProcess,
    spawnSync: blockedProcess,
    exec: blockedProcess,
    execSync: blockedProcess,
    execFile: blockedProcess,
    execFileSync: blockedProcess,
    fork: blockedProcess,
  };
  const promiseMethods = {
    readFile: blockedFs,
    readdir: blockedFs,
    lstat: blockedFs,
    stat: blockedFs,
    realpath: blockedFs,
    readlink: blockedFs,
    writeFile: blockedFs,
    mkdtemp: blockedFs,
    mkdir: blockedFs,
    copyFile: blockedFs,
    symlink: blockedFs,
    rename: blockedFs,
    unlink: blockedFs,
    rmdir: blockedFs,
    rm: blockedFs,
  };
  return {
    process: { ...processMethods, default: processMethods },
    promises: { ...promiseMethods, default: promiseMethods },
    fs: (actual: Record<string, unknown>) => {
      const methods = Object.fromEntries(
        Object.entries(actual).map(([key, value]) => [
          key,
          typeof value === 'function' ? blockedFs : value,
        ]),
      );
      methods.promises = promiseMethods;
      return { ...methods, default: methods };
    },
  };
});
vi.mock('node:child_process', () => hostMocks.process);
vi.mock('child_process', () => hostMocks.process);
vi.mock('node:fs', async (original) =>
  hostMocks.fs(await original<Record<string, unknown>>()),
);
vi.mock('fs', async (original) =>
  hostMocks.fs(await original<Record<string, unknown>>()),
);
vi.mock('node:fs/promises', () => hostMocks.promises);
vi.mock('fs/promises', () => hostMocks.promises);

type Entry = {
  bytes?: Buffer;
  link?: string;
  directory?: boolean;
  inode: number;
};

export class MemoryFs {
  entries = new Map<string, Entry>();
  writes: string[] = [];
  nextInode = 10000;

  put(
    path: string,
    value: Omit<Entry, 'inode'>,
    inode = this.nextInode++,
  ): void {
    const parent = dirname(path);
    if (parent !== path && !this.entries.has(parent)) {
      this.put(parent, { directory: true });
    }
    this.entries.set(path, { ...value, inode });
  }

  async realpath(path: string): Promise<string> {
    let current = resolve(path);
    for (let depth = 0; depth < 32; depth++) {
      const parts = current.split('/').filter(Boolean);
      let changed = false;
      for (let i = 0; i < parts.length; i++) {
        const prefix = `/${parts.slice(0, i + 1).join('/')}`;
        const link = this.entries.get(prefix)?.link;
        if (link === undefined) continue;
        current = resolve(dirname(prefix), link, ...parts.slice(i + 1));
        changed = true;
        break;
      }
      if (!changed) {
        if (!this.entries.has(current)) throw new Error(`ENOENT ${current}`);
        return current;
      }
    }
    throw new Error('ELOOP');
  }

  async readFile(path: string): Promise<Buffer>;
  async readFile(path: string, encoding: string): Promise<string>;
  async readFile(path: string, encoding?: string): Promise<Buffer | string> {
    const bytes = this.entries.get(await this.realpath(path))?.bytes;
    if (!bytes) throw new Error(`EISDIR ${path}`);
    return encoding ? bytes.toString('utf8') : Buffer.from(bytes);
  }

  async readdir(path: string): Promise<string[]> {
    const root = await this.realpath(path);
    return [...this.entries.keys()]
      .filter((key) => dirname(key) === root)
      .map((key) => key.slice(root.length + 1))
      .sort();
  }

  async lstat(path: string) {
    const entry = this.entries.get(path);
    if (!entry) throw new Error(`ENOENT ${path}`);
    return {
      dev: 2049,
      ino: entry.inode,
      mode: 0o100600,
      isFile: () => entry.bytes !== undefined,
      isDirectory: () => entry.directory === true,
      isSymbolicLink: () => entry.link !== undefined,
    };
  }

  async stat(path: string) {
    return this.lstat(await this.realpath(path));
  }

  async readlink(path: string): Promise<string> {
    const link = this.entries.get(path)?.link;
    if (link === undefined) throw new Error(`EINVAL ${path}`);
    return link;
  }

  async mkdtemp(prefix: string): Promise<string> {
    const path = `${prefix}owned-${this.nextInode}`;
    this.writes.push(`mkdtemp:${path}`);
    this.put(path, { directory: true });
    return path;
  }

  async mkdir(path: string): Promise<void> {
    this.writes.push(`mkdir:${path}`);
    this.put(path, { directory: true });
  }

  async writeFile(path: string, bytes: Buffer | string): Promise<void> {
    this.writes.push(`write:${path}`);
    this.put(path, { bytes: Buffer.from(bytes) });
  }

  async copyFile(from: string, to: string): Promise<void> {
    await this.writeFile(to, await this.readFile(from));
  }

  async symlink(link: string, path: string): Promise<void> {
    this.writes.push(`symlink:${path}`);
    this.put(path, { link });
  }

  async rename(from: string, to: string): Promise<void> {
    const value = this.entries.get(from);
    if (!value) throw new Error(`ENOENT ${from}`);
    this.writes.push(`rename:${from}:${to}`);
    this.entries.set(to, value);
    this.entries.delete(from);
  }

  async unlink(path: string): Promise<void> {
    this.writes.push(`unlink:${path}`);
    if (!this.entries.delete(path)) throw new Error(`ENOENT ${path}`);
  }

  async rmdir(path: string): Promise<void> {
    if ((await this.readdir(path)).length) throw new Error('ENOTEMPTY');
    await this.unlink(path);
  }
}

export type RawCommand = {
  command: string;
  args: string[];
  input?: Buffer;
  cwd?: string;
};

export function rawClock() {
  const timers = new Map<number, () => void>();
  const clock = {
    now: vi.fn(() => 1000),
    setTimeout: vi.fn((callback: () => void) => {
      const id = timers.size + 1;
      timers.set(id, callback);
      return id;
    }),
    clearTimeout: vi.fn((id: number) => {
      timers.delete(id);
    }),
  };
  return { clock, timers };
}

export class Child extends EventEmitter {
  pid = 9001;
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  chunks: Buffer[] = [];
  ended = false;
  killed: string[] = [];
  stdin = Object.assign(new EventEmitter(), {
    write: (chunk: Buffer | string) => {
      this.chunks.push(Buffer.from(chunk));
      this.stdin.emit('input');
      return true;
    },
    end: (chunk?: Buffer | string) => {
      if (chunk !== undefined) this.chunks.push(Buffer.from(chunk));
      this.ended = true;
      this.stdin.emit('input');
    },
  });

  kill(signal = 'SIGTERM'): boolean {
    this.killed.push(signal);
    return true;
  }

  output(value: string): void {
    this.stdout.emit('data', Buffer.from(value));
  }

  errorOutput(value: string): void {
    this.stderr.emit('data', Buffer.from(value));
  }

  close(status: number | null = 0, signal: string | null = null): void {
    this.stdout.emit('end');
    this.stderr.emit('end');
    this.emit('exit', status, signal);
    this.emit('close', status, signal);
  }

  get input(): string {
    return Buffer.concat(this.chunks).toString('utf8');
  }
}
