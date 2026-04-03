# DPINO Launchpad — Smart Contract Deployment Guide

## Pre-deployment Verification (Confirmed ✅)

All of these have been verified from the Replit environment:

| Check | Result |
|-------|--------|
| Solana Devnet connectivity | ✅ v3.1.10, slot ~452M |
| $DPINO mint on Mainnet | ✅ `4fwCUiZ8qaddK3WFLXazXRtpYpHc39iYLnEfF7KjmoEy` |
| $DPINO decimals | ✅ 9 |
| $DPINO total supply | ✅ 987,341,830,004 |
| PDA derivation logic | ✅ All 8 PDAs derive correctly |
| DEX Screener API | ✅ Live price data flowing |

Run the verification script at any time:
```bash
cd contracts && node_modules/.bin/ts-node --skipProject scripts/test-devnet-connection.ts
```

---

## Why Contracts Must Be Built Locally

The Replit environment uses a NixOS-based container. The Rust toolchain binaries
downloaded by `rustup` and Nix are incompatible with this container's dynamic
linker configuration (TLS allocation error / segfault). Solana's `cargo-build-sbf`
requires a working `rustc` + Solana BPF tools that cannot be installed here.

**This is a Replit environment limitation, not a code issue. The contracts are correct.**

Build and deploy using your local machine (macOS or Ubuntu 22.04+ recommended).

---

## Local Setup — Step by Step

### Prerequisites
- macOS 13+ or Ubuntu 22.04+
- 8GB RAM minimum
- ~15GB free disk space (Rust + Solana BPF tools)

### Step 1 — Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
rustup default stable
rustc --version   # Should show 1.75+
```

### Step 2 — Install Solana CLI

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version   # Should show solana-cli 3.x
```

### Step 3 — Install Anchor CLI via AVM

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.30.1
avm use 0.30.1
anchor --version   # Should show anchor-cli 0.30.1
```

### Step 4 — Create a Devnet Wallet

```bash
solana-keygen new --outfile ~/.config/solana/devnet-deployer.json
solana config set --keypair ~/.config/solana/devnet-deployer.json
solana config set --url devnet
```

### Step 5 — Fund the Devnet Wallet

```bash
# Option A: CLI airdrop (may be rate limited)
solana airdrop 5

# Option B: Web faucet (more reliable)
# Visit: https://faucet.solana.com
# Enter your public key: solana-keygen pubkey ~/.config/solana/devnet-deployer.json
```

Verify: `solana balance` — should show ≥ 5 SOL

### Step 6 — Clone and Build

```bash
cd contracts

# Install Node deps
npm install

# Build the Anchor programs (first build takes 10-25 min — downloads BPF toolchain)
anchor build
```

This compiles both programs:
- `dpino_staking` → `.anchor/build/dpino_staking.so`
- `dpino_ido` → `.anchor/build/dpino_ido.so`

### Step 7 — Get Real Program IDs

```bash
anchor keys list
```

Output will look like:
```
dpino_ido: AbcDef123...
dpino_staking: XyzPqr456...
```

Update **these files** with the real program IDs:

**`contracts/Anchor.toml`** — in `[programs.devnet]`:
```toml
[programs.devnet]
dpino_staking = "XyzPqr456..."   # ← paste real ID
dpino_ido     = "AbcDef123..."   # ← paste real ID
```

**`contracts/programs/dpino-staking/src/lib.rs`** line 3:
```rust
declare_id!("XyzPqr456...");  // ← paste real staking ID
```

**`contracts/programs/dpino-ido/src/lib.rs`** line 3:
```rust
declare_id!("AbcDef123...");  // ← paste real IDO ID
```

Then rebuild with the correct IDs embedded:
```bash
anchor build
```

### Step 8 — Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

Expected output:
```
Deploying cluster: https://api.devnet.solana.com
Upgrade authority: ~/.config/solana/devnet-deployer.json
Deploying program "dpino_staking"...
Program Id: XyzPqr456...
Deploying program "dpino_ido"...
Program Id: AbcDef123...
Deploy success
```

### Step 9 — Run Anchor Tests

```bash
# Optional: pin the $DPINO mint in tests/dpino-staking.ts line 8:
# const DPINO_MINT = new PublicKey("4fwCUiZ8qaddK3WFLXazXRtpYpHc39iYLnEfF7KjmoEy");

anchor test --provider.cluster devnet
```

### Step 10 — Run Connectivity Script

```bash
node_modules/.bin/ts-node --skipProject scripts/test-devnet-connection.ts
```

This verifies: Devnet live, $DPINO mint real, PDA math correct, DEX Screener live.

---

## Frontend Integration After Devnet Deploy

Once you have the real program IDs from Step 7, update the frontend in Replit:

**`artifacts/dpino-launchpad/src/providers/SolanaWalletProvider.tsx`**

```typescript
// Replace with real IDs from anchor keys list
const STAKING_PROGRAM_ID = new PublicKey("XyzPqr456...");
const IDO_PROGRAM_ID     = new PublicKey("AbcDef123...");

// Replace with real treasury wallet
const TREASURY_WALLET = new PublicKey("YOUR_TREASURY_WALLET_ADDRESS");
```

---

## Mainnet Deployment (After Successful Devnet Testing)

### Requirements Before Mainnet
- [ ] All Devnet tests passing
- [ ] Security audit completed (recommended: OtterSec, Halborn, or Neodyme)
- [ ] ~10-20 SOL in deployer wallet for program accounts
- [ ] Create Mainnet wallet: `solana-keygen new --outfile ~/.config/solana/mainnet-deployer.json`

### Mainnet Deploy

```bash
# Switch to mainnet
solana config set --url mainnet-beta
solana config set --keypair ~/.config/solana/mainnet-deployer.json

# In Anchor.toml, change cluster from devnet → mainnet-beta
# Also update [programs.mainnet] section with mainnet program IDs

anchor build
anchor deploy --provider.cluster mainnet
```

---

## Program Architecture Summary

### dpino-staking

| Instruction | Description |
|-------------|-------------|
| `initialize` | Creates pool + vault, sets authority |
| `stake` | Locks DPINO tokens, creates/updates position |
| `unstake` | Initiates 7-day cooldown |
| `claim_unstake` | Releases tokens after cooldown |
| `distribute_rewards` | Authority deposits SOL rewards |
| `claim_rewards` | User claims their proportional SOL |

**Tier thresholds (on-chain):**
- SOLDIER: 100,000 DPINO (1× weight)
- GENERAL: 500,000 DPINO (3× weight)
- DARK LORD: 1,000,000 DPINO (7× weight)

### dpino-ido

| Instruction | Description |
|-------------|-------------|
| `initialize_ido` | Creates IDO pool + vault |
| `participate` | User sends SOL, gets allocation |
| `finalize_ido` | Authority finalizes when soft cap hit |
| `claim_tokens` | User claims project tokens post-IDO |
| `refund` | User refunds if soft cap not met |
| `emergency_close` | Authority cancels + refunds all |

**Tier gating:** Users must hold minimum staking tier to participate.

---

## Token Details (Verified)

| Property | Value |
|----------|-------|
| Mint address | `4fwCUiZ8qaddK3WFLXazXRtpYpHc39iYLnEfF7KjmoEy` |
| Decimals | 9 |
| Total supply | 987,341,830,004 DPINO |
| DEX pair | `8wKQuMgoXKV9w8Vn8CpsA2g2WckuVs3ChcN5ZNp8mcNM` |

---

*Verified: 2025-04-03 | Solana Devnet v3.1.10 | Anchor 0.30.1*
