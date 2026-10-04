export type ConfigIntegration = {
  readonly name: string;
  readonly hooks: Record<string, (...args: never[]) => unknown>;
};

export function edgeSecurityIntegration(): ConfigIntegration;
export function builtRouteScriptsIntegration(): ConfigIntegration;
