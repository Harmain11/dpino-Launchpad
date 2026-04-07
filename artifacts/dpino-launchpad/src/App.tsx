import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/layout";
import { SolanaWalletProvider } from "@/providers/SolanaWalletProvider";
import { useWallet } from "@solana/wallet-adapter-react";
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

function WalletProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { connected } = useWallet();
  if (!connected) return <Redirect to="/" />;
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
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("dark");
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SolanaWalletProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </SolanaWalletProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AppInner />
    </WouterRouter>
  );
}

export default App;
