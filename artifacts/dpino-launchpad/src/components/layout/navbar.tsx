import React, { useState } from "react";
import { Link, useLocation, useLocation as useNav } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Menu, X, ChevronDown, Copy, LogOut, Wallet } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useDpinoBalance } from "@/hooks/useDpinoBalance";
import { useDpinoPrice } from "@/hooks/useDpinoPrice";
import { useWalletGate, PROTECTED_PATHS } from "@/context/WalletGateContext";

function shortenAddress(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const WALLET_OPTIONS = [
  {
    name: "Phantom",
    id: "phantom",
    icon: "https://phantom.app/favicon.ico",
    desc: "Most popular Solana wallet",
  },
  {
    name: "Solflare",
    id: "solflare",
    icon: "https://solflare.com/favicon.ico",
    desc: "Advanced Solana wallet",
  },
];

const NAV_LINKS = [
  { href: "/", label: "Home", protected: false },
  { href: "/projects", label: "Launchpad", protected: true },
  { href: "/stake", label: "Stake", protected: true },
  { href: "/dashboard", label: "Dashboard", protected: true },
  { href: "/apply", label: "Apply", protected: true },
];

export function Navbar() {
  const [location, navigate] = useLocation();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { select, wallets, publicKey, connected, disconnect, connecting } = useWallet();
  const { openConnectModal } = useWalletGate();

  const handleNavClick = (e: React.MouseEvent, link: { href: string; protected: boolean }) => {
    e.preventDefault();
    if (link.protected && !connected) {
      openConnectModal();
    } else {
      navigate(link.href);
      setMobileMenuOpen(false);
    }
  };

  const { data: balance } = useDpinoBalance();
  const { data: priceData } = useDpinoPrice();

  const address = publicKey?.toBase58() ?? "";

  const handleSelectWallet = (walletName: string) => {
    const found = wallets.find(
      (w) => w.adapter.name.toLowerCase() === walletName.toLowerCase()
    );
    if (found) {
      select(found.adapter.name);
    }
    setWalletModalOpen(false);
  };

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setProfileOpen(false);
  };

  return (
    <>
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-background/80 backdrop-blur-md">
        {priceData && (
          <div className="w-full bg-primary/5 border-b border-primary/10 text-xs py-1 px-4 flex items-center gap-4 overflow-hidden">
            <span className="text-muted-foreground font-mono">$DPINO</span>
            <span className="text-primary font-bold font-mono">${priceData.priceUsd.toFixed(8)}</span>
            <span className={`font-mono font-medium ${priceData.priceChange24h >= 0 ? "text-green-400" : "text-red-400"}`}>
              {priceData.priceChange24h >= 0 ? "+" : ""}{priceData.priceChange24h.toFixed(2)}% 24h
            </span>
            <span className="hidden sm:inline text-muted-foreground">
              Vol: <span className="text-foreground">${formatNum(priceData.volume24h)}</span>
            </span>
            <span className="hidden md:inline text-muted-foreground">
              MCap: <span className="text-foreground">${formatNum(priceData.marketCap)}</span>
            </span>
            <span className="hidden lg:inline text-muted-foreground">
              Liq: <span className="text-foreground">${formatNum(priceData.liquidity)}</span>
            </span>
            <a
              href="https://dexscreener.com/solana/8wkqumgoxkv9w8vn8cpsa2g2wckuvs3chcn5znp8mcnm"
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-primary/60 hover:text-primary transition-colors"
            >
              DEX Screener →
            </a>
          </div>
        )}

        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-sm overflow-hidden border border-primary/30 shadow-[0_0_15px_rgba(245,158,11,0.2)] group-hover:border-primary transition-colors shrink-0">
              <img src="/dpino-logo.jpeg" alt="DPINO" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-lg tracking-tight hidden sm:block">
              DPINO<span className="text-primary">.LAUNCH</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link)}
                className={`text-sm font-medium tracking-wide uppercase transition-colors hover:text-primary cursor-pointer ${
                  location === link.href ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {connected && publicKey ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-primary/30 rounded-sm px-3 py-2 transition-all group"
                >
                  <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80]" />
                  <span className="font-mono text-sm text-foreground">{shortenAddress(address)}</span>
                  {balance !== undefined && balance > 0 && (
                    <span className="text-xs text-primary font-bold border-l border-white/10 pl-2">
                      {formatNum(balance)} $DPINO
                    </span>
                  )}
                  <ChevronDown size={14} className={`text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} />
                </button>

                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-72 bg-card border border-white/10 rounded-sm shadow-xl z-50 overflow-hidden">
                      <div className="p-4 border-b border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                          <Wallet size={14} className="text-primary" />
                          <span className="text-xs text-muted-foreground uppercase tracking-widest">Connected Wallet</span>
                        </div>
                        <p className="font-mono text-xs break-all text-muted-foreground">{address}</p>
                      </div>

                      <div className="p-4 border-b border-white/10">
                        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">$DPINO Balance</p>
                        <p className="text-2xl font-black text-primary">{balance !== undefined ? formatNum(balance) : "—"}</p>
                        {priceData && balance !== undefined && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ≈ ${(balance * priceData.priceUsd).toFixed(2)} USD
                          </p>
                        )}
                      </div>

                      <div className="p-2 flex flex-col gap-1">
                        <button
                          onClick={handleCopy}
                          className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-white/5 rounded-sm transition-colors"
                        >
                          <Copy size={14} />
                          {copied ? "Copied!" : "Copy Address"}
                        </button>
                        <a
                          href={`https://solscan.io/account/${address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 rounded-sm transition-colors"
                        >
                          <span>↗</span> View on Solscan
                        </a>
                        <a
                          href={`https://dexscreener.com/solana/8wkqumgoxkv9w8vn8cpsa2g2wckuvs3chcn5znp8mcnm`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 rounded-sm transition-colors"
                        >
                          <span>↗</span> Trade $DPINO
                        </a>
                        <button
                          onClick={handleDisconnect}
                          className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-400/10 rounded-sm transition-colors"
                        >
                          <LogOut size={14} />
                          Disconnect
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Button
                onClick={() => setWalletModalOpen(true)}
                disabled={connecting}
                className="bg-primary/10 text-primary border border-primary/30 hover:bg-primary hover:text-black transition-all duration-300 shadow-[0_0_10px_rgba(245,158,11,0.1)] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] uppercase font-bold tracking-widest rounded-sm"
              >
                {connecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            )}
          </div>

          <button
            className="md:hidden text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/10 bg-background/95 backdrop-blur-xl absolute top-full left-0 w-full p-4 flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link)}
                className={`text-base font-medium tracking-wide uppercase p-2 border-b border-white/5 transition-colors cursor-pointer ${
                  location === link.href ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </a>
            ))}

            {connected && publicKey ? (
              <div className="flex items-center gap-2 p-2 border border-white/10 rounded-sm">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="font-mono text-sm">{shortenAddress(address)}</span>
                {balance !== undefined && balance > 0 && (
                  <span className="text-xs text-primary font-bold ml-auto">{formatNum(balance)} $DPINO</span>
                )}
              </div>
            ) : (
              <Button
                onClick={() => { setWalletModalOpen(true); setMobileMenuOpen(false); }}
                className="mt-2 w-full bg-primary/10 text-primary border border-primary/30 hover:bg-primary hover:text-black uppercase font-bold rounded-sm"
              >
                Connect Wallet
              </Button>
            )}
          </div>
        )}
      </nav>

      <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
        <DialogContent className="border-primary/20 bg-card/95 backdrop-blur-xl shadow-[0_0_50px_rgba(245,158,11,0.1)] rounded-sm max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center uppercase tracking-widest">
              Connect <span className="text-primary">Wallet</span>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-3">
            {WALLET_OPTIONS.map((w) => (
              <button
                key={w.id}
                onClick={() => handleSelectWallet(w.name)}
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

          <p className="text-center text-xs text-muted-foreground mt-4">
            Connecting to <span className="text-primary">Solana Mainnet</span>.
            <br />
            By connecting you agree to the DPINO Launchpad Terms of Service.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
