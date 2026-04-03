import { SignIn } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkAppearance = {
  variables: {
    colorBackground: "#0a0a0a",
    colorText: "#ffffff",
    colorTextSecondary: "#a1a1aa",
    colorPrimary: "#f59e0b",
    colorInputBackground: "#111111",
    colorInputText: "#ffffff",
    borderRadius: "2px",
    fontFamily: "inherit",
  },
  elements: {
    rootBox: "w-full",
    card: "bg-[#0d0d0d] border border-white/10 shadow-[0_0_50px_rgba(245,158,11,0.08)] rounded-sm",
    headerTitle: "text-white font-black uppercase tracking-widest text-xl",
    headerSubtitle: "text-zinc-400 text-sm",
    socialButtonsBlockButton:
      "bg-white/5 border border-white/10 hover:border-primary/40 hover:bg-primary/5 text-white rounded-sm transition-all",
    socialButtonsBlockButtonText: "text-white font-medium",
    dividerLine: "bg-white/10",
    dividerText: "text-zinc-500 text-xs uppercase tracking-widest",
    formFieldLabel: "text-zinc-300 text-xs uppercase tracking-widest font-medium",
    formFieldInput:
      "bg-[#111] border border-white/10 focus:border-primary/50 text-white rounded-sm placeholder:text-zinc-600 focus:ring-0 focus:outline-none",
    formButtonPrimary:
      "bg-primary text-black font-black uppercase tracking-widest hover:bg-primary/90 rounded-sm shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-all",
    footerActionText: "text-zinc-400",
    footerActionLink: "text-primary hover:text-primary/80 font-medium",
    identityPreviewText: "text-white",
    identityPreviewEditButton: "text-primary hover:text-primary/80",
    formFieldSuccessText: "text-green-400",
    formFieldErrorText: "text-red-400",
    alertText: "text-red-400",
    alert: "border border-red-400/20 bg-red-400/5 rounded-sm",
    otpCodeFieldInput:
      "bg-[#111] border border-white/10 focus:border-primary/50 text-white rounded-sm",
  },
};

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-background relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.04)_0%,transparent_60%)]" />
      </div>

      <div className="mb-8 text-center relative z-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-sm bg-black border border-primary/30 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <span className="font-bold text-primary font-mono text-sm leading-none">DP</span>
          </div>
          <span className="font-bold text-2xl tracking-tight">
            DPINO<span className="text-primary">.LAUNCH</span>
          </span>
        </div>
        <p className="text-muted-foreground text-sm uppercase tracking-widest">
          Enter the Syndicate
        </p>
      </div>

      <div className="w-full max-w-md relative z-10">
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
          appearance={clerkAppearance}
        />
      </div>
    </div>
  );
}
