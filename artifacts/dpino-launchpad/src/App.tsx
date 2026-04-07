import { useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/layout";
import { SolanaWalletProvider } from "@/providers/SolanaWalletProvider";
import { useWallet } from "@solana/wallet-adapter-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wallet, Shield, Zap, Crown } from "lucide-react";
import { WalletGateContext, PROTECTED_PATHS, useWalletGate } from "@/context/WalletGateContext";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import Stake from "@/pages/stake";
import Apply from "@/pages/apply";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const WALLET_OPTIONS = [
  { name: "Phantom",  id: "phantom",  icon: "https://phantom.app/favicon.ico",  desc: "Most popular Solana wallet" },
  { name: "Solflare", id: "solflare", icon: "https://solflare.com/favicon.ico", desc: "Advanced Solana wallet" },
];

function ConnectWalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { select, wallets } = useWallet();

  const handleSelect = (walletName: string) => {
    const found = wallets.find((w) => w.adapter.name.toLowerCase() === walletName.toLowerCase());
    if (found) select(found.adapter.name);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-primary/20 bg-card/95 backdrop-blur-xl shadow-[0_0_50px_rgba(245,158,11,0.15)] rounded-sm max-w-md">
        <DialogHeader>
          <div className="flex flex-col items-center gap-3 pb-2">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Wallet className="w-7 h-7 text-primary" />
            </div>
            <DialogTitle className="text-xl font-black text-center uppercase tracking-widest">
              Connect <span className="text-primary">Wallet</span>
            </DialogTitle>
            <p className="text-sm text-muted-foreground text-center">
              Connect your Solana wallet to access staking, launches, and your dashboard.
            </p>
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          {WALLET_OPTIONS.map((w) => (
            <button
              key={w.id}
              onClick={() => handleSelect(w.name)}
              className="w-full flex items-center gap-4 p-4 border border-white/10 hover:border-primary/40 hover:bg-primary/5 rounded-sm transition-all group"
            >
              <img
                src={w.icon}
                alt={w.name}
                className="w-10 h-10 rounded-md"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="text-left">
                <p className="font-bold text-foreground group-hover:text-primary transition-colors">{w.name}</p>
                <p className="text-xs text-muted-foreground">{w.desc}</p>
              </div>
              <span className="ml-auto text-muted-foreground group-hover:text-primary transition-colors text-lg">→</span>
            </button>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-muted-foreground text-center mb-3">Unlock access by holding $DPINO</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "SOLDIER", req: "100K", color: "text-amber-400", icon: Shield },
              { label: "GENERAL", req: "500K", color: "text-violet-400", icon: Zap },
              { label: "DARK LORD", req: "1M", color: "text-yellow-300", icon: Crown },
            ].map(({ label, req, color, icon: Icon }) => (
              <div key={label} className="border border-white/10 rounded-sm p-2 bg-white/[0.02] text-center">
                <Icon className={`w-3 h-3 mx-auto mb-1 ${color}`} />
                <p className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>{label}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{req} DPINO</p>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WalletProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { connected } = useWallet();
  const { openConnectModal } = useWalletGate();
  const [, navigate] = useLocation();

  if (!connected) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 px-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.15)]">
          <Wallet className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Wallet Required</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Connect your Solana wallet to access this section of the DPINO Launchpad.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={openConnectModal}
            className="bg-primary text-black font-black uppercase tracking-widest px-6 py-3 rounded-sm hover:bg-primary/90 transition-colors shadow-[0_0_20px_rgba(245,158,11,0.3)]"
          >
            Connect Wallet
          </button>
          <button
            onClick={() => navigate("/")}
            className="border border-white/20 text-muted-foreground font-bold uppercase tracking-widest px-6 py-3 rounded-sm hover:border-white/40 hover:text-foreground transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route>
        {() => (
          <Layout>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/dashboard">
                {() => <WalletProtectedRoute component={Dashboard} />}
              </Route>
              <Route path="/projects">
                {() => <WalletProtectedRoute component={Projects} />}
              </Route>
              <Route path="/projects/:id">
                {() => <WalletProtectedRoute component={ProjectDetail} />}
              </Route>
              <Route path="/stake">
                {() => <WalletProtectedRoute component={Stake} />}
              </Route>
              <Route path="/apply">
                {() => <WalletProtectedRoute component={Apply} />}
              </Route>
              <Route path="/admin" component={Admin} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        )}
      </Route>
    </Switch>
  );
}

function AppInner() {
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  if (typeof document !== "undefined") {
    document.documentElement.classList.add("dark");
  }

  const openConnectModal = () => setConnectModalOpen(true);

  return (
    <WalletGateContext.Provider value={{ openConnectModal }}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router />
          <ConnectWalletModal open={connectModalOpen} onClose={() => setConnectModalOpen(false)} />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </WalletGateContext.Provider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <SolanaWalletProvider>
        <AppInner />
      </SolanaWalletProvider>
    </WouterRouter>
  );
}

export default App;
