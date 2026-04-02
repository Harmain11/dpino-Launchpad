import React, { useState } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetProject } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Clock, Globe, Twitter, MessageCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatCurrency(num: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
}

function calculateTimeLeft(endDateStr: string) {
  const difference = +new Date(endDateStr) - +new Date();
  let timeLeft = {};

  if (difference > 0) {
    timeLeft = {
      d: Math.floor(difference / (1000 * 60 * 60 * 24)),
      h: Math.floor((difference / (1000 * 60 * 60)) % 24),
      m: Math.floor((difference / 1000 / 60) % 60)
    };
  }

  return timeLeft;
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { data: project, isLoading } = useGetProject(id!, { query: { enabled: !!id } });
  const [participateAmount, setParticipateAmount] = useState("");

  if (isLoading) {
    return (
      <div className="w-full min-h-screen pt-24 pb-12">
        <div className="container px-4">
          <Skeleton className="w-full h-64 md:h-96 rounded-sm bg-white/5 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Skeleton className="w-2/3 h-12 bg-white/5 rounded-sm" />
              <Skeleton className="w-full h-32 bg-white/5 rounded-sm" />
              <Skeleton className="w-full h-64 bg-white/5 rounded-sm" />
            </div>
            <div>
              <Skeleton className="w-full h-96 bg-white/5 rounded-sm" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) return <div className="p-24 text-center text-xl text-muted-foreground">Project not found</div>;

  const tl = calculateTimeLeft(project.endDate);
  const hasTimeLeft = Object.keys(tl).length > 0;
  const progressPercent = Math.min(100, (project.raisedAmount / project.totalRaise) * 100);

  return (
    <div className="w-full pb-24">
      {/* Banner */}
      <div className="w-full h-64 md:h-96 relative bg-black border-b border-white/10">
        {project.bannerUrl ? (
          <img src={project.bannerUrl} alt={project.name} className="w-full h-full object-cover opacity-50" />
        ) : (
          <div className="w-full h-full bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.3),transparent_70%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        
        <div className="absolute bottom-0 left-0 w-full transform translate-y-1/2">
          <div className="container px-4 flex items-end gap-6">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-sm bg-card border-2 border-primary/50 shadow-[0_0_20px_rgba(245,158,11,0.2)] overflow-hidden shrink-0">
              {project.logoUrl ? (
                <img src={project.logoUrl} alt={project.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-black">
                  <span className="text-3xl font-bold text-primary font-mono">{project.ticker.slice(0,2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container px-4 mt-20">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-12">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-foreground">{project.name}</h1>
              <Badge className={`uppercase tracking-widest font-bold ${
                project.status === 'live' ? 'bg-green-500/20 text-green-400 border-green-500/50 glow-green' :
                project.status === 'upcoming' ? 'bg-secondary/20 text-secondary border-secondary/50 glow-violet' :
                'bg-muted text-muted-foreground border-white/10'
              }`}>
                {project.status}
              </Badge>
            </div>
            <p className="text-xl text-primary font-mono">${project.ticker}</p>
          </div>
          
          <div className="flex items-center gap-4">
            {project.websiteUrl && (
              <a href={project.websiteUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary/20 hover:text-primary transition-colors">
                <Globe className="w-5 h-5" />
              </a>
            )}
            {project.twitterUrl && (
              <a href={project.twitterUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary/20 hover:text-primary transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
            )}
            {project.telegramUrl && (
              <a href={project.telegramUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary/20 hover:text-primary transition-colors">
                <MessageCircle className="w-5 h-5" />
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-10">
            <section className="bg-card/40 border border-white/5 p-8 rounded-sm">
              <h2 className="text-2xl font-bold uppercase tracking-widest mb-4 border-b border-white/10 pb-4">Project Description</h2>
              <div className="prose prose-invert max-w-none">
                <p className="text-lg leading-relaxed text-muted-foreground">{project.description}</p>
              </div>
            </section>

            <section className="bg-card/40 border border-white/5 p-8 rounded-sm">
              <h2 className="text-2xl font-bold uppercase tracking-widest mb-6 border-b border-white/10 pb-4">Tokenomics & Info</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12 font-mono">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Token Address</p>
                  <p className="text-sm text-primary break-all select-all">{project.tokenAddress || "TBA"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Category</p>
                  <p className="text-sm text-foreground">{project.category}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Price Per Token</p>
                  <p className="text-lg text-foreground">${project.tokenPrice}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Total Raise</p>
                  <p className="text-lg text-foreground">{formatCurrency(project.totalRaise)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Min Allocation</p>
                  <p className="text-sm text-foreground">{project.minAllocation ? formatCurrency(project.minAllocation) : "None"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Max Allocation</p>
                  <p className="text-sm text-foreground">{project.maxAllocation ? formatCurrency(project.maxAllocation) : "None"}</p>
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-black/80 border border-primary/20 p-6 rounded-sm shadow-[0_0_30px_rgba(245,158,11,0.05)] sticky top-28">
              {(project.status === 'live' || project.status === 'upcoming') && hasTimeLeft && (
                <div className="bg-white/5 border border-white/10 rounded-sm p-4 mb-8 flex flex-col items-center justify-center">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    {project.status === 'live' ? 'Sale ends in' : 'Sale starts in'}
                  </p>
                  <div className="flex gap-4 font-mono text-2xl font-bold">
                    <div className="flex flex-col items-center"><span className="text-primary">{tl.d || 0}</span><span className="text-[10px] text-muted-foreground uppercase">Days</span></div>
                    <span className="text-white/20">:</span>
                    <div className="flex flex-col items-center"><span className="text-primary">{tl.h || 0}</span><span className="text-[10px] text-muted-foreground uppercase">Hrs</span></div>
                    <span className="text-white/20">:</span>
                    <div className="flex flex-col items-center"><span className="text-primary">{tl.m || 0}</span><span className="text-[10px] text-muted-foreground uppercase">Min</span></div>
                  </div>
                </div>
              )}

              <div className="mb-8">
                <div className="flex justify-between text-sm mb-2 font-mono">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="text-primary">{formatCurrency(project.raisedAmount)} / {formatCurrency(project.totalRaise)}</span>
                </div>
                <Progress value={progressPercent} className="h-3 bg-white/5 [&>div]:bg-primary mb-2" />
                <div className="flex justify-between text-xs text-muted-foreground font-mono">
                  <span>{progressPercent.toFixed(1)}% Filled</span>
                  <span>{project.participants} Participants</span>
                </div>
              </div>

              {project.status === 'live' ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-xs uppercase tracking-widest text-muted-foreground">Investment Amount (USD)</Label>
                    <Input 
                      id="amount" 
                      type="number" 
                      placeholder="0.00" 
                      value={participateAmount}
                      onChange={(e) => setParticipateAmount(e.target.value)}
                      className="bg-black border-white/20 focus-visible:ring-primary font-mono text-lg h-12"
                    />
                  </div>
                  <Button className="w-full h-14 text-lg font-bold uppercase tracking-widest bg-primary text-black hover:bg-primary/90 rounded-sm shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] transition-all">
                    Participate Now
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    0.5% Protocol fee applies
                  </p>
                </div>
              ) : project.status === 'upcoming' ? (
                <Button disabled className="w-full h-14 text-lg font-bold uppercase tracking-widest bg-secondary/20 text-secondary border border-secondary/50 rounded-sm">
                  Starts {format(new Date(project.startDate), 'MMM dd, yyyy')}
                </Button>
              ) : (
                <Button disabled className="w-full h-14 text-lg font-bold uppercase tracking-widest bg-white/5 text-muted-foreground border border-white/10 rounded-sm">
                  Sale Ended
                </Button>
              )}

              <div className="mt-8 pt-6 border-t border-white/10 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Start Date</span>
                  <span className="font-mono text-foreground">{format(new Date(project.startDate), 'MMM dd, yyyy HH:mm')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">End Date</span>
                  <span className="font-mono text-foreground">{format(new Date(project.endDate), 'MMM dd, yyyy HH:mm')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
