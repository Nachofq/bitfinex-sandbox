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
        freq: "P0",
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
        freq: "F0",
        len: "1", // for the tips only need 1 price point on each side
        prec: "P0",
      });
      const result = await bfxProvider.getOBSnapshotTips();
      return response.send({ result });
    } catch (e: any) {
      return next(new InternalError(e));
    }
  }

  async getEffectivePrice(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      const pair = request.query.pair as string;
      const type = request.query.type as string;
      const operation = request.query.operation as string;
      const amount = parseFloat(request.query.amount as string);
      const limitPrice = parseFloat(request.query.limitPrice as string);

      if (!pair || !type || !operation || !amount) {
        return next(
          new BadRequest(
            "Missing parameters. Expected /bfx/place-order?pair=tABCDEF&type=<MARKET>&operation=<BUY|SELL>&amount=<FLOAT>"
          )
        );
      }

      const bfxProvider = new BitfinexProvider();
      await bfxProvider.connect();
      bfxProvider.subscribe({
        event: "subscribe",
        channel: "book",
        symbol: pair,
        freq: "F0",
        len: "250",
        prec: "P0",
      });
      const result = await bfxProvider.getEffectivePrice({
        type,
        operation,
        amount,
        ...(limitPrice && { limitPrice }),
      });

      response.send({ result });
    } catch (e: any) {
      return next(new InternalError(e));
    }
  }
}
export default BitfinexController;
