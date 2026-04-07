import React, { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  useListStakingPositions,
  useGetPlatformStats,
  useGetFeaturedProjects,
} from "@workspace/api-client-react";
import { useDpinoBalance } from "@/hooks/useDpinoBalance";
import { useDpinoPrice } from "@/hooks/useDpinoPrice";
import {
  Shield, Zap, Crown, Wallet, TrendingUp, Coins,
  ArrowRight, AlertCircle, Lock, Unlock, CalendarClock,
  BarChart3, Users, Activity, Star,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}
function fmtReward(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(4) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(3) + "K";
  return n.toFixed(4);
}

const APY: Record<string, Record<string, number>> = {
  flexible: { SOLDIER: 0.12, GENERAL: 0.18, "DARK LORD": 0.24 },
  fixed30: { SOLDIER: 0.20, GENERAL: 0.28, "DARK LORD": 0.36 },
  fixed90: { SOLDIER: 0.30, GENERAL: 0.42, "DARK LORD": 0.54 },
};

function getPosApy(tier: string, type: string, days: number | null) {
  if (type === "fixed" && days === 90) return APY.fixed90[tier] ?? 0;
  if (type === "fixed") return APY.fixed30[tier] ?? 0;
  return APY.flexible[tier] ?? 0;
}

function useLiveEarnings(staked: number, apy: number, startedAt: string | Date | null) {
  const [earned, setEarned] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!startedAt || staked <= 0) { setEarned(0); return; }
    const start = new Date(startedAt).getTime();
    const tick = () => {
      const elapsed = Math.max(0, (Date.now() - start) / 1000);
      setEarned(staked * apy * elapsed / (365 * 24 * 3600));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [staked, apy, startedAt]);
  return earned;
}

function useLockCountdown(lockUntil: string | null | undefined) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!lockUntil) { setMs(0); return; }
    const update = () => setMs(Math.max(0, new Date(lockUntil).getTime() - Date.now()));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [lockUntil]);
  if (!ms) return null;
  return {
    d: Math.floor(ms / 86400000),
    h: Math.floor((ms % 86400000) / 3600000),
    m: Math.floor((ms % 3600000) / 60000),
    s: Math.floor((ms % 60000) / 1000),
  };
}

