import { randomBytes } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

/**
 * The web edge reads STEP_UP_SCOPE_SECRET (the HMAC key that binds the step-up
 * scope nonce to the signed-in subject) from the local runtime variables file
 * `apps/web/.dev.vars`, which is gitignored and the only place a local run reads
 * it from (`.dev.vars.example` lists the name). A local Chrome run that finds the
 * file missing, or without the name, adds a RANDOM value; an existing value is
 * never replaced and nothing here is a fixed secret.
 */
export const ensureWebDevVars = (projectRoot) => {
  const file = join(projectRoot, 'apps/web/.dev.vars');
  const line = () =>
    `STEP_UP_SCOPE_SECRET=${randomBytes(32).toString('hex')}\n`;
  if (!existsSync(file)) {
    writeFileSync(file, line(), { mode: 0o600 });
    return;
  }
  const current = readFileSync(file, 'utf8');
  if (!/^STEP_UP_SCOPE_SECRET=./mu.test(current)) {
    appendFileSync(
      file,
      `${current.endsWith('\n') || current === '' ? '' : '\n'}${line()}`,
    );
  }
};
