declare module 'node:fs' {
  export function readFileSync(path: URL | string, encoding: 'utf8'): string;
  export function readdirSync(path: URL | string): string[];
  export function existsSync(path: URL | string): boolean;
  export function statSync(path: URL | string): { isFile(): boolean };
}

declare module 'node:path' {
  export function dirname(path: string): string;
  export function relative(from: string, to: string): string;
  export function resolve(...segments: string[]): string;
}

interface ImportMeta {
  readonly dirname: string;
}

declare module 'node:url' {
  export function fileURLToPath(url: URL): string;
}
