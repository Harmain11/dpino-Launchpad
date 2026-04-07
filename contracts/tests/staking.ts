import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DpinoStaking } from "../target/types/dpino_staking";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";
import { BN } from "bn.js";

describe("dpino-staking", () => {
  const provider  = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program   = anchor.workspace.DpinoStaking as Program<DpinoStaking>;
  const authority = provider.wallet as anchor.Wallet;

  let dpinoMint:             anchor.web3.PublicKey;
  let stakingPoolPda:        anchor.web3.PublicKey;
  let vaultPda:              anchor.web3.PublicKey;
  let rewardVaultPda:        anchor.web3.PublicKey;
  let authorityTokenAccount: anchor.web3.PublicKey;
  let stakingPositionPda:    anchor.web3.PublicKey;

  // DPINO has 9 decimals on mainnet; we mirror that in tests
  const DECIMALS         = 9;
  const ONE_DPINO        = 1_000_000_000;                         // 1 DPINO (raw)
  const SOLDIER_AMOUNT   = new BN(100_000).mul(new BN(ONE_DPINO)); // 100K DPINO
  const COOLDOWN_SECONDS = 5;                                     // short for test speed

  before(async () => {
    // Create a test DPINO mint with 9 decimals
    dpinoMint = await createMint(
      provider.connection,
      (authority.payer as anchor.web3.Keypair),
      authority.publicKey,
      null,
      DECIMALS
    );

    // Derive PDA addresses using the same seeds as the program
    [stakingPoolPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("staking_pool"), dpinoMint.toBuffer()],
      program.programId
    );
    [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), dpinoMint.toBuffer()],
      program.programId
    );
    [rewardVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("reward_vault"), dpinoMint.toBuffer()],
      program.programId
    );
    [stakingPositionPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("position"), stakingPoolPda.toBuffer(), authority.publicKey.toBuffer()],
      program.programId
    );

    // Create and fund authority token account
    authorityTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      (authority.payer as anchor.web3.Keypair),
      dpinoMint,
      authority.publicKey
    );
    await mintTo(
      provider.connection,
      (authority.payer as anchor.web3.Keypair),
      dpinoMint,
      authorityTokenAccount,
      authority.publicKey,
      BigInt(10_000_000) * BigInt(ONE_DPINO)  // 10M DPINO
    );
  });

  it("Initializes the staking pool with correct APYs", async () => {
    await program.methods
      .initializePool(new BN(COOLDOWN_SECONDS))
      .accounts({
        stakingPool:  stakingPoolPda,
        vault:        vaultPda,
        rewardVault:  rewardVaultPda,
        dpinoMint,
        authority:    authority.publicKey,
      })
      .rpc();

    const pool = await program.account.stakingPool.fetch(stakingPoolPda);

    // Verify APYs match the constants (Flexible: 6/9/12%)
    assert.equal(pool.soldierApyBps.toNumber(),   600,   "SOLDIER flex APY should be 600 bps (6%)");
    assert.equal(pool.generalApyBps.toNumber(),   900,   "GENERAL flex APY should be 900 bps (9%)");
    assert.equal(pool.darkLordApyBps.toNumber(),  1200,  "DARK LORD flex APY should be 1200 bps (12%)");

    // Fixed-30d: 10/14/18%
    assert.equal(pool.soldierFixed30ApyBps.toNumber(),   1000, "SOLDIER fixed-30d should be 1000 bps (10%)");
    assert.equal(pool.generalFixed30ApyBps.toNumber(),   1400, "GENERAL fixed-30d should be 1400 bps (14%)");
    assert.equal(pool.darkLordFixed30ApyBps.toNumber(),  1800, "DARK LORD fixed-30d should be 1800 bps (18%)");

    // Fixed-90d: 15/20/25%
    assert.equal(pool.soldierFixed90ApyBps.toNumber(),   1500, "SOLDIER fixed-90d should be 1500 bps (15%)");
    assert.equal(pool.generalFixed90ApyBps.toNumber(),   2000, "GENERAL fixed-90d should be 2000 bps (20%)");
    assert.equal(pool.darkLordFixed90ApyBps.toNumber(),  2500, "DARK LORD fixed-90d should be 2500 bps (25%)");

    assert.equal(pool.cooldownSeconds.toNumber(), COOLDOWN_SECONDS, "cooldown mismatch");
    assert.equal(pool.totalStaked.toNumber(), 0, "pool should start empty");

    console.log("✅ Pool initialized — Flex APYs: SOLDIER=6% GENERAL=9% DARK_LORD=12%");
    console.log("   Fixed-30d APYs: 10%/14%/18% | Fixed-90d APYs: 15%/20%/25%");
  });

  it("Stakes 100K DPINO (SOLDIER tier, flexible)", async () => {
    await program.methods
      .stake(SOLDIER_AMOUNT)
      .accounts({
        stakingPool:       stakingPoolPda,
        stakingPosition:   stakingPositionPda,
        vault:             vaultPda,
        userTokenAccount:  authorityTokenAccount,
        user:              authority.publicKey,
      })
      .rpc();

    const pos  = await program.account.stakingPosition.fetch(stakingPositionPda);
    const pool = await program.account.stakingPool.fetch(stakingPoolPda);

    assert.equal(pos.amountStaked.toString(), SOLDIER_AMOUNT.toString(), "staked amount mismatch");
    assert.equal(pos.tier, 1, "should be SOLDIER tier (1)");
    assert.equal(pos.stakingMode, 0, "should be FLEXIBLE mode (0)");
    assert.equal(pos.positionApyBps.toNumber(), 600, "SOLDIER flexible APY should be 600 bps");
    assert.equal(pool.totalStaked.toString(), SOLDIER_AMOUNT.toString(), "pool total mismatch");

    console.log("✅ Staked 100K DPINO — Tier: SOLDIER | APY: 6% (600 bps) | Mode: Flexible");
  });

  it("Stakes 100K DPINO fixed-30d (SOLDIER tier)", async () => {
    // Add another 100K for a second position test (uses same PDA, accumulates)
    await program.methods
      .stakeFixed(SOLDIER_AMOUNT, 30)
      .accounts({
        stakingPool:       stakingPoolPda,
        stakingPosition:   stakingPositionPda,
        vault:             vaultPda,
        userTokenAccount:  authorityTokenAccount,
        user:              authority.publicKey,
      })
      .rpc();

    const pos = await program.account.stakingPosition.fetch(stakingPositionPda);

    assert.equal(pos.stakingMode, 1, "should be FIXED mode (1)");
    assert.equal(pos.positionApyBps.toNumber(), 1000, "SOLDIER fixed-30d APY should be 1000 bps");
    assert.ok(pos.lockUntil.toNumber() > 0, "lock_until should be set");

    console.log("✅ Fixed-30d stake — SOLDIER APY: 10% (1000 bps)");
  });

  it("Admin can update flexible APY rates", async () => {
    await program.methods
      .updateApyRates(new BN(700), new BN(1000), new BN(1300))
      .accounts({
        stakingPool: stakingPoolPda,
        authority:   authority.publicKey,
      })
      .rpc();

    const pool = await program.account.stakingPool.fetch(stakingPoolPda);
    assert.equal(pool.soldierApyBps.toNumber(),  700,  "SOLDIER updated APY mismatch");
    assert.equal(pool.generalApyBps.toNumber(),  1000, "GENERAL updated APY mismatch");
    assert.equal(pool.darkLordApyBps.toNumber(), 1300, "DARK LORD updated APY mismatch");

    // Restore originals
    await program.methods
      .updateApyRates(new BN(600), new BN(900), new BN(1200))
      .accounts({ stakingPool: stakingPoolPda, authority: authority.publicKey })
      .rpc();

    console.log("✅ updateApyRates works — rates updated and restored");
  });

  it("Admin can update fixed-30d and fixed-90d APY rates", async () => {
    await program.methods
      .updateFixed30ApyRates(new BN(1100), new BN(1500), new BN(1900))
      .accounts({ stakingPool: stakingPoolPda, authority: authority.publicKey })
      .rpc();

    await program.methods
      .updateFixed90ApyRates(new BN(1600), new BN(2100), new BN(2600))
      .accounts({ stakingPool: stakingPoolPda, authority: authority.publicKey })
      .rpc();

    const pool = await program.account.stakingPool.fetch(stakingPoolPda);
    assert.equal(pool.soldierFixed30ApyBps.toNumber(),  1100);
    assert.equal(pool.soldierFixed90ApyBps.toNumber(),  1600);

    // Restore
    await program.methods
      .updateFixed30ApyRates(new BN(1000), new BN(1400), new BN(1800))
      .accounts({ stakingPool: stakingPoolPda, authority: authority.publicKey })
      .rpc();
    await program.methods
      .updateFixed90ApyRates(new BN(1500), new BN(2000), new BN(2500))
      .accounts({ stakingPool: stakingPoolPda, authority: authority.publicKey })
      .rpc();

    console.log("✅ updateFixed30ApyRates + updateFixed90ApyRates work correctly");
  });

  it("Funds reward vault", async () => {
    const fundAmount = new BN(1_000_000).mul(new BN(ONE_DPINO)); // 1M DPINO

    await program.methods
      .fundRewardVault(fundAmount)
      .accounts({
        stakingPool:            stakingPoolPda,
        rewardVault:            rewardVaultPda,
        authorityTokenAccount,
        authority:              authority.publicKey,
      })
      .rpc();

    const rewardVault = await getAccount(provider.connection, rewardVaultPda);
    assert.ok(BigInt(rewardVault.amount) > 0n, "reward vault should have balance");

    console.log(`✅ Reward vault funded with 1M DPINO`);
  });

  it("Initiates unstake and waits for cooldown", async () => {
    await program.methods
      .initiateUnstake()
      .accounts({
        stakingPool:     stakingPoolPda,
        stakingPosition: stakingPositionPda,
        user:            authority.publicKey,
      })
      .rpc();

    const pos = await program.account.stakingPosition.fetch(stakingPositionPda);
    assert.ok(pos.unstakeInitiatedAt.toNumber() > 0, "cooldown should be active");

    console.log(`✅ Unstake initiated. Waiting ${COOLDOWN_SECONDS + 2}s for cooldown...`);
    await new Promise((r) => setTimeout(r, (COOLDOWN_SECONDS + 2) * 1_000));
  });

  it("Completes unstake after cooldown — tokens returned", async () => {
    await program.methods
      .completeUnstake()
      .accounts({
        stakingPool:      stakingPoolPda,
        stakingPosition:  stakingPositionPda,
        vault:            vaultPda,
        userTokenAccount: authorityTokenAccount,
        user:             authority.publicKey,
      })
      .rpc();

    const pos  = await program.account.stakingPosition.fetch(stakingPositionPda);
    const pool = await program.account.stakingPool.fetch(stakingPoolPda);

    assert.equal(pos.amountStaked.toNumber(), 0, "should have no staked tokens");
    assert.equal(pool.totalStaked.toNumber(), 0, "pool should be empty");

    console.log("✅ Unstake completed — DPINO returned to user");
  });
});
