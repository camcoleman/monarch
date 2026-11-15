import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  zeroAddress,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { monadTestnet, monarchAbi } from "@monarch/shared";
import type { Config } from "./config";

export interface SettleArgs {
  onchainId: Hex;
  stateId: number;
  winner: string;
  loser: string;
  winnerBps: number;
  loserBps: number;
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

  async getStateOwner(stateId: number): Promise<string | null> {
    if (!this.publicClient || !this.address) return null;
    const owner = await this.publicClient.readContract({
      address: this.address,
      abi: monarchAbi,
      functionName: "stateOwner",
      args: [stateId],
    });
    return owner === zeroAddress ? null : owner.toLowerCase();
  }

  /** On-chain name, null if unregistered, undefined when running without a contract. */
  async getPlayerName(player: string): Promise<string | null | undefined> {
    if (!this.publicClient || !this.address) return undefined;
    const [name, , , , , , exists] = await this.publicClient.readContract({
      address: this.address,
      abi: monarchAbi,
      functionName: "players",
      args: [getAddress(player)],
    });
    return exists ? name : null;
  }

  /** True if `signature` is `player`'s signature of `message`. Always true when running without a chain. */
  async verify(player: string, message: string, signature: string): Promise<boolean> {
    if (!this.publicClient) return true;
    if (!/^0x[0-9a-fA-F]+$/.test(signature)) return false;
    try {
      return await this.publicClient.verifyMessage({
        address: getAddress(player),
        message,
        signature: signature as Hex,
      });
    } catch {
      return false;
    }
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
      args: [a.onchainId, a.stateId, getAddress(a.winner), getAddress(a.loser), a.winnerBps, a.loserBps],
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
