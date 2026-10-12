import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CLIENT_WORKFLOW_CONTRACT_MODULES,
  CLIENT_CORE_CONTRACT_MODULES,
  CLIENT_RULE_CONTRACT_MODULES,
  CLIENT_SAFE_CONTRACT_MODULES,
  CLIENT_EDITOR_CONTRACT_MODULES,
  clientChunkFor,
  clientChunkGroups,
  isClientWorkflowContractModule,
  isClientCoreContractModule,
  isClientRuleContractModule,
  isClientSafeContractModule,
  isClientEditorContractModule,
} from '../client-chunk-boundaries.mjs';

/**
 * AC261: `manualChunks` pins zod and every contracts module into dependency
 * chunks (see client-chunk-boundaries.mjs). If the zod-free browser entry
 * (`contracts/src/client.ts`) shared the zod-carrying `contracts` chunk, every
 * protected island that needs a constant would load zod with it. The zod-free
 * closure of the entry therefore owns a chunk of its own.
 */

const CONTRACTS_SRC = resolve(
  import.meta.dirname,
  '../../../packages/contracts/src',
);
const STATIC_IMPORT =
  /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\s+from\s+)?['"]([^'"]+)['"]/gu;

const closure = (entry: string): string[] => {
  const seen = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      if (match[1] !== undefined || !(match[2] as string).startsWith('.'))
        continue;
      const target = resolve(dirname(file), match[2] as string);
      if (existsSync(target) && statSync(target).isFile()) pending.push(target);
    }
  }
  return [...seen];
};

describe('[P2-S09-AC-261] client chunk boundaries', () => {
  it('[P2-S09-AC-261] gives the zod-free contracts client entry and its closure their own chunk', () => {
    const files = closure(resolve(CONTRACTS_SRC, 'client.ts'));
    expect(files.length).toBeGreaterThan(4);
    for (const file of files)
      expect(isClientSafeContractModule(file)).toBe(true);
    expect(
      files
        .map((file) => file.slice(file.indexOf('/packages/contracts/')))
        .sort(),
    ).toEqual([...CLIENT_SAFE_CONTRACT_MODULES].sort());
  });

  it('[P2-S09-AC-261] declares the zod-free groups before the dependency group, rules first, with falling priority', () => {
    const [
      rulesGroup,
      clientGroup,
      workflowGroup,
      editorGroup,
      dependencyGroup,
    ] = clientChunkGroups;
    expect(rulesGroup).toMatchObject({ name: 'contracts-client-rules' });
    expect(clientGroup).toMatchObject({ name: 'contracts-client' });
    expect(workflowGroup).toMatchObject({ name: 'contracts-client-workflow' });
    expect(editorGroup).toMatchObject({
      name: 'contracts-client-editor',
    });
    expect(rulesGroup?.priority ?? 0).toBeGreaterThan(
      clientGroup?.priority ?? 0,
    );
    expect(workflowGroup?.priority ?? 0).toBe(clientGroup?.priority ?? 0);
    expect(editorGroup?.priority ?? 0).toBe(clientGroup?.priority ?? 0);
    expect(clientGroup?.priority ?? 0).toBeGreaterThan(
      dependencyGroup?.priority ?? 0,
    );
    expect(dependencyGroup?.name).toBe(clientChunkFor);
    expect(clientChunkGroups).toHaveLength(5);
  });

  it('[P2-S09-AC-261] keeps the editor walkers out of the workflow and core chunks', () => {
    expect(CLIENT_EDITOR_CONTRACT_MODULES.length).toBeGreaterThan(0);
    for (const module of CLIENT_EDITOR_CONTRACT_MODULES) {
      const file = resolve(CONTRACTS_SRC, '..', '..', '..', module.slice(1));
      expect(CLIENT_CORE_CONTRACT_MODULES).not.toContain(module);
      expect(CLIENT_WORKFLOW_CONTRACT_MODULES).not.toContain(module);
      expect(isClientEditorContractModule(file)).toBe(true);
      expect(isClientCoreContractModule(file)).toBe(false);
      expect(isClientWorkflowContractModule(file)).toBe(false);
    }
  });

  it('[P2-S09-AC-261] keeps the workflow-only zod-free modules out of the core chunk the registry routes load', () => {
    expect(CLIENT_WORKFLOW_CONTRACT_MODULES.length).toBeGreaterThan(0);
    for (const module of CLIENT_WORKFLOW_CONTRACT_MODULES) {
      const file = resolve(CONTRACTS_SRC, '..', '..', '..', module.slice(1));
      expect(CLIENT_CORE_CONTRACT_MODULES).not.toContain(module);
      expect(isClientWorkflowContractModule(file)).toBe(true);
      expect(isClientCoreContractModule(file)).toBe(false);
    }
    for (const module of CLIENT_CORE_CONTRACT_MODULES)
      expect(
        isClientWorkflowContractModule(
          resolve(CONTRACTS_SRC, '..', '..', '..', module.slice(1)),
        ),
      ).toBe(false);
  });

  it('[P2-S09-AC-261] keeps the registry field rules, used only by the lazy command enhancement, out of the hydration chunk', () => {
    expect(CLIENT_RULE_CONTRACT_MODULES.length).toBeGreaterThan(0);
    for (const module of CLIENT_RULE_CONTRACT_MODULES) {
      expect(CLIENT_SAFE_CONTRACT_MODULES).toContain(module);
      expect(
        isClientRuleContractModule(
          resolve(CONTRACTS_SRC, '..', '..', '..', module.slice(1)),
        ),
      ).toBe(true);
    }
    expect(
      isClientRuleContractModule(resolve(CONTRACTS_SRC, 'client.ts')),
    ).toBe(false);
  });

  it('[P2-S09-AC-261] keeps zod and every other contracts module in their dependency chunks', () => {
    expect(clientChunkFor('/repo/node_modules/zod/v4/core/index.js')).toBe(
      'zod',
    );
    expect(clientChunkFor(resolve(CONTRACTS_SRC, 'api-error.ts'))).toBe(
      'contracts',
    );
    expect(
      clientChunkFor(
        resolve(CONTRACTS_SRC, 'content-schema-registry/validators.ts'),
      ),
    ).toBe('contracts');
    expect(
      clientChunkFor('/repo/apps/web/src/lib/client-binding.ts'),
    ).toBeUndefined();
  });
});
