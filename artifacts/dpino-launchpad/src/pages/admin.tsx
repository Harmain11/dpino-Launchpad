import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useListProjects } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, RefreshCw, ExternalLink, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_BASE = `${BASE}/api`;

function formatDpino(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

const projectSchema = z.object({
  name: z.string().min(2),
  ticker: z.string().min(2).max(10),
  description: z.string().min(10),
  category: z.string().min(1),
  tokenAddress: z.string().optional().or(z.literal("")),
  totalRaise: z.coerce.number().min(1),
  tokenPrice: z.coerce.number().min(0.000001),
  minAllocation: z.coerce.number().min(0).optional(),
  maxAllocation: z.coerce.number().min(0).optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  logoUrl: z.string().optional().or(z.literal("")),
  bannerUrl: z.string().optional().or(z.literal("")),
  websiteUrl: z.string().optional().or(z.literal("")),
  twitterUrl: z.string().optional().or(z.literal("")),
  telegramUrl: z.string().optional().or(z.literal("")),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

function ProjectForm({ initial, onSave, onCancel }: {
  initial?: Partial<ProjectFormValues>;
  onSave: (v: ProjectFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "", ticker: "", description: "", category: "", tokenAddress: "",
      totalRaise: 0, tokenPrice: 0, minAllocation: undefined, maxAllocation: undefined,
      startDate: format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm"),
      endDate: format(new Date(Date.now() + 8 * 86400000), "yyyy-MM-dd'T'HH:mm"),
      logoUrl: "", bannerUrl: "", websiteUrl: "", twitterUrl: "", telegramUrl: "",
      ...initial,
    },
  });

  const [saving, setSaving] = useState(false);

  async function onSubmit(v: ProjectFormValues) {
    setSaving(true);
    try { await onSave(v); } finally { setSaving(false); }
  }

  const inp = "bg-black/50 border-white/20 h-10 rounded-sm focus-visible:ring-primary text-sm";
  const lbl = "uppercase tracking-widest text-[10px] text-muted-foreground";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel className={lbl}>Name *</FormLabel>
              <FormControl><Input className={inp} placeholder="Project Name" {...field} /></FormControl>
              <FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="ticker" render={({ field }) => (
            <FormItem><FormLabel className={lbl}>Ticker *</FormLabel>
              <FormControl><Input className={`${inp} font-mono uppercase`} placeholder="TICK" {...field} onChange={e => field.onChange(e.target.value.toUpperCase())} /></FormControl>
              <FormMessage /></FormItem>
          )} />
        </div>

        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel className={lbl}>Description *</FormLabel>
            <FormControl><Textarea className="bg-black/50 border-white/20 rounded-sm focus-visible:ring-primary text-sm min-h-[80px]" placeholder="Project description..." {...field} /></FormControl>
            <FormMessage /></FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem><FormLabel className={lbl}>Category *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger className="bg-black/50 border-white/20 h-10 rounded-sm text-sm"><SelectValue placeholder="Category" /></SelectTrigger></FormControl>
                <SelectContent className="bg-card border-white/10">
                  {["DeFi","Gaming","Infrastructure","NFT","Meme","AI","DAO"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="tokenAddress" render={({ field }) => (
            <FormItem><FormLabel className={lbl}>Token Address</FormLabel>
              <FormControl><Input className={`${inp} font-mono text-xs`} placeholder="Solana mint address" {...field} /></FormControl>
              <FormMessage /></FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="totalRaise" render={({ field }) => (
            <FormItem><FormLabel className={lbl}>Hard Cap (DPINO) *</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input type="number" className={`${inp} pr-16`} placeholder="500000" {...field} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-primary font-mono">DPINO</span>
                </div>
              </FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="tokenPrice" render={({ field }) => (
            <FormItem><FormLabel className={lbl}>Token Price (DPINO) *</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input type="number" step="0.000001" className={`${inp} pr-16`} placeholder="0.5" {...field} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-primary font-mono">DPINO</span>
                </div>
              </FormControl><FormMessage /></FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="minAllocation" render={({ field }) => (
            <FormItem><FormLabel className={lbl}>Min Allocation (DPINO)</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input type="number" className={`${inp} pr-16`} placeholder="100" {...field} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-primary font-mono">DPINO</span>
                </div>
              </FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="maxAllocation" render={({ field }) => (
            <FormItem><FormLabel className={lbl}>Max Allocation (DPINO)</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input type="number" className={`${inp} pr-16`} placeholder="10000" {...field} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-primary font-mono">DPINO</span>
                </div>
              </FormControl><FormMessage /></FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="startDate" render={({ field }) => (
            <FormItem><FormLabel className={lbl}>Start Date *</FormLabel>
              <FormControl><Input type="datetime-local" className={inp} {...field} /></FormControl>
              <FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="endDate" render={({ field }) => (
            <FormItem><FormLabel className={lbl}>End Date *</FormLabel>
              <FormControl><Input type="datetime-local" className={inp} {...field} /></FormControl>
              <FormMessage /></FormItem>
          )} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField control={form.control} name="websiteUrl" render={({ field }) => (
            <FormItem><FormLabel className={lbl}>Website</FormLabel>
              <FormControl><Input className={inp} placeholder="https://..." {...field} /></FormControl>
              <FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="twitterUrl" render={({ field }) => (
            <FormItem><FormLabel className={lbl}>X / Twitter</FormLabel>
              <FormControl><Input className={inp} placeholder="https://x.com/..." {...field} /></FormControl>
              <FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="telegramUrl" render={({ field }) => (
            <FormItem><FormLabel className={lbl}>Telegram</FormLabel>
              <FormControl><Input className={inp} placeholder="https://t.me/..." {...field} /></FormControl>
              <FormMessage /></FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="logoUrl" render={({ field }) => (
            <FormItem><FormLabel className={lbl}>Logo URL</FormLabel>
              <FormControl><Input className={inp} placeholder="https://..." {...field} /></FormControl>
              <FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="bannerUrl" render={({ field }) => (
            <FormItem><FormLabel className={lbl}>Banner URL</FormLabel>
              <FormControl><Input className={inp} placeholder="https://..." {...field} /></FormControl>
              <FormMessage /></FormItem>
          )} />
        </div>

        <div className="flex gap-3 pt-2 border-t border-white/10">
          <Button type="submit" disabled={saving} className="flex-1 bg-primary text-black font-bold uppercase tracking-widest rounded-sm h-10">
            {saving ? "Saving..." : "Save Project"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} className="border-white/20 uppercase tracking-widest rounded-sm h-10">
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editProject, setEditProject] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: projects, isLoading, refetch } = useListProjects(
    { status: "all" },
    { query: { queryKey: ["/api/projects", "all"] } }
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    refetch();
  };

  async function createProject(values: ProjectFormValues) {
    const res = await fetch(`${API_BASE}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        tokenAddress: values.tokenAddress || undefined,
        logoUrl: values.logoUrl || undefined,
        bannerUrl: values.bannerUrl || undefined,
        websiteUrl: values.websiteUrl || undefined,
        twitterUrl: values.twitterUrl || undefined,
        telegramUrl: values.telegramUrl || undefined,
        minAllocation: values.minAllocation || undefined,
        maxAllocation: values.maxAllocation || undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to create project");
    }
    toast({ title: "Project Created", description: `${values.name} added successfully.` });
    setAddOpen(false);
    invalidate();
  }

  async function updateProject(id: string, values: Partial<ProjectFormValues & { status?: string }>) {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error("Failed to update");
    toast({ title: "Project Updated" });
    setEditProject(null);
    invalidate();
  }

  async function deleteProject(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: "Project Deleted", description: `${name} has been removed.` });
      invalidate();
    } catch {
      toast({ title: "Error", description: "Failed to delete project.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  async function changeStatus(id: string, status: "upcoming" | "live" | "ended") {
    await fetch(`${API_BASE}/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    toast({ title: "Status Updated", description: `Project set to ${status.toUpperCase()}.` });
    invalidate();
  }

  const statusColors: Record<string, string> = {
    live:     "bg-green-500/20 text-green-400 border-green-500/50",
    upcoming: "bg-violet-500/20 text-violet-400 border-violet-500/50",
    ended:    "bg-white/5 text-muted-foreground border-white/10",
  };

  return (
    <div className="w-full min-h-screen py-12">
      <div className="container px-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Restricted — Internal Use Only</p>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-gradient-gold">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => refetch()} className="border-white/20 rounded-sm h-10 uppercase tracking-widest text-xs">
              <RefreshCw className="w-3 h-3 mr-2" /> Refresh
            </Button>
            <Button onClick={() => setAddOpen(true)} className="bg-primary text-black font-bold uppercase tracking-widest rounded-sm h-10">
              <Plus className="w-4 h-4 mr-2" /> Add Project
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Total Projects", value: projects?.length ?? 0 },
            { label: "Live", value: projects?.filter(p => p.status === "live").length ?? 0 },
            { label: "Upcoming", value: projects?.filter(p => p.status === "upcoming").length ?? 0 },
            { label: "Ended", value: projects?.filter(p => p.status === "ended").length ?? 0 },
          ].map(s => (
            <div key={s.label} className="bg-card/40 border border-white/5 rounded-sm p-4 text-center">
              <p className="text-3xl font-black font-mono text-foreground">{s.value}</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Warning */}
        <div className="mb-6 flex items-start gap-2 p-3 border border-yellow-500/20 bg-yellow-500/5 rounded-sm">
          <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-400">
            This admin panel has no authentication. Do not share the URL. New projects are created with <strong>UPCOMING</strong> status — change to LIVE when ready to open for participation.
          </p>
        </div>

        {/* Projects Table */}
        {isLoading ? (
          <p className="text-center text-muted-foreground py-20">Loading projects...</p>
        ) : projects?.length === 0 ? (
          <div className="text-center py-24 border border-white/5 rounded-sm bg-black/20">
            <p className="text-xl font-bold uppercase tracking-widest mb-2">No Projects</p>
            <p className="text-muted-foreground mb-6">The database is empty. Add the first real project.</p>
            <Button onClick={() => setAddOpen(true)} className="bg-primary text-black font-bold uppercase tracking-widest rounded-sm">
              <Plus className="w-4 h-4 mr-2" /> Add First Project
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {projects?.map((project) => (
              <Card key={project.id} className="bg-card/40 border-white/5 rounded-sm">
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <h3 className="font-black uppercase tracking-tight text-lg">{project.name}</h3>
                        <span className="font-mono text-xs text-muted-foreground">${project.ticker}</span>
                        <Badge className={`text-[10px] uppercase tracking-widest border ${statusColors[project.status]}`}>
                          {project.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-white/10 text-muted-foreground">
                          {project.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{project.description}</p>
                      <div className="flex flex-wrap gap-4 text-xs font-mono text-muted-foreground">
                        <span>Cap: <span className="text-primary">{formatDpino(project.totalRaise)} DPINO</span></span>
                        <span>Raised: <span className="text-foreground">{formatDpino(project.raisedAmount)} DPINO</span></span>
                        <span>Price: <span className="text-foreground">{formatDpino(project.tokenPrice)} DPINO</span></span>
                        <span>Participants: <span className="text-foreground">{project.participants}</span></span>
                        {project.tokenAddress && (
                          <span className="text-green-400">Token: {project.tokenAddress.slice(0, 8)}...</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {/* Status change buttons */}
                      {project.status !== "upcoming" && (
                        <Button size="sm" variant="outline" onClick={() => changeStatus(project.id, "upcoming")} className="h-8 text-[10px] border-violet-500/30 text-violet-400 hover:bg-violet-500/10 rounded-sm uppercase tracking-widest">
                          → Upcoming
                        </Button>
                      )}
                      {project.status !== "live" && (
                        <Button size="sm" variant="outline" onClick={() => changeStatus(project.id, "live")} className="h-8 text-[10px] border-green-500/30 text-green-400 hover:bg-green-500/10 rounded-sm uppercase tracking-widest">
                          → Live
                        </Button>
                      )}
                      {project.status !== "ended" && (
                        <Button size="sm" variant="outline" onClick={() => changeStatus(project.id, "ended")} className="h-8 text-[10px] border-white/20 text-muted-foreground hover:bg-white/5 rounded-sm uppercase tracking-widest">
                          → End
                        </Button>
                      )}

                      <Link href={`/projects/${project.id}`} target="_blank">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-white/5">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => setEditProject(project)} className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deletingId === project.id}
                        onClick={() => deleteProject(project.id, project.name)}
                        className="h-8 w-8 p-0 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Project Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="border-primary/20 bg-card backdrop-blur-xl rounded-sm max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-primary">Add New Project</DialogTitle>
          </DialogHeader>
          <ProjectForm
            onSave={createProject}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Project Modal */}
      <Dialog open={!!editProject} onOpenChange={(o) => !o && setEditProject(null)}>
        <DialogContent className="border-primary/20 bg-card backdrop-blur-xl rounded-sm max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-primary">
              Edit — {editProject?.name}
            </DialogTitle>
          </DialogHeader>
          {editProject && (
            <ProjectForm
              initial={{
                name: editProject.name,
                ticker: editProject.ticker,
                description: editProject.description,
                category: editProject.category,
                tokenAddress: editProject.tokenAddress ?? "",
                totalRaise: editProject.totalRaise,
                tokenPrice: editProject.tokenPrice,
                minAllocation: editProject.minAllocation,
                maxAllocation: editProject.maxAllocation,
                startDate: editProject.startDate ? editProject.startDate.slice(0, 16) : "",
                endDate: editProject.endDate ? editProject.endDate.slice(0, 16) : "",
                logoUrl: editProject.logoUrl ?? "",
                bannerUrl: editProject.bannerUrl ?? "",
                websiteUrl: editProject.websiteUrl ?? "",
                twitterUrl: editProject.twitterUrl ?? "",
                telegramUrl: editProject.telegramUrl ?? "",
              }}
              onSave={(v) => updateProject(editProject.id, {
                ...v,
                tokenAddress: v.tokenAddress || undefined,
                logoUrl: v.logoUrl || undefined,
                bannerUrl: v.bannerUrl || undefined,
                websiteUrl: v.websiteUrl || undefined,
                twitterUrl: v.twitterUrl || undefined,
                telegramUrl: v.telegramUrl || undefined,
              })}
              onCancel={() => setEditProject(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
