import { fileURLToPath } from 'node:url';
import { ensure } from './receiving-bootstrap-artifacts.mjs';
import { COORDINATOR } from './receiving-bootstrap-profile.mjs';
import { runPreReadyCoordinator } from './receiving-native-bootstrap.mjs';

async function main() {
  ensure(
    fileURLToPath(import.meta.url) === COORDINATOR,
    'DEC203_SUPERVISOR_REFUSED',
  );
  // The private runner returns or rejects only after proved local owned closure.
  // Unproved closure retains its actual construction record and does not return.
  await runPreReadyCoordinator();
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(() => {
    process.exitCode = 1;
  });
}
