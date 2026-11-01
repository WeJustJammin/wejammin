export type SchemaIssue = Readonly<{
  path: readonly PropertyKey[];
  message: string;
  code?: string;
  keys?: readonly string[];
}>;

/**
 * The bounded RFC 6901 violations of a body the contract refused, exactly as the Worker route
 * reports them (BE03b `issues`): a lowercase machine token, never the submitted value. The codes the
 * relay publishes are filtered by `safeDetails` in `cms-composition-platform-mutation.ts`.
 */
export const violationsOf = (issues: readonly SchemaIssue[]) =>
  issues
    .flatMap((issue) =>
      issue.code === 'unrecognized_keys' && Array.isArray(issue.keys)
        ? issue.keys.map((key) => ({
            path: [...issue.path, key],
            code: 'unknown_field',
          }))
        : [
            {
              path: [...issue.path],
              code: /^[a-z][a-z0-9_]{0,63}$/u.test(issue.message)
                ? issue.message
                : 'invalid_value',
            },
          ],
    )
    .slice(0, 50)
    .map(({ path, code }) => ({
      path: `/${path
        .map((part) => String(part).replaceAll('~', '~0').replaceAll('/', '~1'))
        .join('/')}`,
      code,
    }));
