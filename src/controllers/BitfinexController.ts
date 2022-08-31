import { BitfinexProvider } from "../providers/bitfinex";

import { Request, Response, NextFunction } from "express";
import InternalError from "../exceptions/InternalError";
import BadRequest from "../exceptions/BadRequest";
class BitfinexController {
  async testPair(_request: Request, response: Response, next: NextFunction) {
    try {
      const bfxProvider = new BitfinexProvider();
      await bfxProvider.connect();
      bfxProvider.subscribe({
        event: "subscribe",
        channel: "book",
        symbol: "tBTCUSD",
        frequency: "F1",
        len: "25",
        prec: "P1",
      });
      const result = await bfxProvider.getOBSnapshotTips();
      bfxProvider.close();
      return response.send({ result });
    } catch (e: any) {
      return next(new InternalError(e));
    }
  }

  async getTips(request: Request, response: Response, next: NextFunction) {
    try {
      const { pair } = request.params;
      if (!pair) {
        return next(new BadRequest("Pair must be defined"));
      }
      if (!pair.match("^t[A-Z]{6,}$")) {
        return next(new BadRequest("Wrong format. expected tABCDEF"));
      }

      const bfxProvider = new BitfinexProvider();
      await bfxProvider.connect();
      bfxProvider.subscribe({
        event: "subscribe",
        channel: "book",
        symbol: pair,
        frequency: "F1",
        len: "25",
        prec: "P1",
      });
      const result = await bfxProvider.getOBSnapshotTips();
      return response.send({ result });
    } catch (e: any) {
      return next(new InternalError(e));
    }
  }
}
export default BitfinexController;
