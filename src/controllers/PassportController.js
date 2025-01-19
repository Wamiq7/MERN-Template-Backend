const {
  generateSocialTokens,
} = require("../services/tokenService");
const { FRONTEND_URL } = require("../config/env");

const oauthSuccessHandler = async (req, res) => {
  try {
    const token = generateSocialTokens(req?.user?._json?.email, "user");
    res.redirect(`${FRONTEND_URL}/authenticating?token=${token}`);
    return;
  } catch (error) {
    console.error(error.message);
    res.redirect(`${FRONTEND_URL}/authenticating`);

  }
};

module.exports = {
  oauthSuccessHandler,
};
