import { useCallback, useEffect, useState } from 'react';

/** A verified 429 gates both the button and direct form submit until its delay. */
export const useCmsTemplateRateWait = () => {
  const [retryAt, setRetryAt] = useState<number | null>(null);

  useEffect(() => {
    if (retryAt === null) return;
    const remainingMs = retryAt - Date.now();
    if (remainingMs <= 0) {
      setRetryAt(null);
      return;
    }
    const timer = setTimeout(() => setRetryAt(null), remainingMs);
    return () => clearTimeout(timer);
  }, [retryAt]);

  const start = useCallback((seconds: number): void => {
    setRetryAt(Date.now() + seconds * 1_000);
  }, []);

  return { waiting: retryAt !== null && Date.now() < retryAt, start };
};
