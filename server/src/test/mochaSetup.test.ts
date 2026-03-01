import nock from 'nock';
import app from '../server';
import { clearDatabase } from './testHelpers';

export const mochaHooks = {
  async beforeAll() {
    (this as Mocha.Context).timeout(5000);
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
    await app.isReadyPromise;
  },

  async afterEach() {
    nock.cleanAll();
    await clearDatabase();
  },

  async afterAll() {
    nock.enableNetConnect();
  },
};
