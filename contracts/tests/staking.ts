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
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program  = anchor.workspace.DpinoStaking as Program<DpinoStaking>;
  const authority = provider.wallet as anchor.Wallet;

  let dpinoMint:             anchor.web3.PublicKey;
  let stakingPoolPda:        anchor.web3.PublicKey;
  let vaultPda:              anchor.web3.PublicKey;
  let rewardVaultPda:        anchor.web3.PublicKey;
  let authorityTokenAccount: anchor.web3.PublicKey;
  let userTokenAccount:      anchor.web3.PublicKey;
  let stakingPositionPda:    anchor.web3.PublicKey;

  const DECIMALS          = 6;
  const ONE_DPINO         = 1_000_000;               // 1 DPINO with 6 decimals
  const SOLDIER_AMOUNT    = new BN(100_000 * ONE_DPINO);  // 100K DPINO
  const REWARD_RATE_BPS   = 1000;                    // 10% APR
  const COOLDOWN_SECONDS  = 5;                       // 5 seconds for test speed

  before(async () => {
    // Create the fake DPINO mint
    dpinoMint = await createMint(
      provider.connection,
      (authority.payer as anchor.web3.Keypair),
      authority.publicKey,
      null,
      DECIMALS
    );

    // Derive PDA addresses
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
      BigInt(10_000_000 * ONE_DPINO)  // 10M DPINO
    );

    // User token account
    userTokenAccount = authorityTokenAccount; // using authority as user in tests
  });

  it("Initializes the staking pool", async () => {
    await program.methods
      .initializePool(new BN(REWARD_RATE_BPS), new BN(COOLDOWN_SECONDS))
      .accounts({
        stakingPool:  stakingPoolPda,
        vault:        vaultPda,
        rewardVault:  rewardVaultPda,
        dpinoMint,
        authority:    authority.publicKey,
      })
      .rpc();

    const pool = await program.account.stakingPool.fetch(stakingPoolPda);
    assert.equal(pool.rewardRateBps.toNumber(), REWARD_RATE_BPS, "reward rate mismatch");
    assert.equal(pool.cooldownSeconds.toNumber(), COOLDOWN_SECONDS, "cooldown mismatch");
    assert.equal(pool.totalStaked.toNumber(), 0, "should start empty");
    console.log("✅ Pool initialized");
  });

  it("Stakes 100K DPINO (SOLDIER tier)", async () => {
    [stakingPositionPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("position"), stakingPoolPda.toBuffer(), authority.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .stake(SOLDIER_AMOUNT)
      .accounts({
        stakingPool:       stakingPoolPda,
        stakingPosition:   stakingPositionPda,
        vault:             vaultPda,
        userTokenAccount,
        user:              authority.publicKey,
      })
      .rpc();

    const pos  = await program.account.stakingPosition.fetch(stakingPositionPda);
    const pool = await program.account.stakingPool.fetch(stakingPoolPda);

    assert.equal(pos.amountStaked.toString(), SOLDIER_AMOUNT.toString(), "staked amount mismatch");
    assert.equal(pos.tier, 1, "should be SOLDIER tier (1)");
    assert.equal(pool.totalStaked.toString(), SOLDIER_AMOUNT.toString(), "pool total mismatch");
    console.log("✅ Staked 100K — Tier: SOLDIER");
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
    console.log("✅ Unstake initiated. Waiting for cooldown...");

    // Wait for the test cooldown to elapse
    await new Promise((r) => setTimeout(r, (COOLDOWN_SECONDS + 2) * 1000));
  });

  it("Completes unstake after cooldown", async () => {
    await program.methods
      .completeUnstake()
      .accounts({
        stakingPool:      stakingPoolPda,
        stakingPosition:  stakingPositionPda,
        vault:            vaultPda,
        userTokenAccount,
        user:             authority.publicKey,
      })
      .rpc();

    const pos  = await program.account.stakingPosition.fetch(stakingPositionPda);
    const pool = await program.account.stakingPool.fetch(stakingPoolPda);

    assert.equal(pos.amountStaked.toNumber(), 0, "should have no staked tokens");
    assert.equal(pool.totalStaked.toNumber(), 0, "pool should be empty");
    console.log("✅ Unstake completed — tokens returned");
  });

  it("Funds reward vault and stakes again for reward test", async () => {
    // Re-stake
    await program.methods
      .stake(SOLDIER_AMOUNT)
      .accounts({
        stakingPool:      stakingPoolPda,
        stakingPosition:  stakingPositionPda,
        vault:            vaultPda,
        userTokenAccount,
        user:             authority.publicKey,
      })
      .rpc();

    // Fund reward vault
    await program.methods
      .fundRewardVault(new BN(1_000_000 * ONE_DPINO))
      .accounts({
        stakingPool:            stakingPoolPda,
        rewardVault:            rewardVaultPda,
        authorityTokenAccount,
        authority:              authority.publicKey,
      })
      .rpc();

    const rewardVault = await getAccount(provider.connection, rewardVaultPda);
    assert.ok(BigInt(rewardVault.amount) > 0n, "reward vault should have balance");
    console.log("✅ Reward vault funded");
  });
});
