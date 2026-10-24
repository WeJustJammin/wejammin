/** DTOs shared by the DEC194 local RPC-isolation Worker helper. */
export type Producer = 'ordinary' | 'continuation' | 'recovery';
export type RpcTrace = Readonly<{
  operation: string;
  producer: Producer | null;
  status: number;
  request: unknown;
  response: unknown;
  opaqueApikeyOnly: boolean;
  platformProfile: boolean;
  abortable: boolean;
}>;

export type CanonicalJobSnapshot = {
  id: string;
  type: string;
  state: string;
  version: string;
};
