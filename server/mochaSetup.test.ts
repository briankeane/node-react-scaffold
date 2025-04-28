/*
 * Global setup code for mocha tests
 * note: I think this works (executes first) because
 * it is not inside of a describe block.   It still must
 * stay within the '${ROOT}/test' folder.
 */

import { afterEach, before } from 'mocha';
// import db from '../db';
import app from '../server';

before(async function (this: Mocha.Context) {
  this.timeout(5000);
  await app.isReadyPromise;
  // await clearDatabase(db);
});

afterEach(async function () {
  // await clearDatabase(db);
});
