import React, { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetStakingTiers,
  useListStakingPositions,
  useCreateStakingPosition,
  getListStakingPositionsQueryKey,
} from "@workspace/api-client-react";
import { motion } from "framer-motion";
import {
  Shield, Zap, Crown, CheckCircle2, AlertCircle,
  Wallet, Lock, ArrowRight, TrendingUp, Coins, Clock,
  Unlock, CalendarClock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useDpinoBalance } from "@/hooks/useDpinoBalance";
import { useDpinoPrice } from "@/hooks/useDpinoPrice";

// ─── APY table ────────────────────────────────────────────────────────────────
const APY: Record<string, Record<string, number>> = {
  flexible: { SOLDIER: 0.06, GENERAL: 0.09, "DARK LORD": 0.12 },
  fixed30:  { SOLDIER: 0.10, GENERAL: 0.14, "DARK LORD": 0.18 },
  fixed90:  { SOLDIER: 0.15, GENERAL: 0.20, "DARK LORD": 0.25 },
};

type StakeMode  = "flexible" | "fixed";
type LockOption = 30 | 90;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatReward(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(4) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(3) + "K";
  return n.toFixed(4);
}

function getTierByAmount(amount: number): string {
  if (amount >= 1_000_000) return "DARK LORD";
  if (amount >= 500_000)   return "GENERAL";
  if (amount >= 100_000)   return "SOLDIER";
  return "NONE";
}

function getApy(tier: string, mode: StakeMode, lock: LockOption): number {
  if (mode === "flexible") return APY.flexible[tier] ?? 0;
  return lock === 90 ? (APY.fixed90[tier] ?? 0) : (APY.fixed30[tier] ?? 0);
}

function calcReturn(staked: number, apy: number, days: number): number {
  return staked * apy * (days / 365);
}

function secondsSince(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
}

function useLiveEarnings(staked: number, apyRate: number, startedAt: string | null) {
  const [earned, setEarned] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!startedAt || staked <= 0) { setEarned(0); return; }
    const tick = () => {
      setEarned(staked * apyRate * secondsSince(startedAt) / (365 * 24 * 3600));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [staked, apyRate, startedAt]);
  return earned;
}

