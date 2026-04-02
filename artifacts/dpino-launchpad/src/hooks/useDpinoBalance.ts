import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";

const DPINO_MINT = "4fwCUiZ8qaddK3WFLXazXRtpYpHc39iYLnEfF7KjmoEy";

export function useDpinoBalance() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  return useQuery({
    queryKey: ["dpino-balance", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return 0;
      try {
        const mint = new PublicKey(DPINO_MINT);
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          publicKey,
          { mint }
        );
        if (tokenAccounts.value.length === 0) return 0;
        const balance =
          tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        return balance ?? 0;
      } catch {
        return 0;
      }
    },
    enabled: connected && !!publicKey,
    refetchInterval: 30000,
    staleTime: 25000,
  });
}
