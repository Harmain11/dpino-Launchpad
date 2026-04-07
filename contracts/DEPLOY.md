# DPINO Launchpad — Smart Contract Deployment Guide

---

## What You're Deploying

Two Anchor programs live in `contracts/programs/`:

| Program | Description |
|---------|-------------|
| `dpino-staking` | Stake $DPINO → earn $DPINO rewards (6–25% APY by tier/mode) + proportional SOL fees |
| `dpino-ido`     | Tier-gated IDO participation, allocation tracking, 0.5% protocol fee collection |

**Reward flow:**
1. Users stake $DPINO into the staking vault (flexible or fixed 30/90-day lock).
2. Every IDO charges a 0.5% DPINO fee → admin sweeps it into the reward vault.
3. Stakers accrue APY rewards every second — rates by tier and mode:
   - **Flexible**: SOLDIER 6% · GENERAL 9% · DARK LORD 12%
   - **Fixed-30d**: SOLDIER 10% · GENERAL 14% · DARK LORD 18%
   - **Fixed-90d**: SOLDIER 15% · GENERAL 20% · DARK LORD 25%
4. Users also earn a proportional share of SOL fees the admin deposits.
5. Users call `claim_dpino_rewards` or `claim_sol_rewards` at any time — no lockup on rewards.

---

## Why You Must Build Locally

Replit's container cannot run `rustc` / `cargo-build-sbf` due to a NixOS ELF/TLS linker incompatibility.
The contracts are complete and correct — build them on your own machine.

Recommended OS: macOS 13+ or Ubuntu 22.04+

---

## Step 1 — Local Prerequisites

```bash
# 1. Rust stable
curl https://sh.rustup.rs -sSf | sh
source $HOME/.cargo/env
rustup update stable

# 2. Solana CLI (v1.18+)
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version        # → solana-cli 1.18.x

# 3. Anchor CLI (v0.30+)
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install latest && avm use latest
anchor --version        # → anchor-cli 0.30.x

# 4. Node.js 20+ (for tests and admin scripts)
# Use nvm: https://github.com/nvm-sh/nvm
nvm install 20 && nvm use 20
```

---

## Step 2 — Clone Contracts Locally

```bash
# Copy or clone the contracts/ directory from your Replit project
git clone <your-repo-url>
cd contracts
npm install
```

---

## Step 3 — Devnet Deployment (test first)

### 3a. Create a deploy keypair

```bash
solana-keygen new -o ~/.config/solana/dpino-deploy.json
solana config set --keypair ~/.config/solana/dpino-deploy.json
solana config set --url https://api.devnet.solana.com
```

### 3b. Airdrop devnet SOL

```bash
solana airdrop 5
solana balance   # confirm ≥ 5 SOL
```

### 3c. Build both programs

```bash
anchor build
ls target/deploy/
# dpino_staking.so   dpino_staking-keypair.json
# dpino_ido.so       dpino_ido-keypair.json
```

### 3d. Get your program IDs

```bash
solana address -k target/deploy/dpino_staking-keypair.json
# → STAKING_PROGRAM_ID

solana address -k target/deploy/dpino_ido-keypair.json
# → IDO_PROGRAM_ID
```

### 3e. Update declare_id! in both programs

In `programs/dpino-staking/src/lib.rs`:
```rust
declare_id!("YOUR_STAKING_PROGRAM_ID");
```

In `programs/dpino-ido/src/lib.rs`:
```rust
declare_id!("YOUR_IDO_PROGRAM_ID");
```

In `Anchor.toml`:
```toml
[programs.devnet]
dpino_staking = "YOUR_STAKING_PROGRAM_ID"
dpino_ido     = "YOUR_IDO_PROGRAM_ID"
```

Rebuild after updating IDs:
```bash
anchor build
```

### 3f. Deploy to devnet

```bash
anchor deploy --provider.cluster devnet
```

Expected output:
```
Deploying cluster: https://api.devnet.solana.com
Deploying program "dpino_staking"...
Program Id: <YOUR_STAKING_PROGRAM_ID>
Deploy success ✓
```

---

## Step 4 — Initialize the Staking Pool (one-time admin setup)

After deployment, run this script once to create the pool PDA:

```typescript
// scripts/initialize-pool.ts
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

const DPINO_MINT        = new PublicKey("4fwCUiZ8qaddK3WFLXazXRtpYpHc39iYLnEfF7KjmoEy");
const COOLDOWN_SECONDS  = 7 * 24 * 60 * 60; // 7 days

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.DpinoStaking;

  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("staking_pool"), DPINO_MINT.toBuffer()],
    program.programId
  );

  await program.methods
    .initializePool(new anchor.BN(COOLDOWN_SECONDS))
    .accounts({ authority: provider.wallet.publicKey, dpino_mint: DPINO_MINT })
    .rpc();

  console.log("Pool PDA:", poolPda.toBase58());
  console.log("Initialized. Flex APYs: SOLDIER=6% GENERAL=9% DARK_LORD=12%");
  console.log("Fixed-30d APYs: 10%/14%/18% | Fixed-90d APYs: 15%/20%/25%");
}
main();
```

