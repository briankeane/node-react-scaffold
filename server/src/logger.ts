const isSuppressed =
  process.env.NODE_ENV === "test" && process.env.LOGGING_LEVEL !== "verbose";

function log(...args: unknown[]): void {
  if (!isSuppressed) {
    console.log(...args);
  }
}

function error(...args: unknown[]): void {
  if (!isSuppressed) {
    console.error(...args);
  }
}

function logAndReturnError<T extends Error>(err: T): T {
  error(err);
  return err;
}

const always = {
  log: (...args: unknown[]): void => {
    console.log(...args);
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};

export default { log, error, logAndReturnError, always };
