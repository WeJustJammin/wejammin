#!/usr/bin/env node
// Runs the pgTAP suites against the local Supabase database with VERBOSE TAP, the
// only pgTAP output the evidence collector accepts (`pnpm evidence:collect
// --pgtap <file>`): one `ok N - description` line per assertion plus each file's
// plan, so a skipped, TODO or never-run assertion can never pass for a criterion.
//
//   pnpm db:test:tap [--out test-results/db-test.tap] [supabase/tests/<file>.sql ...]
//
// `supabase test db` runs the same suites through the same pg_prove image but
// prints only a verdict per file, and has no verbose switch, so this script starts
// that image itself on the Supabase docker network (so `pnpm db:test` is still
// the quick pass/fail gate). Exit status is pg_prove's. Without `--out` the TAP
// goes to stdout. Run it right after `pnpm db:reset`, like `pnpm db:test`.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Mount point of the test directory inside the pg_prove container (a short path: the image truncates long ones). */
export const CONTAINER_ROOT = '/w';
const TESTS = 'supabase/tests';

/** The Supabase project id (`project_id` in supabase/config.toml). */
export const projectId = (config) => {
  const match = /^project_id\s*=\s*"([^"]+)"/mu.exec(config);
  if (match === null) throw new Error('supabase/config.toml has no project_id');
  return match[1];
};

/** `docker run` arguments for the pg_prove container. */
export const dockerArguments = ({ project, image, repository, paths }) => {
  const targets =
    paths.length === 0
      ? [`${CONTAINER_ROOT}/${TESTS}`]
      : paths.map((path) => `${CONTAINER_ROOT}/${path.replace(/^\.\//u, '')}`);
  return [
    'run',
    '--rm',
    '--network',
    `supabase_network_${project}`,
    '-v',
    `${resolve(repository, TESTS)}:${CONTAINER_ROOT}/${TESTS}:ro`,
    '-e',
    `PGHOST=supabase_db_${project}`,
    '-e',
    'PGUSER=postgres',
    '-e',
    'PGPASSWORD',
    '-e',
    'PGDATABASE=postgres',
    image,
    'pg_prove',
    '-v',
    '-r',
    '--ext',
    '.sql',
    ...targets,
  ];
};

/** Rewrites container paths in the TAP back to repository-absolute paths, which the collector relativises. */
export const restorePaths = (tap, repository) =>
  tap.replaceAll(
    `${CONTAINER_ROOT}/${TESTS}/`,
    `${resolve(repository, TESTS)}/`,
  );

const run = (command, args, options = {}) =>
  spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 1 << 30,
    ...options,
  });

const discoverImage = () => {
  if (process.env.PG_PROVE_IMAGE) return process.env.PG_PROVE_IMAGE;
  const listing = run('docker', [
    'images',
    '--format',
    '{{.Repository}}:{{.Tag}}',
  ]);
  const image = (listing.stdout ?? '')
    .split('\n')
    .find((line) => /supabase\/pg_prove:/u.test(line));
  if (image === undefined)
    throw new Error(
      'no supabase/pg_prove image is cached; run `pnpm db:test` once (the Supabase CLI pulls it) or set PG_PROVE_IMAGE',
    );
  return image;
};

const databasePassword = (project) => {
  const env = run('docker', [
    'inspect',
    `supabase_db_${project}`,
    '--format',
    '{{range .Config.Env}}{{println .}}{{end}}',
  ]);
  const line = (env.stdout ?? '')
    .split('\n')
    .find((entry) => entry.startsWith('POSTGRES_PASSWORD='));
  if (line === undefined)
    throw new Error(
      `supabase_db_${project} is not running; run \`pnpm db:start\``,
    );
  return line.slice('POSTGRES_PASSWORD='.length);
};

const main = () => {
  const args = process.argv.slice(2);
  let out = null;
  const paths = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--out') out = args[(index += 1)] ?? null;
    else paths.push(args[index]);
  }
  const project = projectId(
    readFileSync(resolve(repositoryRoot, 'supabase/config.toml'), 'utf8'),
  );
  const result = run(
    'docker',
    dockerArguments({
      project,
      image: discoverImage(),
      repository: repositoryRoot,
      paths,
    }),
    { env: { ...process.env, PGPASSWORD: databasePassword(project) } },
  );
  const tap = restorePaths(
    `${result.stdout ?? ''}${result.stderr ?? ''}`,
    repositoryRoot,
  );
  if (out === null) process.stdout.write(tap);
  else {
    const target = resolve(repositoryRoot, out);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, tap);
    process.stdout.write(`wrote verbose TAP to ${target}\n`);
  }
  process.exit(result.status ?? 1);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
