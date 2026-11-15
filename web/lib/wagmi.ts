import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { monadTestnet } from "@monarch/shared";
import { RPC_URL, WC_PROJECT_ID } from "./config";

/**
 * Without a WalletConnect project ID, MetaMask can only connect through its extension (its fallback is WalletConnect),
 * so it's listed only when the extension is installed.
 */
type Injected = { isMetaMask?: boolean; isRabby?: boolean; isBraveWallet?: boolean; isPhantom?: boolean };
const hasMetaMaskExtension = (() => {
  if (typeof window === "undefined") return false;
  const eth = (window as { ethereum?: Injected }).ethereum;
  return Boolean(eth?.isMetaMask && !eth.isRabby && !eth.isBraveWallet && !eth.isPhantom);
})();

const connectors = connectorsForWallets(
  [
    {
      groupName: "Wallets",
      wallets: WC_PROJECT_ID
        ? [metaMaskWallet, rabbyWallet, walletConnectWallet, injectedWallet]
        : hasMetaMaskExtension
          ? [metaMaskWallet, rabbyWallet, injectedWallet]
          : [injectedWallet, rabbyWallet],
    },
  ],
  { appName: "MONARCH", projectId: WC_PROJECT_ID ?? "monarch-dev" }
);

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors,
  transports: { [monadTestnet.id]: http(RPC_URL) },
  ssr: true,
});
