import BaseException from "./BaseException";
import { ErrorRequestHandler } from "express";

class InternalError extends BaseException {
  constructor(error?: ErrorRequestHandler) {
    super(500, "An internal error occurred", { error: error });
  }
}

export default InternalError;