```bash
export ANCHOR_WALLET=~/.config/solana/dpino-deploy.json
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
npx ts-node scripts/initialize-pool.ts
```

---

## Step 5 — Fund the DPINO Reward Vault

Deposit $DPINO so stakers can claim their APY rewards:

```typescript
// scripts/fund-dpino-rewards.ts
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const DPINO_MINT   = new PublicKey("4fwCUiZ8qaddK3WFLXazXRtpYpHc39iYLnEfF7KjmoEy");
const AMOUNT_DPINO = 1_000_000;               // 1M DPINO
const AMOUNT_RAW   = BigInt(AMOUNT_DPINO) * BigInt(10 ** 9); // 9 decimals

async function main() {
  const provider   = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program    = anchor.workspace.DpinoStaking;
  const adminAta   = await getAssociatedTokenAddress(DPINO_MINT, provider.wallet.publicKey);

  await program.methods
    .fundRewardVault(new anchor.BN(AMOUNT_RAW.toString()))
    .accounts({ authority: provider.wallet.publicKey, authority_token_account: adminAta })
    .rpc();

  console.log(`Deposited ${AMOUNT_DPINO.toLocaleString()} DPINO into reward vault.`);
}
main();
```

> Rule of thumb: Keep 3–6 months of expected rewards in the vault at all times.
> At 100M DPINO staked at ~12% avg APY (mix of tiers/modes) → ~12M / year → deposit ~3M per quarter.

---

## Step 6 — Fund SOL Rewards (recurring, after each IDO)

After an IDO closes and you've collected protocol SOL fees, deposit them:

```typescript
// scripts/fund-sol-rewards.ts
import * as anchor from "@coral-xyz/anchor";

const SOL_AMOUNT = 10; // adjust to actual fees collected
const LAMPORTS   = SOL_AMOUNT * anchor.web3.LAMPORTS_PER_SOL;

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program  = anchor.workspace.DpinoStaking;

  await program.methods
    .fundSolRewards(new anchor.BN(LAMPORTS))
    .accounts({ authority: provider.wallet.publicKey })
    .rpc();

  console.log(`Deposited ${SOL_AMOUNT} SOL into reward pool.`);
}
main();
```

When stakers call `claim_sol_rewards`, they receive:
```
their_staked / total_staked  ×  sol_reward_pool
```

---

## Step 7 — Run the Test Suite

```bash
anchor test --provider.cluster devnet
```

Tests verify:
- Pool initializes with correct APYs (Flex 6/9/12%, Fixed-30d 10/14/18%, Fixed-90d 15/20/25%)
- `stake(100,000)` creates SOLDIER position at 600 bps (6%)
- `stakeFixed(100,000, 30)` creates SOLDIER fixed-30d position at 1000 bps (10%)
- `updateApyRates`, `updateFixed30ApyRates`, `updateFixed90ApyRates` all work
- `initiate_unstake` → cooldown → `complete_unstake` returns full amount
- `fund_sol_rewards` + `claim_sol_rewards` splits proportionally

---

## Step 8 — Mainnet Deployment

### 8a. Switch to mainnet

```bash
solana config set --url https://api.mainnet-beta.solana.com
```

Update `Anchor.toml`:
```toml
[provider]
cluster = "mainnet"
wallet  = "~/.config/solana/dpino-deploy.json"

[programs.mainnet]
dpino_staking = "YOUR_STAKING_PROGRAM_ID"
dpino_ido     = "YOUR_IDO_PROGRAM_ID"
```

### 8b. Fund the deploy wallet with real SOL

You need ~10–15 SOL for deployment + rent:
```bash
solana balance   # check current balance
# Send SOL from exchange or existing wallet to: $(solana address)
```

### 8c. Deploy

```bash
anchor deploy --provider.cluster mainnet
```

### 8d. Initialize on mainnet

```bash
export ANCHOR_PROVIDER_URL=https://api.mainnet-beta.solana.com
npx ts-node scripts/initialize-pool.ts
npx ts-node scripts/fund-dpino-rewards.ts
```

---

## Step 9 — Update the Frontend

After mainnet deployment, add your program IDs to the app:

