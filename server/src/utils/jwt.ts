import * as jwt from "jsonwebtoken";
import User from "../db/models/user.model";
import { config } from "../lib/config";
import { ErrorMessages } from "./errors";

function jwtUserFromPlayolaUser(user: User): Record<string, unknown> {
  return user.toJSON();
}

function generateToken(user: User): Promise<string> {
  return new Promise((resolve, reject) => {
    jwt.sign(
      user.jwtRepr(),
      config.JWT_SECRET,
      { algorithm: "HS256" },
      function (err, token) {
        if (!token)
          return reject(new Error(ErrorMessages.FAILED_TO_GENERATE_TOKEN));
        return resolve(token);
      },
    );
  });
}

export { generateToken, jwtUserFromPlayolaUser };

if (typeof module !== "undefined") {
  module.exports = {
    generateToken,
    jwtUserFromPlayolaUser,
  };
}
