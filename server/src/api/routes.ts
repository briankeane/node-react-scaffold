import { Application } from "express";
import authApi from "./auth";
import healthCheckApi from "./healthCheck";

function addRoutes(app: Application) {
  app.use("/v1/healthCheck", healthCheckApi);
  app.use("/v1/auth", authApi);
}

export default addRoutes;
