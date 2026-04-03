import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetPlatformStats, useGetFeaturedProjects } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { ArrowRight, Activity, Users, Coins, TrendingUp } from "lucide-react";

function formatDpino(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num as number)) return "0";
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
  if (num >= 1_000_000)     return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000)         return (num / 1_000).toFixed(1) + "K";
  return num.toLocaleString();
}

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useGetPlatformStats();
  const { data: featuredProjects, isLoading: featuredLoading } = useGetFeaturedProjects();

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden py-24">
        <div className="absolute inset-0 z-0">
          <img
            src="/images/hero-bg.png"
            alt="Dark cinematic crypto background"
            className="w-full h-full object-cover opacity-40 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.15),transparent_50%)]" />
        </div>

        <div className="container px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors mb-6 px-4 py-1.5 text-sm tracking-widest uppercase">
                Solana's Darkest Syndicate
              </Badge>
              <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter mb-6 leading-none">
                <span className="text-foreground">ENTER THE</span>
                <br />
                <span className="text-gradient-gold">SYNDICATE</span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto font-light">
                The curated gatekeeper for the $DPINO ecosystem. Elite projects only.
                Every launch fuels the <span className="text-primary font-bold">TRILLIONS ON TRILLIONS</span> prophecy.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/projects">
                  <Button className="w-full sm:w-auto h-14 px-8 text-lg font-bold uppercase tracking-widest bg-primary text-black hover:bg-primary/90 rounded-sm shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:shadow-[0_0_40px_rgba(245,158,11,0.5)] transition-all">
                    View Launches
                  </Button>
                </Link>
                <Link href="/apply">
                  <Button variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg font-bold uppercase tracking-widest border-white/20 text-white hover:bg-white/5 hover:border-white/40 rounded-sm transition-all">
                    Apply to Launch
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-black/40 border-y border-white/5 relative z-10">
        <div className="container px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
            {[
              {
                label: "DPINO Raised",
                value: stats ? formatDpino(stats.totalRaisedDpino) + " DPINO" : null,
                icon: Coins,
                color: "text-primary",
              },
              { label: "Active Launches", value: stats?.activeLaunches, icon: Activity, color: "text-secondary" },
              {
                label: "$DPINO Staked",
                value: stats ? formatDpino(stats.totalDpinoStaked) : null,
                icon: TrendingUp,
                color: "text-primary",
              },
              { label: "Total Stakers", value: stats?.totalStakers, icon: Users, color: "text-white" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="flex flex-col items-center text-center p-6 card-dark-glass rounded-lg border-t border-white/10"
              >
                <stat.icon className={`w-8 h-8 mb-4 ${stat.color} opacity-80`} />
                <h3 className="text-3xl md:text-4xl font-bold font-mono mb-2 text-foreground">
                  {statsLoading ? <Skeleton className="h-10 w-24 mx-auto bg-white/5" /> : stat.value}
                </h3>
                <p className="text-sm font-medium tracking-widest uppercase text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 relative z-10">
        <div className="container px-4">
          <h2 className="text-3xl font-black uppercase tracking-tighter mb-12 text-center">
            How the <span className="text-primary">Workflow</span> Flows
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* TOKEN LAUNCH */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-card/40 border border-primary/20 rounded-sm p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-sm bg-primary/20 flex items-center justify-center">
                  <Coins className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-bold uppercase tracking-widest text-sm">Token Launch</p>
                  <p className="text-xs text-muted-foreground">For Creators</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Submit your project to the DPINO Launchpad. The community raises in <span className="text-primary font-bold">$DPINO</span>, creating buy pressure that flows into the DPINO/SOL LP on Raydium.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-primary font-mono">
                <span>↓ IDO Participation</span>
                <span>→</span>
                <span>DPINO/SOL LP (Raydium)</span>
              </div>
            </motion.div>

            {/* STAKING VAULT */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-card/40 border border-secondary/20 rounded-sm p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-sm bg-secondary/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <p className="font-bold uppercase tracking-widest text-sm">Staking Vault</p>
                  <p className="text-xs text-muted-foreground">For Investors</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Stake $DPINO to earn tier status: <span className="text-primary">SOLDIER (100K)</span>, <span className="text-secondary">GENERAL (500K)</span>, or <span className="text-yellow-300">DARK LORD (1M)</span>. Higher tiers unlock guaranteed allocations.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-secondary font-mono">
                <span>↓ Fees in $DPINO</span>
                <span>→</span>
                <span>DPINO/SOL LP (Raydium)</span>
              </div>
            </motion.div>

            {/* IDO Participation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-card/40 border border-green-500/20 rounded-sm p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-sm bg-green-500/20 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="font-bold uppercase tracking-widest text-sm">IDO Participation</p>
                  <p className="text-xs text-muted-foreground">Pay with $DPINO</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                All IDO participation is denominated in <span className="text-primary font-bold">$DPINO</span>. No SOL, no USDC. Buy $DPINO first on Raydium, then invest in launches — every purchase compounds the flywheel.
              </p>
              <a
                href="https://raydium.io/swap/?inputMint=sol&outputMint=4fwCUiZ8qaddK3WFLXazXRtpYpHc39iYLnEfF7KjmoEy"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-xs text-green-400 hover:underline font-mono"
              >
                Buy $DPINO on Raydium →
              </a>
            </motion.div>

            {/* Fee Collection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="bg-card/40 border border-white/10 rounded-sm p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-sm bg-white/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-bold uppercase tracking-widest text-sm">Fee Collection</p>
                  <p className="text-xs text-muted-foreground">Paid in $DPINO</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A <span className="text-primary font-bold">0.5% protocol fee</span> on every IDO participation is collected in $DPINO. These fees flow directly into the DPINO/SOL LP on Raydium, deepening liquidity and supporting price.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-white/50 font-mono">
                <span>0.5% of each IDO</span>
                <span>→</span>
                <span>DPINO/SOL LP</span>
              </div>
            </motion.div>
          </div>

          {/* Central LP Callout */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mt-8 max-w-4xl mx-auto bg-primary/5 border border-primary/30 rounded-sm p-6 text-center"
          >
            <p className="text-primary font-black uppercase tracking-widest text-lg mb-2">
              DPINO/SOL Liquidity Pool — Already Live on Raydium
            </p>
            <p className="text-muted-foreground text-sm mb-4">
              Every token launch, staking fee, IDO contribution, and protocol fee flows back to the DPINO/SOL LP —
              compounding buy pressure and deepening liquidity with every transaction.
            </p>
            <a
              href="https://raydium.io/liquidity-pools/?token=4fwCUiZ8qaddK3WFLXazXRtpYpHc39iYLnEfF7KjmoEy"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary font-bold hover:underline"
            >
              View DPINO/SOL Pool on Raydium <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* Featured Projects */}
      <section className="py-24 relative z-10">
        <div className="container px-4">
          <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-4">
            <div>
              <h2 className="text-4xl font-black uppercase tracking-tighter mb-2 flex items-center gap-3">
                <span className="w-2 h-8 bg-secondary rounded-sm glow-violet"></span>
                Featured <span className="text-gradient-violet">Launches</span>
              </h2>
              <p className="text-muted-foreground max-w-xl">
                The most anticipated projects launching within the DPINO ecosystem.
              </p>
            </div>
            <Link href="/projects">
              <Button variant="ghost" className="uppercase tracking-widest font-bold text-xs hover:text-primary hover:bg-transparent">
                View All <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>

          {featuredLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-[400px] w-full bg-white/5 rounded-sm" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProjects?.map((project, i) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <Link href={`/projects/${project.id}`}>
                    <Card className="h-full bg-card/40 border-white/5 hover:border-secondary/50 transition-all duration-500 overflow-hidden group cursor-pointer rounded-sm hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]">
                      <div className="h-48 relative overflow-hidden bg-black">
                        {project.bannerUrl ? (
                          <img
                            src={project.bannerUrl}
                            alt={project.name}
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-700"
                          />
                        ) : (
                          <img
                            src={i % 2 === 0 ? "/images/project-1.png" : "/images/project-2.png"}
                            alt="Project banner"
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-700"
                          />
                        )}
                        <div className="absolute top-4 right-4">
                          <Badge className={`uppercase tracking-widest font-bold ${
                            project.status === "live" ? "bg-green-500/20 text-green-400 border-green-500/50 glow-green" :
                            project.status === "upcoming" ? "bg-secondary/20 text-secondary border-secondary/50 glow-violet" :
                            "bg-muted text-muted-foreground border-white/10"
                          }`}>
                            {project.status}
                          </Badge>
                        </div>
                      </div>
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-2xl font-bold uppercase tracking-tight mb-1 group-hover:text-secondary transition-colors">
                              {project.name}
                            </h3>
                            <p className="text-sm font-mono text-muted-foreground">${project.ticker}</p>
                          </div>
                          {project.logoUrl && (
                            <img src={project.logoUrl} alt="" className="w-12 h-12 rounded-sm border border-white/10 bg-black" />
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-2 mb-6">{project.description}</p>

                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-sm mb-2 font-mono">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="text-primary">
                                {formatDpino(project.raisedAmount)} / {formatDpino(project.totalRaise)} DPINO
                              </span>
                            </div>
                            <Progress
                              value={(project.raisedAmount / project.totalRaise) * 100}
                              className="h-2 bg-white/5 [&>div]:bg-primary"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Price</p>
                              <p className="font-mono text-sm">{formatDpino(project.tokenPrice)} DPINO</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Participants</p>
                              <p className="font-mono text-sm">{project.participants}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Staking Promo */}
      <section className="py-24 relative z-10 overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 border-y border-primary/10"></div>
        <div className="container px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-6 text-gradient-gold">
              Secure Your Allocation
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              The launchpad is exclusive. You must stake $DPINO to access top-tier allocations.
              Higher tiers grant guaranteed allocations and multiplier bonuses.
            </p>
            <Link href="/stake">
              <Button className="h-14 px-10 text-lg font-bold uppercase tracking-widest bg-primary text-black hover:bg-primary/90 rounded-sm shadow-[0_0_30px_rgba(245,158,11,0.3)] transition-all">
                Stake $DPINO Now
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
