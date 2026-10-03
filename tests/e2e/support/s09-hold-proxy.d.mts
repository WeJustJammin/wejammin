export interface HoldingProxyOptions {
  readonly port: number;
  readonly host?: string;
  readonly upstreamPort: () => number;
  readonly ready: () => Promise<void>;
  readonly holdMs?: number;
  readonly onRetry?: (info: {
    method: string;
    url: string;
    code: string;
    attempt: number;
  }) => void;
}

export interface HoldingProxy {
  readonly listen: () => Promise<void>;
  readonly close: () => Promise<void>;
}

export function createHoldingProxy(options: HoldingProxyOptions): HoldingProxy;
