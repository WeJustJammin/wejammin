import { fileURLToPath } from 'node:url';
import { ensure } from './receiving-bootstrap-artifacts.mjs';
import { DIRECTORY } from './receiving-bootstrap-profile.mjs';
import { runPreReadyLeaseConstruction } from './receiving-lease.mjs';

let spent = false;

export async function runPreReadyCoordinator() {
  ensure(arguments.length === 0 && !spent, 'DEC203_SUPERVISOR_REFUSED');
  spent = true;
  ensure(
    fileURLToPath(import.meta.url) ===
      `${DIRECTORY}/receiving-native-bootstrap.mjs`,
    'DEC203_SUPERVISOR_REFUSED',
  );
  await runPreReadyLeaseConstruction();
}
