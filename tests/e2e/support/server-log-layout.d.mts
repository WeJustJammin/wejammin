export const SERVER_LOG_DIRECTORY_ENV: 'S09_SERVER_LOG_DIR';
export const SERVER_LOG_ROOT: '.lane-logs/e2e-server-logs';
export const SERVER_LOG_POINTER: 'current.json';
export const SERVER_LOG_FILES: Readonly<{
  api: 'api-worker.log';
  web: 'web-server.log';
  launcher: 'launcher.log';
}>;
export const SERVER_LOG_HEADER_PREFIX: '# s09-real-server-log ';

export type ServerLogKind = 'api' | 'web' | 'launcher';

export function serverLogDirectoryFor(
  projectRoot: string,
  runToken: string,
  env?: Readonly<Record<string, string | undefined>>,
): string;
export function serverLogPointerPath(projectRoot: string): string;

export interface ServerLogCapture {
  readonly directory: string;
  readonly append: (kind: ServerLogKind, chunk: string | Uint8Array) => void;
  readonly launcherLine: (text: string) => void;
  readonly tee: (
    kind: ServerLogKind,
    stream: {
      on: (event: 'data', listener: (chunk: Buffer) => void) => unknown;
    },
    destination: { write: (chunk: Buffer) => unknown },
  ) => void;
  readonly close: () => void;
}

export function createServerLogCapture(options: {
  projectRoot: string;
  runToken: string;
  env?: Readonly<Record<string, string | undefined>>;
  pid?: number;
  now?: () => Date;
}): ServerLogCapture;
