## Objective

 Use Express framework to set up the server.
 The API will expose two endpoints:
  - One that receives a pair name, and retrieves the tips of the orderbook (i.e. the
better prices for bid-ask). Both the total amount and prices.
  - Other endpoint that is called with the pair name, the operation type (buy/sell) and
the amount to be traded. Should return the effective price that will result if the
order is executed (i.e. evaluate Market Depth).
  - In the second endpoint, include a parameter to set a limit for the effective price and
retrieves the maximum order size that could be executed.

## Required global packages

Please install node and npm package manager. The easiest way is to get nvm and install the required node version, npm version will be automatically installed.

- installing nvm: https://github.com/nvm-sh/nvm
- node version: 16.14.0
- npm version: 8.3.1

## Production start

```sh
npm install
npm run build
npm run start

```

## Development start

```sh
npm install
npm run dev
```
## Usage examples
### Pair Tips
/bfx/pair-tips/tIOTUSD

### Market Order
/bfx/place-order?pair=tETHUSD&type=MARKET&operation=BUY&amount=500&limitPrice=1755
- pair:       required
- type:       required <MARKET>
- operation:  required <BUY|SELL> 
- amount:     required
- limitPrice: optional
