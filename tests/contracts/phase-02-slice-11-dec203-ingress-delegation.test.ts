import { describe, expect, it, vi } from 'vitest';

import { hostBindingFixture } from './phase-02-slice-11-delivery-receiving-upgrade-host-binding-fixtures';
import { smallLocal } from './phase-02-slice-11-delivery-receiving-upgrade-renewal-fixtures';

describe('DEC203 injected non-ingress filesystem delegation', () => {
  it.each(['lstat', 'stat'] as const)(
    'ID01 %s forwards the exact options and late raw observation',
    async (method) => {
      const mock = await smallLocal();
      const installed = await hostBindingFixture(mock);
      const path = installed.executables.node.path;
      expect(path).toBe('/unit/trusted/node');
      expect(path).not.toBe(installed.binding.ingress.parent.path);
      expect(path).not.toBe(installed.binding.ingress.socket.path);

      const raw = mock.fs[method].bind(mock.fs);
      const sentinel = await raw(path);
      expect(sentinel.isFile()).toBe(true);
      expect(Number.isSafeInteger(sentinel.ino) && sentinel.ino > 0).toBe(true);
      const control = await installed.fs[method](path);
      expect(control.dev).toBe(sentinel.dev);
      expect(control.ino).toBe(sentinel.ino);
      expect(control.mode).toBe(sentinel.mode);
      expect(control.isFile()).toBe(true);

      const late = vi
        .fn<
          (
            path: string,
            options?: { bigint?: boolean },
          ) => Promise<typeof sentinel>
        >()
        .mockResolvedValue(sentinel);
      mock.fs[method] = late;
      expect(mock.fs[method]).toBe(late);
      const options = { bigint: true };
      const observed = await installed.fs[method](path, options);

      expect(observed).toBe(sentinel);
      expect(mock.process.spawn).not.toHaveBeenCalled();
      expect(mock.process.run).not.toHaveBeenCalled();
      expect(mock.children).toEqual([]);
      expect(late).toHaveBeenCalledOnce();
      expect(late.mock.calls[0]?.[0]).toBe(path);
      expect(options).toEqual({ bigint: true });
      expect(late).toHaveBeenCalledWith(path, options);
      expect(late.mock.calls[0]?.[1]).toBe(options);
    },
  );
});
