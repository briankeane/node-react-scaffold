import { Request, Response, NextFunction } from "express";
import * as googleLib from "../../../services/google/google.lib";
import { config } from "../../../lib/config";
import * as querystring from "querystring";
import logger from "../../../logger";

const handleWebSignUp = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  const { code, originatesFromIOS, return_to } = req.body;
  try {
    const responseData = await googleLib.handleOAuthCallback(
      code,
      return_to,
      originatesFromIOS,
    );
    return res.status(200).json(responseData);
  } catch (err) {
    next(err);
  }
};

const handleCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state } = req.query;

    const responseData = await googleLib.handleOAuthCallback(
      code as string,
      state as string,
    );

    res.redirect(
      `${config.CLIENT_BASE_URL}/spotifyAuth/success?${querystring.stringify(
        responseData,
      )}`,
    );
  } catch (err) {
    logger.error("Google callback error:", err);
    res.redirect(`${config.CLIENT_BASE_URL}/login?error=google_auth_failed`);
  }
};

export { handleWebSignUp, handleCallback };
