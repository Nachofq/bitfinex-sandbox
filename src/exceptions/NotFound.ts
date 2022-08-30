import BaseException from "./BaseException";

class ServiceNotFound extends BaseException {
  constructor(message: string = "Service not found") {
    super(404, message);
  }
}

export default ServiceNotFound;
