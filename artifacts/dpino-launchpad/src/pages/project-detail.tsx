import React, { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGetProject } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Clock, Globe, Twitter, MessageCircle, AlertCircle, Copy, CheckCircle2, Wallet, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@solana/wallet-adapter-react";
import { useDpinoBalance } from "@/hooks/useDpinoBalance";
import { useDpinoPrice } from "@/hooks/useDpinoPrice";
import { TREASURY_WALLET } from "@/providers/SolanaWalletProvider";
import { useToast } from "@/hooks/use-toast";

function formatCurrency(num: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
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
  const { data: balance } = useDpinoBalance();

  const { data: project, isLoading } = useGetProject(id!, { query: { enabled: !!id } });
  const [participateAmount, setParticipateAmount] = useState("");
  const [participateModal, setParticipateModal] = useState(false);
  const [copiedTreasury, setCopiedTreasury] = useState(false);

  const countdownDate = project ? (project.status === "live" ? project.endDate : project.startDate) : "";
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

  const progressPercent = Math.min(100, (project.raisedAmount / project.totalRaise) * 100);
  const amountNum = Number(participateAmount);
  const protocolFee = amountNum * 0.005;
  const totalPayable = amountNum + protocolFee;

  const handleParticipate = () => {
    if (!connected) {
      toast({ title: "Connect Wallet", description: "Please connect your Solana wallet first.", variant: "destructive" });
      return;
    }
    if (!participateAmount || isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Invalid Amount", description: "Enter a valid investment amount.", variant: "destructive" });
      return;
    }
    if (project.minAllocation && amountNum < project.minAllocation) {
      toast({ title: "Below Minimum", description: `Minimum allocation is ${formatCurrency(project.minAllocation)}.`, variant: "destructive" });
      return;
    }
    if (project.maxAllocation && amountNum > project.maxAllocation) {
      toast({ title: "Exceeds Maximum", description: `Maximum allocation is ${formatCurrency(project.maxAllocation)}.`, variant: "destructive" });
      return;
    }
    setParticipateModal(true);
  };

  const handleCopyTreasury = () => {
    navigator.clipboard.writeText(TREASURY_WALLET);
    setCopiedTreasury(true);
    setTimeout(() => setCopiedTreasury(false), 2000);
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
                project.status === "live" ? "bg-green-500/20 text-green-400 border-green-500/50 shadow-[0_0_10px_rgba(74,222,128,0.3)]" :
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
              <h2 className="text-xl font-bold uppercase tracking-widest mb-6 border-b border-white/10 pb-4">Token Info</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 font-mono">
                {[
                  { label: "Token Price", value: `$${project.tokenPrice}` },
                  { label: "Total Raise", value: formatCurrency(project.totalRaise) },
                  { label: "Category", value: project.category },
                  { label: "Min Allocation", value: project.minAllocation ? formatCurrency(project.minAllocation) : "None" },
                  { label: "Max Allocation", value: project.maxAllocation ? formatCurrency(project.maxAllocation) : "None" },
                  { label: "Participants", value: project.participants.toLocaleString() },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
                    <p className="text-base text-foreground font-bold">{value}</p>
                  </div>
                ))}
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
                  <span>{formatCurrency(project.raisedAmount)} raised</span>
                  <span>{formatCurrency(project.totalRaise)} goal</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-right">{project.participants.toLocaleString()} participants</p>
              </div>

              {/* CTA */}
              {project.status === "live" ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="inv-amount" className="text-xs uppercase tracking-widest text-muted-foreground">
                      Investment Amount (USD)
                    </Label>
                    <div className="relative">
                      <Input
                        id="inv-amount"
                        type="number"
                        placeholder="0.00"
                        value={participateAmount}
                        onChange={(e) => setParticipateAmount(e.target.value)}
                        className="bg-black border-white/20 focus-visible:ring-primary font-mono text-lg h-12 pr-14"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">USD</span>
                    </div>
                    {amountNum > 0 && (
                      <p className="text-xs text-muted-foreground font-mono">
                        + {(amountNum * 0.005).toFixed(2)} fee = <span className="text-primary">${totalPayable.toFixed(2)} total</span>
                      </p>
                    )}
                  </div>

                  {!connected ? (
                    <div className="flex items-center gap-2 p-3 border border-yellow-500/20 bg-yellow-500/5 rounded-sm">
                      <Wallet className="w-4 h-4 text-yellow-400 shrink-0" />
                      <p className="text-xs text-yellow-400">Connect your wallet to participate in this launch.</p>
                    </div>
                  ) : (
                    balance !== undefined && priceData && amountNum > 0 && amountNum > balance * priceData.priceUsd && (
                      <div className="flex items-center gap-2 p-3 border border-yellow-500/20 bg-yellow-500/5 rounded-sm">
                        <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
                        <p className="text-xs text-yellow-400">Your $DPINO balance may be insufficient for this allocation.</p>
                      </div>
                    )
                  )}

                  <Button
                    onClick={handleParticipate}
                    className="w-full h-12 text-base font-bold uppercase tracking-widest bg-primary text-black hover:bg-primary/90 rounded-sm shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] transition-all"
                  >
                    Participate Now
                  </Button>

                  <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    0.5% protocol fee flows to $DPINO liquidity pool
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

      {/* Participate Modal — Step-by-step instructions */}
      <Dialog open={participateModal} onOpenChange={setParticipateModal}>
        <DialogContent className="border-primary/20 bg-card/95 backdrop-blur-xl shadow-[0_0_50px_rgba(245,158,11,0.1)] rounded-sm max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-center">
              How to <span className="text-primary">Participate</span>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-4 text-sm">
            <div className="bg-primary/5 border border-primary/20 rounded-sm p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Your Investment</p>
              <p className="text-2xl font-black text-primary">${amountNum.toFixed(2)} USD</p>
              <p className="text-xs text-muted-foreground mt-1">+ ${protocolFee.toFixed(2)} protocol fee (0.5%) = <span className="text-foreground">${totalPayable.toFixed(2)} total</span></p>
            </div>

            <p className="text-muted-foreground text-xs border border-white/10 rounded-sm p-3 bg-white/2">
              <span className="text-foreground font-bold block mb-1">Step 1:</span>
              Convert your USD equivalent to <strong>SOL or USDC</strong> on Solana. Use Jupiter or Raydium.
            </p>

            <p className="text-muted-foreground text-xs border border-white/10 rounded-sm p-3 bg-white/2">
              <span className="text-foreground font-bold block mb-1">Step 2:</span>
              Send the exact amount to the DPINO Launchpad treasury wallet:
            </p>

            <div className="bg-black border border-primary/30 rounded-sm p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Treasury Wallet</p>
              <p className="font-mono text-xs text-primary break-all">{TREASURY_WALLET}</p>
              <button
                onClick={handleCopyTreasury}
                className="mt-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {copiedTreasury ? <><CheckCircle2 className="w-3 h-3 text-green-400" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy Address</>}
              </button>
            </div>

            <p className="text-muted-foreground text-xs border border-white/10 rounded-sm p-3 bg-white/2">
              <span className="text-foreground font-bold block mb-1">Step 3:</span>
              Include your connected wallet address in the transaction memo:{" "}
              <span className="font-mono text-primary text-xs break-all">{publicKey?.toBase58() ?? "your-wallet"}</span>
            </p>

            <p className="text-muted-foreground text-xs border border-white/10 rounded-sm p-3 bg-white/2">
              <span className="text-foreground font-bold block mb-1">Step 4:</span>
              After confirmation, join the project Telegram and send your Solscan tx link for manual verification.
            </p>

            <div className="flex items-center gap-2 p-3 border border-yellow-500/20 bg-yellow-500/5 rounded-sm">
              <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
              <p className="text-xs text-yellow-400">
                Automated on-chain participation is coming when the smart contract deploys. Treasury address will be updated before launch.
              </p>
            </div>
          </div>

          <Button onClick={() => setParticipateModal(false)} className="w-full mt-4 bg-primary text-black font-bold uppercase tracking-widest rounded-sm">
            I Understand
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
