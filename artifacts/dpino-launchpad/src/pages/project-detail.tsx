import React, { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGetProject, useListStakingPositions } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Clock, Globe, Twitter, MessageCircle, AlertCircle, Copy, CheckCircle2, Wallet, ExternalLink, ArrowRight, Lock, Shield, Zap, Crown } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@solana/wallet-adapter-react";
import { useDpinoBalance } from "@/hooks/useDpinoBalance";
import { useDpinoPrice } from "@/hooks/useDpinoPrice";
import { TREASURY_WALLET } from "@/providers/SolanaWalletProvider";
import { useToast } from "@/hooks/use-toast";

// ─── Tier utilities ───────────────────────────────────────────────────────────
const TIER_ORDER: Record<string, number> = { none: 0, soldier: 1, general: 2, dark_lord: 3 };

function tierLabel(tier: string) {
  if (tier === "dark_lord") return "DARK LORD";
  return tier.toUpperCase();
}

function tierIcon(tier: string, size = 14) {
  if (tier === "dark_lord") return <Crown size={size} className="text-yellow-300" />;
  if (tier === "general")   return <Zap size={size} className="text-violet-400" />;
  if (tier === "soldier")   return <Shield size={size} className="text-amber-400" />;
  return null;
}

function tierColor(tier: string) {
  if (tier === "dark_lord") return "border-yellow-400/50 bg-yellow-400/10 text-yellow-300";
  if (tier === "general")   return "border-violet-500/50 bg-violet-500/10 text-violet-400";
  if (tier === "soldier")   return "border-amber-500/50 bg-amber-500/10 text-amber-400";
  return "border-white/10 bg-white/5 text-muted-foreground";
}

function tierStakeUrl() { return "/stake"; }

const DPINO_MINT = "4fwCUiZ8qaddK3WFLXazXRtpYpHc39iYLnEfF7KjmoEy";

function formatDpino(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num as number)) return "0";
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
  if (num >= 1_000_000)     return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000)         return (num / 1_000).toFixed(1) + "K";
  return num.toLocaleString();
}

