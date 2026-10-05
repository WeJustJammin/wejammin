import * as React from 'react';

export const formatWait = (seconds: number): string => {
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }
  return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
};

export const formatClock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export type Lockout = Readonly<{
  /** Whole seconds left, or null when not locked. */
  remainingSeconds: number | null;
  /** Polite text: at start, once per whole minute, and at unlock. */
  announcement: string;
  start: (seconds: number) => void;
}>;

const remainingFor = (until: number): number =>
  Math.max(0, Math.ceil((until - Date.now()) / 1000));

/**
 * FE01 lockout: the countdown updates every second for sighted users, while
 * the announcement changes only at the start, each whole minute, and unlock.
 */
export const useLockout = (): Lockout => {
  const [until, setUntil] = React.useState<number | null>(null);
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const [announcement, setAnnouncement] = React.useState('');

  const start = React.useCallback((seconds: number): void => {
    setUntil(Date.now() + seconds * 1000);
    setRemaining(seconds);
    setAnnouncement(`Too many attempts. Try again in ${formatWait(seconds)}.`);
  }, []);

  React.useEffect(() => {
    if (until === null) return undefined;
    const timer = setInterval(() => {
      const left = remainingFor(until);
      if (left <= 0) {
        setUntil(null);
        setRemaining(null);
        setAnnouncement('You can try again.');
        return;
      }
      setRemaining(left);
      if (left % 60 === 0) setAnnouncement(`Try again in ${formatWait(left)}.`);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);

  return { remainingSeconds: remaining, announcement, start };
};
