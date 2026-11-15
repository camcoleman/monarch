"use client";

import { useEffect } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { BUILDINGS, FAUCET_URL, MAX_BUILDING_LEVEL, goldPerWin, monadTestnet, monarchAbi, upgradeCost } from "@monarch/shared";
import { MONARCH_ADDRESS, explorerTx } from "@/lib/config";
import { friendlyError } from "@/lib/errors";

interface Props {
  buildingId: number;
  levels: number[];
  gold: number;
  onClose: () => void;
  onUpgraded: () => void;
}

export function BuildingPanel({ buildingId, levels, gold, onClose, onUpgraded }: Props) {
  const building = BUILDINGS[buildingId];
  const level = levels[buildingId];
  const townHall = levels[0];
  const cost = upgradeCost(buildingId, level);
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash, chainId: monadTestnet.id });

  useEffect(() => {
    if (receipt.isSuccess) onUpgraded();
  }, [receipt.isSuccess, onUpgraded]);

  useEffect(() => reset(), [buildingId, reset]);

  const blocked =
    level >= MAX_BUILDING_LEVEL
      ? "Max level reached"
      : buildingId !== 0 && level >= townHall
        ? `Requires Town Hall level ${level + 1}`
        : gold < cost
          ? `Need ${cost - gold} more gold - win a battle!`
          : null;

  const busy = isPending || receipt.isLoading;
  const message = error ? friendlyError(error) : null;

  return (
    <div className="panel relative space-y-3 p-5">
      <button onClick={onClose} className="absolute right-3 top-2 text-xl text-zinc-500 hover:text-zinc-200" aria-label="Close">
        ×
      </button>
      <div className="flex items-center gap-4">
        <img src={`/village/${building.key}.png`} alt="" className="h-20 w-20 object-contain" />
        <div>
          <h3 className="font-display text-2xl text-gold">{building.name}</h3>
          <p className="text-sm text-zinc-400">
            Level {level} / {MAX_BUILDING_LEVEL}
          </p>
          <div className="mt-1 flex gap-1">
            {Array.from({ length: MAX_BUILDING_LEVEL }, (_, i) => (
              <span key={i} className={`h-1.5 w-6 rounded-full ${i < level ? "bg-gold" : "bg-edge"}`} />
            ))}
          </div>
        </div>
      </div>
      <p className="text-sm text-zinc-300">{building.description}</p>
      {buildingId === 1 && (
        <p className="text-sm text-amber-300">
          Victory reward: {goldPerWin(level)} gold
          {level < MAX_BUILDING_LEVEL && ` (next level: ${goldPerWin(level + 1)})`}
        </p>
      )}

      {level < MAX_BUILDING_LEVEL && (
        <button
          className="btn-gold w-full text-lg"
          disabled={!!blocked || busy || !MONARCH_ADDRESS}
          onClick={() =>
            writeContract({
              address: MONARCH_ADDRESS!,
              abi: monarchAbi,
              functionName: "upgrade",
              args: [buildingId],
              chainId: monadTestnet.id,
            })
          }
        >
          {isPending ? "Confirm in wallet..." : receipt.isLoading ? "Building..." : `Upgrade to level ${level + 1} · 🪙 ${cost}`}
        </button>
      )}
      {blocked && <p className="text-sm text-zinc-400">{blocked}</p>}
      {message && (
        <p className="text-sm text-red-400">
          {message}
          {message.includes("faucet") && (
            <>
              {" "}
              <a className="text-royal underline" href={FAUCET_URL} target="_blank" rel="noreferrer">
                Open faucet
              </a>
            </>
          )}
        </p>
      )}
      {receipt.isSuccess && hash && (
        <p className="text-sm text-up">
          Upgraded!{" "}
          <a className="text-royal underline" href={explorerTx(hash)} target="_blank" rel="noreferrer">
            View on Monad explorer
          </a>
        </p>
      )}
    </div>
  );
}
