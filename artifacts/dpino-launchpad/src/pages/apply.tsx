import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useCreateProject } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Coins, Info } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters."),
  ticker: z.string().min(2, "Ticker must be at least 2 characters.").max(10, "Ticker max 10 characters.").toUpperCase(),
  description: z.string().min(20, "Description must be at least 20 characters."),
  category: z.string().min(1, "Please select a category."),
  tokenAddress: z.string().optional().or(z.literal("")),
  totalRaise: z.coerce.number().min(1000, "Minimum raise is 1,000 DPINO."),
  tokenPrice: z.coerce.number().min(0.000001, "Token price must be greater than 0."),
  minAllocation: z.coerce.number().min(0).optional(),
  maxAllocation: z.coerce.number().min(0).optional(),
  startDate: z.string().min(1, "Start date is required."),
  endDate: z.string().min(1, "End date is required."),
  websiteUrl: z.string().url("Must be a valid URL.").optional().or(z.literal("")),
  twitterUrl: z.string().url("Must be a valid URL.").optional().or(z.literal("")),
  telegramUrl: z.string().url("Must be a valid URL.").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

export default function Apply() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createProject = useCreateProject();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      ticker: "",
      description: "",
      category: "",
      tokenAddress: "",
      totalRaise: 0,
      tokenPrice: 0,
      minAllocation: undefined,
      maxAllocation: undefined,
      startDate: format(new Date(Date.now() + 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"),
      endDate: format(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"),
      websiteUrl: "",
      twitterUrl: "",
      telegramUrl: "",
    },
  });

  function onSubmit(values: FormValues) {
    createProject.mutate({
      data: {
        name: values.name,
        ticker: values.ticker,
        description: values.description,
        category: values.category,
        tokenAddress: values.tokenAddress || undefined,
        totalRaise: values.totalRaise,
        tokenPrice: values.tokenPrice,
        minAllocation: values.minAllocation || undefined,
        maxAllocation: values.maxAllocation || undefined,
        startDate: values.startDate,
        endDate: values.endDate,
        websiteUrl: values.websiteUrl || undefined,
        twitterUrl: values.twitterUrl || undefined,
        telegramUrl: values.telegramUrl || undefined,
      }
    }, {
      onSuccess: (project) => {
        toast({
          title: "Application Submitted",
          description: "Your project has been submitted. The DPINO Syndicate will review it shortly.",
        });
        setLocation(`/projects/${project.id}`);
      },
      onError: () => {
        toast({
          title: "Submission Failed",
          description: "There was an error submitting your project. Please try again.",
          variant: "destructive"
        });
      }
    });
  }

  return (
    <div className="w-full min-h-screen py-16 relative">
      <div className="absolute top-0 left-0 w-full h-96 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.1),transparent_70%)] pointer-events-none" />

      <div className="container max-w-4xl px-4 relative z-10">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-4 text-foreground">
            Apply to <span className="text-gradient-gold">Launch</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Submit your project for consideration on the DPINO Launchpad. All raises are denominated in{" "}
            <span className="text-primary font-bold">$DPINO</span>. A 0.5% protocol fee applies to all successful raises —
            this fee flows directly to the DPINO/SOL LP on Raydium.
          </p>
        </div>

        {/* Info banner */}
        <div className="mb-8 p-4 border border-primary/20 bg-primary/5 rounded-sm flex items-start gap-3">
          <Coins className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-primary mb-1">All amounts are in $DPINO</p>
            <p className="text-xs text-muted-foreground">
              Token prices, raise caps, and allocations are all denominated in $DPINO — not USD or SOL.
              Participants must hold $DPINO to participate in your IDO.
            </p>
          </div>
        </div>

        <Card className="bg-card/40 border-white/10 rounded-sm shadow-2xl backdrop-blur-sm">
          <CardContent className="p-8 md:p-12">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">

                {/* Basic Info */}
                <div className="space-y-6">
                  <h3 className="text-xl font-bold uppercase tracking-widest border-b border-white/10 pb-2 text-primary">Basic Info</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Project Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Dark Protocol" className="bg-black/50 border-white/20 h-12 rounded-sm focus-visible:ring-primary" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ticker"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Token Ticker *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. DARK" className="bg-black/50 border-white/20 h-12 rounded-sm font-mono focus-visible:ring-primary uppercase" {...field} onChange={e => field.onChange(e.target.value.toUpperCase())} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Project Description *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your project, vision, and utility. Be specific — the DPINO Syndicate reviews all applications."
                            className="bg-black/50 border-white/20 min-h-[140px] rounded-sm focus-visible:ring-primary"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Category *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-black/50 border-white/20 h-12 rounded-sm focus-visible:ring-primary">
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-card border-white/10">
                              <SelectItem value="DeFi">DeFi</SelectItem>
                              <SelectItem value="Gaming">Gaming / GameFi</SelectItem>
                              <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                              <SelectItem value="NFT">NFT / Metaverse</SelectItem>
                              <SelectItem value="Meme">Meme / Culture</SelectItem>
                              <SelectItem value="AI">AI / Web3</SelectItem>
                              <SelectItem value="DAO">DAO / Governance</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="tokenAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Token Contract Address (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Solana token mint address" className="bg-black/50 border-white/20 h-12 rounded-sm font-mono text-xs focus-visible:ring-primary" {...field} />
                          </FormControl>
                          <FormDescription className="text-xs text-muted-foreground/60">Leave blank if token is not yet deployed.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Raise Details (DPINO) */}
                <div className="space-y-6 pt-2">
                  <h3 className="text-xl font-bold uppercase tracking-widest border-b border-white/10 pb-2 text-primary">Raise Details — in $DPINO</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="totalRaise"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Hard Cap (DPINO) *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input type="number" placeholder="500000" className="bg-black/50 border-white/20 h-12 rounded-sm font-mono focus-visible:ring-primary pr-20" {...field} />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-mono font-bold">DPINO</span>
                            </div>
                          </FormControl>
                          <FormDescription className="text-xs text-muted-foreground/60">Maximum $DPINO to raise from participants.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tokenPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Token Price (DPINO) *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input type="number" step="0.000001" placeholder="0.5" className="bg-black/50 border-white/20 h-12 rounded-sm font-mono focus-visible:ring-primary pr-20" {...field} />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-mono font-bold">DPINO</span>
                            </div>
                          </FormControl>
                          <FormDescription className="text-xs text-muted-foreground/60">Price per 1 project token, in $DPINO.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="minAllocation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Min Allocation (DPINO) — Optional</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input type="number" placeholder="100" className="bg-black/50 border-white/20 h-12 rounded-sm font-mono focus-visible:ring-primary pr-20" {...field} />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-mono font-bold">DPINO</span>
                            </div>
                          </FormControl>
                          <FormDescription className="text-xs text-muted-foreground/60">Minimum $DPINO a user can invest.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="maxAllocation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Max Allocation (DPINO) — Optional</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input type="number" placeholder="10000" className="bg-black/50 border-white/20 h-12 rounded-sm font-mono focus-visible:ring-primary pr-20" {...field} />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-mono font-bold">DPINO</span>
                            </div>
                          </FormControl>
                          <FormDescription className="text-xs text-muted-foreground/60">Maximum $DPINO a single wallet can invest.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">IDO Start Date & Time *</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" className="bg-black/50 border-white/20 h-12 rounded-sm font-mono focus-visible:ring-primary" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">IDO End Date & Time *</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" className="bg-black/50 border-white/20 h-12 rounded-sm font-mono focus-visible:ring-primary" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Social Links */}
                <div className="space-y-6 pt-2">
                  <h3 className="text-xl font-bold uppercase tracking-widest border-b border-white/10 pb-2 text-primary">Social Links</h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="websiteUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Website</FormLabel>
                          <FormControl>
                            <Input placeholder="https://yourproject.io" className="bg-black/50 border-white/20 h-12 rounded-sm focus-visible:ring-primary text-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="twitterUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">X / Twitter</FormLabel>
                          <FormControl>
                            <Input placeholder="https://x.com/yourproject" className="bg-black/50 border-white/20 h-12 rounded-sm focus-visible:ring-primary text-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="telegramUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Telegram</FormLabel>
                          <FormControl>
                            <Input placeholder="https://t.me/yourproject" className="bg-black/50 border-white/20 h-12 rounded-sm focus-visible:ring-primary text-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Terms */}
                <div className="pt-2 border-t border-white/5">
                  <div className="flex items-start gap-3 p-4 bg-white/[0.02] border border-white/10 rounded-sm mb-6">
                    <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      By submitting, you confirm your project is a legitimate Solana-based project. The DPINO Syndicate reserves the right to reject any application. Approved projects will have their status changed to LIVE by the admin team. All raises are collected in $DPINO with a 0.5% protocol fee routed to the DPINO/SOL LP on Raydium.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={createProject.isPending}
                    className="w-full h-16 text-lg font-bold uppercase tracking-widest bg-primary text-black hover:bg-primary/90 rounded-sm shadow-[0_0_30px_rgba(245,158,11,0.2)] hover:shadow-[0_0_40px_rgba(245,158,11,0.4)] transition-all"
                  >
                    {createProject.isPending ? "Submitting Application..." : "Submit to DPINO Syndicate"}
                  </Button>
                </div>

              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
