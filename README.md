# MONARCH

**Trade. Conquer. Rule.** A Clash of Clans style village-builder on Monad Testnet, powered by crypto trading battles: hit Attack, out-trade your opponent over 90 seconds of live prices, and expand your territory. Upgrading your Town Hall unlocks more coins to trade.

**Monad Testnet contract:** [`0x6DD4f21c830929f04C6b9c40e2a4ad9818e27f22`](https://testnet.monadexplorer.com/address/0x6DD4f21c830929f04C6b9c40e2a4ad9818e27f22)

## Layout

| Folder | What it is |
| --- | --- |
| `contracts/` | Foundry project. `Monarch.sol` records players, bases, territory, battle settlements and history, and session keys. |
| `server/` | Node referee. Streams BTC, ETH, SOL, DOGE and MON prices from Coinbase, runs matchmaking and battles over Socket.IO, settles results on-chain with viem. |
| `web/` | Next.js app: full-screen village with HUD, matchmaking, practice battles vs a bot, battle screen, paper trading, rankings. |
| `shared/` | ABI, game constants, and Socket.IO event types used by both `server` and `web`. |

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

- `PRICE_MODE=mock` uses a volatile random walk instead of Coinbase (offline, or when prices are flat during a demo).
- `ROUND_SECONDS` / `PICK_SECONDS` shorten battles for testing.
- `pnpm --filter ./server simulate` matchmakes and plays a full scripted, signed battle between the wallets in `SIM_KEY_A` / `SIM_KEY_B` (defaults: Anvil accounts 1 and 2). Both must be registered.

Leaving `CONTRACT_ADDRESS` empty runs the server with no chain: battles still work but nothing is settled.

## Game rules

- Paper trading: $10,000 virtual balance (stored in the browser), long/short up to 10x on any coin your Town Hall has unlocked (guests get BTC), liquidation at -100% of margin.
- Matchmaking: **Attack** queues you; the next commander to hit Attack is paired with you. You can also send an open invite link, or attack a specific player from their scouted village (`/kingdom/<address>`). Unaccepted invites expire after 5 minutes.
- Battles: both players get the same entry price, each pick a coin, long/short and leverage within 15 seconds (default long BTC 1x), then the 90-second round runs on live prices. Each player's return is measured on their own coin, so a SOL long can face a DOGE short. Highest return wins; ties go to the player who accepted.
- Winner: +25 trophies (more with a Trophy Hall), +100 gold (more with a Gold Mine), 10% of the loser's gold as loot, and +1 territory plot (max 25).
- Loser: -10 trophies and -1 territory plot (never below the starting 4).
- Leagues by trophies: Bronze 0, Silver 100, Gold 250, Crystal 500, Titan 1000, Monarch 2000.

- Practice: **Attack -> Practice vs Bot**, or **Try a demo battle** on the landing page (no wallet needed), starts an off-chain round against the Training Bot. Every coin and up to 6x leverage are available, the bot picks a random trade, and nothing is settled or rewarded.

### Village

Registered players land on a full-screen village: a 5x5 territory grid with their buildings, a Clash-style HUD (profile and league top-left, resources top-right, Attack bottom-left, Shop bottom-right), a live battle feed on the left edge, and a live price ticker for the coin last picked on the trade page. Players start with 200 gold, 4 plots, and every building at level 1. Upgrades are on-chain and cost `baseCost x nextLevel` gold, up to level 5. No building can be higher level than the Town Hall.

| Building | Base cost | Effect |
| --- | --- | --- |
| Town Hall | 100 | Caps every other building's level; each level unlocks a coin (1 BTC, 2 ETH, 3 SOL, 4 DOGE, 5 MON) |
| Gold Mine | 60 | Produces 2 gold/min per level (tap to collect on-chain, cap 150 per level); +20 gold per win per level above 1 |
| Barracks | 50 | Max battle leverage = level + 1 (2x to 6x) |
| Trophy Hall | 80 | +5 trophies per win per level above 1 |

The battle log and the live feed's on-chain results are read straight from the contract (`getHistory`, `getRecentBattles`).

### Signed actions and Fast mode

Finding a match, issuing a challenge, accepting, and locking in a pick each require a signature, which the referee verifies before acting, so nobody can play as an address they don't control.

**Fast mode** removes the wallet pop-ups: the player approves one `startSession(key, expiry)` transaction, which authorizes a browser-held key for 7 days and forwards 0.05 MON to it for gas. That key signs battle actions and sends `upgrade` / `collect` itself. The contract resolves it to the player via `playerOf(key)`, and the referee accepts signatures from the player or their live session key. A session key can't register, can't move the player's funds, and can be revoked with `endSession()`.

## Demo script

1. Two browsers, two wallets. Register both; each lands on their village. (For a solo demo, hit **Try a demo battle** instead.)
2. Turn on Fast mode in one browser to show pop-up free play. Collect gold from the Gold Mine and upgrade the Town Hall to unlock ETH.
3. Hit **Attack** in both browsers - matchmaking pairs them.
4. Both pick a coin, side and leverage (the Barracks caps it), and watch the 90-second round on live prices.
5. Open the settlement transaction from the result screen.
6. Back in the village: a new territory plot lights up, the battle log shows the raid and loot, the rankings update.

## Known MVP limits

- The referee is trusted: it decides prices and results, and battle state lives in its memory.
- Join and pick signatures have no timestamp, so they are only bound to one battle id.
- Session keys live in browser `localStorage`; clearing it just means re-enabling Fast mode.
