import { NextFunction, Request, Response } from 'express';
import { ErrorMessages } from '../../utils/errors';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUUIDsInParams(paramArray: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    for (const paramName of paramArray) {
      const paramValue = req.params[paramName];
      if (paramValue && !UUID_REGEX.test(paramValue)) {
        return res.status(400).json({
          error: { message: ErrorMessages.invalidUuidFormat(paramName) },
        });
      }
    }
    return next();
  };
}

export function validateUUIDsInQuery(queryArray: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    for (const queryName of queryArray) {
      const queryValue = req.query[queryName] as string;
      if (queryValue && !UUID_REGEX.test(queryValue)) {
        return res.status(400).json({
          error: { message: ErrorMessages.invalidUuidFormat(queryName) },
        });
      }
    }
    return next();
  };
}

export function validateUUIDsInBody(bodyArray: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    for (const bodyName of bodyArray) {
      const bodyValue = req.body[bodyName];
      if (bodyValue && !UUID_REGEX.test(bodyValue)) {
        return res.status(400).json({
          error: { message: ErrorMessages.invalidUuidFormat(bodyName) },
        });
      }
    }
    return next();
  };
}

type RequestProperty = 'query' | 'body';

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function checkFor(objName: RequestProperty, strArray: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const missing = strArray.filter(
      (str) => !Object.prototype.hasOwnProperty.call(req[objName], str)
    );
    if (missing.length) {
      return res.status(400).json({
        error: {
          message: `${capitalize(objName)} parameter(s) missing: ${missing.join(', ')}`,
        },
      });
    }
    return next();
  };
}

export function checkQueryFor(strArray: string[]) {
  return checkFor('query', strArray);
}

export function checkBodyFor(strArray: string[]) {
  return checkFor('body', strArray);
}

export function checkQueryForAtLeastOneOf(strArray: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const present = strArray.filter((str) =>
      Object.prototype.hasOwnProperty.call(req.query, str)
    );
    if (!present.length) {
      return res.status(400).json({
        error: {
          message: `Query must include at least one of the following: ${strArray.join(', ')}`,
        },
      });
    }
    return next();
  };
}

export function checkBodyForAtLeastOneOf(strArray: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const present = strArray.filter((str) =>
      Object.prototype.hasOwnProperty.call(req.body, str)
    );
    if (!present.length) {
      return res.status(400).json({
        error: {
          message: `Body must include at least one of the following: ${strArray.join(', ')}`,
        },
      });
    }
    return next();
  };
}

export function checkQueryForNoExtraFields(strArray: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const extraFields: string[] = [];
    for (const key of Object.keys(req.query)) {
      if (!strArray.includes(key)) {
        extraFields.push(key);
      }
    }
    if (!extraFields.length) return next();

    return res.status(400).json({
      error: {
        message: `Query cannot include the parameters: ${extraFields.join(', ')}. This endpoint accepts the values: ${strArray.join(', ')}`,
      },
    });
  };
}

export function checkBodyForNoExtraFields(strArray: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const extraFields: string[] = [];
    for (const key of Object.keys(req.body)) {
      if (!strArray.includes(key)) {
        extraFields.push(key);
      }
    }
    if (!extraFields.length) return next();

    return res.status(400).json({
      error: {
        message: `Body cannot include the parameters: ${extraFields.join(', ')}. This endpoint accepts the values: ${strArray.join(', ')}`,
      },
    });
  };
}

function checkEnum(
  objName: RequestProperty,
  field: string,
  allowedValues: readonly string[]
) {
  return function (req: Request, res: Response, next: NextFunction) {
    const value = req[objName][field];
    if (!value || !allowedValues.includes(value as string)) {
      return res.status(400).json({
        error: {
          message: ErrorMessages.invalidBodyField(field, [...allowedValues]),
        },
      });
    }
    return next();
  };
}

export function checkBodyEnum(field: string, allowedValues: readonly string[]) {
  return checkEnum('body', field, allowedValues);
}

export function checkQueryEnum(field: string, allowedValues: readonly string[]) {
  return checkEnum('query', field, allowedValues);
}

export function convertQueryParamToDate(dateParams: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    try {
      for (const param of dateParams) {
        if (req.query[param] !== undefined && req.query[param] !== null) {
          const parsedDate = new Date(req.query[param] as string);
          if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({
              error: { message: `Invalid Value: ${param} must be a valid date` },
            });
          }
          (req.query as Record<string, Date | string>)[param] = parsedDate;
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function convertBodyParamToDate(dateParams: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    try {
      for (const param of dateParams) {
        if (req.body[param] !== undefined && req.body[param] !== null) {
          const parsedDate = new Date(req.body[param] as string);
          if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({
              error: { message: `Invalid Value: ${param} must be a valid date` },
            });
          }
          req.body[param] = parsedDate;
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function convertQueryParamToNumber(numberParams: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    try {
      for (const param of numberParams) {
        if (req.query[param] !== undefined && req.query[param] !== null) {
          const parsedNumber = Number(req.query[param]);
          if (isNaN(parsedNumber)) {
            return res.status(400).json({
              error: {
                message: `Invalid Value: ${param} must be a valid number`,
              },
            });
          }
          (req.query as Record<string, number | string>)[param] = parsedNumber;
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function oneOf(
  middlewares: Array<(req: Request, res: Response, next: NextFunction) => void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Error[] = [];

    const tryNextMiddleware = (index: number) => {
      if (index >= middlewares.length) {
        if (errors.length === 0) {
          next(new Error('Access denied'));
        } else if (errors.length === 1) {
          next(errors[0]);
        } else {
          const combinedMessage = errors.map((err) => err.message).join(' OR ');
          const firstError = errors[0];
          firstError.message = combinedMessage;
          next(firstError);
        }
        return;
      }

      const middleware = middlewares[index];
      const middlewareNext: NextFunction = (err) => {
        if (err) {
          errors.push(err instanceof Error ? err : new Error(String(err)));
          tryNextMiddleware(index + 1);
        } else {
          next();
        }
      };

      middleware(req, res, middlewareNext);
    };

    tryNextMiddleware(0);
  };
}
