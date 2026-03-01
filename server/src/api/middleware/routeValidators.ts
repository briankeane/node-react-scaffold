import { NextFunction, Request, RequestHandler, Response } from "express";
import { ErrorMessages, ValidationError } from "../../utils/errors";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUUIDs(
  source: "params" | "query" | "body",
  fields: string[],
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const data = req[source] as Record<string, unknown>;
    for (const field of fields) {
      const value = data[field];
      if (value && typeof value === "string" && !UUID_REGEX.test(value)) {
        return next(
          new ValidationError(ErrorMessages.invalidUuidFormat(field)),
        );
      }
    }
    return next();
  };
}

export function validateUUIDsInParams(fields: string[]): RequestHandler {
  return validateUUIDs("params", fields);
}

export function validateUUIDsInQuery(fields: string[]): RequestHandler {
  return validateUUIDs("query", fields);
}

export function validateUUIDsInBody(fields: string[]): RequestHandler {
  return validateUUIDs("body", fields);
}

function checkFor(
  source: "query" | "body",
  fields: string[],
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const data = req[source] as Record<string, unknown>;
    const missing = fields.filter(
      (f) => !Object.prototype.hasOwnProperty.call(data, f),
    );
    if (missing.length > 0) {
      return next(
        new ValidationError(
          `Missing required ${source} parameter(s): ${missing.join(", ")}.`,
          { missing },
        ),
      );
    }
    return next();
  };
}

export function checkQueryFor(fields: string[]): RequestHandler {
  return checkFor("query", fields);
}

export function checkBodyFor(fields: string[]): RequestHandler {
  return checkFor("body", fields);
}

function checkForAtLeastOneOf(
  source: "query" | "body",
  fields: string[],
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const data = req[source] as Record<string, unknown>;
    const found = fields.some((f) =>
      Object.prototype.hasOwnProperty.call(data, f),
    );
    if (!found) {
      return next(
        new ValidationError(
          `${source} must contain at least one of: ${fields.join(", ")}.`,
        ),
      );
    }
    return next();
  };
}

export function checkQueryForAtLeastOneOf(fields: string[]): RequestHandler {
  return checkForAtLeastOneOf("query", fields);
}

export function checkBodyForAtLeastOneOf(fields: string[]): RequestHandler {
  return checkForAtLeastOneOf("body", fields);
}

function checkForNoExtraFields(
  source: "query" | "body",
  allowedFields: string[],
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const data = req[source] as Record<string, unknown>;
    const extra = Object.keys(data).filter((k) => !allowedFields.includes(k));
    if (extra.length > 0) {
      return next(
        new ValidationError(
          `Unexpected ${source} parameter(s): ${extra.join(", ")}.`,
          { extra },
        ),
      );
    }
    return next();
  };
}

export function checkQueryForNoExtraFields(
  allowedFields: string[],
): RequestHandler {
  return checkForNoExtraFields("query", allowedFields);
}

export function checkBodyForNoExtraFields(
  allowedFields: string[],
): RequestHandler {
  return checkForNoExtraFields("body", allowedFields);
}

function checkEnum(
  source: "query" | "body",
  field: string,
  allowedValues: string[],
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const data = req[source] as Record<string, unknown>;
    const value = data[field];
    if (value !== undefined && !allowedValues.includes(value as string)) {
      return next(
        new ValidationError(
          ErrorMessages.invalidBodyField(field, allowedValues),
        ),
      );
    }
    return next();
  };
}

export function checkBodyEnum(
  field: string,
  allowedValues: string[],
): RequestHandler {
  return checkEnum("body", field, allowedValues);
}

export function checkQueryEnum(
  field: string,
  allowedValues: string[],
): RequestHandler {
  return checkEnum("query", field, allowedValues);
}

function convertToDate(
  source: "query" | "body",
  dateParams: string[],
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const data = req[source] as Record<string, unknown>;
    for (const param of dateParams) {
      const value = data[param];
      if (value !== undefined && typeof value === "string") {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return next(
            new ValidationError(`Invalid date format for '${param}'.`),
          );
        }
        data[param] = date;
      }
    }
    return next();
  };
}

export function convertQueryParamToDate(dateParams: string[]): RequestHandler {
  return convertToDate("query", dateParams);
}

export function convertBodyParamToDate(dateParams: string[]): RequestHandler {
  return convertToDate("body", dateParams);
}

export function convertQueryParamToNumber(
  numberParams: string[],
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const data = req.query as Record<string, unknown>;
    for (const param of numberParams) {
      const value = data[param];
      if (value !== undefined && typeof value === "string") {
        const num = Number(value);
        if (isNaN(num)) {
          return next(
            new ValidationError(
              `Invalid number format for query parameter '${param}'.`,
            ),
          );
        }
        data[param] = num;
      }
    }
    return next();
  };
}

export function oneOf(middlewares: RequestHandler[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Error[] = [];
    let index = 0;

    function tryNext(): void {
      if (index >= middlewares.length) {
        const messages = errors.map((e) => e.message).join("; ");
        return next(new ValidationError(`None of the validators passed: ${messages}`));
      }

      const middleware = middlewares[index++];
      middleware(req, res, (err?: unknown) => {
        if (!err) {
          return next();
        }
        errors.push(err instanceof Error ? err : new Error(String(err)));
        tryNext();
      });
    }

    tryNext();
  };
}
