import {
  ProjectTerms,
  MilestoneConfig,
  TimeoutPolicy,
} from "../types.js";
import { ethers } from "ethers";

export class TermsBuilder {
  private client: string = ethers.ZeroAddress;
  private freelancer: string = ethers.ZeroAddress;
  private token: string = ethers.ZeroAddress;
  private milestones: MilestoneConfig[] = [];
  private disputeWindow: number = 86400 * 5; // 5 days default
  private committee: string[] = [];
  private quorumThreshold: number = 2;
  private timeoutPolicy: TimeoutPolicy = TimeoutPolicy.SplitEvenly;
  private feeBps: number = 250; // 2.5% default
  private feeRecipient: string = ethers.ZeroAddress;
  private agreementHash: string = ethers.ZeroHash;
  private nonce: bigint = 1n;
  private signatureExpiry: bigint = 0n;

  public setClient(address: string): this {
    this.client = ethers.getAddress(address);
    return this;
  }

  public setFreelancer(address: string): this {
    this.freelancer = ethers.getAddress(address);
    return this;
  }

  public setToken(address: string): this {
    this.token = address === "" || address === ethers.ZeroAddress ? ethers.ZeroAddress : ethers.getAddress(address);
    return this;
  }

  public addMilestone(amount: bigint, deliveryDeadline: bigint, reviewPeriodSeconds: number, maxRevisions: number = 2): this {
    this.milestones.push({
      amount,
      deliveryDeadline,
      reviewPeriod: reviewPeriodSeconds,
      maxRevisions,
    });
    return this;
  }

  public setDisputeWindow(seconds: number): this {
    this.disputeWindow = seconds;
    return this;
  }

  public setCommittee(members: string[], threshold: number): this {
    this.committee = members.map((m) => ethers.getAddress(m));
    this.quorumThreshold = threshold;
    return this;
  }

  public setTimeoutPolicy(policy: TimeoutPolicy): this {
    this.timeoutPolicy = policy;
    return this;
  }

  public setPlatformFee(feeBps: number, recipient: string): this {
    this.feeBps = feeBps;
    this.feeRecipient = ethers.getAddress(recipient);
    return this;
  }

  public setAgreementContent(contentOrHash: string): this {
    if (contentOrHash.startsWith("0x") && contentOrHash.length === 66) {
      this.agreementHash = contentOrHash;
    } else {
      this.agreementHash = ethers.keccak256(ethers.toUtf8Bytes(contentOrHash));
    }
    return this;
  }

  public setNonce(nonce: bigint): this {
    this.nonce = nonce;
    return this;
  }

  public setSignatureExpiry(expiryTimestamp: bigint): this {
    this.signatureExpiry = expiryTimestamp;
    return this;
  }

  public validate(): void {
    if (this.client === ethers.ZeroAddress) throw new Error("Client address required.");
    if (this.freelancer === ethers.ZeroAddress) throw new Error("Freelancer address required.");
    if (this.client.toLowerCase() === this.freelancer.toLowerCase()) {
      throw new Error("Client and Freelancer cannot be identical.");
    }
    if (this.milestones.length === 0) throw new Error("At least one milestone is required.");
    if (this.milestones.length > 32) throw new Error("At most 32 milestones permitted.");

    for (let i = 0; i < this.milestones.length; i++) {
      const m = this.milestones[i];
      if (m.amount <= 0n) throw new Error(`Milestone ${i} amount must be positive.`);
      if (m.reviewPeriod < 3600) throw new Error(`Milestone ${i} review period must be >= 1 hour.`);
    }

    if (this.committee.length === 0 || this.committee.length > 7) {
      throw new Error("Committee size must be between 1 and 7 members.");
    }
    if (this.quorumThreshold === 0 || this.quorumThreshold > this.committee.length) {
      throw new Error("Invalid quorum threshold.");
    }

    const set = new Set<string>();
    for (const c of this.committee) {
      const norm = c.toLowerCase();
      if (norm === this.client.toLowerCase() || norm === this.freelancer.toLowerCase()) {
        throw new Error("Counterparties cannot be dispute committee members.");
      }
      if (set.has(norm)) throw new Error("Duplicate committee members found.");
      set.add(norm);
    }

    if (this.feeBps > 1000) throw new Error("Fee basis points cannot exceed 1000 (10%).");
    if (this.feeBps > 0 && this.feeRecipient === ethers.ZeroAddress) {
      throw new Error("Fee recipient required when feeBps > 0.");
    }
  }

  public build(): ProjectTerms {
    this.validate();
    return {
      client: this.client,
      freelancer: this.freelancer,
      token: this.token,
      milestones: [...this.milestones],
      disputeWindow: this.disputeWindow,
      committee: [...this.committee],
      quorumThreshold: this.quorumThreshold,
      timeoutPolicy: this.timeoutPolicy,
      feeBps: this.feeBps,
      feeRecipient: this.feeRecipient,
      agreementHash: this.agreementHash,
      nonce: this.nonce,
      signatureExpiry: this.signatureExpiry,
    };
  }
}
