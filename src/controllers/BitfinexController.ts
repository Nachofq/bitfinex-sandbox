import { BitfinexProvider } from "../providers/bitfinex";

import { Request, Response, NextFunction } from "express";
import InternalError from "../exceptions/InternalError";

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
      const result = await bfxProvider.getOBSnapshot();
      bfxProvider.close();
      return response.json({ result });
    } catch (e: any) {
      return next(new InternalError(e));
    }
  }
}
export default BitfinexController;
