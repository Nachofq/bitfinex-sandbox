import { Express } from "express";
import BitfinexController from "./controllers/BitfinexController";
import GeneralPurposeController from "./controllers/GeneralPurposeController";

const routes = (app: Express) => {
  const generalPurposeController = new GeneralPurposeController();
  const bitfinexController = new BitfinexController();
  app.get("/", generalPurposeController.health);
  app.get("/bfx", bitfinexController.testPair);
};

export default routes;
