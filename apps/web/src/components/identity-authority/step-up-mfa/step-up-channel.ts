/** An invalidation-only multi-tab signal; it never carries proof or secrets. */
export type StepUpChannelPort = Readonly<{
  post: () => void;
  subscribe: (listener: () => void) => () => void;
}>;

const CHANNEL_NAME = 'wj-step-up';
const MESSAGE = { type: 'step-up-verified' } as const;

/** A BroadcastChannel-backed port, or null where the API is unavailable. */
export const createStepUpChannel = (): StepUpChannelPort | null => {
  if (typeof BroadcastChannel === 'undefined') return null;
  return {
    post: () => {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(MESSAGE);
      channel.close();
    },
    subscribe: (listener) => {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<unknown>) => {
        const data = event.data as { type?: unknown } | null;
        if (data?.type === MESSAGE.type) listener();
      };
      return () => channel.close();
    },
  };
};
