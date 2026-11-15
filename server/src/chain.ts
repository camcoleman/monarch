import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  recoverMessageAddress,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { ARENA_MAX_LEVERAGE, MAX_BUILDING_LEVEL, NO_REALM, monadTestnet, monarchAbi } from "@monarch/shared";
import type { Config } from "./config";

export interface SettleArgs {
  onchainId: Hex;
  winner: string;
  loser: string;
  winnerBps: number;
  loserBps: number;
  /** Realm fought over, or NO_REALM for matchmade battles. */
  realm: number;
}

/** Reads game state from Monarch.sol and submits referee settlements one at a time. */
export class Chain {
  private readonly publicClient?: PublicClient;
  private readonly walletClient?: WalletClient;
  private readonly account?: PrivateKeyAccount;
  private readonly address?: Hex;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(config: Config) {
    if (!config.contractAddress) {
      console.warn("[chain] CONTRACT_ADDRESS not set: registration checks and settlement disabled");
      return;
    }
    this.address = config.contractAddress;
    const transport = http(config.rpcUrl);
    this.publicClient = createPublicClient({ chain: monadTestnet, transport });

    if (!config.refereeKey) {
      console.warn("[chain] REFEREE_PRIVATE_KEY not set: settlement disabled");
      return;
    }
    this.account = privateKeyToAccount(config.refereeKey);
    this.walletClient = createWalletClient({ chain: monadTestnet, transport, account: this.account });
    console.log(`[chain] referee ${this.account.address} settling to ${this.address}`);
  }

  get enabled() {
    return Boolean(this.publicClient);
  }

  /** True when battle results can be written on-chain. */
  get canSettle() {
    return Boolean(this.walletClient);
  }

  /** Town Hall level, which decides the assets a player can trade. Max level without a contract. */
  async getTownHallLevel(player: string): Promise<number> {
    if (!this.publicClient || !this.address) return MAX_BUILDING_LEVEL;
    const levels = await this.publicClient.readContract({
      address: this.address,
      abi: monarchAbi,
      functionName: "getBuildings",
      args: [getAddress(player)],
    });
    return levels[0];
  }

  /** Current owner of a realm, or null if neutral / unavailable. */
  async getRealmOwner(realm: number): Promise<string | null> {
    if (!this.publicClient || !this.address) return null;
    const owner = await this.publicClient.readContract({
      address: this.address,
      abi: monarchAbi,
      functionName: "realmOwner",
      args: [realm],
    });
    return owner === "0x0000000000000000000000000000000000000000" ? null : owner.toLowerCase();
  }

  /** Battle leverage cap from the player's Barracks. */
  async getMaxLeverage(player: string): Promise<number> {
    if (!this.publicClient || !this.address) return ARENA_MAX_LEVERAGE;
    return this.publicClient.readContract({
      address: this.address,
      abi: monarchAbi,
      functionName: "maxLeverage",
      args: [getAddress(player)],
    });
  }

  /** On-chain name, null if unregistered, undefined when running without a contract. */
  async getPlayerName(player: string): Promise<string | null | undefined> {
    if (!this.publicClient || !this.address) return undefined;
    const [name, , , , , , , exists] = await this.publicClient.readContract({
      address: this.address,
      abi: monarchAbi,
      functionName: "players",
      args: [getAddress(player)],
    });
    return exists ? name : null;
  }

  /**
   * True if `message` was signed by `player` or by a live session key acting for `player`.
   * Always true when running without a chain.
   */
  async verify(player: string, message: string, signature: string): Promise<boolean> {
    if (!this.publicClient || !this.address) return true;
    if (!/^0x[0-9a-fA-F]+$/.test(signature)) return false;
    let signer: string;
    try {
      signer = await recoverMessageAddress({ message, signature: signature as Hex });
    } catch {
      return false;
    }
    if (signer.toLowerCase() === player.toLowerCase()) return true;
    const actsFor = await this.publicClient.readContract({
      address: this.address,
      abi: monarchAbi,
      functionName: "playerOf",
      args: [getAddress(signer)],
    });
    return actsFor.toLowerCase() === player.toLowerCase();
  }

  /** Serialized so concurrent battles never race on the referee nonce. Retries once. */
  settle(args: SettleArgs): Promise<Hex> {
    const run = () =>
      this.sendSettle(args).catch((err) => {
        if (!this.walletClient) throw err;
        console.warn("[chain] settlement failed, retrying once:", errMessage(err));
        return this.sendSettle(args);
      });
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async sendSettle(a: SettleArgs): Promise<Hex> {
    if (!this.walletClient || !this.publicClient || !this.address || !this.account) {
      throw new Error("Settlement disabled: set CONTRACT_ADDRESS and REFEREE_PRIVATE_KEY on the server");
    }
    const hash = await this.walletClient.writeContract({
      address: this.address,
      abi: monarchAbi,
      functionName: "settleBattle",
      args: [a.onchainId, getAddress(a.winner), getAddress(a.loser), a.winnerBps, a.loserBps, a.realm ?? NO_REALM],
      account: this.account,
      chain: monadTestnet,
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`Settlement reverted: ${hash}`);
    return hash;
  }
}

export function errMessage(err: unknown): string {
  if (err && typeof err === "object" && "shortMessage" in err) return String(err.shortMessage);
  return err instanceof Error ? err.message : String(err);
}
