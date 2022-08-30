import { Express } from "express";
import GeneralPurposeController from "./controllers/GeneralPurposeController";

const routes = (app: Express) => {
  const generalPurposeController = new GeneralPurposeController();
  app.get("/", generalPurposeController.health);
};

export default routes;
