import React, { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetStakingTiers, useListStakingPositions, useCreateStakingPosition, getListStakingPositionsQueryKey } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Shield, Zap, Crown, CheckCircle2, AlertCircle, Wallet, Lock, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useDpinoBalance } from "@/hooks/useDpinoBalance";
import { useDpinoPrice } from "@/hooks/useDpinoPrice";

function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(0) + "K";
  return num.toLocaleString();
}

function getTierByAmount(amount: number): string {
  if (amount >= 1_000_000) return "DARK LORD";
  if (amount >= 500_000) return "GENERAL";
  if (amount >= 100_000) return "SOLDIER";
  return "NONE";
}

export default function Stake() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? "";

  const { data: tiers, isLoading: tiersLoading } = useGetStakingTiers();
  const { data: positions, isLoading: positionsLoading } = useListStakingPositions(
    { walletAddress },
    { query: { enabled: connected && !!walletAddress } }
  );
  const { data: balance, isLoading: balanceLoading } = useDpinoBalance();
  const { data: priceData } = useDpinoPrice();
  const createStakingPosition = useCreateStakingPosition();

  const [stakeAmount, setStakeAmount] = useState("");
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  const amountNum = Number(stakeAmount);
  const projectedTier = stakeAmount ? getTierByAmount(amountNum) : null;
  const insufficient = balance !== undefined && amountNum > balance;

  const handleStake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !walletAddress) {
      toast({ title: "Wallet Not Connected", description: "Please connect your wallet to stake.", variant: "destructive" });
      return;
    }
    if (!stakeAmount || isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid staking amount.", variant: "destructive" });
      return;
    }
    if (amountNum < 100_000) {
      toast({ title: "Below Minimum", description: "Minimum stake is 100,000 $DPINO (SOLDIER tier).", variant: "destructive" });
      return;
    }
    if (insufficient) {
      toast({ title: "Insufficient Balance", description: `You only have ${formatNumber(balance ?? 0)} $DPINO in your wallet.`, variant: "destructive" });
      return;
    }

    createStakingPosition.mutate(
      { data: { walletAddress, amountStaked: amountNum } },
      {
        onSuccess: () => {
          toast({ title: "Position Recorded", description: `${formatNumber(amountNum)} $DPINO staked as ${projectedTier}.` });
          setStakeAmount("");
          queryClient.invalidateQueries({ queryKey: getListStakingPositionsQueryKey({ walletAddress }) });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to record stake. Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const getTierIcon = (name: string) => {
    if (name.toLowerCase().includes("lord")) return Crown;
    if (name.toLowerCase().includes("general")) return Zap;
    return Shield;
  };

  const getTierStyle = (color: string) => {
    if (color === "#F59E0B" || color.includes("F59") || color.includes("amber")) {
      return { border: "border-yellow-500/60", glow: "shadow-[0_0_40px_rgba(245,158,11,0.15)]", text: "text-yellow-400", bg: "bg-yellow-500/5" };
    }
    if (color === "#8B5CF6" || color.includes("8B5") || color.includes("violet")) {
      return { border: "border-violet-500/60", glow: "shadow-[0_0_40px_rgba(139,92,246,0.15)]", text: "text-violet-400", bg: "bg-violet-500/5" };
    }
    return { border: "border-white/20", glow: "shadow-[0_0_20px_rgba(255,255,255,0.03)]", text: "text-foreground", bg: "bg-white/2" };
  };

  return (
    <div className="w-full min-h-screen py-16 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(43,43,43,0.4),transparent_50%)] pointer-events-none" />

      <div className="container px-4 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <Badge className="bg-primary/10 text-primary border-primary/20 mb-4 uppercase tracking-widest">
            Elite Access Protocol
          </Badge>
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-6 text-foreground">
            Stake <span className="text-primary">$DPINO</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Lock your tokens to gain guaranteed launch allocations, multiplier bonuses, and a share of the 0.5% protocol fee from every launch.
          </p>
        </div>

        {/* Tier → IDO Access Banner */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-4xl mx-auto mb-16 border border-primary/20 bg-primary/5 rounded-sm p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Your Tier Unlocks IDO Access</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            IDOs on the DPINO Launchpad are tier-gated. Stake enough $DPINO to reach the required tier before participating.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { tier: "SOLDIER", amount: "100K", min: "100,000", icon: Shield, color: "text-amber-400", border: "border-amber-500/40 bg-amber-500/5", desc: "Access to standard IDOs" },
              { tier: "GENERAL", amount: "500K", min: "500,000", icon: Zap, color: "text-violet-400", border: "border-violet-500/40 bg-violet-500/5", desc: "Access to premium IDOs + higher allocations" },
              { tier: "DARK LORD", amount: "1M", min: "1,000,000", icon: Crown, color: "text-yellow-300", border: "border-yellow-400/40 bg-yellow-500/5", desc: "Full access to all IDOs + max multiplier" },
            ].map(({ tier, amount, min, icon: Icon, color, border, desc }) => (
              <div key={tier} className={`border rounded-sm p-4 ${border}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className={`text-xs font-bold uppercase tracking-widest ${color}`}>{tier}</span>
                </div>
                <p className={`font-mono text-lg font-black mb-1 ${color}`}>{amount} DPINO</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">View open IDOs to see which tier is required.</p>
            <Link href="/projects">
              <Button variant="ghost" className="text-xs text-primary hover:text-primary h-7 px-3 hover:bg-primary/10">
                Browse IDOs <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Tiers */}
        <div className="mb-20">
          <h2 className="text-xl font-bold uppercase tracking-widest text-center mb-10 text-muted-foreground">Staking Tiers</h2>

          {tiersLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-96 w-full bg-white/5 rounded-sm" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {tiers?.map((tier, i) => {
                const Icon = getTierIcon(tier.name);
                const style = getTierStyle(tier.color);
                const isSelected = selectedTierId === tier.id;

                return (
                  <motion.div
                    key={tier.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.12, duration: 0.5 }}
                    onClick={() => {
                      setSelectedTierId(tier.id);
                      setStakeAmount(String(tier.requiredAmount));
                    }}
                    className={`relative rounded-sm border bg-black/80 overflow-hidden cursor-pointer transition-all duration-300 ${style.border} ${style.glow} ${isSelected ? "ring-1 ring-primary scale-[1.02]" : "hover:scale-[1.01]"}`}
                  >
                    <div className={`absolute inset-0 ${style.bg} pointer-events-none`} />
                    <div className="p-8 relative z-10 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-6">
                        <Icon className={`w-10 h-10 ${style.text}`} />
                        <span className={`font-mono text-3xl font-black ${style.text}`}>{tier.allocationMultiplier}x</span>
                      </div>

                      <h3 className={`text-3xl font-black uppercase tracking-tighter mb-1 ${style.text}`}>{tier.name}</h3>
                      <p className="font-mono text-lg mb-8 text-muted-foreground">{formatNumber(tier.requiredAmount)} $DPINO</p>

                      <div className="flex-1 space-y-3 mb-8">
                        {tier.benefits.map((benefit, j) => (
                          <div key={j} className="flex items-start gap-3">
                            <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${style.text}`} />
                            <span className="text-sm text-muted-foreground leading-snug">{benefit}</span>
                          </div>
                        ))}
                      </div>

                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTierId(tier.id);
                          setStakeAmount(String(tier.requiredAmount));
                        }}
                        className={`w-full uppercase font-bold tracking-widest rounded-sm transition-all ${isSelected ? "bg-primary text-black" : "bg-white/10 text-white hover:bg-white/20 border border-white/20"}`}
                      >
                        {isSelected ? "Selected" : "Select Tier"}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Staking Action Area */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Stake Form */}
          <Card className="bg-card/40 border-white/10 rounded-sm shadow-xl">
            <CardContent className="p-8">
              <h3 className="text-xl font-bold uppercase tracking-widest mb-6 border-b border-white/10 pb-4">
                Manage Stake
              </h3>

              {!connected ? (
                <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                  <Wallet className="w-12 h-12 text-primary/40" />
                  <p className="text-muted-foreground">Connect your Solana wallet to stake $DPINO and access exclusive launches.</p>
                  <p className="text-xs text-muted-foreground/60 uppercase tracking-widest">Use the Connect Wallet button in the top navigation.</p>
                </div>
              ) : (
                <form onSubmit={handleStake} className="space-y-6">
                  {/* Wallet balance display */}
                  <div className="bg-white/5 border border-white/10 rounded-sm p-3 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">Your $DPINO Balance</span>
                    {balanceLoading ? (
                      <Skeleton className="h-4 w-24 bg-white/10" />
                    ) : (
                      <span className="font-mono font-bold text-primary">{formatNumber(balance ?? 0)}</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="amount" className="text-xs uppercase tracking-widest text-muted-foreground">Amount to Stake</Label>
                      {projectedTier && projectedTier !== "NONE" && (
                        <span className="text-xs text-primary font-bold tracking-widest">{projectedTier} tier</span>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="amount"
                        type="number"
                        placeholder="100000"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        className={`bg-black/50 border-white/20 focus-visible:ring-primary font-mono text-lg h-14 pl-4 pr-20 rounded-sm ${insufficient ? "border-red-500/50" : ""}`}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">$DPINO</span>
                    </div>
                    {insufficient && (
                      <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Insufficient balance
                      </p>
                    )}
                    {stakeAmount && amountNum > 0 && amountNum < 100_000 && (
                      <p className="text-xs text-yellow-400">Minimum stake is 100,000 $DPINO for SOLDIER tier</p>
                    )}
                  </div>

                  {priceData && stakeAmount && amountNum > 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      ≈ ${(amountNum * priceData.priceUsd).toFixed(2)} USD at current price
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={createStakingPosition.isPending || insufficient || !stakeAmount}
                    className="w-full h-14 text-lg font-bold uppercase tracking-widest bg-primary text-black hover:bg-primary/90 rounded-sm shadow-[0_0_20px_rgba(245,158,11,0.2)] disabled:opacity-40 transition-all"
                  >
                    {createStakingPosition.isPending ? "Processing..." : "Stake Tokens"}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground uppercase tracking-wider">
                    Unstaking has a 7-day cooldown. Smart contract deployment coming soon.
                  </p>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Current Position */}
          <Card className="bg-primary/5 border-primary/20 rounded-sm shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <CardContent className="p-8 relative z-10 flex flex-col h-full">
              <h3 className="text-xl font-bold uppercase tracking-widest mb-6 border-b border-primary/20 pb-4 text-primary">
                Your Position
              </h3>

              {!connected ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-6">
                  <AlertCircle className="w-10 h-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">Connect wallet to view your staking position.</p>
                </div>
              ) : positionsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-1/2 bg-primary/10" />
                  <Skeleton className="h-16 w-full bg-primary/10" />
                </div>
              ) : positions && positions.length > 0 ? (
                <div className="space-y-6 flex-1">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Current Tier</p>
                    <p className="text-3xl font-black uppercase text-primary">{positions[0].tier}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total Staked</p>
                    <p className="text-4xl font-mono font-bold text-foreground">
                      {formatNumber(positions[0].amountStaked)} <span className="text-lg text-primary">$DPINO</span>
                    </p>
                    {priceData && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ≈ ${(positions[0].amountStaked * priceData.priceUsd).toFixed(2)} USD
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Protocol Fee Rewards</p>
                    <p className="text-xl font-mono text-green-400">+{formatNumber(positions[0].rewardsEarned)} $DPINO</p>
                  </div>
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">Allocation Multiplier</p>
                    <p className="text-2xl font-black text-primary mt-1">
                      {positions[0].tier === "DARK LORD" ? "7x" : positions[0].tier === "GENERAL" ? "3x" : "1x"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-8">
                  <AlertCircle className="w-12 h-12 text-muted-foreground opacity-30" />
                  <p className="text-muted-foreground text-sm">No active staking position for this wallet.</p>
                  <p className="text-xs text-muted-foreground/60">Stake $DPINO to unlock guaranteed allocations in every launch.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info banner */}
        <div className="max-w-4xl mx-auto mt-8 p-4 border border-white/10 bg-white/2 rounded-sm text-center">
          <p className="text-xs text-muted-foreground">
            <span className="text-primary font-bold">Note:</span> Staking is currently tracked off-chain in our platform database.
            On-chain smart contract deployment is coming soon — all positions will be migrated automatically.
            Real $DPINO transfers will be required once the contract launches.
          </p>
        </div>
      </div>
    </div>
  );
}
