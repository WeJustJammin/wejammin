/**
 * One labelled metric entry key: `name{label="value",...}` with the labels in
 * alphabetical order. Label values must come from closed sets, never from
 * request text or an identifier.
 */
export const metricKey = (
  name: string,
  labels: Readonly<Record<string, string>>,
): string =>
  `${name}{${Object.keys(labels)
    .sort()
    .map((key) => `${key}="${labels[key]}"`)
    .join(',')}}`;
