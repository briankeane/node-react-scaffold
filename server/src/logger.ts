/* eslint-disable no-console */

let _suppressOutput = false;

export function suppressLogger(): void {
  _suppressOutput = true;
}

export function enableLogger(): void {
  _suppressOutput = false;
}

export function log(...args: unknown[]): void {
  if (
    (process.env.NODE_ENV !== "test" ||
      process.env.LOGGING_LEVEL === "verbose") &&
    !_suppressOutput
  ) {
    console.log(...args);
  }
}

export function error(...args: unknown[]): void {
  if (
    !_suppressOutput &&
    (process.env.NODE_ENV !== "test" || process.env.LOGGING_LEVEL === "verbose")
  ) {
    console.error(...args);
  }
}

export function logAndReturnError<T extends Error>(err: T): T {
  error(err);
  return err;
}

export const always = {
  log: (value: unknown): void => console.log(value),
  error: (value: unknown): void => console.error(value),
};

const logger = {
  log,
  error,
  always,
  logAndReturnError,
  suppressLogger,
  enableLogger,
};

export default logger;

if (typeof module !== "undefined") {
  module.exports = logger;
}

/* eslint-enable no-console */
