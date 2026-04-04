import React from "react";
import { SignUp } from "@clerk/react";

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
    socialButtonsBlockButton:
      "!border-white/15 !bg-white/[0.04] hover:!bg-white/[0.08] hover:!border-white/30 !text-white !rounded-sm !transition-all",
    socialButtonsBlockButtonText: "!font-semibold !text-sm",
    dividerLine: "!bg-white/10",
    dividerText: "!text-zinc-600 !text-xs !uppercase !tracking-widest",
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

export default function SignUpPage() {
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
            Join the syndicate. Stake <span className="text-primary font-bold">$DPINO</span> to unlock elite IDO access across all tiers.
          </p>
          <div className="space-y-3 text-left">
            {[
              { icon: "🔐", text: "Tier-gated IDO allocations" },
              { icon: "⚡", text: "0.5% fee back to DPINO/SOL LP" },
              { icon: "🏆", text: "SOLDIER → GENERAL → DARK LORD" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3 border border-white/10 rounded-sm px-4 py-3 bg-white/[0.02]">
                <span className="text-lg">{icon}</span>
                <span className="text-sm text-zinc-400">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — Clerk SignUp */}
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

          <SignUp
            path={`${basePath}/sign-up`}
            routing="path"
            signInUrl={`${basePath}/sign-in`}
            afterSignUpUrl={`${basePath}/dashboard`}
            appearance={clerkAppearance}
          />
        </div>
      </div>
    </div>
  );
}
