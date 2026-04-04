import { useEffect, useRef } from "react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, useClerk, useUser } from "@clerk/react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/layout";
import { SolanaWalletProvider } from "@/providers/SolanaWalletProvider";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import Stake from "@/pages/stake";
import Apply from "@/pages/apply";
import Admin from "@/pages/admin";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import SsoCallback from "@/pages/sso-callback";
import NotFound from "@/pages/not-found";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

if (!clerkPubKey) {
  console.error("Missing VITE_CLERK_PUBLISHABLE_KEY — authentication will not work");
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

// Redirects authenticated users away from sign-in/up to dashboard
function GuestRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <Component />;
}

// Protects routes — redirects to sign-in if not authenticated
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Loading...</p>
        </div>
      </div>
    );
  }
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* Auth pages — no nav/footer, redirect to dashboard if already signed in */}
      <Route path="/sign-in/*?">
        {() => <GuestRoute component={SignInPage} />}
      </Route>
      <Route path="/sign-up/*?">
        {() => <GuestRoute component={SignUpPage} />}
      </Route>
      <Route path="/sso-callback" component={SsoCallback} />

      {/* Main app — with nav/footer */}
      <Route>
        {() => (
          <Layout>
            <Switch>
              {/* Public */}
              <Route path="/" component={Home} />

              {/* Protected — require sign-in */}
              <Route path="/dashboard">
                {() => <ProtectedRoute component={Dashboard} />}
              </Route>
              <Route path="/projects">
                {() => <ProtectedRoute component={Projects} />}
              </Route>
              <Route path="/projects/:id">
                {() => <ProtectedRoute component={ProjectDetail} />}
              </Route>
              <Route path="/stake">
                {() => <ProtectedRoute component={Stake} />}
              </Route>
              <Route path="/apply">
                {() => <ProtectedRoute component={Apply} />}
              </Route>

              {/* Admin — no auth gate (security by obscurity) */}
              <Route path="/admin" component={Admin} />

              <Route component={NotFound} />
            </Switch>
          </Layout>
        )}
      </Route>
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <SolanaWalletProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </SolanaWalletProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("dark");
  }

  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
