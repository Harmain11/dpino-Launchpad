import { useQuery } from "@tanstack/react-query";

const DPINO_MINT = "4fwCUiZ8qaddK3WFLXazXRtpYpHc39iYLnEfF7KjmoEy";

export interface DpinoPrice {
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  pairAddress: string;
}

async function fetchDpinoPrice(): Promise<DpinoPrice> {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${DPINO_MINT}`
  );
  if (!res.ok) throw new Error("Failed to fetch price");
  const data = await res.json();
  const pair = data.pairs?.[0];
  if (!pair) throw new Error("No pair found");

  return {
    priceUsd: parseFloat(pair.priceUsd ?? "0"),
    priceChange24h: pair.priceChange?.h24 ?? 0,
    volume24h: pair.volume?.h24 ?? 0,
    marketCap: pair.marketCap ?? 0,
    liquidity: pair.liquidity?.usd ?? 0,
    pairAddress: pair.pairAddress ?? "",
  };
}

export function useDpinoPrice() {
  return useQuery({
    queryKey: ["dpino-price"],
    queryFn: fetchDpinoPrice,
    refetchInterval: 30000,
    staleTime: 25000,
  });
}
