# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

MONARCH is a Clash of Clans style crypto trading game on Monad Testnet (chain ID 10143): players build a village and win 30-second 1v1 trading battles for gold, trophies and territory. The Town Hall level unlocks tradable coins (`ASSETS` in `shared`). It is a pnpm workspace (`shared`, `server`, `web`) plus a Foundry project (`contracts`). README.md covers deploy steps, local Anvil setup, and game rules.

## Commands

Requires Node 22+, pnpm, and Foundry.

```bash
pnpm install
pnpm dev                 # server (:4000) + web (:3000) in parallel
pnpm dev:server          # tsx watch server/src/index.ts
pnpm dev:web             # next dev
pnpm build:web
pnpm typecheck           # tsc --noEmit in every workspace package (no lint or JS test suite exists)
pnpm test:contracts      # forge test in contracts/
cd contracts && forge test --match-test <testName> -vvv   # single contract test
pnpm abi                 # regenerate shared/src/abi.ts from Monarch.sol
pnpm --filter ./server simulate [stateId] [addrA] [addrB] # scripted full battle against a running server
```

## Architecture

```
Coinbase WS -> server (PriceFeed -> BattleManager -> Chain) -> Monarch.sol
                  ^ Socket.IO                                    ^ reads + register()
                  web ------------------------------------------ +
```

- **`shared/`** is consumed as raw TypeScript (`main: src/index.ts`, no build step). It holds the generated `monarchAbi`, the `monadTestnet` chain definition, `STATES`, game constants, `computeReturnPct`, and the typed Socket.IO contract (`ClientToServerEvents` / `ServerToClientEvents`). Any new socket event or payload change goes here first; both server and web are typed against it.
- **`shared/src/abi.ts` is generated.** Never hand-edit it; change `contracts/src/Monarch.sol` and run `pnpm abi` (runs `forge inspect Monarch abi`).
- **State IDs must stay in sync** across `STATE_COUNT` in `Monarch.sol`, the `STATES` array in `shared` (array index = on-chain ID; `fips` maps to us-atlas features for the map), and the README.
- **Server is the trusted referee** (`server/src/`):
  - `priceFeed.ts` — single price source for every coin in `ASSETS` (one Coinbase subscription); emits a multi-asset `tick` every 500 ms so every client and battle sees identical prices. `PRICE_MODE=mock` swaps Coinbase for a random walk.
  - `battles.ts` — `BattleManager` holds all battles in memory (lost on restart). Phases: `lobby` → `picking` → `live` → `ended`. Picks are hidden from `BattleView` until `live`; Each pick is an asset, side and leverage; the asset must be in the player's Town Hall unlocks, and returns use that asset's entry price. Unpicked players default to long BTC 1x. `mode: "practice"` battles (`battle:practice`) pit a player or guest against `BOT_PLAYER`, unlock everything, skip signatures, never settle, and are hidden from the live feed and matchmaking. Ties go to the defender (or creator if neutral). Lobbies expire after 5 min, ended battles are dropped after 30 min. On-chain battle ID is `keccak256(toHex(id))`.
  - `chain.ts` — viem reads (`players`, `stateOwner`) and `settleBattle` writes. Settlements are serialized through a promise queue to avoid nonce races, with one retry. With no `CONTRACT_ADDRESS`, `getPlayerName` returns `undefined` (registration check skipped) and settlement is disabled, so battles still run off-chain.
  - `index.ts` — wires Socket.IO handlers through `respond()`, which always answers the ack even if a handler throws. Also serves `GET /health`.
- **Contract rules the server mirrors:** only the referee can settle; both players must be registered; an owned state can only change hands in a battle including its current owner (`OwnerNotInBattle`). The server pre-checks the same rules on create/join so failures surface before a battle runs.
- **Web** (Next.js 15 App Router, React 19, wagmi/RainbowKit, Tailwind v4): `lib/socket.ts` is a singleton socket; `lib/priceStore.ts` and `hooks/useOpenBattles.ts` are module-level stores exposed via `useSyncExternalStore`. Contract reads go through wagmi in `hooks/useMonarch.ts` and refetch on the `chain:updated` socket event. Paper trading (`app/trade`) is purely client-side with balance in browser storage; only battles touch the server. `@/` resolves to `web/`.

## Configuration

- `server/.env` (from `.env.example`): `CONTRACT_ADDRESS`, `REFEREE_PRIVATE_KEY` (must match the referee passed to the `Monarch` constructor), `RPC_URL`, `PRICE_MODE`, `ROUND_SECONDS`, `PICK_SECONDS`, `PORT`, `CORS_ORIGIN`.
- `web/.env.local`: `NEXT_PUBLIC_MONARCH_ADDRESS`, `NEXT_PUBLIC_SERVER_URL`, optional `NEXT_PUBLIC_RPC_URL` (e.g. local Anvil), `NEXT_PUBLIC_WC_PROJECT_ID`.
- For local Anvil, run `anvil --chain-id 10143` so the shared `monadTestnet` chain definition still matches.

## Known MVP limits

Socket.IO actions are unsigned (a client can act for any address), and game state lives only in server memory. Adding a `signMessage` check on join/pick is the planned next hardening step.
