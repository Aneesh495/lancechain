import { ethers } from "ethers";
import { LancechainEscrowAbi } from "../abi/LancechainEscrowAbi.js";
import { LancechainReputationAbi } from "../abi/LancechainReputationAbi.js";
import { MockERC20Abi } from "../abi/MockERC20Abi.js";
import {
  ProjectTerms,
  ProjectView,
  MilestoneData,
  MilestoneState,
  LiabilityView,
  ReputationScore,
  DeploymentManifest,
  TransactionProgress,
  TransactionStage,
} from "../types.js";
import { EventDecoder, DecodedLancechainEvent } from "../events/EventDecoder.js";
import { parseContractError } from "../errors/LancechainErrors.js";
import { verifyDeploymentManifest } from "../manifest.js";

export class LancechainClient {
  public readonly manifest: DeploymentManifest;
  public readonly provider: ethers.Provider;
  public signer?: ethers.Signer;

  public readonly escrowContract: ethers.Contract;
  public readonly reputationContract: ethers.Contract;
  private readonly eventDecoder: EventDecoder;

  public onProgress?: (progress: TransactionProgress) => void;

  constructor(
    manifest: DeploymentManifest,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ) {
    this.manifest = manifest;
    this.provider = provider;
    this.signer = signer;
    this.eventDecoder = new EventDecoder();

    const runner = signer || provider;
    this.escrowContract = new ethers.Contract(
      manifest.escrowAddress,
      LancechainEscrowAbi as unknown as ethers.InterfaceAbi,
      runner
    );
    this.reputationContract = new ethers.Contract(
      manifest.reputationAddress,
      LancechainReputationAbi as unknown as ethers.InterfaceAbi,
      runner
    );
  }

  public connect(signer: ethers.Signer): LancechainClient {
    return new LancechainClient(this.manifest, this.provider, signer);
  }

  public async verifyManifest(): Promise<void> {
    await verifyDeploymentManifest(this.manifest, this.provider);
  }

  private requireSigner(): ethers.Signer {
    if (!this.signer) {
      throw new Error("LancechainClient requires an active signer to execute transactions.");
    }
    return this.signer;
  }

  private notifyProgress(progress: TransactionProgress): void {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  public async checkAllowance(token: string, owner: string, amount: bigint): Promise<boolean> {
    if (token === ethers.ZeroAddress) return true;
    const tokenContract = new ethers.Contract(token, MockERC20Abi as unknown as ethers.InterfaceAbi, this.provider);
    const allowance: bigint = await tokenContract.allowance(owner, this.manifest.escrowAddress);
    return allowance >= amount;
  }

  public async approveToken(token: string, amount: bigint): Promise<ethers.ContractTransactionReceipt> {
    const signer = this.requireSigner();
    const tokenContract = new ethers.Contract(token, MockERC20Abi as unknown as ethers.InterfaceAbi, signer);

    this.notifyProgress({ stage: TransactionStage.SignatureRequested });
    const tx = await tokenContract.approve(this.manifest.escrowAddress, amount);
    this.notifyProgress({ stage: TransactionStage.Submitted, txHash: tx.hash });
    const receipt = await tx.wait();
    this.notifyProgress({ stage: TransactionStage.Mined, txHash: tx.hash, blockNumber: receipt.blockNumber });
    return receipt;
  }

  public async createAndFundProject(
    terms: ProjectTerms,
    clientSig: string,
    freelancerSig: string
  ): Promise<{ projectId: string; receipt: ethers.ContractTransactionReceipt; events: DecodedLancechainEvent[] }> {
    const signer = this.requireSigner();
    const signerAddress = await signer.getAddress();

    let totalBudget = 0n;
    for (const m of terms.milestones) {
      totalBudget += m.amount;
    }

    if (terms.token !== ethers.ZeroAddress) {
      const funder = signerAddress.toLowerCase() === terms.client.toLowerCase() ? signerAddress : terms.client;
      const hasAllowance = await this.checkAllowance(terms.token, funder, totalBudget);
      if (!hasAllowance && funder.toLowerCase() === signerAddress.toLowerCase()) {
        await this.approveToken(terms.token, totalBudget);
      }
    }

    const value = terms.token === ethers.ZeroAddress ? totalBudget : 0n;

    try {
      this.notifyProgress({ stage: TransactionStage.SignatureRequested });
      const tx = await this.escrowContract.createAndFundProject(terms, clientSig, freelancerSig, { value });
      this.notifyProgress({ stage: TransactionStage.Submitted, txHash: tx.hash });

      const receipt = await tx.wait();
      this.notifyProgress({
        stage: TransactionStage.Mined,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
      });

      const events = this.eventDecoder.decodeReceiptEvents(receipt);
      const termsAccepted = events.find((e) => e.name === "TermsAccepted");
      const projectId = termsAccepted && "projectId" in termsAccepted ? termsAccepted.projectId : "";

      return { projectId, receipt, events };
    } catch (err) {
      this.notifyProgress({ stage: TransactionStage.Failed, error: err as Error });
      throw parseContractError(err);
    }
  }

  public async submitDeliverable(
    projectId: string,
    milestoneIndex: number,
    deliverableHash: string
  ): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    try {
      this.notifyProgress({ stage: TransactionStage.SignatureRequested });
      const tx = await this.escrowContract.submitDeliverable(projectId, milestoneIndex, deliverableHash);
      this.notifyProgress({ stage: TransactionStage.Submitted, txHash: tx.hash });
      const receipt = await tx.wait();
      this.notifyProgress({ stage: TransactionStage.Mined, txHash: tx.hash, blockNumber: receipt.blockNumber });
      return receipt;
    } catch (err) {
      this.notifyProgress({ stage: TransactionStage.Failed, error: err as Error });
      throw parseContractError(err);
    }
  }

