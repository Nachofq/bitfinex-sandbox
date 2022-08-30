import { NextFunction, Request, Response, ErrorRequestHandler } from "express";
import BaseException from "../exceptions/BaseException";
import InternalError from "../exceptions/InternalError";
import PageNotFoundError from "../exceptions/NotFound";

export const errorHandler = (
  error: ErrorRequestHandler,
  _request: Request,
  response: Response,
  next: NextFunction
) => {
  if (error) {
    const errorInstance =
      error instanceof BaseException ? error : new InternalError(error);

    return response
      .status(errorInstance.getStatus())
      .json(errorInstance.getMessage());
  }
  next();
};

export const routeNotFoundHandler = (
  _request: Request,
  _response: Response,
  next: NextFunction
) => {
  next(new PageNotFoundError());
};
