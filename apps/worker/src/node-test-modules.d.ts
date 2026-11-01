declare module 'node:fs' {
  export function copyFileSync(source: string, target: string): void;
  export function mkdirSync(path: string, options: { recursive: true }): void;
  export function mkdtempSync(prefix: string): string;
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readdirSync(path: string): string[];
  export function rmSync(
    path: string,
    options?: { force?: boolean; recursive?: boolean },
  ): void;
  export function writeFileSync(path: string, data: string): void;
}

declare module 'node:os' {
  export function tmpdir(): string;
}

declare module 'node:path' {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
  export function relative(from: string, to: string): string;
  export function resolve(...paths: string[]): string;
}

declare module 'node:crypto' {
  export function createHash(algorithm: 'sha256'): {
    update(value: string): { digest(encoding: 'hex'): string };
  };
}

declare module 'node:url' {
  export function fileURLToPath(path: string | URL): string;
}

interface ImportMeta {
  readonly url: string;
}
