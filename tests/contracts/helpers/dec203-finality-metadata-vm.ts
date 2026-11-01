import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { createContext, Script } from 'node:vm';
import type { AuditResult } from './dec203-finality-metadata-fixture';

export type MetadataIo = {
  openSync: (path: string, flags: 'r') => number;
  readSync: (
    fd: number,
    buffer: Buffer,
    offset: number,
    length: number,
    position: null,
  ) => number;
  closeSync: (fd: number) => void;
  readlinkSync: (path: string) => string;
  realpathSync: (path: string) => string;
};

type RunMetadataAudit = () => AuditResult;

export function loadFinalityMetadataAudit(io: MetadataIo): RunMetadataAudit {
  try {
    const helperUrl = new URL(
      '../../../.memory/pipeline/progress/verification/2026-10-22-native-finality-metadata.cjs',
      import.meta.url,
    );
    const helperPath = helperUrl.pathname;
    const source = readFileSync(helperPath, 'utf8');
    const moduleObject: { exports: Record<string, unknown> } = { exports: {} };
    const sourceRequire = createRequire(helperPath);
    const localRequire = (request: string): unknown => {
      if (request === 'node:fs')
        return {
          openSync: io.openSync,
          readSync: io.readSync,
          closeSync: io.closeSync,
          readlinkSync: io.readlinkSync,
          realpathSync: io.realpathSync,
        };
      if (request === 'node:path' || request === 'node:assert/strict')
        return sourceRequire(request);
      throw new Error(`unplanned CJS require: ${request}`);
    };
    const context = createContext({ Buffer, TextDecoder });
    const wrapper = new Script(
      `(function (require, module, exports, __filename, __dirname) {\n${source}\n})`,
      { filename: helperPath },
    ).runInContext(context) as (
      require: (request: string) => unknown,
      module: { exports: Record<string, unknown> },
      exports: Record<string, unknown>,
      filename: string,
      dirname: string,
    ) => void;
    wrapper(
      localRequire,
      moduleObject,
      moduleObject.exports,
      helperPath,
      dirname(helperPath),
    );
    const exportKeys = Reflect.ownKeys(moduleObject.exports);
    if (exportKeys.length !== 1 || exportKeys[0] !== 'runMetadataAudit')
      throw new TypeError('metadata helper export surface changed');
    const exported = moduleObject.exports.runMetadataAudit;
    if (typeof exported !== 'function')
      throw new TypeError('actual zero-argument metadata helper missing');
    return exported as RunMetadataAudit;
  } catch (error) {
    return () => {
      throw error;
    };
  }
}
