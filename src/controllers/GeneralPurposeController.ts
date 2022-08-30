import { Request, Response } from "express";

class GeneralPurposeController {
  async health(_request: Request, response: Response) {
    return response.json({ status: "ok" });
  }
}

export default GeneralPurposeController;
