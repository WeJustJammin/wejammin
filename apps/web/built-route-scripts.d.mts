export const AUTH_SCOPE_ASSET: RegExp;
export function verifyBuiltRouteScripts(distDirectory: string): {
  readonly failures: string[];
  readonly documentRoutes: string[];
  readonly scriptKeys: number;
};
