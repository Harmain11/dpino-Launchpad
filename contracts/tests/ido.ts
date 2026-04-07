import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DpinoIdo } from "../target/types/dpino_ido";
import {
  createMint,
  createAssociatedTokenAccount,
  getAssociatedTokenAddress,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";
import { BN } from "bn.js";

describe("dpino-ido", () => {
  const provider  = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program   = anchor.workspace.DpinoIdo as Program<DpinoIdo>;
  const authority = provider.wallet as anchor.Wallet;

  // DPINO has 9 decimals; mirror that in tests
  const DECIMALS  = 9;
  const ONE_DPINO = 1_000_000_000;   // 1 DPINO in raw base units

  // ─── IDO parameters (all amounts in DPINO raw units) ────────────────────────
  const PROJECT_NAME = "ShadowFi";
  const now          = Math.floor(Date.now() / 1000);

  const idoParams = {
    projectName:           PROJECT_NAME,
    tokenPriceDpino:       new BN(100 * ONE_DPINO),   // 100 DPINO per project token
    hardCapDpino:          new BN(10_000 * ONE_DPINO), // 10,000 DPINO hard cap
    softCapDpino:          new BN(500 * ONE_DPINO),    // 500 DPINO soft cap
    startTime:             new BN(now - 10),            // started 10s ago
    endTime:               new BN(now + 60),            // ends in 60s
    minAllocationDpino:    new BN(100 * ONE_DPINO),    // 100 DPINO min
    maxAllocationDpino:    new BN(5_000 * ONE_DPINO),  // 5,000 DPINO max
    minTierRequired:       0,                           // open to all
  };

  // ─── PDA / account addresses ─────────────────────────────────────────────
  let dpinoMint:            anchor.web3.PublicKey;
  let authorityDpinoAta:    anchor.web3.PublicKey;
  let idoPoolPda:           anchor.web3.PublicKey;
  let idoVaultPda:          anchor.web3.PublicKey;
  let protocolFeeVaultPda:  anchor.web3.PublicKey;
  let userAllocationPda:    anchor.web3.PublicKey;

  before(async () => {
    // 1. Create a test DPINO mint (9 decimals, authority is admin wallet)
    dpinoMint = await createMint(
      provider.connection,
      (authority.payer as anchor.web3.Keypair),
      authority.publicKey,
      null,
      DECIMALS
    );

    // 2. Create authority's DPINO ATA and mint a large supply for testing
    authorityDpinoAta = await createAssociatedTokenAccount(
      provider.connection,
      (authority.payer as anchor.web3.Keypair),
      dpinoMint,
      authority.publicKey
    );
    await mintTo(
      provider.connection,
      (authority.payer as anchor.web3.Keypair),
      dpinoMint,
      authorityDpinoAta,
      authority.publicKey,
      BigInt(100_000_000) * BigInt(ONE_DPINO)  // 100M DPINO for testing
    );

    // 3. Derive all PDA addresses
    [idoPoolPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("ido_pool"), Buffer.from(PROJECT_NAME)],
      program.programId
    );
    [idoVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("ido_vault"), Buffer.from(PROJECT_NAME)],
      program.programId
    );
    [protocolFeeVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_fee_vault")],
      program.programId
    );
    [userAllocationPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("allocation"), idoPoolPda.toBuffer(), authority.publicKey.toBuffer()],
      program.programId
    );
  });

  // ─── 1. Initialize IDO ───────────────────────────────────────────────────

  it("Initializes IDO pool with DPINO amounts", async () => {
    await program.methods
      .initializeIdo(idoParams)
      .accounts({
        idoPool:          idoPoolPda,
        dpinoMint,
        idoVault:         idoVaultPda,
        protocolFeeVault: protocolFeeVaultPda,
        authority:        authority.publicKey,
      })
      .rpc();

    const ido = await program.account.idoPool.fetch(idoPoolPda);

    assert.equal(ido.projectName, PROJECT_NAME, "project name mismatch");
    assert.equal(
      ido.hardCapDpino.toString(),
      idoParams.hardCapDpino.toString(),
      "hard cap mismatch"
    );
    assert.equal(
      ido.softCapDpino.toString(),
      idoParams.softCapDpino.toString(),
      "soft cap mismatch"
    );
    assert.equal(ido.dpinoMint.toBase58(), dpinoMint.toBase58(), "mint mismatch");
    assert.ok(!ido.isFinalized, "should not be finalized at creation");
    assert.equal(ido.totalRaisedDpino.toNumber(), 0, "nothing raised yet");

    console.log(`✅ IDO '${PROJECT_NAME}' initialized`);
    console.log(`   Hard cap: ${idoParams.hardCapDpino.toNumber() / ONE_DPINO} DPINO`);
    console.log(`   Soft cap: ${idoParams.softCapDpino.toNumber() / ONE_DPINO} DPINO`);
  });

  // ─── 2. Participate ──────────────────────────────────────────────────────

  it("User participates with 1,000 DPINO (above soft cap)", async () => {
    const contribution = new BN(1_000 * ONE_DPINO);

    await program.methods
      .participate(contribution)
      .accounts({
        idoPool:          idoPoolPda,
        userAllocation:   userAllocationPda,
        userDpinoAta:     authorityDpinoAta,
        idoVault:         idoVaultPda,
        protocolFeeVault: protocolFeeVaultPda,
        stakingPosition:  null,
        user:             authority.publicKey,
      })
      .rpc();

    const ido        = await program.account.idoPool.fetch(idoPoolPda);
    const allocation = await program.account.userAllocation.fetch(userAllocationPda);

    // Net after 0.5% fee = 995 DPINO credited to IDO total
    const expectedNet = contribution.toNumber() - Math.floor(contribution.toNumber() * 50 / 10_000);

    assert.equal(ido.participants, 1, "participant count should be 1");
    assert.equal(
      ido.totalRaisedDpino.toNumber(),
      expectedNet,
      "raised total should equal net contribution"
    );
    assert.equal(
      allocation.amountPaidDpino.toString(),
      contribution.toString(),
      "allocation should track gross contribution"
    );
    assert.ok(!allocation.tokensClaimed, "tokens not yet claimed");
    assert.ok(!allocation.refunded, "not refunded");

    // Check vault received the net amount
    const vault = await getAccount(provider.connection, idoVaultPda);
    assert.equal(vault.amount.toString(), expectedNet.toString(), "vault balance mismatch");

    console.log(`✅ Participated: 1,000 DPINO. Net to IDO: ${expectedNet / ONE_DPINO} DPINO`);
  });

  // ─── 3. Reject below-minimum ────────────────────────────────────────────

  it("Rejects contribution below minimum allocation", async () => {
    try {
      await program.methods
        .participate(new BN(50 * ONE_DPINO))   // 50 DPINO < 100 DPINO minimum
        .accounts({
          idoPool:          idoPoolPda,
          userAllocation:   userAllocationPda,
          userDpinoAta:     authorityDpinoAta,
          idoVault:         idoVaultPda,
          protocolFeeVault: protocolFeeVaultPda,
          stakingPosition:  null,
          user:             authority.publicKey,
        })
        .rpc();
      assert.fail("Should have thrown BelowMinAllocation");
    } catch (err: any) {
      assert.include(err.toString(), "BelowMinAllocation");
      console.log("✅ Correctly rejected below-minimum contribution (50 DPINO < 100 DPINO min)");
    }
  });

  // ─── 4. Reject before IDO ends ──────────────────────────────────────────

  it("Cannot finalize while IDO is still active", async () => {
    try {
      await program.methods
        .finalizeIdo()
        .accounts({
          idoPool:   idoPoolPda,
          authority: authority.publicKey,
        })
        .rpc();
      assert.fail("Should have thrown IdoStillActive");
    } catch (err: any) {
      assert.include(err.toString(), "IdoStillActive");
      console.log("✅ Correctly rejected early finalization");
    }
  });

  // ─── 5. Finalize after IDO ends ─────────────────────────────────────────

  it("Finalizes IDO after end time", async () => {
    console.log("   Waiting 65s for IDO end time...");
    await new Promise((r) => setTimeout(r, 65_000));

    await program.methods
      .finalizeIdo()
      .accounts({
        idoPool:   idoPoolPda,
        authority: authority.publicKey,
      })
      .rpc();

    const ido = await program.account.idoPool.fetch(idoPoolPda);
    assert.ok(ido.isFinalized, "should be finalized");

    console.log(`✅ IDO finalized. Total raised: ${ido.totalRaisedDpino.toNumber() / ONE_DPINO} DPINO`);
  });

  // ─── 6. Withdraw raised DPINO (soft cap met) ────────────────────────────

  it("Admin withdraws raised DPINO to authority ATA (soft cap met)", async () => {
    const vaultBefore = await getAccount(provider.connection, idoVaultPda);
    assert.ok(vaultBefore.amount > 0n, "vault should have DPINO");

    await program.methods
      .withdrawFunds()
      .accounts({
        idoPool:            idoPoolPda,
        idoVault:           idoVaultPda,
        authorityDpinoAta,
        authority:          authority.publicKey,
      })
      .rpc();

    const vaultAfter = await getAccount(provider.connection, idoVaultPda);
    assert.equal(vaultAfter.amount.toString(), "0", "vault should be empty after withdrawal");

    console.log(`✅ Withdrew ${Number(vaultBefore.amount) / ONE_DPINO} DPINO from IDO vault`);
  });

  // ─── 7. Cannot participate after finalization ────────────────────────────

  it("Rejects participation after IDO is finalized", async () => {
    try {
      await program.methods
        .participate(new BN(200 * ONE_DPINO))
        .accounts({
          idoPool:          idoPoolPda,
          userAllocation:   userAllocationPda,
          userDpinoAta:     authorityDpinoAta,
          idoVault:         idoVaultPda,
          protocolFeeVault: protocolFeeVaultPda,
          stakingPosition:  null,
          user:             authority.publicKey,
        })
        .rpc();
      assert.fail("Should have thrown AlreadyFinalized");
    } catch (err: any) {
      assert.include(err.toString(), "AlreadyFinalized");
      console.log("✅ Correctly rejected participation after finalization");
    }
  });
});
