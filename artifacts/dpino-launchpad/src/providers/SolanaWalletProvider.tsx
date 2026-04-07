import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { useMemo, type ReactNode } from "react";

const heliusApiKey = import.meta.env.VITE_HELIUS_API_KEY;
export const SOLANA_RPC = heliusApiKey
  ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`
  : "https://api.mainnet-beta.solana.com";
export const DPINO_MINT = "4fwCUiZ8qaddK3WFLXazXRtpYpHc39iYLnEfF7KjmoEy";
export const TREASURY_WALLET = "PLACEHOLDER_TREASURY_WALLET_SET_BEFORE_LAUNCH";

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={SOLANA_RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
