import React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Menu, X } from "lucide-react";

export function Navbar() {
  const [location] = useLocation();
  const [walletModalOpen, setWalletModalOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const links = [
    { href: "/", label: "Home" },
    { href: "/projects", label: "Launchpad" },
    { href: "/stake", label: "Stake" },
    { href: "/apply", label: "Apply" },
  ];

  return (
    <>
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-sm bg-black border border-primary/30 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.2)] group-hover:border-primary transition-colors">
              <span className="font-bold text-primary font-mono text-lg leading-none">DP</span>
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:block">
              DPINO<span className="text-primary">.LAUNCH</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className={`text-sm font-medium tracking-wide uppercase transition-colors hover:text-primary ${
                  location === link.href ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Button 
              onClick={() => setWalletModalOpen(true)}
              className="bg-primary/10 text-primary border border-primary/30 hover:bg-primary hover:text-black transition-all duration-300 shadow-[0_0_10px_rgba(245,158,11,0.1)] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] uppercase font-bold tracking-widest rounded-sm"
            >
              Connect Wallet
            </Button>
          </div>

          <button 
            className="md:hidden text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/10 bg-background/95 backdrop-blur-xl absolute top-20 left-0 w-full p-4 flex flex-col gap-4">
            {links.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`text-base font-medium tracking-wide uppercase p-2 border-b border-white/5 transition-colors ${
                  location === link.href ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Button 
              onClick={() => {
                setWalletModalOpen(true);
                setMobileMenuOpen(false);
              }}
              className="mt-2 w-full bg-primary/10 text-primary border border-primary/30 hover:bg-primary hover:text-black transition-all uppercase font-bold rounded-sm"
            >
              Connect Wallet
            </Button>
          </div>
        )}
      </nav>

      <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
        <DialogContent className="border-primary/20 bg-card/95 backdrop-blur-xl shadow-[0_0_50px_rgba(245,158,11,0.1)] rounded-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center uppercase tracking-widest text-gradient-gold">Connect Wallet</DialogTitle>
            <DialogDescription className="text-center pt-4 text-muted-foreground">
              Secure wallet connection protocol initializing.
              <br />
              <span className="text-primary mt-6 block font-bold tracking-widest text-lg glow-gold p-2 border border-primary/20 rounded bg-primary/5">TRILLIONS ON TRILLIONS.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-8">
            <Button onClick={() => setWalletModalOpen(false)} className="w-full bg-primary text-black hover:bg-primary/90 font-bold uppercase tracking-widest rounded-sm">Acknowledge</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
