import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export const requestLogger = (
  request: Request,
  _response: Response,
  next: NextFunction
) => {
  logger.info(`${request.method}: ${request.path}`);
  next();
};
