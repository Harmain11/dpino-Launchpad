import React, { useEffect } from "react";
import { SignIn } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkAppearance = {
  variables: {
    colorPrimary: "#f59e0b",
    colorBackground: "#0d0d0d",
    colorText: "#ffffff",
    colorTextSecondary: "#a1a1aa",
    colorInputBackground: "rgba(255,255,255,0.05)",
    colorInputText: "#ffffff",
    colorInputPlaceholder: "#52525b",
    borderRadius: "2px",
    fontFamily: "inherit",
    fontSize: "14px",
  },
  elements: {
    card: "!shadow-none !bg-transparent !border-0 !p-0",
    rootBox: "w-full",
    headerTitle: "!text-white !text-3xl !font-black !uppercase !tracking-tight",
    headerSubtitle: "!text-zinc-500 !text-sm",
    formButtonPrimary:
      "!bg-amber-500 !text-black hover:!bg-amber-400 !font-black !uppercase !tracking-widest !rounded-sm !h-12 !shadow-[0_0_25px_rgba(245,158,11,0.25)] hover:!shadow-[0_0_40px_rgba(245,158,11,0.4)] !transition-all",
    formFieldInput:
      "!bg-white/[0.04] !border-white/10 focus:!border-amber-500/50 !text-white !rounded-sm !h-12",
    formFieldLabel: "!text-zinc-400 !text-xs !uppercase !tracking-widest",
    socialButtonsRoot: "!hidden",
    socialButtonsBlockButton: "!hidden",
    socialButtonsBlockButtonText: "!hidden",
    dividerRow: "!hidden",
    dividerLine: "!hidden",
    dividerText: "!hidden",
    badge: "!hidden",
    footerActionLink: "!text-amber-500 hover:!text-amber-400 !font-semibold",
    footerActionText: "!text-zinc-600",
    identityPreviewText: "!text-white",
    identityPreviewEditButtonIcon: "!text-amber-500",
    alertText: "!text-white",
    formFieldErrorText: "!text-red-400",
    otpCodeFieldInput: "!bg-white/[0.04] !border-white/10 !text-white !rounded-sm",
    formResendCodeLink: "!text-amber-500 hover:!text-amber-400",
    backLink: "!text-zinc-400 hover:!text-white",
  },
};

function useHideClerkDevBadge() {
  useEffect(() => {
    const hide = () => {
      document.querySelectorAll("a, div, span, button").forEach((el) => {
        const text = (el as HTMLElement).innerText?.trim();
        if (text === "Development mode") {
          (el as HTMLElement).style.setProperty("display", "none", "important");
        }
      });
    };
    const observer = new MutationObserver(hide);
    observer.observe(document.body, { childList: true, subtree: true });
    hide();
    return () => observer.disconnect();
  }, []);
}

export default function SignInPage() {
  useHideClerkDevBadge();
  return (
    <div className="min-h-screen flex relative overflow-hidden bg-[#060606]">
      <style>{`
        .cl-badge, [class*="cl-badge"], [data-clerk-badge],
        a[href*="clerk.com/docs/deployments"],
        a[href*="dashboard.clerk.com"] { display: none !important; }
      `}</style>
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

      {/* Right panel — Clerk SignIn */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-16 relative">
        <div className="absolute inset-0 lg:border-l border-white/5" />
        <div className="w-full max-w-md relative z-10">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-sm overflow-hidden border border-primary/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <img src="/dpino-logo.jpeg" alt="DPINO" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-xl tracking-tight">
              DPINO<span className="text-primary">.LAUNCH</span>
            </span>
          </div>

          <SignIn
            path={`${basePath}/sign-in`}
            routing="path"
            signUpUrl={`${basePath}/sign-up`}
            afterSignInUrl={`${basePath}/dashboard`}
            appearance={clerkAppearance}
          />
        </div>
      </div>
    </div>
  );
}
