import { describe, expect, it } from 'vitest';

import {
  pgtapIncludes,
  read,
  validateGate,
} from './phase-02-slice-09-amendment-evidence.test-support';

/**
 * Record guard for a Slice 09 process criterion. AC204 is a standing rule, not a
 * behaviour: the blocking security gates must stay blocking. This guard proves
 * the rule is carried by something executable (a named test for each gate, run
 * by a command that blocks a release), and the criterion is recorded as
 * self-attested: it does not prove the behaviours themselves, each of which has
 * its own acceptance rows.
 */

type SecurityGate = Readonly<{
  gate: string;
  file: string;
  /** Text that shows the named test is about this gate. */
  about: RegExp;
}>;

const SECURITY_GATES: readonly SecurityGate[] = [
  {
    gate: 'reserved-concept',
    file: 'supabase/tests/phase_02_slice_09_p240_a01_grammar.sql',
    about: /the reserved canonical concept key .* is refused/u,
  },
  {
    gate: 'arbitrary-code/style',
    file: 'apps/worker/src/content-schema-registry/phase-02-slice-09-adversarial.test.ts',
    about: /<style>/u,
  },
  {
    gate: 'draft/control-plane leak',
    file: 'supabase/tests/phase_02_slice_09_p240_reads_detail.sql',
    about: /no private control-plane payload/u,
  },
  {
    gate: 'BOLA',
    file: 'supabase/tests/phase_02_slice_09_dec108_decision.sql',
    about: /another organization/u,
  },
  {
    gate: 'approval-bypass',
    file: 'supabase/tests/phase_02_slice_09_dec108_decision.sql',
    about: /submitter can never be recorded as a reviewer/u,
  },
  {
    gate: 'migration-corruption',
    file: 'supabase/tests/phase_02_slice_09_p240_migration_protocol.sql',
    about:
      /hashes and the transform pair are durable and bind the exact source and target/u,
  },
];

describe('Slice 09 process record guards', () => {
  it('[P2-S09-AC-204] names an executed test for every blocking security gate and keeps the commands that block a release running them', () => {
    const includes = pgtapIncludes();
    for (const { gate, file, about } of SECURITY_GATES) {
      const source = read(file);
      expect(source, `${gate}: ${file} speaks of the gate`).toMatch(about);
      expect(source, `${gate}: ${file} carries an acceptance marker`).toMatch(
        /P2-S09-AC-\d{3,4}/u,
      );
      expect(
        validateGate(file, includes),
        `${gate}: ${file} is executed by a release-blocking command`,
      ).not.toBeNull();
    }
    expect(new Set(SECURITY_GATES.map(({ gate }) => gate)).size).toBe(6);

    const scripts = (
      JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    ).scripts;
    expect(scripts.validate, 'pnpm validate runs the vitest suite').toContain(
      'pnpm test:coverage',
    );
    expect(
      scripts['db:verify'],
      'the database gate runs the pgTAP suite',
    ).toContain('pnpm db:test');
    expect(
      read('.github/workflows/ci.yml'),
      'CI runs the database gate',
    ).toContain('pnpm db:ci');
  });
});
