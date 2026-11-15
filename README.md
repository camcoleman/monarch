# MONARCH

**Trade. Conquer. Rule.** A competitive BTC paper-trading game on Monad Testnet: win 90-second 1v1 trading battles to capture US states.

## Layout

| Folder | What it is |
| --- | --- |
| `contracts/` | Foundry project. `Monarch.sol` records players, battle settlements, trophies, gold, and state ownership. |
| `server/` | Node referee. Streams BTC-USD from Coinbase, runs battles over Socket.IO, settles results on-chain with viem. |
| `web/` | Next.js app: wallet + registration, paper trading, conquest map, battle screen, leaderboard. |
| `shared/` | ABI, state list, game constants, and Socket.IO event types used by both `server` and `web`. |

```
Coinbase WS -> server (price feed -> battle engine -> settler) -> Monarch.sol
                   ^ Socket.IO                                       ^ reads + register()
                   web --------------------------------------------- +
```

## Setup

Requires Node 22+, pnpm, and [Foundry](https://book.getfoundry.sh/getting-started/installation).

```bash
pnpm install
pnpm test:contracts
```

## Deploy to Monad Testnet

1. Create two wallets (deployer and referee) and fund both from the [faucet](https://faucet.monad.xyz). The referee pays gas for every settlement.
2. Deploy:

   ```bash
   cd contracts
   REFEREE_ADDRESS=0xYourRefereeAddress forge script script/Deploy.s.sol \
     --rpc-url monad --private-key $DEPLOYER_KEY --broadcast
   ```

3. Configure and start the referee:

   ```bash
   cp server/.env.example server/.env   # set CONTRACT_ADDRESS and REFEREE_PRIVATE_KEY
   pnpm dev:server
   ```

4. Configure and start the web app:

   ```bash
   cp web/.env.example web/.env.local   # set NEXT_PUBLIC_MONARCH_ADDRESS
   pnpm dev:web                         # http://localhost:3000
   ```

`pnpm dev` runs both. After changing `Monarch.sol`, run `pnpm abi` to regenerate `shared/src/abi.ts`.

## Local development without testnet

Run the whole stack against a local Anvil chain that pretends to be Monad:

```bash
anvil --chain-id 10143
# deploy with anvil account 0 as deployer + referee
cd contracts && REFEREE_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast
```

Then set `RPC_URL=http://127.0.0.1:8545` in `server/.env` and `NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545` in `web/.env.local`, and import Anvil accounts into your wallet.

Useful server knobs:

- `PRICE_MODE=mock` uses a volatile random walk instead of Coinbase (offline, or when BTC is flat during a demo).
- `ROUND_SECONDS` / `PICK_SECONDS` shorten battles for testing.
- `pnpm --filter ./server simulate [stateId] [addrA] [addrB]` plays a full scripted battle between two registered addresses.

Leaving `CONTRACT_ADDRESS` empty runs the server with no chain: battles still work but nothing is settled.

## Game rules

- Paper trading: $10,000 virtual balance (stored in the browser), long/short BTC up to 10x, liquidation at -100% of margin.
- Battles: both players get the same entry price, pick long/short and 1-5x leverage within 15 seconds (default long 1x), then the 90-second round runs on live prices. Highest return wins.
- Ties go to the defending ruler, or the challenger who created the battle if the state was neutral.
- An owned state can only change hands in a battle that includes its ruler. One battle per state at a time; unaccepted challenges expire after 5 minutes.
- A win is worth +25 trophies, +100 gold, and the state.

State IDs: 0 CA, 1 OR, 2 WA, 3 TX, 4 FL, 5 NY, 6 CO, 7 IL.

## Demo script

1. Two browsers, two wallets. Register both.
2. Show a quick paper trade on **Trade**.
3. On **Conquest**, select California and declare war. Send the battle link to the second browser.
4. Accept, both pick a side and leverage, watch the 90-second round.
5. Open the settlement transaction from the result screen.
6. Back on the map, California is now the winner's color; the leaderboard updates.

## Known MVP limits

- The referee is trusted: it decides prices and results, and game state lives in its memory.
- Socket.IO actions are not signed, so a client could act for an address it does not control. Adding a `signMessage` check on join/pick is the next hardening step.