function TierBadge({ tier }: { tier: string }) {
  const cfg = tier === "DARK LORD"
    ? { icon: Crown, color: "text-yellow-300", bg: "bg-yellow-500/10 border-yellow-500/30" }
    : tier === "GENERAL"
    ? { icon: Zap, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/30" }
    : { icon: Shield, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-sm border text-xs font-bold uppercase tracking-widest ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {tier}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? "";

  const { data: balance } = useDpinoBalance();
  const { data: priceData } = useDpinoPrice();
  const { data: stats } = useGetPlatformStats();
  const { data: featured } = useGetFeaturedProjects();
  const { data: positions, isLoading: posLoading } = useListStakingPositions(
    { walletAddress },
    { query: { enabled: connected && !!walletAddress } }
  );

  const pos = positions?.[0] ?? null;
  const posTier = pos?.tier ?? "";
  const posStaked = pos?.amountStaked ?? 0;
  const posType = pos?.stakingType ?? "flexible";
  const posLockDays = pos?.lockDurationDays ?? null;
  const posApy = getPosApy(posTier, posType, posLockDays);
  const posStarted = pos?.stakedAt ? String(pos.stakedAt) : null;
  const liveEarned = useLiveEarnings(posStaked, posApy, posStarted);
  const lockCountdown = useLockCountdown(pos?.lockUntil ? String(pos.lockUntil) : null);
  const secondRate = posStaked * posApy / (365 * 24 * 3600);

  const multiplier = posTier === "DARK LORD" ? 7 : posTier === "GENERAL" ? 3 : 1;
  const displayName = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : "Warrior";

  return (
    <div className="w-full min-h-screen py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(43,43,43,0.3),transparent_40%)] pointer-events-none" />

      <div className="container px-4 relative z-10 max-w-7xl mx-auto">

        {/* ── Welcome Header ───────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Welcome back</p>
              <h1 className="text-4xl font-black uppercase tracking-tighter">
                {displayName} <span className="text-primary">⚡</span>
              </h1>
              {pos && <div className="mt-2"><TierBadge tier={posTier} /></div>}
            </div>
            <div className="flex items-center gap-3">
              <Link href="/stake">
                <Button className="bg-primary text-black hover:bg-primary/90 font-bold uppercase tracking-widest rounded-sm">
                  Manage Stake <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/projects">
                <Button variant="outline" className="border-white/20 hover:border-primary/40 uppercase tracking-widest rounded-sm font-bold">
                  Launchpad <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ── Top Stats Row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "$DPINO Balance",
              value: balance !== undefined ? fmt(balance) : "—",
              sub: priceData && balance ? `≈ $${(balance * priceData.priceUsd).toFixed(2)} USD` : "Connect wallet",
              icon: Coins,
              color: "text-primary",
            },
            {
              label: "Total Staked",
              value: pos ? fmt(posStaked) : "—",
              sub: pos ? `${(posApy * 100).toFixed(0)}% APY · ${posType}` : "No active position",
              icon: Lock,
              color: "text-green-400",
            },
            {
              label: "Rewards Earned",
              value: pos ? fmtReward(liveEarned) : "—",
              sub: pos ? `+${(secondRate * 3600).toFixed(4)} / hr` : "Stake to start earning",
              icon: TrendingUp,
              color: "text-blue-400",
            },
            {
              label: "Allocation Power",
              value: pos ? `${multiplier}x` : "—",
              sub: pos ? posTier : "No tier — stake to gain access",
              icon: Star,
              color: "text-yellow-400",
            },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-white/10 bg-black/40 rounded-sm p-5 hover:border-white/20 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
                <Icon className={`w-4 h-4 ${color} opacity-60`} />
              </div>
              <p className={`text-2xl font-black font-mono ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: Staking Position ──────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            <Card className="bg-card/40 border-white/10 rounded-sm overflow-hidden">
              <div className="px-6 pt-6 pb-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Staking Position</h2>
                <Link href="/stake">
                  <span className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer uppercase tracking-widest">
                    Manage →
                  </span>
                </Link>
              </div>
              <CardContent className="p-6">
                {!connected ? (
                  <div className="flex flex-col items-center gap-4 py-8 text-center">
                    <Wallet className="w-10 h-10 text-muted-foreground/30" />
                    <div>
                      <p className="font-bold mb-1">Wallet Not Connected</p>
                      <p className="text-sm text-muted-foreground">Connect your Solana wallet to view your staking position and start earning.</p>
                    </div>
                  </div>
                ) : posLoading ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-12 bg-white/5" />)}
                  </div>
                ) : pos ? (
                  <div className="space-y-5">
                    {/* Tier + mode */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <TierBadge tier={posTier} />
                      <Badge className={`text-xs font-bold uppercase tracking-widest ${
                        posType === "fixed"
                          ? "bg-primary/20 text-primary border-primary/40"
                          : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                      }`}>
                        {posType === "fixed" ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
                        {posType === "fixed" ? `Fixed ${posLockDays}d` : "Flexible"}
                      </Badge>
                    </div>

                    {/* Key numbers */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Staked</p>
                        <p className="text-xl font-black font-mono text-white">{fmt(posStaked)}</p>
                        <p className="text-[10px] text-primary">$DPINO</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">APY</p>
                        <p className="text-xl font-black text-green-400">{(posApy * 100).toFixed(0)}%</p>
                        <p className="text-[10px] text-muted-foreground">Annual</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Multiplier</p>
                        <p className="text-xl font-black text-yellow-400">{multiplier}x</p>
                        <p className="text-[10px] text-muted-foreground">Allocation</p>
                      </div>
                    </div>

                    {/* Live earnings ticker */}
                    <div className="bg-green-500/5 border border-green-500/20 rounded-sm p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <p className="text-[10px] uppercase tracking-widest text-green-400">Live Earnings</p>
                      </div>
                      <p className="font-mono text-2xl font-black text-green-300 tabular-nums">
                        +{fmtReward(liveEarned)} <span className="text-sm">$DPINO</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {(secondRate * 86400).toFixed(2)} $DPINO per day · {(secondRate * 3600).toFixed(4)} per hour
                      </p>
                    </div>

                    {/* Lock countdown (fixed only) */}
                    {posType === "fixed" && pos.lockUntil && (
                      <div className={`rounded-sm p-4 border ${lockCountdown ? "border-orange-500/30 bg-orange-500/5" : "border-green-500/30 bg-green-500/5"}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <CalendarClock className={`w-4 h-4 ${lockCountdown ? "text-orange-400" : "text-green-400"}`} />
                          <p className={`text-[10px] uppercase tracking-widest ${lockCountdown ? "text-orange-400" : "text-green-400"}`}>
                            {lockCountdown ? "Lock Countdown" : "Ready to Unstake"}
                          </p>
                        </div>
                        {lockCountdown && (
                          <div className="grid grid-cols-4 gap-2 text-center">
                            {[["Days", lockCountdown.d], ["Hours", lockCountdown.h], ["Min", lockCountdown.m], ["Sec", lockCountdown.s]].map(([l, v]) => (
                              <div key={l} className="bg-white/5 rounded-sm py-2">
                                <p className="text-lg font-black font-mono text-orange-300 tabular-nums">{String(v).padStart(2, "0")}</p>
                                <p className="text-[9px] text-muted-foreground uppercase">{l}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-2">
                          Unlocks: {new Date(String(pos.lockUntil)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                    )}

                    {/* Claim buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" size="sm" className="border-green-500/30 text-green-300 hover:bg-green-500/10 text-xs uppercase tracking-widest font-bold rounded-sm">
                        <Coins className="w-3.5 h-3.5 mr-1.5" /> Claim $DPINO
                      </Button>
                      <Button variant="outline" size="sm" className="border-sky-500/30 text-sky-300 hover:bg-sky-500/10 text-xs uppercase tracking-widest font-bold rounded-sm">
                        <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Claim SOL
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-8 text-center">
                    <AlertCircle className="w-10 h-10 text-muted-foreground/30" />
                    <div>
                      <p className="font-bold mb-1">No Staking Position</p>
                      <p className="text-sm text-muted-foreground mb-4">Stake $DPINO to unlock IDO access, earn rewards, and gain allocation power.</p>
                      <Link href="/stake">
                        <Button className="bg-primary text-black hover:bg-primary/90 uppercase font-bold tracking-widest rounded-sm">
                          Start Staking →
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Active Projects ─────────────────────────────────────────── */}
            <Card className="bg-card/40 border-white/10 rounded-sm overflow-hidden">
              <div className="px-6 pt-6 pb-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Active Launches</h2>
                <Link href="/projects">
                  <span className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer uppercase tracking-widest">
                    All Projects →
                  </span>
                </Link>
              </div>
              <CardContent className="p-6">
                {!featured?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No active launches at the moment.</p>
                ) : (
                  <div className="space-y-4">
                    {featured.slice(0, 3).map((p) => {
                      const pct = p.totalRaise > 0 ? Math.min(100, (p.raisedAmount / p.totalRaise) * 100) : 0;
                      const canAccess = !pos && p.minTierRequired !== "NONE" ? false : true;
                      return (
                        <Link key={p.id} href={`/projects/${p.id}`}>
                          <div className="border border-white/10 rounded-sm p-4 hover:border-primary/30 transition-all cursor-pointer group">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="font-bold group-hover:text-primary transition-colors">{p.name}</p>
                                  <Badge className={`text-[9px] uppercase font-bold ${
                                    p.status === "live" ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                                  }`}>{p.status}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground font-mono">${p.ticker}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Raised</p>
                                <p className="text-sm font-bold font-mono text-primary">{fmt(p.raisedAmount)}</p>
                                <p className="text-[10px] text-muted-foreground">/ {fmt(p.totalRaise)} DPINO</p>
                              </div>
                            </div>
                            <Progress value={pct} className="h-1.5 bg-white/5" />
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-[10px] text-muted-foreground">{pct.toFixed(1)}% filled</p>
                              {!canAccess && (
                                <p className="text-[10px] text-yellow-400 flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" /> Requires {p.minTierRequired}
                                </p>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Right: Sidebar ───────────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Account Info */}
            <Card className="bg-card/40 border-white/10 rounded-sm overflow-hidden">
              <div className="px-5 pt-5 pb-4 border-b border-white/10">
                <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Account</h2>
              </div>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <p className="text-lg font-black text-primary">{displayName[0]?.toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="font-bold">{displayName}</p>
                    <p className="text-xs text-muted-foreground">Solana Wallet</p>
                  </div>
                </div>

                {connected && publicKey ? (
                  <div className="bg-green-500/5 border border-green-500/20 rounded-sm p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full" />
                      <p className="text-[10px] uppercase tracking-widest text-green-400">Wallet Connected</p>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground break-all">{walletAddress}</p>
                  </div>
                ) : (
                  <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-sm p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="w-3.5 h-3.5 text-yellow-400" />
                      <p className="text-[10px] uppercase tracking-widest text-yellow-400">No Wallet</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Connect wallet to stake and participate in IDOs.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Platform Stats */}
            <Card className="bg-card/40 border-white/10 rounded-sm overflow-hidden">
              <div className="px-5 pt-5 pb-4 border-b border-white/10">
                <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Platform Stats</h2>
              </div>
              <CardContent className="p-5 space-y-3">
                {[
                  { label: "Total Staked", value: stats ? fmt(stats.totalDpinoStaked) + " DPINO" : "—", icon: Lock },
                  { label: "Active Stakers", value: stats ? stats.totalStakers.toLocaleString() : "—", icon: Users },
                  { label: "Active Launches", value: stats ? String(stats.activeLaunches) : "—", icon: Activity },
                  { label: "DPINO Raised", value: stats ? fmt(stats.totalRaisedDpino) : "—", icon: BarChart3 },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                    <p className="text-sm font-bold font-mono text-foreground">{value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Tier access guide */}
            <Card className="bg-card/40 border-white/10 rounded-sm overflow-hidden">
              <div className="px-5 pt-5 pb-4 border-b border-white/10">
                <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Tier Guide</h2>
              </div>
              <CardContent className="p-5 space-y-3">
                {[
                  { name: "SOLDIER", min: "100K", mult: "1x", apy: "12%", icon: Shield, color: "text-amber-400" },
                  { name: "GENERAL", min: "500K", mult: "3x", apy: "18%", icon: Zap, color: "text-violet-400" },
                  { name: "DARK LORD", min: "1M", mult: "7x", apy: "24%", icon: Crown, color: "text-yellow-300" },
                ].map(({ name, min, mult, apy, icon: Icon, color }) => {
                  const isCurrentTier = posTier === name;
                  return (
                    <div key={name} className={`flex items-center gap-3 p-2.5 rounded-sm border ${isCurrentTier ? "border-primary/40 bg-primary/5" : "border-white/5 bg-white/[0.02]"}`}>
                      <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold ${color}`}>{name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{min} DPINO</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-green-400">{apy}</p>
                        <p className="text-[10px] text-muted-foreground">{mult} alloc</p>
                      </div>
                      {isCurrentTier && <Badge className="text-[9px] bg-primary/20 text-primary border-primary/30">You</Badge>}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
