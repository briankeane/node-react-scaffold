/*
 * Global setup code for mocha tests
 * note: I think this works (executes first) because
 * it is not inside of a describe block.   It still must
 * stay within the '${ROOT}/test' folder.
 */

import { after, afterEach, before } from "mocha";
import app from "../server";
import db from "../db";
import logger from "../logger";
import { clearDatabase } from "./test.helpers";

before(async function (this: Mocha.Context) {
  this.timeout(5000);
  logger.suppressLogger();
  await app.isReadyPromise;
  await clearDatabase(db);
});

afterEach(async function () {
  await clearDatabase(db);
});

after(function () {
  logger.enableLogger();
});
