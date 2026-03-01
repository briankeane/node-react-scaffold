const isTestEnv = process.env.NODE_ENV === 'test';
const isVerbose = process.env.LOGGING_LEVEL === 'verbose';

function log(...args: unknown[]) {
  if (!isTestEnv || isVerbose) {
    console.log(...args);
  }
}

function error(...args: unknown[]) {
  if (!isTestEnv || isVerbose) {
    console.error(...args);
  }
}

function logAndReturnError(err: Error): Error {
  error(err.message);
  return err;
}

const always = {
  log: (...args: unknown[]) => console.log(...args),
  error: (...args: unknown[]) => console.error(...args),
};

export default { log, error, logAndReturnError, always };
