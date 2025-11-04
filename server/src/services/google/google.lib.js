const jwt = require("jsonwebtoken");
const querystring = require("querystring");
const axios = require("axios");
const db = require("../../db");
const { config } = require("../../lib/config");
const { generateToken } = require("../../utils/jwt");

/**
 * Creates or updates a user via Google OAuth
 */
const createOrUpdateUserViaGoogle = async ({
  code,
  originatesFromIOS = false,
}) => {
  const response = await axios.post(
    "https://oauth2.googleapis.com/token",
    querystring.stringify({
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: originatesFromIOS
        ? config.GOOGLE_SIGNIN_REDIRECT_URI
        : "postmessage",
      grant_type: "authorization_code",
    }),
  );

  const { access_token, refresh_token, id_token } = response.data;
  const { email } = jwt.decode(id_token);

  // Get profile information from UserInfo endpoint since ID token doesn't include profile fields
  const userInfoResponse = await axios.get(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    },
  );

  const { given_name, family_name } = userInfoResponse.data;

  const assetWorkflowInclude = db.models.UserAssetWorkflowRole
    ? [{ model: db.models.UserAssetWorkflowRole, as: "assetWorkflowRole" }]
    : [];

  let googleUser = await db.models.GoogleUser.findOne({
    where: { googleUserId: email },
  });
  let user = await db.models.User.findOne({
    where: { email },
    include: assetWorkflowInclude,
  });
  if (!user) {
    user = await db.models.User.create({
      email,
      firstName: given_name,
      lastName: family_name,
    });
  }

  if (googleUser) {
    googleUser.accessToken = access_token;
    googleUser.refreshToken = refresh_token;
    await googleUser.save();
  } else {
    googleUser = await db.models.GoogleUser.create({
      googleUserId: email,
      accessToken: access_token,
      refreshToken: refresh_token,
      userId: user.id,
    });
  }
  // Reload user with associations
  user = await db.models.User.findByPk(user.id, {
    include: assetWorkflowInclude,
  });
  return { user, googleUser };
};

/**
 * Handles the OAuth callback including generating token and building redirect data
 * @throws Will throw an error if authentication fails
 */
const handleOAuthCallback = async (code, state, originatesFromIOS = false) => {
  // Create or update user via Google
  const { user } = await createOrUpdateUserViaGoogle({
    code,
    originatesFromIOS,
  });

  // Generate Playola token
  const token = await generateToken(user);

  // Prepare response data
  const responseData = { token };

  // Add return_to if state is a path
  if (state && state.startsWith("/")) {
    responseData.return_to = state;
  }

  return responseData;
};

module.exports = {
  createOrUpdateUserViaGoogle,
  handleOAuthCallback,
};
