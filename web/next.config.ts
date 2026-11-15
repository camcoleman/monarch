import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, ".."),
  transpilePackages: ["@monarch/shared"],
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    // Optional deps pulled in by WalletConnect / MetaMask SDK that aren't needed in the browser.
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = { ...config.resolve.fallback, "@react-native-async-storage/async-storage": false };
    // Payment extras from @coinbase/cdp-sdk (via the Base Account connector) that aren't installed.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/core": false,
      "@x402/evm": false,
      "@x402/svm": false,
    };
    return config;
  },
};

export default nextConfig;
