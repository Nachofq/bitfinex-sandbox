import WebSocket from "ws";
import { isEmpty } from "../../utils/dictUtils";
import { weightedAverageDecimal } from "../../utils/mathUtils";
import Decimal from "decimal.js";
import BadRequest from "../../exceptions/BadRequest";
import { logger } from "../../utils/logger";

const BFX_WEBSOCKET_ADDRESS = "wss://api-pub.bitfinex.com/ws/2";

interface IBFXSubscriptionData {
  event: string;
  channel: string;
  symbol: string;
  freq: string;
  len: string;
  prec: string;
}

export class BitfinexProvider {
  wsServer: WebSocket = new WebSocket(BFX_WEBSOCKET_ADDRESS);
  connected: boolean = false;
  suscribed: boolean = false;
  channel: string = "";
  channelId: number | null = null;
  orderBook: {
    lastSnapshot: { [key: string]: number[] };
    messageCount: number;
  } = { lastSnapshot: {}, messageCount: 0 };

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.wsServer.onmessage = (msg) => this.onMessage(msg);
        this.wsServer.onerror = (err) => this.onError(err);
        this.wsServer.onopen = () => resolve(this.onOpen());
      } catch (e) {
        logger.error(e);
        reject(e);
      }
    });
  }

  subscribe(bfxSubscribeData: IBFXSubscriptionData) {
    try {
      let subscribeMsg = JSON.stringify(bfxSubscribeData);
      this.wsServer.send(subscribeMsg);
      this.suscribed = true;
    } catch (e) {
      throw e;
    }
  }

  close() {
    try {
      this.connected = false;
      this.suscribed = false;
      this.wsServer.close();
    } catch (e) {
      throw e;
    }
  }

  getOBSnapshot() {
    try {
      return new Promise((resolve, _reject) => {
        const checkBookLoop: () => void = () =>
          !isEmpty(this.orderBook.lastSnapshot)
            ? resolve(this.orderBook)
            : setTimeout(checkBookLoop);
        checkBookLoop();
      });
    } catch (e) {
      throw e;
    }
  }

  getOBSnapshotTips() {
    try {
      return new Promise((resolve, _reject) => {
        const checkBookLoop: () => void = () =>
          !isEmpty(this.orderBook.lastSnapshot)
            ? resolve(this.getTipsFromOB())
            : setTimeout(checkBookLoop);
        checkBookLoop();
      });
    } catch (e) {
      throw e;
    }
  }

  getEffectivePrice({
    type,
    operation,
    amount,
    limitPrice,
  }: {
    type: string;
    operation: string;
    amount: number;
    limitPrice?: number;
  }) {
    return new Promise((resolve, reject) => {
      const checkBookLoop: () => void = () => {
        if (!isEmpty(this.orderBook.lastSnapshot)) {
          try {
            resolve(
              this.getEffectivePriceFromOB({
                type,
                operation,
                amount,
                ...(limitPrice && { limitPrice }),
              })
            );
          } catch (e: any) {
            reject(e);
          }
        } else setTimeout(checkBookLoop);
      };
      checkBookLoop();
    });
  }

  private onOpen() {
    this.connected = true;
    logger.info(`Bitfinex ws provider connected`);
  }

  private onError(err: WebSocket.ErrorEvent) {
    logger.error("WS Error:", err.message);
  }

  private onMessage(msg: WebSocket.MessageEvent) {
    try {
      const data = JSON.parse(msg.data.toString());
      if (this.orderBook.messageCount > 0) this.close();
      if (data.event) logger.info("Bfx ws event:", JSON.stringify(data));
      if (data.event === "subscribed") {
        this.suscribed = true;
        this.channel = data.channel;
        this.channelId = data.chanId;
        return;
      }
      switch (this.channel) {
        case "book":
          this.handleBookData(data);
          break;
      }
    } catch (e) {
      throw e;
    }
  }

  private handleBookData(bfxData: any) {
    try {
      let channelId = bfxData[0];
      let data = bfxData[1];
      if (data === "hb") return;
      if (data === "cs") return;
      if (channelId === this.channelId) {
        if (this.orderBook.messageCount === 0) {
          data.forEach((priceLevel: any) => {
            this.orderBook.lastSnapshot[priceLevel[0]] = priceLevel.slice(1);
          });
          this.orderBook.messageCount += 1;
        } else {
          this.orderBook.lastSnapshot[data[0]] = data.slice(1);
          this.orderBook.messageCount += 1;
        }
        return;
      }
    } catch (e) {
      throw e;
    }
  }

  private getTipsFromOB() {
    try {
      const bidPrices = this.getSortedBidsFromOB();
      const askPrices = this.getSortedAsksFromOB();
      const result = { bidTip: bidPrices[0], askTip: askPrices[0] };
      logger.info("Tips retrieved: ", JSON.stringify(result));
      return result;
    } catch (e) {
      throw e;
    }
  }

  private getEffectivePriceFromOB({
    type,
    operation,
    amount,
    limitPrice,
  }: {
    type: string;
    operation: string;
    amount: number;
    limitPrice?: number;
  }) {
    try {
      if (type !== "MARKET") {
        throw new BadRequest(`Operation of type ${type} not supported`);
      }
      if (operation !== "BUY" && operation !== "SELL")
        throw new BadRequest(`Action ${operation} not supported`);

      let orders: Decimal[][];
      let limitPriceDecimal: Decimal | undefined;
      if (limitPrice) limitPriceDecimal = new Decimal(limitPrice);

      if (operation === "BUY") {
        orders = this.getSortedAsksFromOB();
        if (limitPriceDecimal && limitPriceDecimal.lt(orders[0][0]))
          throw new BadRequest(
            `Limit price ${limitPrice} can not be less than ask tip ${orders[0][0]}`
          );
      } else {
        orders = this.getSortedBidsFromOB();
        if (limitPriceDecimal && limitPriceDecimal.gt(orders[0][0]))
          throw new BadRequest(
            `Limit price ${limitPrice} can not be higher than bid tip ${orders[0][0]}`
          );
      }

      let totalBookVolume = new Decimal(0);
      for (let i = 0; i < orders.length; i++) {
        totalBookVolume = totalBookVolume.add(orders[i][2]);
      }

      let nonFilledAmount = new Decimal(amount);
      let filledAmount = new Decimal(0);
      let filledAmountsAtPrice: Decimal[][] = [];
      let priceLevelCounter = 0;

      while (
        !nonFilledAmount.eq(0) && // Continue if there some more amount to fill AND
        priceLevelCounter < orders.length && // If there are still price levels to consume amount from
        !this.limitPriceCrossedOver({
          limitPrice: limitPriceDecimal,
          operation,
          currentPrice: orders[priceLevelCounter][0],
        }) // AND if currentPrice level is above/below limitPrice (sell/buy respectively)
      ) {
        if (nonFilledAmount.gt(orders[priceLevelCounter][2])) {
          filledAmountsAtPrice.push([
            orders[priceLevelCounter][0],
            orders[priceLevelCounter][2],
          ]);
          nonFilledAmount = nonFilledAmount.sub(orders[priceLevelCounter][2]);
          filledAmount = filledAmount.add(orders[priceLevelCounter][2]);
          priceLevelCounter += 1;
        } else {
          // when nonFilled is less than current priceLevel
          filledAmountsAtPrice.push([
            orders[priceLevelCounter][0],
            nonFilledAmount,
          ]);
          filledAmount = filledAmount.add(nonFilledAmount);
          nonFilledAmount = new Decimal(0);
        }
      }
      const effectivePrice = weightedAverageDecimal(filledAmountsAtPrice);
      logger.info(
        `Market Ordert executed: ${operation} | requested: ${amount} | filled: ${filledAmount} | bookVolume: ${totalBookVolume} | effPrice: ${effectivePrice}`
      );
      return {
        operation,
        amount,
        filledAmount,
        totalBookVolume,
        effectivePrice,
        debug: { orders },
      };
    } catch (e: any) {
      throw e;
    }
  }

  private getSortedBidsFromOB() {
    try {
      const ob2Array = Object.entries(this.orderBook.lastSnapshot);
      return ob2Array
        .filter((priceLevel) => priceLevel[1][1] > 0)
        .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
        .map((priceLevel) => [
          new Decimal(priceLevel[0]),
          new Decimal(priceLevel[1][0]),
          new Decimal(priceLevel[1][1]),
        ]);
    } catch (e) {
      throw e;
    }
  }

  private getSortedAsksFromOB() {
    try {
      const ob2Array = Object.entries(this.orderBook.lastSnapshot);
      return ob2Array
        .filter((priceLevel) => priceLevel[1][1] < 0)
        .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
        .map((priceLevel) => [
          new Decimal(priceLevel[0]),
          new Decimal(priceLevel[1][0]),
          new Decimal(Math.abs(priceLevel[1][1])),
        ]);
    } catch (e) {
      throw e;
    }
  }

  private limitPriceCrossedOver({
    limitPrice,
    currentPrice,
    operation,
  }: {
    limitPrice?: Decimal;
    currentPrice: Decimal;
    operation: string;
  }) {
    if (!limitPrice) {
      return false; // if limitPrice is not present, limitPriceCrossedOver is never true.
    }
    if (operation === "BUY") return limitPrice.lt(currentPrice);
    if (operation === "SELL") return limitPrice.gt(currentPrice);
  }
}
