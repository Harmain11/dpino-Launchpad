import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DpinoIdo } from "../target/types/dpino_ido";
import { assert } from "chai";
import { BN } from "bn.js";

describe("dpino-ido", () => {
  const provider  = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program   = anchor.workspace.DpinoIdo as Program<DpinoIdo>;
  const authority = provider.wallet as anchor.Wallet;

  const PROJECT_NAME = "ShadowFi";

  let idoPoolPda:         anchor.web3.PublicKey;
  let idoVaultPda:        anchor.web3.PublicKey;
  let protocolFeeVaultPda: anchor.web3.PublicKey;
  let userAllocationPda:  anchor.web3.PublicKey;

  const SOL  = anchor.web3.LAMPORTS_PER_SOL;
  const now  = Math.floor(Date.now() / 1000);

  const idoParams = {
    projectName:              PROJECT_NAME,
    tokenPriceLamports:       new BN(0.01 * SOL),      // 0.01 SOL per token
    hardCapLamports:          new BN(100 * SOL),        // 100 SOL hard cap
    softCapLamports:          new BN(10 * SOL),         // 10 SOL soft cap
    startTime:                new BN(now - 10),         // started 10s ago
    endTime:                  new BN(now + 60),         // ends in 60s
    minAllocationLamports:    new BN(0.1 * SOL),        // 0.1 SOL minimum
    maxAllocationLamports:    new BN(10 * SOL),         // 10 SOL maximum
    minTierRequired:          0,                        // no tier required for this IDO
  };

  before(() => {
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

  it("Initializes IDO pool", async () => {
    await program.methods
      .initializeIdo(idoParams)
      .accounts({
        idoPool:          idoPoolPda,
        idoVault:         idoVaultPda,
        protocolFeeVault: protocolFeeVaultPda,
        authority:        authority.publicKey,
      })
      .rpc();

    const ido = await program.account.idoPool.fetch(idoPoolPda);
    assert.equal(ido.projectName, PROJECT_NAME, "project name mismatch");
    assert.equal(ido.hardCapLamports.toString(), idoParams.hardCapLamports.toString());
    assert.ok(!ido.isFinalized, "should not be finalized");
    console.log("✅ IDO initialized:", PROJECT_NAME);
  });

  it("User participates with 1 SOL", async () => {
    const contributionLamports = new BN(1 * SOL);

    await program.methods
      .participate(contributionLamports)
      .accounts({
        idoPool:          idoPoolPda,
        userAllocation:   userAllocationPda,
        idoVault:         idoVaultPda,
        protocolFeeVault: protocolFeeVaultPda,
        stakingPosition:  null,
        user:             authority.publicKey,
      })
      .rpc();

    const ido        = await program.account.idoPool.fetch(idoPoolPda);
    const allocation = await program.account.userAllocation.fetch(userAllocationPda);

    assert.equal(allocation.amountPaidLamports.toString(), contributionLamports.toString());
    assert.equal(ido.participants, 1);
    assert.ok(ido.totalRaisedLamports.toNumber() > 0, "raised amount should increase");
    console.log(
      `✅ Participated: ${contributionLamports.toNumber() / SOL} SOL. IDO total: ${ido.totalRaisedLamports.toNumber() / SOL} SOL`
    );
  });

  it("Rejects below-minimum contribution", async () => {
    try {
      await program.methods
        .participate(new BN(0.05 * SOL)) // 0.05 SOL < 0.1 SOL minimum
        .accounts({
          idoPool:          idoPoolPda,
          userAllocation:   userAllocationPda,
          idoVault:         idoVaultPda,
          protocolFeeVault: protocolFeeVaultPda,
          stakingPosition:  null,
          user:             authority.publicKey,
        })
        .rpc();
      assert.fail("Should have thrown BelowMinAllocation error");
    } catch (err: any) {
      assert.include(err.toString(), "BelowMinAllocation");
      console.log("✅ Correctly rejected below-minimum contribution");
    }
  });

  it("Finalizes IDO after end time", async () => {
    // Wait for IDO to end
    console.log("   Waiting 65s for IDO to end...");
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
    console.log("✅ IDO finalized");
  });

  it("Soft cap met — admin can withdraw funds", async () => {
    const vaultBefore = await provider.connection.getBalance(idoVaultPda);
    assert.ok(vaultBefore > 0, "vault should have SOL");

    await program.methods
      .withdrawFunds()
      .accounts({
        idoPool:   idoPoolPda,
        idoVault:  idoVaultPda,
        authority: authority.publicKey,
      })
      .rpc();

    const vaultAfter = await provider.connection.getBalance(idoVaultPda);
    assert.equal(vaultAfter, 0, "vault should be empty after withdrawal");
    console.log(`✅ Withdrew ${vaultBefore / SOL} SOL from IDO vault`);
  });
});
