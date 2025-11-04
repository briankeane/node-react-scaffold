import express from "express";
import * as googleController from "./google/google.controller";
import googleRouter from "./google";

const router = express.Router();

router.use("/google", googleRouter);
router.get("/google/callback", googleController.handleCallback);

export default router;
