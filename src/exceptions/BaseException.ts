import { ErrorRequestHandler } from "express";

export interface IExceptionConfig {
  error?: ErrorRequestHandler;
  data?: any;
}
export interface IBaseException extends IExceptionConfig {
  status: number;
  message: string;
  getMessage: Function;
  getStatus: Function;
}

export interface IRequestError {
  message: string;
  stack?: string;
}

class BaseException implements IBaseException {
  status: number;
  message: string;
  config?: IExceptionConfig;
  debug: any;

  constructor(
    status: number,
    message: string,
    config: IExceptionConfig = {},
    debug: any = {}
  ) {
    console.log("BASE", message, config);

    this.status = status;
    this.message = message;
    this.config = config;
    this.debug = debug;
  }

  getMessage() {
    const baseResponse = {
      status: this.status,
      message: this.message,
      ...(this.debug && { debug: this.debug }),
      ...(this.config?.data && { data: this.config.data }),
    };

    if (this.config?.error) {
      const err = this.config.error as unknown as IRequestError;
      return {
        ...baseResponse,
        message: err.message,
        stack: err.stack,
      };
    } else {
      return baseResponse;
    }
  }

  getStatus() {
    return this.status;
  }
}

export default BaseException;
