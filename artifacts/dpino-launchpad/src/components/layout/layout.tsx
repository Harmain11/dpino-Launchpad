import React from "react";
import { Navbar } from "./navbar";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground relative selection:bg-primary/30 selection:text-primary">
      <Navbar />
      <main className="flex-1 pt-20 relative z-10 flex flex-col">
        {children}
      </main>
      <footer className="border-t border-white/5 py-12 mt-auto relative z-10 bg-background/50 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm overflow-hidden border border-primary/30 shrink-0">
                <img src="/dpino-logo.jpeg" alt="DPINO" className="w-full h-full object-cover" />
              </div>
              <span className="font-bold text-lg tracking-tight">
                DPINO<span className="text-primary">.LAUNCH</span>
              </span>
            </div>
            <div className="text-sm text-muted-foreground text-center md:text-left max-w-md">
              The exclusive gateway for the $DPINO ecosystem on Solana. 0.5% protocol fee from every launch feeds back into the DPINO liquidity pool.
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              <p>Contract:</p>
              <p className="text-primary/70 break-all select-all">4fwCUiZ8qaddK3WFLXazXRtpYpHc39iYLnEfF7KjmoEy</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
