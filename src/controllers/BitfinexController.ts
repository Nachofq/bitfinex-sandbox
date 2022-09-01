import { BitfinexProvider } from "../providers/bitfinex";
import { Request, Response, NextFunction } from "express";
import BadRequest from "../exceptions/BadRequest";
import { logger } from "../utils/logger";
class BitfinexController {
  async testPair(_request: Request, response: Response, next: NextFunction) {
    try {
      const bfxProvider = new BitfinexProvider();
      await bfxProvider.connect();
      bfxProvider.subscribe({
        event: "subscribe",
        channel: "book",
        symbol: "tBTCUSD",
        freq: "F0",
        len: "25",
        prec: "P1",
      });
      const result = await bfxProvider.getOBSnapshot();
      bfxProvider.close();
      return response.send({ result });
    } catch (e: any) {
      return next(e);
    }
  }

  async getTips(request: Request, response: Response, next: NextFunction) {
    try {
      const { pair } = request.params;
      if (!pair) {
        throw new BadRequest("Pair must be defined");
      }
      if (!pair.match("^t[A-Z]{6,}$")) {
        throw new BadRequest("Wrong format. expected tABCDEF");
      }
      logger.info(`Tip Request: ${pair}`);

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
      return next(e);
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
        throw new BadRequest(
          "Missing parameters. Expected /bfx/place-order?pair=tABCDEF&type=<MARKET>&operation=<BUY|SELL>&amount=<FLOAT>"
        );
      }

      logger.info(
        `${
          type[0] + type.slice(1).toLowerCase()
        } Order: ${operation} | ${pair} | amount: ${amount} ${
          limitPrice ? `| limitPrice: ${limitPrice}` : ""
        } `
      );

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
      return next(e);
    }
  }
}
export default BitfinexController;
