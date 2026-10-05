import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const read = (path: string): string =>
  readFileSync(resolve(ROOT, path), 'utf8');
const RUNBOOK = 'docs/runbooks/platform/sole-admin-mfa-lockout.md';

describe('sole-administrator MFA lockout runbook (BE01a Lost factor)', () => {
  const raw = read(RUNBOOK);
  const text = raw.replace(/[ \t]*\n[ \t]*/gu, ' ');

  it('[P2-S09-AC-1150] is the audited Supabase dashboard procedure with prerequisites, numbered steps and verification', () => {
    expect(text).toMatch(/^# Sole administrator MFA lockout/mu);
    for (const heading of [
      'Prerequisites',
      'Procedure',
      'Verification and failure',
    ])
      expect(text).toContain(`## ${heading}`);
    expect(text).toMatch(/Supabase dashboard/u);
    expect(text).toMatch(/Authentication\s+users view/u);
    const steps = raw.match(/^\d+\. /gmu) ?? [];
    expect(steps.length).toBeGreaterThanOrEqual(4);
  });

  it('[P2-S09-AC-1150] requires a change record and an audit note naming who acted, when, the project, the reason and who confirmed identity', () => {
    expect(text).toMatch(/audit note/iu);
    expect(text).toMatch(/change record/iu);
    for (const element of [
      'who acted',
      'UTC time',
      'project',
      'sole-administrator MFA lockout',
      'who confirmed',
    ])
      expect(text).toContain(element);
  });

  it('[P2-S09-AC-1150] contains no credential, token, code, email address or identifier, and states that none may be recorded', () => {
    expect(text).not.toMatch(/\bsb_(?:secret|publishable)_/u);
    expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/u);
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/u);
    expect(text).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu,
    );
    expect(text).not.toMatch(/\b\d{6}\b/u);
    expect(text).toMatch(/Do not put credentials, codes, email\s+addresses/u);
  });

  it('[P2-S09-AC-1150] is the documented path for the sole administrator: indexed by the platform runbook README and cited by the admin reset form', () => {
    expect(read('docs/runbooks/platform/README.md')).toContain(
      '(./sole-admin-mfa-lockout.md)',
    );
    expect(
      read(
        'apps/web/src/components/platform-configuration/admin-mfa-reset/admin-mfa-reset-values.ts',
      ),
    ).toContain('docs/runbooks/platform/sole-admin-mfa-lockout.md');
    expect(text).toMatch(
      /No HTTP\s+route, grant or support bypass substitutes/u,
    );
  });
});
