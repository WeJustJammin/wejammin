/** The polite announcement of a 429 on a read; the person's input is kept by the caller. */
export const rateLimitMessage = (seconds: number | null): string =>
  seconds === null
    ? 'Too many requests. Wait a moment, then try again. Your input is kept.'
    : `Too many requests. Try again in ${seconds} ${
        seconds === 1 ? 'second' : 'seconds'
      }. Your input is kept.`;
