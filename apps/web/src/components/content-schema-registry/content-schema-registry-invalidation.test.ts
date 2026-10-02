import { describe, expect, it, vi } from 'vitest';

import {
  bindContentSchemaRegistryRealtimeInvalidation,
  createContentSchemaRegistryInvalidationHint,
  isContentSchemaRegistryInvalidationHint,
  publishContentSchemaRegistryInvalidation,
  subscribeContentSchemaRegistryInvalidation,
} from './content-schema-registry-invalidation';

class FakeChannel {
  readonly messages: unknown[] = [];
  private listener: ((event: { readonly data: unknown }) => void) | null = null;

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  addEventListener(
    _type: 'message',
    listener: (event: { readonly data: unknown }) => void,
  ): void {
    this.listener = listener;
  }

  removeEventListener(
    _type: 'message',
    listener: (event: { readonly data: unknown }) => void,
  ): void {
    if (this.listener === listener) this.listener = null;
  }

  emit(data: unknown): void {
    this.listener?.({ data });
  }
}

describe('content schema registry invalidation boundary', () => {
  it('[P2-S09-AC-1021] accepts and publishes only a metadata-free hint', () => {
    const hint = createContentSchemaRegistryInvalidationHint();
    expect(isContentSchemaRegistryInvalidationHint(hint)).toBe(true);
    expect(
      isContentSchemaRegistryInvalidationHint({
        ...hint,
        version: '4',
      }),
    ).toBe(false);
    const channel = new FakeChannel();
    publishContentSchemaRegistryInvalidation(channel);
    expect(channel.messages).toEqual([hint]);
  });

  it('[P2-S09-AC-1021] refetches canonical data for valid hints and ignores payloads', () => {
    const channel = new FakeChannel();
    const onInvalidate = vi.fn();
    const subscription = subscribeContentSchemaRegistryInvalidation({
      channel,
      onInvalidate,
    });
    channel.emit({ type: 'content-schema-registry.updated', id: 'secret' });
    channel.emit({
      type: 'content-schema-registry.invalidate',
      secret: 'nope',
    });
    channel.emit(createContentSchemaRegistryInvalidationHint());
    expect(onInvalidate).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
    channel.emit(createContentSchemaRegistryInvalidationHint());
    expect(onInvalidate).toHaveBeenCalledTimes(1);
  });

  it('uses the same invalidation contract for realtime adapters', () => {
    const channel = new FakeChannel();
    const onInvalidate = vi.fn();
    const unbind = bindContentSchemaRegistryRealtimeInvalidation(
      channel,
      onInvalidate,
    );
    channel.emit(createContentSchemaRegistryInvalidationHint());
    expect(onInvalidate).toHaveBeenCalledTimes(1);
    unbind();
  });
});
