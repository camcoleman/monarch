const CONTRACT_ERRORS: Record<string, string> = {
  NotEnoughGold: "Not enough gold. Win battles to earn more.",
  TownHallTooLow: "Upgrade your Town Hall first.",
  MaxLevelReached: "This building is already at max level.",
  NotRegistered: "Register your kingdom first.",
  AlreadyRegistered: "This wallet already has a kingdom.",
  InvalidName: "Names must be 1-24 characters.",
};

/** Turns wallet / viem errors into a one-line message a player can act on. */
export function friendlyError(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string; name?: string } | null;
  const text = `${e?.name ?? ""} ${e?.shortMessage ?? ""} ${e?.message ?? ""}`;

  if (/user (rejected|denied)|UserRejected/i.test(text)) return "You cancelled the transaction in your wallet.";
  if (/insufficient funds|exceeds the balance|gas required exceeds/i.test(text)) {
    return "Not enough MON for gas. Grab some from the Monad faucet.";
  }
  for (const [name, message] of Object.entries(CONTRACT_ERRORS)) {
    if (text.includes(name)) return message;
  }
  return (e?.shortMessage ?? e?.message ?? "Something went wrong").split("\n")[0];
}
