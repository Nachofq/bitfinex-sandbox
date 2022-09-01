import BaseException from "./BaseException";

class BadRequest extends BaseException {
  constructor(message: string = "Bad Request") {
    super(400, message);
  }
}

export default BadRequest;
