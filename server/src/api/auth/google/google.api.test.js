const app = require("../../../server");
const { assert } = require("chai");
const request = require("supertest");
const db = require("../../../db");
const nock = require("nock");
const jwt = require("jsonwebtoken");
const { config } = require("../../../lib/config");

describe("Google API Authorization", function () {
  const code = "THISISTHECODE";
  const accessToken = "THISISTHEACCESSTOKEN";
  const refreshToken = "THISISTHEREFRESHTOKEN";
  const email = "testymctesterson@example.com";
  const firstName = "Testy";
  const lastName = "McTesterson";
  const idToken = jwt.sign(
    {
      email,
      emailVerified: true,
      given_name: firstName,
      family_name: lastName,
    },
    "testSecret",
  );

  describe("POST /signin", function () {
    it("requires a code", function (done) {
      request(app)
        .post("/v1/auth/google/signin")
        .send({})
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err);
          assert.include(res.body.error.message, "code");
          done();
        });
    });

    describe("with mocks", function () {
      let receivedNockBody;

      beforeEach(function () {
        nock("https://oauth2.googleapis.com")
          .post("/token", (body) => {
            receivedNockBody = body;
            return body;
          })
          .reply(200, {
            access_token: accessToken,
            refresh_token: refreshToken,
            id_token: idToken,
          });

        // Mock the UserInfo endpoint
        nock("https://openidconnect.googleapis.com")
          .get("/v1/userinfo")
          .reply(200, {
            given_name: firstName,
            family_name: lastName,
            email: email,
          });
      });

      it("creates a new googleUser and user if neither existed", function (done) {
        request(app)
          .post("/v1/auth/google/signin")
          .send({ code })
          .expect(200)
          .end(async function (err, res) {
            if (err) return done(err);
            try {
              assert.exists(res.body.token);

              let user = await db.models.User.findOne({ where: { email } });
              assert.exists(user);
              assert.equal(user.firstName, firstName);
              assert.equal(user.lastName, lastName);
              assert.equal(user.email, email);

              let googleUser = await db.models.GoogleUser.findOne({
                where: { googleUserId: email },
              });
              assert.exists(googleUser);
              assert.equal(googleUser.googleUserId, email);
              assert.equal(googleUser.accessToken, accessToken);
              assert.equal(googleUser.refreshToken, refreshToken);
              assert.equal(googleUser.userId, user.id);
              done();
            } catch (err) {
              done(err);
            }
          });
      });

      it("user with email already exists -- create googleUser and add googleUserId to existing user", async function () {
        const user = await db.models.User.create({
          email,
          firstName,
          lastName,
        });

        const result = await request(app)
          .post("/v1/auth/google/signin")
          .send({ code })
          .expect(200);

        assert.exists(result.body.token);
        let googleUser = await db.models.GoogleUser.findOne({
          where: { googleUserId: email },
        });

        assert.exists(googleUser);

        assert.equal(googleUser.googleUserId, email);
        assert.equal(googleUser.accessToken, accessToken);
        assert.equal(googleUser.refreshToken, refreshToken);
        assert.equal(googleUser.userId, user.id);
      });

      it("user and googleUser already exist -- update tokens only", async function () {
        const user = await db.models.User.create({
          email,
          firstName,
          lastName,
        });

        await db.models.GoogleUser.create({
          googleUserId: email,
          accessToken,
          refreshToken,
          userId: user.id,
        });

        const result = await request(app)
          .post("/v1/auth/google/signin")
          .send({ code })
          .expect(200);

        assert.exists(result.body.token);
        let foundGoogleUser = await db.models.GoogleUser.findOne({
          where: { googleUserId: email },
        });

        assert.equal(foundGoogleUser.googleUserId, email);
        assert.equal(foundGoogleUser.accessToken, accessToken);
        assert.equal(foundGoogleUser.refreshToken, refreshToken);
        assert.equal(foundGoogleUser.userId, user.id);
      });

      it("passes the correct body originating from the web", async function () {
        await request(app)
          .post("/v1/auth/google/signin")
          .send({ code })
          .expect(200);
        assert.equal(receivedNockBody.redirect_uri, "postmessage");
      });

      it("passes the correct body originating from ios", async function () {
        await request(app)
          .post("/v1/auth/google/signin")
          .send({ code, originatesFromIOS: true })
          .expect(200);
        assert.equal(
          receivedNockBody.redirect_uri,
          config.GOOGLE_SIGNIN_REDIRECT_URI,
        );
      });
    });
  });

  describe("GET /web/authorize", function () {
    it("should redirect to Google OAuth URL with correct parameters", function (done) {
      request(app)
        .get("/v1/auth/google/web/authorize")
        .expect(302)
        .end(function (err, res) {
          if (err) return done(err);

          const location = res.header.location;
          assert.include(
            location,
            "https://accounts.google.com/o/oauth2/v2/auth",
          );
          assert.include(location, `client_id=${config.GOOGLE_CLIENT_ID}`);
          assert.include(location, "response_type=code");
          assert.include(location, "scope=email%20profile");
          assert.include(location, "access_type=offline");
          assert.include(location, "prompt=consent");
          done();
        });
    });

    it("should include return_to path in state parameter", function (done) {
      const returnPath = "/account";
      request(app)
        .get(`/v1/auth/google/web/authorize?return_to=${returnPath}`)
        .expect(302)
        .end(function (err, res) {
          if (err) return done(err);

          const location = res.header.location;
          assert.include(location, `state=${encodeURIComponent(returnPath)}`);
          done();
        });
    });
  });

  describe("GET /google/callback", function () {
    const mockCode = "test-auth-code";

    beforeEach(function () {
      // Mock Google OAuth token endpoint
      nock("https://oauth2.googleapis.com").post("/token").reply(200, {
        access_token: accessToken,
        refresh_token: refreshToken,
        id_token: idToken,
      });

      // Mock the UserInfo endpoint
      nock("https://openidconnect.googleapis.com")
        .get("/v1/userinfo")
        .reply(200, {
          given_name: firstName,
          family_name: lastName,
          email: email,
        });
    });

    it("should redirect to success page with token", function (done) {
      request(app)
        .get(`/v1/auth/google/callback?code=${mockCode}`)
        .expect(302)
        .end(function (err, res) {
          if (err) return done(err);

          const location = res.header.location;
          assert.include(
            location,
            `${config.CLIENT_BASE_URL}/spotifyAuth/success`,
          );
          assert.include(location, "token=");
          done();
        });
    });

    it("should include return_to in redirect when state is a path", function (done) {
      const returnPath = "/account";
      request(app)
        .get(`/v1/auth/google/callback?code=${mockCode}&state=${returnPath}`)
        .expect(302)
        .end(function (err, res) {
          if (err) return done(err);

          const location = res.header.location;
          assert.include(
            location,
            `return_to=${encodeURIComponent(returnPath)}`,
          );
          done();
        });
    });
  });
  describe("failing nock", function () {
    this.beforeEach(function () {
      nock("https://oauth2.googleapis.com").post("/token").reply(500);
    });
    it("should redirect to login with error on failure", function (done) {
      // Force an error by not providing code
      request(app)
        .get("/v1/auth/google/callback")
        .expect(302)
        .end(function (err, res) {
          if (err) return done(err);

          const location = res.header.location;
          assert.include(location, `${config.CLIENT_BASE_URL}/login`);
          assert.include(location, "error=google_auth_failed");
          done();
        });
    });
  });
});