In `artifacts/dpino-launchpad/src/lib/solana.ts`:
```typescript
export const STAKING_PROGRAM_ID = new PublicKey("YOUR_STAKING_PROGRAM_ID");
export const IDO_PROGRAM_ID     = new PublicKey("YOUR_IDO_PROGRAM_ID");
```

The IDL files are generated at:
- `contracts/target/idl/dpino_staking.json`
- `contracts/target/idl/dpino_ido.json`

Copy these into `artifacts/dpino-launchpad/src/idl/` so the frontend can call
the program directly from the user's wallet.

---

## All Program Instructions — Quick Reference

### dpino-staking

| Instruction | Who | What it does |
|-------------|-----|-------------|
| `initialize_pool(cooldown)` | Admin (once) | Creates pool PDA, sets all APY defaults |
| `stake(amount)` | User | Flexible stake — locks DPINO, sets tier, starts earning |
| `stake_fixed(amount, days)` | User | Fixed stake (30 or 90 days) — higher APY, no early withdrawal |
| `initiate_unstake()` | User | Starts 7-day cooldown, snapshots rewards |
| `complete_unstake()` | User | Returns DPINO after cooldown elapses |
| `claim_dpino_rewards()` | User | Sends accrued DPINO from vault to user |
| `claim_sol_rewards()` | User | Sends proportional SOL from pool to user |
| `fund_reward_vault(amount)` | Admin | Deposits DPINO into reward vault |
| `fund_sol_rewards(lamports)` | Admin | Deposits SOL into reward pool |
| `update_apy_rates(s,g,d)` | Admin | Adjusts flexible APY rates (bps) |
| `update_fixed30_apy_rates(s,g,d)` | Admin | Adjusts fixed-30d APY rates (bps) |
| `update_fixed90_apy_rates(s,g,d)` | Admin | Adjusts fixed-90d APY rates (bps) |

### dpino-ido

| Instruction | What it does |
|-------------|-------------|
| `initialize_ido` | Creates IDO pool + vault |
| `participate` | User sends SOL/DPINO, gets allocation |
| `finalize_ido` | Authority finalizes when soft cap hit |
| `claim_tokens` | User claims project tokens post-IDO |
| `refund` | User refunds if soft cap not met |
| `emergency_close` | Authority cancels + refunds all |

---

## Ongoing Admin Schedule

| Action | Frequency | Command |
|--------|-----------|---------|
| Fund DPINO reward vault | Quarterly (or after large IDO) | `npx ts-node scripts/fund-dpino-rewards.ts` |
| Fund SOL reward pool | After each IDO closes | `npx ts-node scripts/fund-sol-rewards.ts` |
| Update APY rates | As needed | Call `update_apy_rates` via script |
| Check vault balance | Weekly | `solana account <reward_vault_address>` |

---

## Security Notes

- **Upgrade authority**: Store `dpino-deploy.json` in a hardware wallet for mainnet. Anyone with this key can upgrade the program.
- **Reward vault solvency**: Monitor weekly. Stakers cannot claim if the vault runs dry.
- **Admin key**: The pool `authority` is the sole account that can call admin instructions.
- **Cooldown**: The 7-day unstake cooldown prevents flash-stake gaming of IDO snapshot allocations.
- **SOL rounding**: Integer division leaves tiny dust in the SOL reward pool — this is normal.
- **Audit**: Consider a professional audit before mainnet if TVL will exceed $500K.

---

## Token Details (Verified On-Chain)

| Property | Value |
|----------|-------|
| $DPINO Mint (mainnet) | `4fwCUiZ8qaddK3WFLXazXRtpYpHc39iYLnEfF7KjmoEy` |
| Decimals | 9 |
| Total Supply | ~987B DPINO |
| DEX Pair | `8wKQuMgoXKV9w8Vn8CpsA2g2WckuVs3ChcN5ZNp8mcNM` |
| SOLDIER threshold | 100,000 DPINO = `100_000_000_000_000` raw |
| GENERAL threshold | 500,000 DPINO = `500_000_000_000_000` raw |
| DARK LORD threshold | 1,000,000 DPINO = `1_000_000_000_000_000` raw |
| Unstake cooldown | 604,800 seconds (7 days) |
| Flexible APYs | SOLDIER 6% (600 bps) · GENERAL 9% (900 bps) · DARK LORD 12% (1,200 bps) |
| Fixed-30d APYs | SOLDIER 10% (1,000 bps) · GENERAL 14% (1,400 bps) · DARK LORD 18% (1,800 bps) |
| Fixed-90d APYs | SOLDIER 15% (1,500 bps) · GENERAL 20% (2,000 bps) · DARK LORD 25% (2,500 bps) |

---

*Last updated: April 2026 | Anchor 0.30.x | Solana 1.18.x*
