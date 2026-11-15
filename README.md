# MONARCH

**Trade. Conquer. Rule.** A competitive BTC paper-trading game on Monad Testnet: win 90-second 1v1 trading battles to capture US states.

**Monad Testnet contract:** [`0x6F13287544819FfB03638247C7950d0487fE7898`](https://testnet.monadexplorer.com/address/0x6F13287544819FfB03638247C7950d0487fE7898)

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
   set -a; source .env; set +a          # DEPLOYER_KEY, REFEREE_ADDRESS (gitignored)
   forge script script/Deploy.s.sol --rpc-url monad --private-key $DEPLOYER_KEY --broadcast
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
- `pnpm --filter ./server simulate [stateId]` plays a full scripted, signed battle between the wallets in `SIM_KEY_A` / `SIM_KEY_B` (defaults: Anvil accounts 1 and 2). Both must be registered.

Leaving `CONTRACT_ADDRESS` empty runs the server with no chain: battles still work but nothing is settled.

## Game rules

- Paper trading: $10,000 virtual balance (stored in the browser), long/short BTC up to 10x, liquidation at -100% of margin.
- Battles: both players get the same entry price, pick long/short and 1-5x leverage within 15 seconds (default long 1x), then the 90-second round runs on live prices. Highest return wins.
- Ties go to the defending ruler, or the challenger who created the battle if the state was neutral.
- An owned state can only change hands in a battle that includes its ruler. One battle per state at a time; unaccepted challenges expire after 5 minutes.
- A win is worth +25 trophies, +100 gold (more with a Gold Mine), and the state, unless the winner was the defender, who keeps it.

State IDs: 0 CA, 1 OR, 2 WA, 3 TX, 4 FL, 5 NY, 6 CO, 7 IL.

### Village

Registered players land on their village: an isometric base showing their buildings and one castle per conquered state. Players start with 200 gold and every building at level 1. Upgrades are on-chain (`upgrade(building)`) and cost `baseCost x nextLevel` gold, up to level 5. No building can be higher level than the Town Hall.

| Building | Base cost | Effect |
| --- | --- | --- |
| Town Hall | 100 | Caps every other building's level |
| Gold Mine | 60 | +20 gold per win for each level above 1 |
| Barracks | 50 | Cosmetic (army size) |
| Trophy Hall | 80 | Cosmetic (prestige) |

Anyone's village can be scouted read-only at `/kingdom/<address>` (linked from the leaderboard).

### Signed actions

Declaring war, accepting a battle, and locking in a pick each require a wallet signature (`signMessage`). The referee verifies it with viem before acting, so nobody can play as an address they don't control. War declarations include a timestamp and expire after 5 minutes.

## Demo script

1. Two browsers, two wallets. Register both; each lands on their village.
2. Upgrade the Town Hall from the village to show an on-chain upgrade, then a quick paper trade on **Trade**.
3. On **Conquest**, select California and declare war. Send the battle link to the second browser.
4. Accept, both pick a side and leverage, watch the 90-second round.
5. Open the settlement transaction from the result screen.
6. Back on the map, California is now the winner's color; the leaderboard updates.

## Known MVP limits

- The referee is trusted: it decides prices and results, and game state lives in its memory.
- Join and pick signatures have no timestamp, so they are only bound to one battle id (which is single-use).
