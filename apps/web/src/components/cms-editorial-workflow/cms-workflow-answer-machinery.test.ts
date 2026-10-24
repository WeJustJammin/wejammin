import { describe, expect, it, vi } from 'vitest';

/*
 * P2-S11-AC-106: the transport and the refusal classifier are loaded by dynamic import, once, when a
 * command is sent or a form is focused. The factories below run when the module is first imported,
 * so they count real loads.
 */
const loads = vi.hoisted(() => ({ transport: 0, refusal: 0 }));
vi.mock('./cms-workflow-command-transport', () => {
  loads.transport += 1;
  return { sendWorkflowCommand: 'transport-module' };
});
vi.mock('./cms-workflow-refusal', () => {
  loads.refusal += 1;
  return { classifyWorkflowRefusal: 'refusal-module' };
});

const machinery = await import('./cms-workflow-answer-machinery');

describe('cms-workflow-answer-machinery', () => {
  it('loads nothing when it is imported', () => {
    expect(loads).toEqual({ transport: 0, refusal: 0 });
  });

  it('warms both modules, each imported once however often it is asked', async () => {
    machinery.warmWorkflowAnswerMachinery();
    machinery.warmWorkflowAnswerMachinery();
    await vi.waitFor(() => expect(loads).toEqual({ transport: 1, refusal: 1 }));
  });

  it('hands out the transport and the refusal classifier it loaded', async () => {
    expect(await machinery.loadWorkflowTransport()).toMatchObject({
      sendWorkflowCommand: 'transport-module',
    });
    expect(await machinery.loadWorkflowRefusal()).toMatchObject({
      classifyWorkflowRefusal: 'refusal-module',
    });
    expect(loads).toEqual({ transport: 1, refusal: 1 });
  });
});
