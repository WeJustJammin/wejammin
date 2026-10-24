import {
  exactKeys,
  identifier,
  positivePid,
} from './delivery-receiving-upgrade-target.mjs';

const DIRECT_FK = 'projection_consumer_state_projection_fk';
const COMMAND_TAG =
  /^(?:BEGIN|SET|CREATE TABLE|CREATE INDEX|COMMENT|CREATE FUNCTION|CREATE TRIGGER|ALTER TABLE|REVOKE|DO|COMMIT|ROLLBACK)$/;

function sessionFrom(lines) {
  const candidate = JSON.parse(lines[0]);
  if (
    !exactKeys(candidate, [
      'witness',
      'database',
      'databaseOid',
      'backendPid',
      'applicationName',
    ]) ||
    candidate.witness !== 'DEC197_MIGRATION_SESSION_V1' ||
    !identifier(candidate.database) ||
    typeof candidate.databaseOid !== 'string' ||
    !/^[1-9][0-9]{0,9}$/.test(candidate.databaseOid) ||
    BigInt(candidate.databaseOid) > 4294967295n ||
    !positivePid(candidate.backendPid) ||
    !identifier(candidate.applicationName)
  ) {
    throw new Error('invalid migration session marker');
  }
  return candidate;
}

/** Interpret the actual psql transcript; exit zero alone never proves refusal. */
export function classifyMigrationOutcome({
  mode,
  status,
  stdout,
  stderr,
} = {}) {
  const result = { expected: false };
  if (
    !['negative', 'positive'].includes(mode) ||
    status !== 0 ||
    typeof stdout !== 'string' ||
    typeof stderr !== 'string'
  )
    return result;
  const lines = stdout.split(/\r?\n/).filter((line) => line.trim() !== '');
  let session;
  try {
    session = sessionFrom(lines);
  } catch {
    return result;
  }
  const tags = lines.slice(1);
  const transactionTag = tags.at(-1);
  Object.assign(result, { session, transactionTag });
  if (
    !tags.length ||
    tags[0] !== 'BEGIN' ||
    tags.some((tag) => !COMMAND_TAG.test(tag)) ||
    tags.filter((tag) => tag === 'BEGIN').length !== 1 ||
    tags.slice(0, -1).some((tag) => tag === 'COMMIT' || tag === 'ROLLBACK')
  ) {
    return result;
  }
  const diagnostics = [...stderr.matchAll(/\b(ERROR|FATAL|PANIC):[^\n]*/g)];
  const errors = diagnostics.map((match) => ({
    level: match[1],
    code: /^ERROR:\s+([0-9A-Z]{5}):/.exec(match[0])?.[1],
    text: match[0],
    offset: match.index,
  }));
  if (mode === 'positive') {
    result.expected = errors.length === 0 && transactionTag === 'COMMIT';
    return result;
  }
  const first = errors[0];
  if (!first) return result;
  const firstBlock = stderr.slice(
    first.offset,
    errors[1]?.offset ?? stderr.length,
  );
  const headerConstraint = /violates foreign key constraint "([^"]+)"/.exec(
    first.text,
  )?.[1];
  const detailConstraints = [
    ...firstBlock.matchAll(/^\s*CONSTRAINT NAME:\s*(\S+)\s*$/gm),
  ].map((match) => match[1]);
  const constraint = headerConstraint ?? detailConstraints[0];
  Object.assign(result, { firstSqlstate: first.code, constraint });
  result.expected =
    first.level === 'ERROR' &&
    first.code === '23503' &&
    constraint === DIRECT_FK &&
    (headerConstraint === undefined || headerConstraint === DIRECT_FK) &&
    detailConstraints.every((name) => name === DIRECT_FK) &&
    errors.length >= 2 &&
    errors
      .slice(1)
      .every((error) => error.level === 'ERROR' && error.code === '25P02') &&
    transactionTag === 'ROLLBACK';
  return result;
}
