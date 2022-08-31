import WebSocket from "ws";
import { isEmpty } from "../../utils/dictUtils";
import { weightedAverage } from "../../utils/mathUtils";

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
    console.log({ limitPrice });
    let orders;

    if (operation === "BUY") {
      orders = this.getSortedAsksFromOB();
      if (limitPrice && limitPrice < orders[0][0])
        return `Limit price ${limitPrice} can not be less than ask tip ${orders[0][0]}`;
    } else {
      orders = this.getSortedBidsFromOB();
      if (limitPrice && limitPrice > orders[0][0])
        return `Limit price ${limitPrice} can not be higher than bid tip ${orders[0][0]}`;
    }

    const totalBookVolume = orders.reduce(
      (partialSum, a) => partialSum + a[2],
      0
    );
    // if (amount > Math.abs(totalVolume))
    //   return `Not enough liquidity. Current volume in orderbook ${Math.abs(
    //     totalVolume
    //   ).toFixed(2)}. Buy amount ${amount}`;

    let nonFilledAmount: number = amount;
    let filledAmount: number = 0;
    let filledAmountsAtPrice: number[][] = [];
    let priceLevelCounter = 0;

    while (
      nonFilledAmount !== 0 && // stop if nonFilled === 0 AND
      priceLevelCounter < orders.length && // stop if the orderbook has no more price levels AND
      !this.limitPriceCrossedOver({
        limitPrice,
        operation,
        currentPrice: orders[priceLevelCounter][0],
      }) // stop if limitPrice is set and current price level is Higher/Lower (Ask/Bid)
    ) {
      // console.log("----------------");
      // console.log("Non Filled:", nonFilledAmount);
      // console.log("Current level amount", orders[priceLevelCounter][2]);
      // console.log("Counter:", priceLevelCounter);
      if (nonFilledAmount > orders[priceLevelCounter][2]) {
        filledAmountsAtPrice.push([
          orders[priceLevelCounter][0],
          orders[priceLevelCounter][2],
        ]);
        nonFilledAmount -= orders[priceLevelCounter][2];
        filledAmount += orders[priceLevelCounter][2];
        priceLevelCounter += 1;
      } else {
        // when nonFilled is less than current priceLevel
        filledAmountsAtPrice.push([
          orders[priceLevelCounter][0],
          nonFilledAmount,
        ]);
        filledAmount += nonFilledAmount;
        nonFilledAmount = 0;
      }
    }

    return {
      operation,
      amount,
      filledAmount,
      totalBookVolume,
      effectivePrice: weightedAverage(filledAmountsAtPrice),
      debug: { orders },
    };
  }

  private getSortedBidsFromOB() {
    const ob2Array = Object.entries(this.orderBook.lastSnapshot);
    return ob2Array
      .filter((priceLevel) => priceLevel[1][1] > 0)
      .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
      .map((priceLevel) => [parseFloat(priceLevel[0]), ...priceLevel[1]]);
  }

  private getSortedAsksFromOB() {
    const ob2Array = Object.entries(this.orderBook.lastSnapshot);
    return ob2Array
      .filter((priceLevel) => priceLevel[1][1] < 0)
      .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
      .map((priceLevel) => [
        parseFloat(priceLevel[0]),
        priceLevel[1][0],
        Math.abs(priceLevel[1][1]),
      ]);
  }

  private limitPriceCrossedOver({
    limitPrice,
    currentPrice,
    operation,
  }: {
    limitPrice?: number;
    currentPrice: number;
    operation: string;
  }) {
    if (!limitPrice) return true;
    if (operation === "BUY") return limitPrice < currentPrice;
    if (operation === "SELL") return limitPrice > currentPrice;
  }
}
