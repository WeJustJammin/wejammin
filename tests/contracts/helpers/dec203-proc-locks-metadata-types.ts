export type Metadata = {
  target: string;
  device: string;
  inode: string;
  mode: number;
  uid: number;
  gid: number;
};

export type InventoryRow = Metadata & {
  fd: number;
  flags: string;
  pos: string;
  pidfd: null | { pid: number; nspid: number[] };
};

export type InventoryPayload = {
  phase: string;
  process: unknown;
  fds: InventoryRow[];
  locks: unknown[];
};

export type InventoryAnchor = {
  phase: string;
  process: unknown;
  root: string;
  requiredFds: InventoryRow[];
  locks: unknown[];
  forbiddenObjects: string[];
  artifacts: unknown[];
  directories: InventoryRow[];
  kernelMetadata?: Metadata;
  [key: string]: unknown;
};

export type InventoryFixture = (phase: string) => {
  payload: InventoryPayload;
  anchor: InventoryAnchor;
};

export type ProductionValidator = (
  kind: string,
  body: unknown,
  id: string,
  paths: string[],
  root: string,
) => void;

export type ProductionPaths = (root: string) => string[];
