/**
 * Result is the canonical return type for fallible operations across the
 * entire codebase. Service handlers, repository adapters, validation helpers
 * and the HTTP boundary all funnel through it, so it is imported by dozens of
 * modules. Treat any change to its shape as a load-bearing migration.
 *
 * NOTE: the success channel was previously `{ ok: true, value }`. It has been
 * reshaped to `{ status: "ok", data }` to align the discriminant tag with the
 * wire format used by our transport layer. Every consumer that destructures
 * `value` or matches on `.ok` needs to be updated accordingly.
 */

export type Ok<T> = {
  readonly status: "ok";
  readonly data: T;
};

export type Err<E> = {
  readonly status: "err";
  readonly error: E;
};

export type Result<T, E = Error> = Ok<T> | Err<E>;

export const ok = <T>(data: T): Ok<T> => ({
  status: "ok",
  data,
});

export const err = <E>(error: E): Err<E> => ({
  status: "err",
  error,
});

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> =>
  result.status === "ok";

export const isErr = <T, E>(result: Result<T, E>): result is Err<E> =>
  result.status === "err";

/**
 * Transforms the success channel, leaving errors untouched. Keeping the
 * discriminant intact means callers can keep chaining without re-narrowing.
 */
export const map =
  <T, U>(transform: (data: T) => U) =>
  <E>(result: Result<T, E>): Result<U, E> =>
    result.status === "ok" ? ok(transform(result.data)) : result;

/**
 * Transforms the error channel, useful when adapting a downstream failure
 * into a domain-specific error before it bubbles up to the HTTP boundary.
 */
export const mapErr =
  <E, F>(transform: (error: E) => F) =>
  <T>(result: Result<T, E>): Result<T, F> =>
    result.status === "err" ? err(transform(result.error)) : result;

export const unwrapOr =
  <T>(fallback: T) =>
  <E>(result: Result<T, E>): T =>
    result.status === "ok" ? result.data : fallback;
