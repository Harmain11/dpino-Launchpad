# DPINO Launchpad — Smart Contracts

Two Anchor (Rust) programs for the DPINO Launchpad ecosystem on Solana.

---

## Programs

### `dpino-staking`
Handles on-chain $DPINO staking, tier tracking, 7-day cooldown, and reward distribution.

**Instructions:**
| Instruction | Who | What |
|---|---|---|
| `initialize_pool` | Admin | Create the staking pool (once) |
| `stake(amount)` | User | Lock DPINO tokens |
| `initiate_unstake` | User | Start 7-day cooldown |
| `complete_unstake` | User | Withdraw tokens after cooldown |
| `claim_rewards` | User | Claim accumulated rewards |
| `fund_reward_vault(amount)` | Admin | Deposit protocol fees as rewards |
| `update_reward_rate(bps)` | Admin | Change APR reward rate |

**Staking Tiers:**
| Tier | Min $DPINO | Multiplier |
|---|---|---|
| SOLDIER | 100,000 | 1x |
| GENERAL | 500,000 | 3x |
| DARK LORD | 1,000,000 | 7x |

---

### `dpino-ido`
Handles IDO participation, tier gating, token claiming, soft/hard cap enforcement, and refunds.

**Instructions:**
| Instruction | Who | What |
|---|---|---|
| `initialize_ido(params)` | Admin | Create a new IDO pool |
| `set_token_mint` | Admin | Set token mint after TGE |
| `finalize_ido` | Admin | Lock IDO after end time |
| `participate(amount_lamports)` | User | Contribute SOL |
| `claim_tokens` | User | Claim purchased tokens after TGE |
| `refund` | User | Get SOL back if soft cap not met |
| `withdraw_funds` | Admin | Withdraw raised SOL if soft cap met |

**Protocol Fee:** 0.5% of every contribution flows to the DPINO protocol fee vault.

---

## Prerequisites

Install these tools on your local machine:

```bash
# 1. Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup component add rustfmt

# 2. Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
solana --version  # should be >= 1.18

# 3. Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.30.1
avm use 0.30.1
anchor --version  # should be 0.30.1

# 4. Node packages (from this directory)
cd contracts
npm install
```

---

## Development Setup

```bash
# Create a local keypair (your deploy wallet)
solana-keygen new --outfile ~/.config/solana/id.json

# Fund it on Devnet
solana airdrop 5 --url devnet

# Check balance
solana balance --url devnet
```

---

## Build

```bash
cd contracts
anchor build
```

This generates:
- `target/deploy/dpino_staking.so` — compiled program
- `target/deploy/dpino_ido.so` — compiled program
- `target/types/dpino_staking.ts` — TypeScript IDL
- `target/types/dpino_ido.ts` — TypeScript IDL

---

## Update Program IDs

After `anchor build`, Anchor generates real program IDs. Update them:

```bash
# Get the new IDs
anchor keys list

# Paste them into:
# 1. Anchor.toml  → [programs.devnet] and [programs.mainnet]
# 2. programs/dpino-staking/src/lib.rs → declare_id!(...)
# 3. programs/dpino-ido/src/lib.rs    → declare_id!(...)

# Rebuild with new IDs
anchor build
```

---

## Test (Devnet)

```bash
anchor test
```

Tests run against a local validator by default. To test on Devnet:

```bash
anchor test --provider.cluster devnet
```

---

## Deploy to Devnet

```bash
# Set cluster
solana config set --url devnet

anchor deploy --provider.cluster devnet
```

---

## Deploy to Mainnet

> ⚠️ Get your contracts audited before mainnet. Recommended auditors:
> OtterSec, Halborn, Trail of Bits, Neodyme.

```bash
# Fund your mainnet wallet first (real SOL required)
solana balance --url mainnet-beta

# Deploy
anchor deploy --provider.cluster mainnet
```

---

## After Deployment: Update the Frontend

Replace the placeholder treasury wallet and add on-chain calls in the frontend:

1. **`artifacts/dpino-launchpad/src/providers/SolanaWalletProvider.tsx`**
   - Replace `TREASURY_WALLET` with the actual `ido_vault` PDA

2. **`artifacts/dpino-launchpad/src/pages/stake.tsx`**
   - Replace the off-chain API call with `program.methods.stake(amount).rpc()`

3. **`artifacts/dpino-launchpad/src/pages/project-detail.tsx`**
   - Replace the instruction modal with `program.methods.participate(lamports).rpc()`

The generated TypeScript IDL (`target/types/*.ts`) gives you full type-safe methods.

---

## Security Checklist Before Mainnet

- [ ] Full program audit by a reputable Solana security firm
- [ ] Test all edge cases: cooldown bypass attempts, overflow attacks, double-claim
- [ ] Set a multisig as `authority` (use Squads Protocol)
- [ ] Enable program upgrade authority freeze after audit passes
- [ ] Verify all PDAs derive correctly on-chain
- [ ] Test with real token amounts on Devnet first
- [ ] Set up monitoring (Dialect, Helius webhooks)
