import { RequestHandler } from 'express';
import { ValidationError } from '../errors';

export function checkQueryFor(strArray: string[]) {
  return checkFor('query', strArray);
}

export function checkBodyFor(strArray: string[]) {
  return checkFor('body', strArray);
}

function checkFor(name: string, strArray: string[]): RequestHandler {
  return (req, res, next) => {
    const missing = strArray.filter(
      (str) =>
        !Object.prototype.hasOwnProperty.call(
          req[name as keyof typeof req] as Record<string, unknown>,
          str
        )
    );
    if (missing.length > 0) {
      return next(
        new ValidationError('Error: Missing required parameters', { missing })
      );
    }
    const str = req[name as keyof typeof req];
    if (!strArray.includes(str)) {
      return next(new ValidationError(`Invalid ${name}: ${str}`));
    }
    return next();
  };
}

export function checkForAtLeastOneOf(
  name: string,
  strArray: string[]
): RequestHandler {
  return (req, res, next) => {
    const existing = strArray.filter((str) =>
      Object.prototype.hasOwnProperty.call(
        req[name as keyof typeof req] as Record<string, unknown>,
        str
      )
    );
    if (!existing.length) {
      return next(
        new ValidationError(
          `Error: ${name} must contain at least one of ${strArray.join(', ')}`,
          { existing }
        )
      );
    }
    return next();
  };
}

export function checkForNoExtraFields(
  name: string,
  allowedFields: string[]
): RequestHandler {
  return (req, res, next) => {
    const extraFields = [];
    for (const key of Object.keys(req[name as keyof typeof req])) {
      if (!allowedFields.includes(key)) {
        extraFields.push(key);
      }
    }
    if (extraFields.length > 0) {
      return next(
        new ValidationError(`Error: Extra parameters in ${name}`, {
          extraFields,
        })
      );
    }
    return next();
  };
}
