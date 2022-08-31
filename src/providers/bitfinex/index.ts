import WebSocket from "ws";
import { isEmpty } from "../../utils/dictUtils";

const BFX_WEBSOCKET_ADDRESS = "wss://api-pub.bitfinex.com/ws/2";

interface IBFXSubscriptionData {
  event: string;
  channel: string;
  symbol: string;
  frequency: string;
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
    lastSnapshot: any;
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
    console.log(this.orderBook.messageCount);
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
}
