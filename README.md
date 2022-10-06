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
