/**
 * How a real-API call is compared with its expected outcome in the claim-gate
 * probes: `<status>:<message>`, where a success is `200:` (PostgREST sends no
 * error message).
 *
 * A fixture may also name the exact members of the JSON object a successful call
 * answers (`GateFixture.successKeys`). A 200 whose body has other members is then
 * a different outcome, so a gate-less stub that answers `{}` cannot pass a probe
 * that expects the function's own success. An actorless operation has no ghost or
 * forged caller to tell the stub from the real function, so the result shape is
 * its behavioural evidence.
 */
import type { RpcOutcome } from './stack';

export const outcomeOf = (
  outcome: RpcOutcome,
  successKeys?: readonly string[],
): string => {
  const plain = `${String(outcome.status)}:${outcome.message}`;
  if (successKeys === undefined || outcome.status !== 200) return plain;
  const body = outcome.body;
  const members =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? Object.keys(body).sort()
      : [];
  return members.join(',') === [...successKeys].sort().join(',')
    ? plain
    : `${plain}[members: ${members.join(',')}]`;
};
