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

const formSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters."),
  ticker: z.string().min(2, "Ticker must be at least 2 characters.").max(10, "Ticker max 10 characters.").toUpperCase(),
  description: z.string().min(20, "Description must be at least 20 characters."),
  category: z.string().min(1, "Please select a category."),
  totalRaise: z.coerce.number().min(1000, "Minimum raise is $1,000."),
  tokenPrice: z.coerce.number().min(0.000001, "Token price must be greater than 0."),
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
      totalRaise: 0,
      tokenPrice: 0,
      startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"),
      websiteUrl: "",
      twitterUrl: "",
      telegramUrl: "",
    },
  });

  function onSubmit(values: FormValues) {
    createProject.mutate({
      data: {
        ...values,
        websiteUrl: values.websiteUrl || undefined,
        twitterUrl: values.twitterUrl || undefined,
        telegramUrl: values.telegramUrl || undefined,
      }
    }, {
      onSuccess: (project) => {
        toast({
          title: "Application Submitted",
          description: "Your project has been submitted for review.",
        });
        setLocation(`/projects/${project.id}`);
      },
      onError: (error) => {
        toast({
          title: "Submission Failed",
          description: "There was an error submitting your project. Please try again.",
          variant: "destructive"
        });
        console.error(error);
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
          <p className="text-lg text-muted-foreground">
            Submit your project for consideration. The DPINO Syndicate reviews all applications to ensure elite quality.
            A 0.5% protocol fee applies to all successful raises.
          </p>
        </div>

        <Card className="bg-card/40 border-white/10 rounded-sm shadow-2xl backdrop-blur-sm">
          <CardContent className="p-8 md:p-12">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                
                <div className="space-y-6">
                  <h3 className="text-xl font-bold uppercase tracking-widest border-b border-white/10 pb-2 text-primary">Basic Info</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Project Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter project name" className="bg-black/50 border-white/20 h-12 rounded-sm focus-visible:ring-primary" {...field} />
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
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Token Ticker</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. DPINO" className="bg-black/50 border-white/20 h-12 rounded-sm font-mono focus-visible:ring-primary uppercase" {...field} />
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
                        <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Project Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe your project, vision, and utility..." 
                            className="bg-black/50 border-white/20 min-h-[120px] rounded-sm focus-visible:ring-primary" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-black/50 border-white/20 h-12 rounded-sm focus-visible:ring-primary">
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-white/10">
                            <SelectItem value="DeFi">DeFi</SelectItem>
                            <SelectItem value="GameFi">GameFi</SelectItem>
                            <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                            <SelectItem value="NFT">NFT / Metaverse</SelectItem>
                            <SelectItem value="Meme">Meme / Culture</SelectItem>
                            <SelectItem value="AI">AI / Web3</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-6 pt-6">
                  <h3 className="text-xl font-bold uppercase tracking-widest border-b border-white/10 pb-2 text-primary">Raise Details</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="totalRaise"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Total Raise (USD)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="100000" className="bg-black/50 border-white/20 h-12 rounded-sm font-mono focus-visible:ring-primary" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tokenPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Token Price (USD)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.000001" placeholder="0.05" className="bg-black/50 border-white/20 h-12 rounded-sm font-mono focus-visible:ring-primary" {...field} />
                          </FormControl>
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
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Start Date & Time</FormLabel>
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
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">End Date & Time</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" className="bg-black/50 border-white/20 h-12 rounded-sm font-mono focus-visible:ring-primary" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-6 pt-6">
                  <h3 className="text-xl font-bold uppercase tracking-widest border-b border-white/10 pb-2 text-primary">Social Links</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="websiteUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Website (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://" className="bg-black/50 border-white/20 h-12 rounded-sm focus-visible:ring-primary text-sm" {...field} />
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
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Twitter (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://x.com/" className="bg-black/50 border-white/20 h-12 rounded-sm focus-visible:ring-primary text-sm" {...field} />
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
                          <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Telegram (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://t.me/" className="bg-black/50 border-white/20 h-12 rounded-sm focus-visible:ring-primary text-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={createProject.isPending}
                  className="w-full h-16 mt-8 text-lg font-bold uppercase tracking-widest bg-primary text-black hover:bg-primary/90 rounded-sm shadow-[0_0_30px_rgba(245,158,11,0.2)] hover:shadow-[0_0_40px_rgba(245,158,11,0.4)] transition-all"
                >
                  {createProject.isPending ? "Submitting Application..." : "Submit Project"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
