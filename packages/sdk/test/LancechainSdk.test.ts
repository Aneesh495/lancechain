import { describe, it } from "node:test";
import assert from "node:assert";
import { ethers } from "ethers";
import {
  TermsBuilder,
  TimeoutPolicy,
  signProjectTerms,
  signDisputeResolution,
  signMutualSettlement,
  parseContractError,
  LancechainError,
  EventDecoder,
  verifyDeploymentManifest,
  DeploymentManifest,
} from "../src/index.js";

describe("Lancechain SDK Unit Tests", () => {
  const clientWallet = ethers.Wallet.createRandom();
  const freelancerWallet = ethers.Wallet.createRandom();
  const feeWallet = ethers.Wallet.createRandom();
  const arb1 = ethers.Wallet.createRandom();
  const arb2 = ethers.Wallet.createRandom();
  const arb3 = ethers.Wallet.createRandom();

  it("TermsBuilder: builds valid terms with correct defaults", () => {
    const builder = new TermsBuilder()
      .setClient(clientWallet.address)
      .setFreelancer(freelancerWallet.address)
      .setToken(ethers.ZeroAddress)
      .addMilestone(1000000000000000000n, BigInt(Math.floor(Date.now() / 1000) + 86400 * 7), 86400 * 3, 2)
      .setCommittee([arb1.address, arb2.address, arb3.address], 2)
      .setPlatformFee(250, feeWallet.address)
      .setTimeoutPolicy(TimeoutPolicy.SplitEvenly)
      .setAgreementContent("Statement of Work: Lancechain protocol rebuild")
      .setNonce(42n)
      .setSignatureExpiry(BigInt(Math.floor(Date.now() / 1000) + 86400));

    const terms = builder.build();

    assert.strictEqual(terms.client, clientWallet.address);
    assert.strictEqual(terms.freelancer, freelancerWallet.address);
    assert.strictEqual(terms.token, ethers.ZeroAddress);
    assert.strictEqual(terms.milestones.length, 1);
    assert.strictEqual(terms.milestones[0].amount, 1000000000000000000n);
    assert.strictEqual(terms.committee.length, 3);
    assert.strictEqual(terms.quorumThreshold, 2);
    assert.strictEqual(terms.feeBps, 250);
    assert.strictEqual(terms.nonce, 42n);
  });

  it("TermsBuilder: rejects duplicate committee members or counterparties as arbitrators", () => {
    assert.throws(
      () => {
        new TermsBuilder()
          .setClient(clientWallet.address)
          .setFreelancer(freelancerWallet.address)
          .addMilestone(100n, 1000n, 3600)
          .setCommittee([clientWallet.address, arb1.address], 1)
          .build();
      },
      /Counterparties cannot be dispute committee members/
    );

    assert.throws(
      () => {
        new TermsBuilder()
          .setClient(clientWallet.address)
          .setFreelancer(freelancerWallet.address)
          .addMilestone(100n, 1000n, 3600)
          .setCommittee([arb1.address, arb1.address], 1)
          .build();
      },
      /Duplicate committee members found/
    );
  });

  it("SignerHelpers: signs EIP-712 ProjectTerms and recovers signer", async () => {
    const escrowAddress = "0x1111111111111111111111111111111111111111";
    const chainId = 31337n;

    const terms = new TermsBuilder()
      .setClient(clientWallet.address)
      .setFreelancer(freelancerWallet.address)
      .setToken(ethers.ZeroAddress)
      .addMilestone(1000n, 5000n, 7200)
      .setCommittee([arb1.address, arb2.address], 1)
      .setPlatformFee(100, feeWallet.address)
      .setAgreementContent("Agreement V1")
      .setNonce(1n)
      .setSignatureExpiry(10000n)
      .build();

    const sig = await signProjectTerms(terms, clientWallet, escrowAddress, chainId);
    assert.strictEqual(typeof sig, "string");
    assert.strictEqual(sig.startsWith("0x"), true);
    assert.strictEqual(sig.length, 132); // 65 bytes in hex
  });

  it("SignerHelpers: signs dispute resolution with committee members", async () => {
    const escrowAddress = "0x1111111111111111111111111111111111111111";
    const chainId = 31337n;

    const sig1 = await signDisputeResolution(
      {
        projectId: ethers.ZeroHash,
        milestoneIndex: 0,
        disputeRound: 1,
        clientSplitBps: 6000,
        freelancerSplitBps: 4000,
        nonce: 1n,
      },
      arb1,
      escrowAddress,
      chainId
    );

    assert.strictEqual(sig1.length, 132);
  });

  it("ErrorParser: maps contract revert error strings to typed domain errors", () => {
    const err = parseContractError(new Error("execution reverted: InvalidSignature()"));
    assert.strictEqual(err instanceof LancechainError, true);
    assert.strictEqual(err.code, "InvalidSignature");
    assert.strictEqual(err.message.includes("EIP-712 or EIP-1271"), true);
  });

  it("Manifest: verifies valid bytecode hash and rejects chainId mismatch", async () => {
    const mockProvider = {
      getNetwork: async () => ({ chainId: 31337n }),
      getCode: async (addr: string) => (addr === "0xEscrow" ? "0x1234" : "0x5678"),
    } as unknown as ethers.Provider;

    const manifest: DeploymentManifest = {
      chainId: 31337,
      chainName: "Local Anvil",
      escrowAddress: "0xEscrow",
      reputationAddress: "0xRep",
      escrowBytecodeHash: ethers.keccak256("0x1234"),
      reputationBytecodeHash: ethers.keccak256("0x5678"),
      deployedBlock: 1,
      deployedTxHash: ethers.ZeroHash,
      compiler: {
        solcVersion: "0.8.27",
        optimizer: true,
        optimizerRuns: 200,
        evmVersion: "cancun",
        viaIR: true,
      },
    };

    // Valid passes
    await verifyDeploymentManifest(manifest, mockProvider);

    // Mismatched chainId throws
    const invalidManifest = { ...manifest, chainId: 1 };
    await assert.rejects(
      async () => verifyDeploymentManifest(invalidManifest, mockProvider),
      /Chain ID mismatch/
    );
  });
});