  public async acceptMilestone(
    projectId: string,
    milestoneIndex: number
  ): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    try {
      this.notifyProgress({ stage: TransactionStage.SignatureRequested });
      const tx = await this.escrowContract.acceptMilestone(projectId, milestoneIndex);
      this.notifyProgress({ stage: TransactionStage.Submitted, txHash: tx.hash });
      const receipt = await tx.wait();
      this.notifyProgress({ stage: TransactionStage.Mined, txHash: tx.hash, blockNumber: receipt.blockNumber });
      return receipt;
    } catch (err) {
      this.notifyProgress({ stage: TransactionStage.Failed, error: err as Error });
      throw parseContractError(err);
    }
  }

  public async requestRevision(
    projectId: string,
    milestoneIndex: number,
    revisionReasonHash: string,
    extensionSeconds: bigint
  ): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    try {
      this.notifyProgress({ stage: TransactionStage.SignatureRequested });
      const tx = await this.escrowContract.requestRevision(
        projectId,
        milestoneIndex,
        revisionReasonHash,
        extensionSeconds
      );
      this.notifyProgress({ stage: TransactionStage.Submitted, txHash: tx.hash });
      const receipt = await tx.wait();
      this.notifyProgress({ stage: TransactionStage.Mined, txHash: tx.hash, blockNumber: receipt.blockNumber });
      return receipt;
    } catch (err) {
      this.notifyProgress({ stage: TransactionStage.Failed, error: err as Error });
      throw parseContractError(err);
    }
  }

  public async finalizeMilestone(
    projectId: string,
    milestoneIndex: number
  ): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    try {
      this.notifyProgress({ stage: TransactionStage.SignatureRequested });
      const tx = await this.escrowContract.finalizeMilestone(projectId, milestoneIndex);
      this.notifyProgress({ stage: TransactionStage.Submitted, txHash: tx.hash });
      const receipt = await tx.wait();
      this.notifyProgress({ stage: TransactionStage.Mined, txHash: tx.hash, blockNumber: receipt.blockNumber });
      return receipt;
    } catch (err) {
      this.notifyProgress({ stage: TransactionStage.Failed, error: err as Error });
      throw parseContractError(err);
    }
  }

  public async claimDeliveryTimeout(
    projectId: string,
    milestoneIndex: number
  ): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    try {
      this.notifyProgress({ stage: TransactionStage.SignatureRequested });
      const tx = await this.escrowContract.claimDeliveryTimeout(projectId, milestoneIndex);
      this.notifyProgress({ stage: TransactionStage.Submitted, txHash: tx.hash });
      const receipt = await tx.wait();
      this.notifyProgress({ stage: TransactionStage.Mined, txHash: tx.hash, blockNumber: receipt.blockNumber });
      return receipt;
    } catch (err) {
      this.notifyProgress({ stage: TransactionStage.Failed, error: err as Error });
      throw parseContractError(err);
    }
  }

  public async openDispute(
    projectId: string,
    milestoneIndex: number,
    disputeReasonHash: string
  ): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    try {
      this.notifyProgress({ stage: TransactionStage.SignatureRequested });
      const tx = await this.escrowContract.openDispute(projectId, milestoneIndex, disputeReasonHash);
      this.notifyProgress({ stage: TransactionStage.Submitted, txHash: tx.hash });
      const receipt = await tx.wait();
      this.notifyProgress({ stage: TransactionStage.Mined, txHash: tx.hash, blockNumber: receipt.blockNumber });
      return receipt;
    } catch (err) {
      this.notifyProgress({ stage: TransactionStage.Failed, error: err as Error });
      throw parseContractError(err);
    }
  }

  public async resolveDisputeWithQuorum(
    projectId: string,
    milestoneIndex: number,
    clientSplitBps: number,
    freelancerSplitBps: number,
    arbitratorSignatures: string[]
  ): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    try {
      this.notifyProgress({ stage: TransactionStage.SignatureRequested });
      const tx = await this.escrowContract.resolveDisputeWithQuorum(
        projectId,
        milestoneIndex,
        clientSplitBps,
        freelancerSplitBps,
        arbitratorSignatures
      );
      this.notifyProgress({ stage: TransactionStage.Submitted, txHash: tx.hash });
      const receipt = await tx.wait();
      this.notifyProgress({ stage: TransactionStage.Mined, txHash: tx.hash, blockNumber: receipt.blockNumber });
      return receipt;
    } catch (err) {
      this.notifyProgress({ stage: TransactionStage.Failed, error: err as Error });
      throw parseContractError(err);
    }
  }

  public async resolveDisputeTimeout(
    projectId: string,
    milestoneIndex: number
  ): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    try {
      this.notifyProgress({ stage: TransactionStage.SignatureRequested });
      const tx = await this.escrowContract.resolveDisputeTimeout(projectId, milestoneIndex);
      this.notifyProgress({ stage: TransactionStage.Submitted, txHash: tx.hash });
      const receipt = await tx.wait();
      this.notifyProgress({ stage: TransactionStage.Mined, txHash: tx.hash, blockNumber: receipt.blockNumber });
      return receipt;
    } catch (err) {
      this.notifyProgress({ stage: TransactionStage.Failed, error: err as Error });
      throw parseContractError(err);
    }
  }

  public async executeMutualSettlement(
    projectId: string,
    milestoneIndex: number,
    clientSplitBps: number,
    freelancerSplitBps: number,
    clientSig: string,
    freelancerSig: string
  ): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    try {
      this.notifyProgress({ stage: TransactionStage.SignatureRequested });
      const tx = await this.escrowContract.executeMutualSettlement(
        projectId,
        milestoneIndex,
        clientSplitBps,
        freelancerSplitBps,
        clientSig,
        freelancerSig
      );
      this.notifyProgress({ stage: TransactionStage.Submitted, txHash: tx.hash });
      const receipt = await tx.wait();
      this.notifyProgress({ stage: TransactionStage.Mined, txHash: tx.hash, blockNumber: receipt.blockNumber });
      return receipt;
    } catch (err) {
      this.notifyProgress({ stage: TransactionStage.Failed, error: err as Error });
      throw parseContractError(err);
    }
  }

  public async withdraw(
    token: string,
    recipient?: string
  ): Promise<{ amount: bigint; receipt: ethers.ContractTransactionReceipt }> {
    const signer = this.requireSigner();
    const signerAddress = await signer.getAddress();
    const targetRecipient = recipient ? ethers.getAddress(recipient) : signerAddress;

    const availableCredit: bigint = await this.escrowContract.getCredits(signerAddress, token);
    if (availableCredit === 0n) {
      throw new Error(`Zero available credits for token ${token}`);
    }

    try {
      this.notifyProgress({ stage: TransactionStage.SignatureRequested });
      const tx = await this.escrowContract.withdraw(token, targetRecipient);
      this.notifyProgress({ stage: TransactionStage.Submitted, txHash: tx.hash });
      const receipt = await tx.wait();
      this.notifyProgress({ stage: TransactionStage.Mined, txHash: tx.hash, blockNumber: receipt.blockNumber });
      return { amount: availableCredit, receipt };
    } catch (err) {
      this.notifyProgress({ stage: TransactionStage.Failed, error: err as Error });
      throw parseContractError(err);
    }
  }

  public async submitRating(
    projectId: string,
    ratee: string,
    score: number,
    feedbackHash: string
  ): Promise<ethers.ContractTransactionReceipt> {
    this.requireSigner();
    try {
      this.notifyProgress({ stage: TransactionStage.SignatureRequested });
      const tx = await this.reputationContract.submitRating(projectId, ratee, score, feedbackHash);
      this.notifyProgress({ stage: TransactionStage.Submitted, txHash: tx.hash });
      const receipt = await tx.wait();
      this.notifyProgress({ stage: TransactionStage.Mined, txHash: tx.hash, blockNumber: receipt.blockNumber });
      return receipt;
    } catch (err) {
      this.notifyProgress({ stage: TransactionStage.Failed, error: err as Error });
      throw parseContractError(err);
    }
  }

  public async getProject(projectId: string): Promise<ProjectView> {
    try {
      const terms = await this.escrowContract.getProjectTerms(projectId);
      const milestoneCount = Number(terms[9]);
      const milestones: MilestoneData[] = [];

      for (let i = 0; i < milestoneCount; i++) {
        const m = await this.getMilestone(projectId, i);
        milestones.push(m);
      }

      const isSettled = await this.escrowContract.isProjectSettled(projectId);

      return {
        id: projectId,
        client: terms[0],
        freelancer: terms[1],
        token: terms[2],
        disputeWindow: Number(terms[3]),
        quorumThreshold: Number(terms[4]),
        timeoutPolicy: Number(terms[5]),
        feeBps: Number(terms[6]),
        feeRecipient: terms[7],
        agreementHash: terms[8],
        milestoneCount,
        isSettled,
        milestones,
      };
    } catch (err) {
      throw parseContractError(err);
    }
  }

  public async getMilestone(projectId: string, milestoneIndex: number): Promise<MilestoneData> {
    try {
      const raw = await this.escrowContract.getMilestone(projectId, milestoneIndex);
      return {
        index: milestoneIndex,
        state: Number(raw[0]) as MilestoneState,
        amount: raw[1],
        deliveryDeadline: raw[2],
        reviewDeadline: raw[3],
        disputeTimeout: raw[4],
        reviewPeriod: Number(raw[5]),
        maxRevisions: Number(raw[6]),
        revisionsUsed: Number(raw[7]),
        disputeRound: Number(raw[8]),
        deliverableHash: raw[9],
        revisionReasonHash: raw[10],
        disputeReasonHash: raw[11],
      };
    } catch (err) {
      throw parseContractError(err);
    }
  }

  public async getCredits(account: string, token: string): Promise<bigint> {
    return await this.escrowContract.getCredits(account, token);
  }

  public async getLiabilities(token: string): Promise<LiabilityView> {
    const raw = await this.escrowContract.getLiabilities(token);
    return {
      token,
      escrowLiability: raw[0],
      creditLiability: raw[1],
      totalLiability: raw[2],
    };
  }

  public async getReputationScore(account: string): Promise<ReputationScore> {
    const raw = await this.reputationContract.getScore(account);
    const ratingCount = Number(raw[5]);
    const totalRatingStars = BigInt(raw[6]);
    const averageRating = ratingCount > 0 ? Number(totalRatingStars) / ratingCount : 0;

    return {
      totalProjects: Number(raw[0]),
      completedCount: Number(raw[1]),
      disputedCount: Number(raw[2]),
      timeoutCount: Number(raw[3]),
      refundCount: Number(raw[4]),
      ratingCount,
      totalRatingStars,
      averageRating,
    };
  }
}
