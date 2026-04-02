import React, { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useListProjects } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Clock, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";

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

export default function Projects() {
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "upcoming" | "ended">("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: projects, isLoading } = useListProjects(
    { status: statusFilter },
    { query: { queryKey: ["/api/projects", statusFilter] } }
  );

  const filteredProjects = projects?.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.ticker.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full min-h-screen py-12 relative">
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      
      <div className="container px-4 relative z-10">
        <div className="mb-12">
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-4 text-gradient-gold">
            Launchpad
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Discover and participate in the most exclusive token launches on Solana.
          </p>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <Tabs defaultValue="all" onValueChange={(v) => setStatusFilter(v as any)} className="w-full md:w-auto">
            <TabsList className="bg-black/50 border border-white/10 p-1 h-auto">
              <TabsTrigger value="all" className="uppercase tracking-widest text-xs py-2 px-4 data-[state=active]:bg-white/10 data-[state=active]:text-white">All</TabsTrigger>
              <TabsTrigger value="live" className="uppercase tracking-widest text-xs py-2 px-4 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Live</TabsTrigger>
              <TabsTrigger value="upcoming" className="uppercase tracking-widest text-xs py-2 px-4 data-[state=active]:bg-secondary/20 data-[state=active]:text-secondary">Upcoming</TabsTrigger>
              <TabsTrigger value="ended" className="uppercase tracking-widest text-xs py-2 px-4 data-[state=active]:bg-white/10 data-[state=active]:text-muted-foreground">Ended</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search projects..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-black/50 border-white/10 focus-visible:ring-primary rounded-sm h-11"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-[450px] w-full bg-white/5 rounded-sm" />
            ))}
          </div>
        ) : filteredProjects?.length === 0 ? (
          <div className="text-center py-24 border border-white/5 rounded-sm bg-black/20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <Filter className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold uppercase tracking-widest mb-2">No Projects Found</h3>
            <p className="text-muted-foreground">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProjects?.map((project, i) => {
              const tl = calculateTimeLeft(project.endDate);
              const hasTimeLeft = Object.keys(tl).length > 0;
              
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                >
                  <Link href={`/projects/${project.id}`}>
                    <Card className="h-full bg-card/40 border-white/5 hover:border-primary/50 transition-all duration-500 overflow-hidden group cursor-pointer rounded-sm hover:shadow-[0_0_30px_rgba(245,158,11,0.1)] flex flex-col">
                      <div className="h-48 relative overflow-hidden bg-black shrink-0">
                        {project.bannerUrl ? (
                          <img 
                            src={project.bannerUrl} 
                            alt={project.name} 
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-700"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-black to-zinc-900 group-hover:scale-105 transition-transform duration-700 relative">
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.2),transparent_70%)]" />
                          </div>
                        )}
                        <div className="absolute top-4 left-4">
                          <Badge variant="outline" className="bg-black/50 backdrop-blur-md border-white/20 text-xs">
                            {project.category}
                          </Badge>
                        </div>
                        <div className="absolute top-4 right-4">
                          <Badge className={`uppercase tracking-widest font-bold ${
                            project.status === 'live' ? 'bg-green-500/20 text-green-400 border-green-500/50 glow-green' :
                            project.status === 'upcoming' ? 'bg-secondary/20 text-secondary border-secondary/50 glow-violet' :
                            'bg-muted text-muted-foreground border-white/10'
                          }`}>
                            {project.status}
                          </Badge>
                        </div>
                      </div>
                      
                      <CardContent className="p-6 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-4 shrink-0">
                          <div>
                            <h3 className="text-2xl font-bold uppercase tracking-tight mb-1 group-hover:text-primary transition-colors">{project.name}</h3>
                            <p className="text-sm font-mono text-muted-foreground">${project.ticker}</p>
                          </div>
                        </div>
                        
                        <div className="flex-1">
                          <div className="space-y-6">
                            <div>
                              <div className="flex justify-between text-sm mb-2 font-mono">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="text-primary">{formatCurrency(project.raisedAmount)} / {formatCurrency(project.totalRaise)}</span>
                              </div>
                              <Progress value={(project.raisedAmount / project.totalRaise) * 100} className="h-2 bg-white/5 [&>div]:bg-primary" />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Price</p>
                                <p className="font-mono text-sm">${project.tokenPrice}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Participants</p>
                                <p className="font-mono text-sm">{project.participants}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {(project.status === 'live' || project.status === 'upcoming') && hasTimeLeft && (
                          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-center gap-2 text-sm font-mono text-muted-foreground">
                            <Clock className="w-4 h-4 text-primary" />
                            <span>Ends in: </span>
                            <span className="text-foreground">
                              {tl.d}d {tl.h}h {tl.m}m
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
