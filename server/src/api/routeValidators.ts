import { NextFunction, Request, Response } from "express";
import { ErrorMessages } from "../utils/errors";

function validateUUIDsInParams(paramArray: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const paramName of paramArray) {
      const paramValue = req.params[paramName];
      if (paramValue && !uuidRegex.test(paramValue)) {
        return res.status(400).json({
          error: {
            message: ErrorMessages.invalidUuidFormat(paramName),
          },
        });
      }
    }
    return next();
  };
}

function validateUUIDsInQuery(queryArray: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const queryName of queryArray) {
      const queryValue = req.query[queryName] as string;
      if (queryValue && !uuidRegex.test(queryValue)) {
        return res.status(400).json({
          error: {
            message: ErrorMessages.invalidUuidFormat(queryName),
          },
        });
      }
    }
    return next();
  };
}

function validateUUIDsInBody(bodyArray: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const bodyName of bodyArray) {
      const bodyValue = req.body[bodyName];
      if (bodyValue && !uuidRegex.test(bodyValue)) {
        return res.status(400).json({
          error: {
            message: ErrorMessages.invalidUuidFormat(bodyName),
          },
        });
      }
    }
    return next();
  };
}

function checkQueryFor(strArray: string[]) {
  return checkFor("query", strArray);
}

function checkBodyFor(strArray: string[]) {
  return checkFor("body", strArray);
}

function checkQueryForAtLeastOneOf(strArray: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const present = strArray.filter((str) =>
      Object.prototype.hasOwnProperty.call(req.query, str),
    );
    if (!present.length) {
      const message = `Query must include at least one of the following: ${strArray.join(
        ", ",
      )}`;

      return res.status(400).json({
        error: {
          message: message,
        },
      });
    }
    return next();
  };
}

function checkQueryForNoExtraFields(strArray: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const extraFields: string[] = [];
    for (const key of Object.keys(req.query)) {
      if (!strArray.includes(key)) {
        extraFields.push(key);
      }
    }
    if (!extraFields.length) return next();

    const message = `Query cannot include the parameters: ${extraFields.join(
      ", ",
    )}. This endpoint accepts the values: ${strArray.join(", ")}`;

    return res.status(400).json({
      error: {
        message: message,
      },
    });
  };
}

function checkBodyForAtLeastOneOf(strArray: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const present = strArray.filter((str) =>
      Object.prototype.hasOwnProperty.call(req.body, str),
    );
    if (!present.length) {
      const message = `Body must include at least one of the following: ${strArray.join(
        ", ",
      )}`;

      return res.status(400).json({
        error: {
          message: message,
        },
      });
    }
    return next();
  };
}

function checkBodyForNoExtraFields(strArray: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const extraFields: string[] = [];
    for (const key of Object.keys(req.body)) {
      if (!strArray.includes(key)) {
        extraFields.push(key);
      }
    }
    if (!extraFields.length) return next();

    const message = `Body cannot include the parameters: ${extraFields.join(
      ", ",
    )}. This endpoint accepts the values: ${strArray.join(", ")}`;

    return res.status(400).json({
      error: {
        message: message,
      },
    });
  };
}

function checkBodyForAtLeastOneSet(...strArrays: string[][]) {
  const objName = "body";
  return function (req: Request, res: Response, next: NextFunction) {
    const missings = strArrays.map((arr) =>
      arr.filter(
        (str) => !Object.prototype.hasOwnProperty.call(req[objName], str),
      ),
    );
    const allMissing = missings.filter((arr) => arr.length > 0);

    if (allMissing.length === strArrays.length) {
      const message = `${capitalize(
        objName,
      )} parameter(s) missing. This requires a combination like the following: ${strArrays.join(
        " | ",
      )}`;

      return res.status(400).json({
        error: {
          message: message,
          data: { details: strArrays },
        },
      });
    }
    return next();
  };
}

type RequestProperty = "query" | "body";

function checkFor(objName: RequestProperty, strArray: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const missing = strArray.filter(
      (str) => !Object.prototype.hasOwnProperty.call(req[objName], str),
    );
    if (missing.length) {
      const message = `${capitalize(
        objName,
      )} parameter(s) missing: ${missing.join(", ")}`;

      return res.status(400).json({
        error: {
          message: message,
        },
      });
    }
    return next();
  };
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const routeValidators = {
  validateUUIDsInParams,
  validateUUIDsInQuery,
  validateUUIDsInBody,
  checkQueryFor,
  checkQueryForAtLeastOneOf,
  checkQueryForNoExtraFields,
  checkBodyFor,
  checkBodyForAtLeastOneOf,
  checkBodyForAtLeastOneSet,
  checkBodyForNoExtraFields,
};

export default routeValidators;
export {
  validateUUIDsInParams,
  validateUUIDsInQuery,
  validateUUIDsInBody,
  checkQueryFor,
  checkQueryForAtLeastOneOf,
  checkQueryForNoExtraFields,
  checkBodyFor,
  checkBodyForAtLeastOneOf,
  checkBodyForAtLeastOneSet,
  checkBodyForNoExtraFields,
};
