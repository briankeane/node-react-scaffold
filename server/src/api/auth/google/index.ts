import express from "express";
import querystring from "querystring";
import { config } from "../../../lib/config";
import { checkBodyFor } from "../../routeValidators";
import * as controller from "./google.controller";

const router = express.Router({ mergeParams: true });

router.post("/signin", checkBodyFor(["code"]), controller.handleWebSignUp);

router.get("/web/authorize", (req, res) => {
  const googleAuthUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const params: Record<string, string | number | boolean> = {
    client_id: config.GOOGLE_CLIENT_ID,
    redirect_uri: `${config.BASE_URL}/v1/auth/google/callback`,
    response_type: "code",
    scope: "email profile",
    access_type: "offline",
    prompt: "consent",
  };

  if (req.query.return_to && typeof req.query.return_to === "string") {
    params.state = req.query.return_to;
  }

  res.redirect(`${googleAuthUrl}?${querystring.stringify(params)}`);
});

export default router;
