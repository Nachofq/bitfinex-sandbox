import WebSocket from "ws";
import { isEmpty } from "../../utils/dictUtils";
import { weightedAverageDecimal } from "../../utils/mathUtils";
import Decimal from "decimal.js";

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
    return new Promise((resolve) => {
      this.wsServer.onmessage = (msg) => this.onMessage(msg);
      this.wsServer.onerror = (err) => this.onError(err);
      this.wsServer.onopen = () => resolve(this.onOpen());
    });
  }

  subscribe(bfxSubscribeData: IBFXSubscriptionData) {
    let subscribeMsg = JSON.stringify(bfxSubscribeData);
    this.wsServer.send(subscribeMsg);
    this.suscribed = true;
  }

  close() {
    this.connected = false;
    this.suscribed = false;
    this.wsServer.close();
  }

  getOBSnapshot() {
    return new Promise((resolve, _reject) => {
      const checkBookLoop: () => void = () =>
        !isEmpty(this.orderBook.lastSnapshot)
          ? resolve(this.orderBook)
          : setTimeout(checkBookLoop);
      checkBookLoop();
    });
  }

  getOBSnapshotTips() {
    return new Promise((resolve, _reject) => {
      const checkBookLoop: () => void = () =>
        !isEmpty(this.orderBook.lastSnapshot)
          ? resolve(this.getTipsFromOB())
          : setTimeout(checkBookLoop);
      checkBookLoop();
    });
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
    return new Promise((resolve, _reject) => {
      const checkBookLoop: () => void = () =>
        !isEmpty(this.orderBook.lastSnapshot)
          ? resolve(
              this.getEffectivePriceFromOB({
                type,
                operation,
                amount,
                ...(limitPrice && { limitPrice }),
              })
            )
          : setTimeout(checkBookLoop);
      checkBookLoop();
    });
  }

  private onOpen() {
    this.connected = true;
    console.log("BFX WS connection accepted");
  }

  private onError(err: WebSocket.ErrorEvent) {
    console.log("WS Error:", err.message);
  }

  private onMessage(msg: WebSocket.MessageEvent) {
    const data = JSON.parse(msg.data.toString());
    if (this.orderBook.messageCount > 0) this.close();
    if (data.event) console.log("Event:", data);
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
  }

  private handleBookData(bfxData: any) {
    //TODO replace any for proper interface
    // data[0]: Channel ID
    // data[1]: sequence or book data.
    // First ws message: data[1] = ['channelId', number[][]] orderbook snapshot
    // Following messages: data[1] = ['channelId', number[]] orderbook single price update
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
  }

  private getTipsFromOB() {
    const bidPrices = this.getSortedBidsFromOB();
    const askPrices = this.getSortedAsksFromOB();
    return { bidTip: bidPrices[0], askTip: askPrices[0] };
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
    if (type !== "MARKET") {
      return `Operation of type ${type} not supported`;
    }
    if (operation !== "BUY" && operation !== "SELL")
      return `Action ${operation} not supported`;

    let orders: Decimal[][];
    let limitPriceDecimal: Decimal | undefined;
    if (limitPrice) limitPriceDecimal = new Decimal(limitPrice);

    if (operation === "BUY") {
      orders = this.getSortedAsksFromOB();
      if (limitPriceDecimal && limitPriceDecimal.lt(orders[0][0]))
        return `Limit price ${limitPrice} can not be less than ask tip ${orders[0][0]}`;
    } else {
      orders = this.getSortedBidsFromOB();
      if (limitPriceDecimal && limitPriceDecimal.gt(orders[0][0]))
        return `Limit price ${limitPrice} can not be higher than bid tip ${orders[0][0]}`;
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
      // console.log("----------------"); // TODO migrate to logger
      // console.log("Non Filled:", nonFilledAmount);
      // console.log("Current level amount", orders[priceLevelCounter][2]);
      // console.log("Counter:", priceLevelCounter);
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

    return {
      operation,
      amount,
      filledAmount,
      totalBookVolume,
      effectivePrice: weightedAverageDecimal(filledAmountsAtPrice),
      debug: { orders },
    };
  }

  private getSortedBidsFromOB() {
    const ob2Array = Object.entries(this.orderBook.lastSnapshot);
    return ob2Array
      .filter((priceLevel) => priceLevel[1][1] > 0)
      .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
      .map((priceLevel) => [
        new Decimal(priceLevel[0]),
        new Decimal(priceLevel[1][0]),
        new Decimal(priceLevel[1][1]),
      ]);
  }

  private getSortedAsksFromOB() {
    const ob2Array = Object.entries(this.orderBook.lastSnapshot);
    return ob2Array
      .filter((priceLevel) => priceLevel[1][1] < 0)
      .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
      .map((priceLevel) => [
        new Decimal(priceLevel[0]),
        new Decimal(priceLevel[1][0]),
        new Decimal(Math.abs(priceLevel[1][1])),
      ]);
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
