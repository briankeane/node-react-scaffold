import { assert } from 'chai';
import request from 'supertest';
import { AppWithIsReadyPromise } from '../../server';

const app: AppWithIsReadyPromise = require('../../server').default;

describe('Authorization and Authentication', function () {
  describe('HealthCheck', function () {
    it('checks the health', function (done) {
      request(app)
        .get('/v1/healthCheck')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          assert.equal(res.body.healthy, true);
          done();
        });
    });
  });
});
