declare module 'node:fs' {
  export function readFileSync(path: URL | string, encoding: 'utf8'): string;
  export function readdirSync(path: URL | string): string[];
}

declare module 'node:url' {
  export function fileURLToPath(url: URL): string;
}
