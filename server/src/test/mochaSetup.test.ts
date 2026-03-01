import nock from "nock";
import app from "../server";
import { clearDatabase } from "./testHelpers";

export const mochaHooks = {
  async beforeAll(this: Mocha.Context) {
    this.timeout(10000);
    nock.disableNetConnect();
    nock.enableNetConnect("127.0.0.1");
    await app.isReadyPromise;
  },

  async afterEach() {
    await clearDatabase();
    nock.cleanAll();
  },

  afterAll() {
    nock.enableNetConnect();
  },
};