function useCountdown(targetDate: string) {
  const compute = (date: string) => {
    if (!date) return null;
    const diff = +new Date(date) - Date.now();
    if (isNaN(diff) || diff <= 0) return null;
    return {
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff % 86400000) / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
    };
  };

  const [timeLeft, setTimeLeft] = useState(() => compute(targetDate));

  useEffect(() => {
    setTimeLeft(compute(targetDate));
    if (!targetDate) return;
    const id = setInterval(() => {
      const result = compute(targetDate);
      setTimeLeft(result);
      if (!result) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return timeLeft;
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const { publicKey, connected } = useWallet();
  const { data: priceData } = useDpinoPrice();
  const { data: dpBalance } = useDpinoBalance();
  const walletAddress = publicKey?.toBase58() ?? "";

  const { data: project, isLoading } = useGetProject(id!, { query: { enabled: !!id } });
  const { data: myPositions } = useListStakingPositions(
    { walletAddress },
    { query: { enabled: connected && !!walletAddress } }
  );

  const [participateAmount, setParticipateAmount] = useState("");
  const [participateModal, setParticipateModal] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);

  // Determine user's highest staking tier
  const userTierStr = myPositions && myPositions.length > 0
    ? myPositions.reduce((best, p) => {
        const t = p.tier.toLowerCase().replace(" ", "_");
        return (TIER_ORDER[t] ?? 0) > (TIER_ORDER[best] ?? 0) ? t : best;
      }, "none")
    : "none";

  const minTierStr = project?.minTierRequired ?? "none";
  const hasRequiredTier = (TIER_ORDER[userTierStr] ?? 0) >= (TIER_ORDER[minTierStr] ?? 0);
  const tierGated = minTierStr !== "none" && connected && !hasRequiredTier;

  const countdownDate = project
    ? project.status === "live" ? project.endDate : project.startDate
    : "";
  const timeLeft = useCountdown(countdownDate);

  if (isLoading) {
    return (
      <div className="w-full min-h-screen pt-24 pb-12">
        <div className="container px-4">
          <Skeleton className="w-full h-64 md:h-80 rounded-sm bg-white/5 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Skeleton className="w-2/3 h-12 bg-white/5 rounded-sm" />
              <Skeleton className="w-full h-32 bg-white/5 rounded-sm" />
            </div>
            <div><Skeleton className="w-full h-96 bg-white/5 rounded-sm" /></div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) return <div className="p-24 text-center text-xl text-muted-foreground">Project not found</div>;

  const progressPercent   = Math.min(100, (project.raisedAmount / project.totalRaise) * 100);
  const amountNum         = Number(participateAmount);          // DPINO amount entered by user
  const protocolFee       = amountNum * 0.005;                  // 0.5% in DPINO
  const totalDpino        = amountNum + protocolFee;
  const usdEquiv          = priceData ? amountNum * priceData.priceUsd : null;
  const insufficientBal   = dpBalance !== undefined && amountNum > 0 && amountNum > dpBalance;
  const belowMin          = project.minAllocation && amountNum > 0 && amountNum < project.minAllocation;
  const aboveMax          = project.maxAllocation && amountNum > 0 && amountNum > project.maxAllocation;

  const handleParticipate = () => {
    if (!connected) {
      toast({ title: "Connect Wallet", description: "Connect your Solana wallet first.", variant: "destructive" });
      return;
    }
    if (tierGated) {
      toast({ title: "Tier Required", description: `This IDO requires ${tierLabel(minTierStr)} tier. Stake $DPINO to unlock.`, variant: "destructive" });
      return;
    }
    if (!participateAmount || isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Invalid Amount", description: "Enter a valid $DPINO amount.", variant: "destructive" });
      return;
    }
    if (belowMin) {
      toast({ title: "Below Minimum", description: `Minimum allocation is ${formatDpino(project.minAllocation!)} DPINO.`, variant: "destructive" });
      return;
    }
    if (aboveMax) {
      toast({ title: "Exceeds Maximum", description: `Maximum allocation is ${formatDpino(project.maxAllocation!)} DPINO.`, variant: "destructive" });
      return;
    }
    if (insufficientBal) {
      toast({ title: "Insufficient Balance", description: `You only have ${formatDpino(dpBalance ?? 0)} DPINO.`, variant: "destructive" });
      return;
    }
    setParticipateModal(true);
  };

  const handleCopyAddr = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  return (
    <div className="w-full pb-24">
      {/* Banner */}
      <div className="w-full h-56 md:h-80 relative bg-black border-b border-white/10">
        {project.bannerUrl ? (
          <img src={project.bannerUrl} alt={project.name} className="w-full h-full object-cover opacity-50" />
        ) : (
          <div className="w-full h-full bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.3),transparent_70%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full translate-y-1/2">
          <div className="container px-4">
            <div className="w-20 h-20 md:w-28 md:h-28 rounded-sm bg-card border-2 border-primary/50 shadow-[0_0_20px_rgba(245,158,11,0.2)] overflow-hidden">
              {project.logoUrl ? (
                <img src={project.logoUrl} alt={project.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-black">
                  <span className="text-2xl font-black text-primary font-mono">{project.ticker.slice(0, 2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container px-4 mt-16">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-10">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">{project.name}</h1>
              <Badge className={`uppercase tracking-widest font-bold text-sm px-3 py-1 ${
                project.status === "live"     ? "bg-green-500/20 text-green-400 border-green-500/50 shadow-[0_0_10px_rgba(74,222,128,0.3)]" :
                project.status === "upcoming" ? "bg-violet-500/20 text-violet-400 border-violet-500/50" :
                "bg-white/5 text-muted-foreground border-white/10"
              }`}>
                {project.status === "live" ? "● LIVE" : project.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xl text-primary font-mono font-bold">${project.ticker}</p>
            <p className="text-sm text-muted-foreground mt-1">{project.category}</p>
          </div>

          <div className="flex items-center gap-3">
            {project.websiteUrl && (
              <a href={project.websiteUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all">
                <Globe className="w-4 h-4" />
              </a>
            )}
            {project.twitterUrl && (
              <a href={project.twitterUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all">
                <Twitter className="w-4 h-4" />
              </a>
            )}
            {project.telegramUrl && (
              <a href={project.telegramUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all">
                <MessageCircle className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card/40 border border-white/5 p-8 rounded-sm">
              <h2 className="text-xl font-bold uppercase tracking-widest mb-4 border-b border-white/10 pb-4">About this Project</h2>
              <p className="text-lg leading-relaxed text-muted-foreground">{project.description}</p>
            </motion.section>

            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card/40 border border-white/5 p-8 rounded-sm">
              <h2 className="text-xl font-bold uppercase tracking-widest mb-6 border-b border-white/10 pb-4">IDO Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 font-mono">
                {[
                  { label: "Token Price", value: `${formatDpino(project.tokenPrice)} DPINO` },
                  { label: "Hard Cap", value: `${formatDpino(project.totalRaise)} DPINO` },
                  { label: "Category", value: project.category },
                  { label: "Min Allocation", value: project.minAllocation ? `${formatDpino(project.minAllocation)} DPINO` : "None" },
                  { label: "Max Allocation", value: project.maxAllocation ? `${formatDpino(project.maxAllocation)} DPINO` : "None" },
                  { label: "Participants", value: project.participants.toLocaleString() },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
                    <p className="text-base text-foreground font-bold">{value}</p>
                  </div>
                ))}

                {minTierStr !== "none" && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Min Tier</p>
                    <span className={`inline-flex items-center gap-1.5 border rounded-sm px-2.5 py-1 text-xs font-bold uppercase tracking-widest ${tierColor(minTierStr)}`}>
                      {tierIcon(minTierStr, 12)}
                      {tierLabel(minTierStr)}
                    </span>
                  </div>
                )}
              </div>

              {/* Buy DPINO CTA */}
              <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Payment Currency</p>
                  <p className="font-mono text-primary font-bold">$DPINO only</p>
                </div>
                <a
                  href={`https://raydium.io/swap/?inputMint=sol&outputMint=${DPINO_MINT}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary border border-primary/30 rounded-sm px-4 py-2 hover:bg-primary/10 transition-all"
                >
                  Buy $DPINO on Raydium <ArrowRight className="w-3 h-3" />
                </a>
              </div>

              {project.tokenAddress && (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Token Address</p>
                  <p className="font-mono text-xs text-primary/70 break-all select-all">{project.tokenAddress}</p>
                  <a
                    href={`https://solscan.io/token/${project.tokenAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                  >
                    View on Solscan <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </motion.section>

            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card/40 border border-white/5 p-8 rounded-sm">
              <h2 className="text-xl font-bold uppercase tracking-widest mb-6 border-b border-white/10 pb-4">Timeline</h2>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${new Date() >= new Date(project.startDate) ? "bg-green-400 shadow-[0_0_6px_#4ade80]" : "bg-white/20"}`} />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">Sale Start</p>
                    <p className="font-mono text-sm">{format(new Date(project.startDate), "MMM dd, yyyy HH:mm")} UTC</p>
                  </div>
                </div>
                <div className="ml-[5px] w-0.5 h-6 bg-white/10" />
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${new Date() >= new Date(project.endDate) ? "bg-red-400" : "bg-white/20"}`} />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">Sale End</p>
                    <p className="font-mono text-sm">{format(new Date(project.endDate), "MMM dd, yyyy HH:mm")} UTC</p>
                  </div>
                </div>
              </div>
            </motion.section>
          </div>

          {/* Sidebar */}
          <div>
            <div className="bg-black/80 border border-primary/20 p-6 rounded-sm shadow-[0_0_30px_rgba(245,158,11,0.05)] sticky top-28 space-y-6">

              {/* Countdown */}
              {timeLeft && (
                <div className="bg-white/5 border border-white/10 rounded-sm p-4 text-center">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center justify-center gap-2">
                    <Clock className="w-3 h-3 text-primary" />
                    {project.status === "live" ? "Sale ends in" : "Sale starts in"}
                  </p>
                  <div className="flex items-center justify-center gap-3 font-mono font-black">
                    {[["d", "Days"], ["h", "Hrs"], ["m", "Min"], ["s", "Sec"]].map(([key, label]) => (
                      <div key={key} className="flex flex-col items-center">
                        <span className="text-2xl text-primary">{String((timeLeft as Record<string, number>)[key]).padStart(2, "0")}</span>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress */}
              <div>
                <div className="flex justify-between text-xs mb-2 font-mono text-muted-foreground">
                  <span>Raise Progress</span>
                  <span className="text-primary">{progressPercent.toFixed(1)}%</span>
                </div>
                <Progress value={progressPercent} className="h-2.5 bg-white/5 [&>div]:bg-primary mb-2" />
                <div className="flex justify-between text-xs font-mono text-muted-foreground">
                  <span>{formatDpino(project.raisedAmount)} DPINO raised</span>
                  <span>{formatDpino(project.totalRaise)} goal</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-right">{project.participants.toLocaleString()} participants</p>
              </div>

              {/* Wallet balance */}
              {connected && dpBalance !== undefined && (
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-sm px-3 py-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-widest">Your DPINO</span>
                  <span className="font-mono text-sm text-primary font-bold">{formatDpino(dpBalance)}</span>
                </div>
              )}

              {/* Tier requirement badge in sidebar */}
              {minTierStr !== "none" && (
                <div className={`flex items-center gap-2 border rounded-sm px-3 py-2 ${tierColor(minTierStr)}`}>
                  <Lock className="w-3 h-3 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-widest opacity-70 mb-0.5">Tier Required</p>
                    <div className="flex items-center gap-1">
                      {tierIcon(minTierStr, 12)}
                      <span className="text-xs font-bold">{tierLabel(minTierStr)}</span>
                    </div>
                  </div>
                  {connected && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${hasRequiredTier ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-red-500/40 bg-red-500/10 text-red-400"}`}>
                      {hasRequiredTier ? "✓ UNLOCKED" : "✗ LOCKED"}
                    </span>
                  )}
                </div>
              )}

              {/* CTA */}
              {project.status === "live" ? (
                <div className="space-y-3">
                  {/* Tier gate block — shown when wallet connected but tier insufficient */}
                  {tierGated && (
                    <div className="border border-red-500/30 bg-red-500/5 rounded-sm p-4 space-y-3">
                      <div className="flex items-center gap-2 text-red-400">
                        <Lock className="w-4 h-4 shrink-0" />
                        <p className="text-xs font-bold uppercase tracking-wider">IDO Access Locked</p>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        This IDO requires{" "}
                        <span className={`font-bold ${tierColor(minTierStr).split(" ").find(c => c.startsWith("text-"))}`}>{tierLabel(minTierStr)}</span>{" "}
                        tier. Your current tier:{" "}
                        <span className="font-bold text-foreground">{userTierStr === "none" ? "No stake" : tierLabel(userTierStr)}</span>.
                      </p>
                      <Link href="/stake">
                        <Button className="w-full h-9 text-xs font-bold uppercase tracking-widest bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 rounded-sm">
                          Stake $DPINO to Unlock <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  )}

                  <div className={`space-y-2 ${tierGated ? "opacity-40 pointer-events-none" : ""}`}>
                    <Label htmlFor="inv-amount" className="text-xs uppercase tracking-widest text-muted-foreground">
                      Amount in $DPINO
                    </Label>
                    <div className="relative">
                      <Input
                        id="inv-amount"
                        type="number"
                        placeholder="0"
                        value={participateAmount}
                        onChange={(e) => setParticipateAmount(e.target.value)}
                        className="bg-black border-white/20 focus-visible:ring-primary font-mono text-lg h-12 pr-20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-mono font-bold">DPINO</span>
                    </div>

                    {amountNum > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-mono">
                          + {protocolFee.toFixed(0)} DPINO fee (0.5%) = <span className="text-primary">{formatDpino(totalDpino)} DPINO total</span>
                        </p>
                        {usdEquiv !== null && (
                          <p className="text-xs text-muted-foreground font-mono">
                            ≈ <span className="text-white">${usdEquiv.toFixed(2)} USD</span> at current price
                          </p>
                        )}
                      </div>
                    )}

                    {project.minAllocation && (
                      <p className="text-xs text-muted-foreground">
                        Min: <span className="text-foreground font-mono">{formatDpino(project.minAllocation)} DPINO</span>
                        {project.maxAllocation && (
                          <> — Max: <span className="text-foreground font-mono">{formatDpino(project.maxAllocation)} DPINO</span></>
                        )}
                      </p>
                    )}
                  </div>

                  {!connected ? (
                    <div className="flex items-center gap-2 p-3 border border-yellow-500/20 bg-yellow-500/5 rounded-sm">
                      <Wallet className="w-4 h-4 text-yellow-400 shrink-0" />
                      <p className="text-xs text-yellow-400">Connect your wallet to participate.</p>
                    </div>
                  ) : insufficientBal ? (
                    <div className="flex items-center gap-2 p-3 border border-red-500/20 bg-red-500/5 rounded-sm">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <p className="text-xs text-red-400">
                        Insufficient $DPINO. You have {formatDpino(dpBalance ?? 0)}.{" "}
                        <a href={`https://raydium.io/swap/?inputMint=sol&outputMint=${DPINO_MINT}`} target="_blank" rel="noreferrer" className="underline">
                          Buy on Raydium →
                        </a>
                      </p>
                    </div>
                  ) : (belowMin || aboveMax) ? (
                    <div className="flex items-center gap-2 p-3 border border-yellow-500/20 bg-yellow-500/5 rounded-sm">
                      <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
                      <p className="text-xs text-yellow-400">
                        {belowMin ? `Min ${formatDpino(project.minAllocation!)} DPINO` : `Max ${formatDpino(project.maxAllocation!)} DPINO`}
                      </p>
                    </div>
                  ) : null}

                  <Button
                    onClick={handleParticipate}
                    className="w-full h-12 text-base font-bold uppercase tracking-widest bg-primary text-black hover:bg-primary/90 rounded-sm shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] transition-all"
                  >
                    Participate with $DPINO
                  </Button>

                  <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    0.5% fee flows to DPINO/SOL LP on Raydium
                  </p>
                </div>
              ) : project.status === "upcoming" ? (
                <Button disabled className="w-full h-12 uppercase tracking-widest bg-violet-500/20 text-violet-400 border border-violet-500/50 rounded-sm font-bold">
                  Opens {format(new Date(project.startDate), "MMM dd, yyyy")}
                </Button>
              ) : (
                <Button disabled className="w-full h-12 uppercase tracking-widest bg-white/5 text-muted-foreground border border-white/10 rounded-sm font-bold">
                  Sale Ended
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Participate Modal */}
      <Dialog open={participateModal} onOpenChange={setParticipateModal}>
        <DialogContent className="border-primary/20 bg-card/95 backdrop-blur-xl shadow-[0_0_50px_rgba(245,158,11,0.1)] rounded-sm max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-center">
              How to <span className="text-primary">Participate</span>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-4 text-sm">
            {/* Amount summary */}
            <div className="bg-primary/5 border border-primary/20 rounded-sm p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Your Contribution</p>
              <p className="text-2xl font-black text-primary font-mono">{formatDpino(amountNum)} DPINO</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                + {protocolFee.toFixed(0)} DPINO fee (0.5%) = <span className="text-foreground">{formatDpino(totalDpino)} DPINO total</span>
              </p>
              {usdEquiv !== null && (
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">≈ ${usdEquiv.toFixed(2)} USD at current price</p>
              )}
            </div>

            {/* Step 1 */}
            <div className="text-muted-foreground text-xs border border-white/10 rounded-sm p-3 bg-white/[0.02]">
              <span className="text-foreground font-bold block mb-1">Step 1 — Ensure you have $DPINO</span>
              You need at least <span className="text-primary font-bold font-mono">{formatDpino(totalDpino)} DPINO</span> in your connected wallet.
              If you need more, buy on Raydium:
              <a
                href={`https://raydium.io/swap/?inputMint=sol&outputMint=${DPINO_MINT}`}
                target="_blank"
                rel="noreferrer"
                className="ml-1 text-primary hover:underline inline-flex items-center gap-1"
              >
                Buy $DPINO <ArrowRight className="w-3 h-3" />
              </a>
            </div>

            {/* Step 2 */}
            <div className="text-muted-foreground text-xs border border-white/10 rounded-sm p-3 bg-white/[0.02]">
              <span className="text-foreground font-bold block mb-1">Step 2 — Send $DPINO to the Launchpad Vault</span>
              Send exactly <span className="text-primary font-bold font-mono">{formatDpino(totalDpino)} DPINO</span> to the DPINO Launchpad treasury:
            </div>

            <div className="bg-black border border-primary/30 rounded-sm p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Launchpad Vault Address</p>
              <p className="font-mono text-xs text-primary break-all">{TREASURY_WALLET}</p>
              <button
                onClick={() => handleCopyAddr(TREASURY_WALLET)}
                className="mt-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {copiedAddr
                  ? <><CheckCircle2 className="w-3 h-3 text-green-400" /> Copied!</>
                  : <><Copy className="w-3 h-3" /> Copy Address</>
                }
              </button>
            </div>

            {/* Step 3 */}
            <div className="text-muted-foreground text-xs border border-white/10 rounded-sm p-3 bg-white/[0.02]">
              <span className="text-foreground font-bold block mb-1">Step 3 — Include your wallet in the memo</span>
              Add your connected wallet as the transaction memo so we can attribute your allocation:
              <span className="block font-mono text-primary text-xs break-all mt-1">{publicKey?.toBase58() ?? "your-wallet-address"}</span>
            </div>

            {/* Step 4 */}
            <div className="text-muted-foreground text-xs border border-white/10 rounded-sm p-3 bg-white/[0.02]">
              <span className="text-foreground font-bold block mb-1">Step 4 — Confirm in Telegram</span>
              Join the project's Telegram and post your Solscan transaction link for verification and token allocation.
            </div>

            <div className="flex items-start gap-2 p-3 border border-yellow-500/20 bg-yellow-500/5 rounded-sm">
              <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-400">
                On-chain automated participation deploys when the smart contract goes live.
                The 0.5% fee in $DPINO is routed to the DPINO/SOL LP on Raydium — compounding the flywheel.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setParticipateModal(false)}
            className="w-full mt-4 bg-primary text-black font-bold uppercase tracking-widest rounded-sm"
          >
            Got It
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
