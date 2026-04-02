import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetStakingTiers, useListStakingPositions, useCreateStakingPosition } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Shield, Zap, Crown, CheckCircle2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(0) + "K";
  return num.toLocaleString();
}

export default function Stake() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: tiers, isLoading: tiersLoading } = useGetStakingTiers();
  
  // Mock wallet address for demo purposes
  const walletAddress = "demo-wallet-address";
  const { data: positions, isLoading: positionsLoading } = useListStakingPositions({ walletAddress });
  
  const createStakingPosition = useCreateStakingPosition();
  
  const [stakeAmount, setStakeAmount] = useState("");

  const handleStake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stakeAmount || isNaN(Number(stakeAmount)) || Number(stakeAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid staking amount.",
        variant: "destructive"
      });
      return;
    }

    createStakingPosition.mutate({
      data: {
        walletAddress,
        amountStaked: Number(stakeAmount)
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Staking Successful",
          description: `Successfully staked ${formatNumber(Number(stakeAmount))} $DPINO.`,
        });
        setStakeAmount("");
        queryClient.invalidateQueries({ queryKey: ["/api/staking/positions"] });
      },
      onError: () => {
        toast({
          title: "Staking Failed",
          description: "An error occurred while staking. Please try again.",
          variant: "destructive"
        });
      }
    });
  };

  const getTierIcon = (name: string) => {
    if (name.toLowerCase().includes("lord")) return Crown;
    if (name.toLowerCase().includes("general")) return Zap;
    return Shield;
  };

  const getTierColorClass = (color: string) => {
    if (color === "gold") return "border-primary text-primary shadow-[0_0_30px_rgba(245,158,11,0.2)]";
    if (color === "purple") return "border-secondary text-secondary shadow-[0_0_30px_rgba(139,92,246,0.2)]";
    return "border-muted-foreground text-foreground shadow-[0_0_30px_rgba(255,255,255,0.05)]";
  };

  const getBgGlowClass = (color: string) => {
    if (color === "gold") return "bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.15),transparent_70%)]";
    if (color === "purple") return "bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.15),transparent_70%)]";
    return "bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.05),transparent_70%)]";
  };

  return (
    <div className="w-full min-h-screen py-16 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(43,43,43,0.4),transparent_50%)] pointer-events-none" />
      
      <div className="container px-4 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge className="bg-primary/10 text-primary border-primary/20 mb-4 uppercase tracking-widest">
            Elite Access Protocol
          </Badge>
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-6 text-foreground">
            Stake <span className="text-gradient-gold">$DPINO</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Lock your tokens to gain access to exclusive launches, multiplier bonuses, and a share of the protocol fees.
          </p>
        </div>

        {/* Tiers */}
        <div className="mb-24">
          <h2 className="text-2xl font-bold uppercase tracking-widest text-center mb-10 text-muted-foreground">Staking Tiers</h2>
          
          {tiersLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-96 w-full bg-white/5 rounded-sm" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {tiers?.map((tier, i) => {
                const Icon = getTierIcon(tier.name);
                const colorClass = getTierColorClass(tier.color);
                const bgGlow = getBgGlowClass(tier.color);
                
                return (
                  <motion.div
                    key={tier.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className={`relative rounded-sm border bg-black/80 overflow-hidden group ${colorClass}`}
                  >
                    <div className={`absolute inset-0 ${bgGlow} opacity-50 group-hover:opacity-100 transition-opacity duration-500`} />
                    <div className="p-8 relative z-10 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-6">
                        <Icon className="w-10 h-10" />
                        <span className="font-mono text-2xl font-bold">{tier.allocationMultiplier}x</span>
                      </div>
                      
                      <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">{tier.name}</h3>
                      <p className="font-mono text-xl mb-8 opacity-80">{formatNumber(tier.requiredAmount)} $DPINO</p>
                      
                      <div className="flex-1 space-y-4 mb-8">
                        {tier.benefits.map((benefit, j) => (
                          <div key={j} className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 shrink-0 opacity-70 mt-0.5" />
                            <span className="text-sm text-muted-foreground leading-snug">{benefit}</span>
                          </div>
                        ))}
                      </div>
                      
                      <Button className="w-full uppercase font-bold tracking-widest bg-white/10 text-white hover:bg-white/20 border border-white/20 rounded-sm">
                        Select Tier
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
              <h3 className="text-2xl font-bold uppercase tracking-widest mb-6 border-b border-white/10 pb-4">Manage Stake</h3>
              
              <form onSubmit={handleStake} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-xs uppercase tracking-widest text-muted-foreground">Amount to Stake</Label>
                  <div className="relative">
                    <Input 
                      id="amount" 
                      type="number" 
                      placeholder="0" 
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      className="bg-black/50 border-white/20 focus-visible:ring-primary font-mono text-lg h-14 pl-4 pr-16 rounded-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">DPINO</span>
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  disabled={createStakingPosition.isPending}
                  className="w-full h-14 text-lg font-bold uppercase tracking-widest bg-primary text-black hover:bg-primary/90 rounded-sm shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all"
                >
                  {createStakingPosition.isPending ? "Processing..." : "Stake Tokens"}
                </Button>
                
                <p className="text-xs text-center text-muted-foreground uppercase tracking-wider">
                  Unstaking requires a 7-day cooldown period.
                </p>
              </form>
            </CardContent>
          </Card>

          {/* Current Position */}
          <Card className="bg-primary/5 border-primary/20 rounded-sm shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            <CardContent className="p-8 relative z-10 flex flex-col h-full">
              <h3 className="text-2xl font-bold uppercase tracking-widest mb-6 border-b border-primary/20 pb-4 text-primary">Your Position</h3>
              
              {positionsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-1/2 bg-primary/10" />
                  <Skeleton className="h-16 w-full bg-primary/10" />
                </div>
              ) : positions && positions.length > 0 ? (
                <div className="space-y-6 flex-1">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Current Tier</p>
                    <p className="text-2xl font-black uppercase text-gradient-gold">{positions[0].tier}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total Staked</p>
                    <p className="text-4xl font-mono text-foreground">{formatNumber(positions[0].amountStaked)} <span className="text-lg text-primary">DPINO</span></p>
                  </div>
                  
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Rewards Earned</p>
                    <p className="text-xl font-mono text-green-400">+{formatNumber(positions[0].rewardsEarned)} DPINO</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-8">
                  <AlertCircle className="w-12 h-12 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">You don't have any active staking positions.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
