const { assert } = require("chai");
const googleLib = require("./google.lib");
const db = require("../../db");
const nock = require("nock");
const jwt = require("jsonwebtoken");
const { config } = require("../../lib/config");
const { parseJwt } = require("../../test/test.helpers");

describe("Google Library functions", function () {
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
  let receivedNockBody;

  describe("createOrUpdateUserViaGoogle", function () {
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

    afterEach(function () {
      nock.cleanAll();
    });

    it("creates a new googleUser and user if neither existed", async function () {
      try {
        const result = await googleLib.createOrUpdateUserViaGoogle({ code });

        await db.models.GoogleUser.findOne({
          where: { googleUserId: email },
        });
        assert.isOk(result?.user);
        assert.equal(result.user.firstName, firstName);
        assert.equal(result.user.lastName, lastName);
        assert.equal(result.user.email, email);

        assert.isOk(result.googleUser);
        assert.equal(result.googleUser.googleUserId, email);
        assert.equal(result.googleUser.accessToken, accessToken);
        assert.equal(result.googleUser.refreshToken, refreshToken);
        assert.equal(result.googleUser.userId, result.user.id);
      } catch (err) {
        console.log("asdfasdfsadf");
        console.log(err);
        assert.fail();
      }
    });

    it("user with email already exists -- create googleUser and add googleUserId to existing user", async function () {
      const user = await db.models.User.create({
        email,
        firstName,
        lastName,
      });

      const result = await googleLib.createOrUpdateUserViaGoogle({ code });

      assert.isOk(result?.user);
      assert.isOk(result?.googleUser);
      assert.equal(user.id, result.user.id);

      assert.equal(result.googleUser.googleUserId, email);
      assert.equal(result.googleUser.accessToken, accessToken);
      assert.equal(result.googleUser.refreshToken, refreshToken);
      assert.equal(result.googleUser.userId, user.id);
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

      const result = await googleLib.createOrUpdateUserViaGoogle({ code });

      assert.isOk(result.user);
      assert.isOk(result.googleUser);
      assert.equal(user.id, result.user.id);

      assert.equal(result.googleUser.googleUserId, email);
      assert.equal(result.googleUser.accessToken, accessToken);
      assert.equal(result.googleUser.refreshToken, refreshToken);
      assert.equal(result.googleUser.userId, user.id);
    });

    it("uses the proper redirect_uri (and the rest of the body) when it originates on the web", async function () {
      await googleLib.createOrUpdateUserViaGoogle({ code });
      assert.equal(receivedNockBody.client_id, config.GOOGLE_CLIENT_ID);
      assert.equal(receivedNockBody.client_secret, config.GOOGLE_CLIENT_SECRET);
      assert.equal(receivedNockBody.code, code);
      assert.equal(receivedNockBody.redirect_uri, "postmessage");
      assert.equal(receivedNockBody.grant_type, "authorization_code");
    });
  });

  it("uses the proper redirect_uri (and the rest of the body) when it originates on mobile", async function () {
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

    await googleLib.createOrUpdateUserViaGoogle({
      code,
      originatesFromIOS: true,
    });
    assert.equal(receivedNockBody.client_id, config.GOOGLE_CLIENT_ID);
    assert.equal(receivedNockBody.client_secret, config.GOOGLE_CLIENT_SECRET);
    assert.equal(receivedNockBody.code, code);
    assert.equal(
      receivedNockBody.redirect_uri,
      config.GOOGLE_SIGNIN_REDIRECT_URI,
    );
    assert.equal(receivedNockBody.grant_type, "authorization_code");
  });

  describe("handleOAuthCallback", function () {
    const mockUser = {
      id: "user-123",
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
    };
    const testCode = "test-auth-code";

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

    it("should call createOrUpdateUserViaGoogle with the correct parameters for web", async function () {
      await googleLib.handleOAuthCallback(testCode, null);

      assert.deepEqual(receivedNockBody, {
        client_id: "theGoogleClientId",
        client_secret: "theGoogleSecret",
        code: testCode,
        redirect_uri: "postmessage",
        grant_type: "authorization_code",
      });
    });

    it("should call createOrUpdateUserViaGoogle with iOS flag when specified", async function () {
      await googleLib.handleOAuthCallback(testCode, null, true);

      // notice the different redirect_uri
      assert.deepEqual(receivedNockBody, {
        client_id: "theGoogleClientId",
        client_secret: "theGoogleSecret",
        code: testCode,
        redirect_uri: "http://localhost:10020/v1/auth/google/web/authorize",
        grant_type: "authorization_code",
      });
    });

    it("should generate a token using the user object", async function () {
      let result = await googleLib.handleOAuthCallback(testCode, null);
      let { token } = result;
      assert.isOk(token);
      let parsedToken = parseJwt(token);
      assert.isOk(parsedToken.id, mockUser.id);
      assert.equal(parsedToken.firstName, firstName);
      assert.equal(parsedToken.lastName, lastName);
      assert.equal(parsedToken.email, email);
    });

    it("should include return_to in the response when state is a path", async function () {
      const testState = "/account";
      const result = await googleLib.handleOAuthCallback(testCode, testState);

      assert.equal(result.return_to, testState);
    });

    it("should not include return_to when state is not a path", async function () {
      const testState = "some-random-state";
      const result = await googleLib.handleOAuthCallback(testCode, testState);

      assert.notOk(result.return_to);
    });
  });

  describe("with failing nock", function () {
    beforeEach(function () {
      nock("https://oauth2.googleapis.com")
        .post("/token", (body) => {
          receivedNockBody = body;
          return body;
        })
        .reply(400, {
          error: "invalid_grant",
          error_description: "Invalid authorization code",
        });
    });

    afterEach(function () {
      nock.cleanAll();
    });

    it("should throw error if createOrUpdateUserViaGoogle fails", async function () {
      try {
        await googleLib.handleOAuthCallback("test-jwt", null);
        assert.fail("Expected an error to be thrown");
      } catch (error) {
        assert.isOk(error);
      }
    });
  });
});
