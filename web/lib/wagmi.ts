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

const connectors = connectorsForWallets(
  [
    {
      groupName: "Wallets",
      wallets: WC_PROJECT_ID
        ? [metaMaskWallet, rabbyWallet, walletConnectWallet, injectedWallet]
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