function useLockCountdown(lockUntil: string | null | undefined) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!lockUntil) { setRemaining(0); return; }
    const update = () => setRemaining(Math.max(0, new Date(lockUntil).getTime() - Date.now()));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [lockUntil]);
  if (!remaining) return null;
  const d = Math.floor(remaining / 86400000);
  const h = Math.floor((remaining % 86400000) / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return { d, h, m, s, total: remaining };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Stake() {
  const { toast }       = useToast();
  const queryClient     = useQueryClient();
  const { publicKey, connected } = useWallet();
  const walletAddress   = publicKey?.toBase58() ?? "";

  const { data: tiers, isLoading: tiersLoading }       = useGetStakingTiers();
  const { data: positions, isLoading: positionsLoading } = useListStakingPositions(
    { walletAddress },
    { query: { enabled: connected && !!walletAddress } }
  );
  const { data: balance, isLoading: balanceLoading } = useDpinoBalance();
  const { data: priceData }   = useDpinoPrice();
  const createPosition        = useCreateStakingPosition();

  // Form state
  const [stakeMode,      setStakeMode]      = useState<StakeMode>("flexible");
  const [lockDays,       setLockDays]       = useState<LockOption>(30);
  const [stakeAmount,    setStakeAmount]    = useState("");
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  const amountNum     = Number(stakeAmount) || 0;
  const projectedTier = stakeAmount && amountNum >= 100_000 ? getTierByAmount(amountNum) : null;
  const projectedApy  = projectedTier ? getApy(projectedTier, stakeMode, lockDays) : 0;
  const insufficient  = balance !== undefined && amountNum > balance;

  // Position
  const activePos   = positions?.[0] ?? null;
  const posStaked   = activePos?.amountStaked  ?? 0;
  const posTier     = activePos?.tier          ?? "";
  const posStarted  = activePos?.stakedAt      ?? null;
  const posType     = activePos?.stakingType   ?? "flexible";
  const posLockUntil = activePos?.lockUntil    ?? null;

  // Determine the live APY for the position
  const posLockDays = activePos?.lockDurationDays ?? null;
  let posApy = APY.flexible[posTier] ?? 0;
  if (posType === "fixed" && posLockDays === 90) posApy = APY.fixed90[posTier] ?? 0;
  else if (posType === "fixed") posApy = APY.fixed30[posTier] ?? 0;

  const liveEarned     = useLiveEarnings(posStaked, posApy, posStarted ? String(posStarted) : null);
  const lockCountdown  = useLockCountdown(posLockUntil);
  const secondRate     = posStaked * posApy / (365 * 24 * 3600);

  const handleStake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !walletAddress) {
      toast({ title: "Wallet Not Connected", description: "Please connect your wallet first.", variant: "destructive" });
      return;
    }
    if (amountNum < 100_000) {
      toast({ title: "Below Minimum", description: "Minimum stake is 100,000 $DPINO (SOLDIER tier).", variant: "destructive" });
      return;
    }
    if (insufficient) {
      toast({ title: "Insufficient Balance", description: `You only have ${formatNumber(balance ?? 0)} $DPINO.`, variant: "destructive" });
      return;
    }

    createPosition.mutate(
      {
        data: {
          walletAddress,
          amountStaked: amountNum,
          stakingType:  stakeMode,
          lockDurationDays: stakeMode === "fixed" ? lockDays : null,
        },
      },
      {
        onSuccess: () => {
          const label = stakeMode === "fixed" ? `Fixed ${lockDays}-day` : "Flexible";
          toast({ title: "Position Created", description: `${formatNumber(amountNum)} $DPINO staked — ${label}.` });
          setStakeAmount("");
          queryClient.invalidateQueries({ queryKey: getListStakingPositionsQueryKey({ walletAddress }) });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to record stake. Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const getTierIcon  = (name: string) => {
    if (name.toLowerCase().includes("lord"))    return Crown;
    if (name.toLowerCase().includes("general")) return Zap;
    return Shield;
  };

  const getTierStyle = (color: string) => {
    if (color.includes("F59") || color.includes("amber"))
      return { border: "border-yellow-500/60", glow: "shadow-[0_0_40px_rgba(245,158,11,0.15)]", text: "text-yellow-400", bg: "bg-yellow-500/5" };
    if (color.includes("8B5") || color.includes("violet"))
      return { border: "border-violet-500/60", glow: "shadow-[0_0_40px_rgba(139,92,246,0.15)]", text: "text-violet-400", bg: "bg-violet-500/5" };
    return { border: "border-white/20", glow: "shadow-[0_0_20px_rgba(255,255,255,0.03)]", text: "text-foreground", bg: "bg-white/2" };
  };

  const getTierName = (name: string) => name.toUpperCase();

  return (
    <div className="w-full min-h-screen py-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(43,43,43,0.4),transparent_50%)] pointer-events-none" />

      <div className="container px-4 relative z-10">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge className="bg-primary/10 text-primary border-primary/20 mb-4 uppercase tracking-widest">
            Earn While You Access
          </Badge>
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-6">
            Stake <span className="text-primary">$DPINO</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Choose how you stake: <span className="text-white font-semibold">flexible</span> for freedom or
            <span className="text-primary font-semibold"> fixed</span> for higher rewards — earn $DPINO + SOL back.
          </p>
        </div>

        {/* ── APY Comparison Table ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto mb-12"
        >
          <div className="border border-white/10 rounded-sm overflow-hidden">
            <div className="grid grid-cols-4 bg-white/[0.04] border-b border-white/10">
              <div className="p-4 text-xs uppercase tracking-widest text-muted-foreground">Tier</div>
              <div className="p-4 text-center">
                <p className="text-xs uppercase tracking-widest text-blue-400 mb-1">Flexible</p>
                <p className="text-[10px] text-muted-foreground">Withdraw anytime</p>
              </div>
              <div className="p-4 text-center border-l border-white/5">
                <p className="text-xs uppercase tracking-widest text-orange-400 mb-1">Fixed 30 Days</p>
                <p className="text-[10px] text-muted-foreground">Locked 1 month</p>
              </div>
              <div className="p-4 text-center border-l border-white/5">
                <p className="text-xs uppercase tracking-widest text-primary mb-1">Fixed 90 Days</p>
                <p className="text-[10px] text-muted-foreground">Locked 3 months</p>
              </div>
            </div>
            {[
              { name: "SOLDIER",   min: "100K", icon: Shield, color: "text-amber-400" },
              { name: "GENERAL",   min: "500K", icon: Zap,    color: "text-violet-400" },
              { name: "DARK LORD", min: "1M",   icon: Crown,  color: "text-yellow-300" },
            ].map(({ name, min, icon: Icon, color }) => (
              <div key={name} className="grid grid-cols-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <div className="p-4 flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <div>
                    <p className={`text-sm font-bold ${color}`}>{name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{min} DPINO</p>
                  </div>
                </div>
                <div className="p-4 text-center border-l border-white/5">
                  <p className="text-xl font-black text-blue-300">
                    {((APY.flexible[name] ?? 0) * 100).toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">APY</p>
                </div>
                <div className="p-4 text-center border-l border-white/5">
                  <p className="text-xl font-black text-orange-300">
                    {((APY.fixed30[name] ?? 0) * 100).toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">APY</p>
                </div>
                <div className="p-4 text-center border-l border-white/5">
                  <p className="text-xl font-black text-primary">
                    {((APY.fixed90[name] ?? 0) * 100).toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">APY</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Tier Cards ───────────────────────────────────────────────────── */}
        {!tiersLoading && tiers && (
          <div className="mb-16">
            <h2 className="text-lg font-bold uppercase tracking-widest text-center mb-8 text-muted-foreground">
              Select Your Tier
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {tiers.map((tier, i) => {
                const Icon       = getTierIcon(tier.name);
                const style      = getTierStyle(tier.color);
                const isSelected = selectedTierId === tier.id;
                const name       = getTierName(tier.name);

                return (
                  <motion.div
                    key={tier.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => { setSelectedTierId(tier.id); setStakeAmount(String(tier.requiredAmount)); }}
                    className={`relative rounded-sm border bg-black/80 overflow-hidden cursor-pointer transition-all duration-300 ${style.border} ${style.glow} ${isSelected ? "ring-1 ring-primary scale-[1.02]" : "hover:scale-[1.01]"}`}
                  >
                    <div className={`absolute inset-0 ${style.bg} pointer-events-none`} />
                    <div className="p-6 relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <Icon className={`w-8 h-8 ${style.text}`} />
                        <span className={`font-mono text-2xl font-black ${style.text}`}>{tier.allocationMultiplier}x</span>
                      </div>
                      <h3 className={`text-2xl font-black uppercase tracking-tighter mb-0.5 ${style.text}`}>{name}</h3>
                      <p className="font-mono text-base mb-3 text-muted-foreground">{formatNumber(tier.requiredAmount)} $DPINO</p>

                      {/* APY quick view for selected mode */}
                      <div className="grid grid-cols-3 gap-1 mb-4 text-center">
                        {[
                          { label: "Flex", apy: (APY.flexible[name] ?? 0) * 100, color: "text-blue-300" },
                          { label: "30d",  apy: (APY.fixed30[name]  ?? 0) * 100, color: "text-orange-300" },
                          { label: "90d",  apy: (APY.fixed90[name]  ?? 0) * 100, color: "text-primary" },
                        ].map(({ label, apy, color }) => (
                          <div key={label} className="bg-white/5 rounded-sm py-1.5">
                            <p className={`text-sm font-black ${color}`}>{apy.toFixed(0)}%</p>
                            <p className="text-[9px] text-muted-foreground uppercase">{label}</p>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1.5 mb-4">
                        {tier.benefits.slice(0, 3).map((b, j) => (
                          <div key={j} className="flex items-start gap-2">
                            <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${style.text}`} />
                            <span className="text-xs text-muted-foreground leading-snug">{b}</span>
                          </div>
                        ))}
                      </div>

                      <Button
                        onClick={(e) => { e.stopPropagation(); setSelectedTierId(tier.id); setStakeAmount(String(tier.requiredAmount)); }}
                        className={`w-full text-xs uppercase font-bold tracking-widest rounded-sm transition-all ${isSelected ? "bg-primary text-black" : "bg-white/10 text-white hover:bg-white/20 border border-white/20"}`}
                      >
                        {isSelected ? "Selected" : "Select Tier"}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Staking Form + Position ──────────────────────────────────────── */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* ── Left: Form ─────────────────────────────────────────────────── */}
          <Card className="bg-card/40 border-white/10 rounded-sm shadow-xl">
            <CardContent className="p-0">

              {/* Mode tabs */}
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setStakeMode("flexible")}
                  className={`flex-1 py-4 text-xs uppercase font-bold tracking-widest transition-all flex items-center justify-center gap-2 ${
                    stakeMode === "flexible"
                      ? "bg-blue-500/10 text-blue-300 border-b-2 border-blue-400"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  <Unlock className="w-3.5 h-3.5" />
                  Flexible
                </button>
                <button
                  onClick={() => setStakeMode("fixed")}
                  className={`flex-1 py-4 text-xs uppercase font-bold tracking-widest transition-all flex items-center justify-center gap-2 ${
                    stakeMode === "fixed"
                      ? "bg-primary/10 text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  Fixed
                </button>
              </div>

              <div className="p-8">
                {/* Mode description */}
                <div className={`mb-6 rounded-sm p-4 text-sm leading-relaxed ${
                  stakeMode === "flexible"
                    ? "bg-blue-500/5 border border-blue-500/20 text-blue-200"
                    : "bg-primary/5 border border-primary/20 text-yellow-200"
                }`}>
                  {stakeMode === "flexible" ? (
                    <>
                      <span className="font-bold text-blue-300">Flexible staking</span> — Withdraw anytime
                      after a 7-day cooldown. Lower APY but full control of your tokens.
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-primary">Fixed staking</span> — Tokens are locked for
                      the chosen period. <span className="font-bold">No early withdrawal.</span> Higher APY
                      as a reward for commitment.
                    </>
                  )}
                </div>

                {/* Lock duration (fixed only) */}
                {stakeMode === "fixed" && (
                  <div className="mb-6">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Lock Duration</p>
                    <div className="grid grid-cols-2 gap-3">
                      {([30, 90] as LockOption[]).map((days) => {
                        const tier   = projectedTier ?? "SOLDIER";
                        const apy    = days === 90 ? (APY.fixed90[tier] ?? 0) : (APY.fixed30[tier] ?? 0);
                        const isActive = lockDays === days;
                        return (
                          <button
                            key={days}
                            onClick={() => setLockDays(days)}
                            className={`border rounded-sm p-4 text-left transition-all ${
                              isActive
                                ? "border-primary/60 bg-primary/10 ring-1 ring-primary"
                                : "border-white/10 bg-white/[0.03] hover:border-white/20"
                            }`}
                          >
                            <p className={`text-lg font-black ${isActive ? "text-primary" : "text-white"}`}>
                              {days} Days
                            </p>
                            <p className="text-xs text-muted-foreground mb-1">{days === 30 ? "1 month" : "3 months"}</p>
                            <p className={`text-xl font-black font-mono ${isActive ? "text-primary" : "text-green-400"}`}>
                              {(apy * 100).toFixed(0)}% APY
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!connected ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                    <Wallet className="w-12 h-12 text-primary/40" />
                    <p className="text-muted-foreground text-sm">Connect your Solana wallet to stake $DPINO.</p>
                  </div>
                ) : (
                  <form onSubmit={handleStake} className="space-y-5">
                    <div className="bg-white/5 border border-white/10 rounded-sm p-3 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-widest text-muted-foreground">Your Balance</span>
                      {balanceLoading ? <Skeleton className="h-4 w-24 bg-white/10" /> : (
                        <span className="font-mono font-bold text-primary">{formatNumber(balance ?? 0)} $DPINO</span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Amount to Stake</Label>
                        {projectedTier && (
                          <span className="text-xs font-bold text-primary tracking-widest">{projectedTier} · {(projectedApy * 100).toFixed(0)}% APY</span>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder="100000"
                          value={stakeAmount}
                          onChange={(e) => setStakeAmount(e.target.value)}
                          className={`bg-black/50 border-white/20 font-mono text-lg h-14 pl-4 pr-20 rounded-sm focus-visible:ring-primary ${insufficient ? "border-red-500/50" : ""}`}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">$DPINO</span>
                      </div>
                      {insufficient && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Insufficient balance</p>}
                      {amountNum > 0 && amountNum < 100_000 && <p className="text-xs text-yellow-400">Minimum stake is 100,000 $DPINO (SOLDIER tier)</p>}
                    </div>

                    {/* Estimated returns */}
                    {projectedTier && projectedApy > 0 && amountNum >= 100_000 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="border border-green-500/20 bg-green-500/5 rounded-sm overflow-hidden"
                      >
                        <div className="px-4 pt-3 pb-2 border-b border-green-500/10">
                          <p className="text-[10px] uppercase tracking-widest text-green-400 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Estimated $DPINO Returns
                          </p>
                        </div>
                        <div className="p-4 space-y-2">
                          {(stakeMode === "flexible"
                            ? [{ label: "Daily", days: 1 }, { label: "Monthly", days: 30 }, { label: "Yearly", days: 365 }]
                            : [{ label: `At Unlock (${lockDays}d)`, days: lockDays }, { label: "Yearly", days: 365 }]
                          ).map(({ label, days }) => {
                            const earned = calcReturn(amountNum, projectedApy, days);
                            const usd    = priceData ? earned * priceData.priceUsd : null;
                            return (
                              <div key={label} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{label}</span>
                                <div className="text-right">
                                  <span className="font-mono font-bold text-green-300">+{formatNumber(earned)} $DPINO</span>
                                  {usd != null && <span className="text-muted-foreground text-xs ml-2">(${usd.toFixed(2)})</span>}
                                </div>
                              </div>
                            );
                          })}

                          {stakeMode === "fixed" && (
                            <div className="pt-2 mt-2 border-t border-green-500/10">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Total you get back</span>
                                <span className="font-mono font-black text-green-200">
                                  {formatNumber(amountNum + calcReturn(amountNum, projectedApy, lockDays))} $DPINO
                                </span>
                              </div>
                              {priceData && (
                                <div className="flex justify-end">
                                  <span className="text-xs text-muted-foreground">
                                    ≈ ${((amountNum + calcReturn(amountNum, projectedApy, lockDays)) * priceData.priceUsd).toFixed(2)} USD
                                  </span>
                                </div>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-2">
                                Unlocks on:{" "}
                                {new Date(Date.now() + lockDays * 86400000).toLocaleDateString("en-US", {
                                  month: "long", day: "numeric", year: "numeric",
                                })}
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    <Button
                      type="submit"
                      disabled={createPosition.isPending || insufficient || amountNum < 100_000}
                      className="w-full h-14 text-base font-bold uppercase tracking-widest bg-primary text-black hover:bg-primary/90 rounded-sm shadow-[0_0_20px_rgba(245,158,11,0.2)] disabled:opacity-40"
                    >
                      {createPosition.isPending
                        ? "Processing..."
                        : stakeMode === "fixed"
                        ? `Lock & Earn (${lockDays}d)`
                        : "Stake & Start Earning"}
                    </Button>

                    <p className="text-[10px] text-center text-muted-foreground uppercase tracking-wider">
                      {stakeMode === "flexible"
                        ? "7-day cooldown on withdrawal · Rewards accrue every second"
                        : `Tokens locked for ${lockDays} days · No early withdrawal · Claim rewards anytime`}
                    </p>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Right: Position ─────────────────────────────────────────────── */}
          <Card className="bg-primary/5 border-primary/20 rounded-sm shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <CardContent className="p-8 relative z-10 flex flex-col h-full">
              <h3 className="text-xl font-bold uppercase tracking-widest mb-6 border-b border-primary/20 pb-4 text-primary">
                Your Position
              </h3>

              {!connected ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-6">
                  <AlertCircle className="w-10 h-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">Connect wallet to view your position.</p>
                </div>
              ) : positionsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full bg-primary/10" />)}
                </div>
              ) : activePos ? (
                <div className="space-y-5 flex-1">
                  {/* Type + tier */}
                  <div className="flex items-start gap-3 flex-wrap">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Tier</p>
                      <p className="text-2xl font-black uppercase text-primary">{posTier}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Mode</p>
                      <Badge className={`text-xs font-bold uppercase tracking-widest ${
                        posType === "fixed" ? "bg-primary/20 text-primary border-primary/40" : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                      }`}>
                        {posType === "fixed" ? `Fixed ${activePos.lockDurationDays}d` : "Flexible"}
                      </Badge>
                    </div>
                  </div>

                  {/* APY */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Your APY</p>
                      <p className="text-2xl font-black text-green-400">{(posApy * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Total Staked</p>
                      <p className="text-2xl font-mono font-bold">{formatNumber(posStaked)} <span className="text-sm text-primary">DPINO</span></p>
                    </div>
                  </div>

                  {/* Lock countdown for fixed */}
                  {posType === "fixed" && posLockUntil && (
                    <div className={`rounded-sm p-4 border ${
                      lockCountdown ? "border-orange-500/30 bg-orange-500/5" : "border-green-500/30 bg-green-500/5"
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarClock className={`w-4 h-4 ${lockCountdown ? "text-orange-400" : "text-green-400"}`} />
                        <p className={`text-[10px] uppercase tracking-widest ${lockCountdown ? "text-orange-400" : "text-green-400"}`}>
                          {lockCountdown ? "Locked — Time Remaining" : "Lock Expired — Ready to Unstake"}
                        </p>
                      </div>
                      {lockCountdown ? (
                        <div className="grid grid-cols-4 gap-2 text-center">
                          {[
                            { label: "Days",  val: lockCountdown.d },
                            { label: "Hours", val: lockCountdown.h },
                            { label: "Min",   val: lockCountdown.m },
                            { label: "Sec",   val: lockCountdown.s },
                          ].map(({ label, val }) => (
                            <div key={label} className="bg-white/5 rounded-sm py-2">
                              <p className="text-lg font-black font-mono text-orange-300 tabular-nums">
                                {String(val).padStart(2, "0")}
                              </p>
                              <p className="text-[9px] text-muted-foreground uppercase">{label}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-green-300">Initiate unstake to withdraw your tokens.</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Unlocks: {new Date(posLockUntil).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  )}

                  {/* Live earnings */}
                  <div className="border border-green-500/30 bg-green-500/5 rounded-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <p className="text-[10px] uppercase tracking-widest text-green-400">Earning Live — $DPINO</p>
                    </div>
                    <p className="font-mono text-2xl font-black text-green-300 tabular-nums">
                      +{formatReward(liveEarned)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      +{(secondRate * 3600).toFixed(4)} $DPINO / hour
                    </p>
                  </div>

                  {/* Claim buttons */}
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full border-green-500/40 text-green-300 hover:bg-green-500/10 uppercase tracking-widest text-xs font-bold rounded-sm"
                      onClick={() => toast({ title: "On-Chain Claim Coming Soon", description: "Your rewards are being tracked. Claimable on contract launch." })}
                    >
                      <Coins className="w-3.5 h-3.5 mr-2" /> Claim $DPINO Rewards
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-sky-500/40 text-sky-300 hover:bg-sky-500/10 uppercase tracking-widest text-xs font-bold rounded-sm"
                      onClick={() => toast({ title: "On-Chain Claim Coming Soon", description: "SOL rewards from protocol fees. Claimable proportionally on launch." })}
                    >
                      <TrendingUp className="w-3.5 h-3.5 mr-2" /> Claim SOL Rewards
                    </Button>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Allocation Multiplier</p>
                    <p className="text-2xl font-black text-primary">
                      {posTier === "DARK LORD" ? "7x" : posTier === "GENERAL" ? "3x" : "1x"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-8">
                  <AlertCircle className="w-12 h-12 text-muted-foreground opacity-30" />
                  <p className="text-muted-foreground text-sm">No active staking position for this wallet.</p>
                  <p className="text-xs text-muted-foreground/60">Choose Flexible or Fixed above and stake to start earning.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Info banner ──────────────────────────────────────────────────── */}
        <div className="max-w-4xl mx-auto mt-10 p-4 border border-primary/20 bg-primary/5 rounded-sm text-center">
          <p className="text-xs text-muted-foreground">
            <span className="text-primary font-bold">Smart Contract Status:</span> Staking is tracked off-chain.
            On-chain deployment is coming — your position and rewards are logged and will be credited in full at launch.
            Fixed lock periods will be enforced on-chain automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
