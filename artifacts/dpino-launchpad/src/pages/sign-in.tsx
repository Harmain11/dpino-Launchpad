import React, { useState } from "react";
import { useSignIn } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Eye, EyeOff, AlertCircle, ArrowRight, Mail, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function SignInPage() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogle = async () => {
    if (!isLoaded) return;
    setGoogleLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${window.location.origin}${basePath}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}${basePath}/`,
      });
    } catch (e: any) {
      setError(e.errors?.[0]?.message ?? "Google sign-in failed.");
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        setLocation("/");
      } else {
        setError("Sign-in incomplete. Please try again.");
      }
    } catch (e: any) {
      setError(e.errors?.[0]?.longMessage ?? e.errors?.[0]?.message ?? "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-[#060606]">
      {/* Left panel — branding */}
      <div className="hidden lg:flex w-1/2 flex-col items-center justify-center p-16 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(245,158,11,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.06),transparent_60%)]" />
        <div className="relative z-10 text-center max-w-sm">
          <div className="w-28 h-28 rounded-xl overflow-hidden border-2 border-primary/40 shadow-[0_0_60px_rgba(245,158,11,0.3)] mx-auto mb-8">
            <img src="/dpino-logo.jpeg" alt="DPINO" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-3">
            DPINO<span className="text-primary">.LAUNCH</span>
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed mb-8">
            The exclusive gateway for the <span className="text-primary font-bold">$DPINO</span> ecosystem. Elite IDO access through staking tiers.
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { label: "SOLDIER", req: "100K", color: "text-amber-400" },
              { label: "GENERAL", req: "500K", color: "text-violet-400" },
              { label: "DARK LORD", req: "1M", color: "text-yellow-300" },
            ].map(({ label, req, color }) => (
              <div key={label} className="border border-white/10 rounded-sm p-3 bg-white/[0.02]">
                <p className={`text-xs font-bold uppercase tracking-wider ${color} mb-1`}>{label}</p>
                <p className="font-mono text-xs text-zinc-500">{req} DPINO</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-16 relative">
        <div className="absolute inset-0 lg:border-l border-white/5" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-sm overflow-hidden border border-primary/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <img src="/dpino-logo.jpeg" alt="DPINO" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-xl tracking-tight">
              DPINO<span className="text-primary">.LAUNCH</span>
            </span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-black uppercase tracking-tight mb-2">Welcome back</h2>
            <p className="text-zinc-500 text-sm">Sign in to access the syndicate</p>
          </div>

          {/* Google button */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading || !isLoaded}
            className="w-full flex items-center justify-center gap-3 h-13 py-3.5 px-4 rounded-sm border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/30 transition-all duration-200 font-semibold text-sm text-white disabled:opacity-50 group mb-4"
          >
            {googleLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            <span>{googleLoading ? "Redirecting…" : "Continue with Google"}</span>
            {!googleLoading && (
              <ArrowRight className="w-4 h-4 ml-auto text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[11px] text-zinc-600 uppercase tracking-widest">or email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Email/password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] text-zinc-500 uppercase tracking-widest mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-12 bg-white/[0.04] border-white/10 text-white placeholder:text-zinc-700 focus-visible:border-primary/50 focus-visible:ring-0 rounded-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] text-zinc-500 uppercase tracking-widest">Password</label>
                <Link href={`${basePath}/forgot-password`} className="text-[11px] text-primary/70 hover:text-primary transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <Input
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 h-12 bg-white/[0.04] border-white/10 text-white placeholder:text-zinc-700 focus-visible:border-primary/50 focus-visible:ring-0 rounded-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-sm">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !isLoaded}
              className="w-full h-12 bg-primary text-black font-black uppercase tracking-widest rounded-sm shadow-[0_0_25px_rgba(245,158,11,0.25)] hover:shadow-[0_0_40px_rgba(245,158,11,0.4)] hover:bg-primary/90 transition-all text-sm disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Signing in…
                </div>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-600 mt-6">
            No account?{" "}
            <Link href={`${basePath}/sign-up`} className="text-primary hover:text-primary/80 font-semibold transition-colors">
              Create one free →
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
