import { NextFunction, Request, Response } from "express";
import InternalError from "../exceptions/InternalError";

class GeneralPurposeController {
  async health(_request: Request, response: Response, next: NextFunction) {
    try {
      throw new InternalError();
    } catch (e: any) {
      return next(new InternalError(e));
    }

    return response.json({ status: "ok" });
  }
}

export default GeneralPurposeController;
