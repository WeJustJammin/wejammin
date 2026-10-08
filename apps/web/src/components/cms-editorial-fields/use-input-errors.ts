import * as React from 'react';

/**
 * Aggregates the raw-input errors of the several controls inside one composite
 * field (list items, object properties, relation rows) into the single
 * `onInputError` the host listens to: the first message while any control is in
 * error, otherwise null.
 */
export const useInputErrors = (
  report: ((message: string | null) => void) | undefined,
): ((key: string) => (message: string | null) => void) => {
  const errors = React.useRef(new Map<string, string>());
  const reportRef = React.useRef(report);
  React.useEffect(() => {
    reportRef.current = report;
  });
  return React.useCallback((key: string) => {
    return (message: string | null): void => {
      if (message === null) errors.current.delete(key);
      else errors.current.set(key, message);
      reportRef.current?.(errors.current.values().next().value ?? null);
    };
  }, []);
};
