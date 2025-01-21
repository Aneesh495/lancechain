import {
  MilestoneState,
  TimeoutPolicy,
  ReputationOutcome,
  ProjectTerms,
  MilestoneData,
  ProjectModel,
  LiabilityModel,
  ModelEvent,
} from "./types.js";
import { ethers } from "ethers";

export class ReferenceEscrowModel {
  public projects: Map<string, ProjectModel> = new Map();
  public clientNonces: Map<string, Set<bigint>> = new Map();
  public credits: Map<string, Map<string, bigint>> = new Map(); // account -> token -> amount
  public escrowLiabilities: Map<string, bigint> = new Map(); // token -> amount
  public creditLiabilities: Map<string, bigint> = new Map(); // token -> amount
  public events: ModelEvent[] = [];

  private normalizeAddr(addr: string): string {
    return addr.toLowerCase();
  }

  public getCredit(account: string, token: string): bigint {
    const acc = this.normalizeAddr(account);
    const tok = this.normalizeAddr(token);
    return this.credits.get(acc)?.get(tok) ?? 0n;
  }

  private setCredit(account: string, token: string, amount: bigint): void {
    const acc = this.normalizeAddr(account);
    const tok = this.normalizeAddr(token);
    if (!this.credits.has(acc)) {
      this.credits.set(acc, new Map());
    }
    this.credits.get(acc)!.set(tok, amount);
  }

  private addCredit(account: string, token: string, delta: bigint): void {
    if (delta <= 0n) return;
    const current = this.getCredit(account, token);
    this.setCredit(account, token, current + delta);
  }

  public getLiabilities(token: string): LiabilityModel {
    const tok = this.normalizeAddr(token);
    const escrowLiability = this.escrowLiabilities.get(tok) ?? 0n;
    const creditLiability = this.creditLiabilities.get(tok) ?? 0n;
    return {
      escrowLiability,
      creditLiability,
      totalLiability: escrowLiability + creditLiability,
    };
  }

  public createAndFundProject(terms: ProjectTerms, caller: string, now: bigint): { projectId: string } {
    const client = this.normalizeAddr(terms.client);
    const freelancer = this.normalizeAddr(terms.freelancer);
    const token = this.normalizeAddr(terms.token);
    const feeRecipient = this.normalizeAddr(terms.feeRecipient);

    if (client === ethers.ZeroAddress || freelancer === ethers.ZeroAddress) {
      throw new Error("ZeroAddress");
    }
    if (client === freelancer) {
      throw new Error("InvalidCounterparty");
    }
    if (terms.milestones.length === 0 || terms.milestones.length > 32) {
      throw new Error("InvalidMilestoneCount");
    }
    if (terms.feeBps > 1000) {
      throw new Error("InvalidFee");
    }
    if (terms.feeBps > 0 && feeRecipient === ethers.ZeroAddress) {
      throw new Error("ZeroAddress");
    }
    if (now > terms.signatureExpiry) {
      throw new Error("TermsExpired");
    }

    if (!this.clientNonces.has(client)) {
      this.clientNonces.set(client, new Set());
    }
    if (this.clientNonces.get(client)!.has(terms.nonce)) {
      throw new Error("NonceAlreadyUsed");
    }
    this.clientNonces.get(client)!.add(terms.nonce);

    // Committee validation
    const committeeLen = terms.committee.length;
    if (committeeLen === 0 || committeeLen > 7) {
      throw new Error("InvalidCommittee");
    }
    if (terms.quorumThreshold === 0 || terms.quorumThreshold > committeeLen) {
      throw new Error("InvalidQuorumThreshold");
    }
    const committeeSet = new Set<string>();
    for (const arb of terms.committee) {
      const normArb = this.normalizeAddr(arb);
      if (normArb === ethers.ZeroAddress || normArb === client || normArb === freelancer) {
        throw new Error("InvalidCommittee");
      }
      if (committeeSet.has(normArb)) {
        throw new Error("InvalidCommittee");
      }
      committeeSet.add(normArb);
    }

    let totalBudget = 0n;
    let lastDeadline = 0n;
    const milestoneDataList: MilestoneData[] = [];

    for (let i = 0; i < terms.milestones.length; i++) {
      const mc = terms.milestones[i];
      if (mc.amount === 0n) {
        throw new Error("InsufficientFunding");
      }
      if (mc.deliveryDeadline <= now || mc.deliveryDeadline < lastDeadline) {
        throw new Error("InvalidDeadlines");
      }
      if (mc.reviewPeriod < 3600 || mc.reviewPeriod > 30 * 86400) {
        throw new Error("InvalidDeadlines");
      }
      lastDeadline = mc.deliveryDeadline;
      totalBudget += mc.amount;

      milestoneDataList.push({
        state: MilestoneState.Pending,
        amount: mc.amount,
        deliveryDeadline: mc.deliveryDeadline,
        reviewDeadline: 0n,
        disputeTimeout: 0n,
        reviewPeriod: mc.reviewPeriod,
        maxRevisions: mc.maxRevisions,
        revisionsUsed: 0,
        disputeRound: 0,
        deliverableHash: ethers.ZeroHash,
        revisionReasonHash: ethers.ZeroHash,
        disputeReasonHash: ethers.ZeroHash,
      });
    }

    // Generate deterministic projectId matching contract hashing
    const dummyDigest = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "address", "uint256", "uint256"],
        [client, freelancer, token, totalBudget, terms.nonce]
      )
    );
    const projectId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "uint256"],
        [dummyDigest, client, terms.nonce]
      )
    );

    if (this.projects.has(projectId)) {
      throw new Error("NonceAlreadyUsed");
    }

    const currentEscrow = this.escrowLiabilities.get(token) ?? 0n;
    this.escrowLiabilities.set(token, currentEscrow + totalBudget);

    const project: ProjectModel = {
      id: projectId,
      terms: {
        ...terms,
        client,
        freelancer,
        token,
        feeRecipient,
        committee: terms.committee.map((a) => this.normalizeAddr(a)),
      },
      totalBudget,
      activeMilestoneIndex: 0,
      milestones: milestoneDataList,
      settled: false,
    };

    this.projects.set(projectId, project);

    this.events.push({
      name: "TermsAccepted",
      projectId,
      timestamp: now,
      data: { client, freelancer, token, totalBudget },
    });
    this.events.push({
      name: "ProjectFunded",
      projectId,
      timestamp: now,
      data: { funder: caller, amount: totalBudget },
    });

    return { projectId };
  }

  public submitDeliverable(projectId: string, milestoneIndex: number, deliverableHash: string, caller: string, now: bigint): void {
    const project = this.projects.get(projectId);
    if (!project) throw new Error("ProjectNotFound");
    if (this.normalizeAddr(caller) !== project.terms.freelancer) throw new Error("Unauthorized");
    if (milestoneIndex !== project.activeMilestoneIndex) throw new Error("InvalidState");
    if (deliverableHash === ethers.ZeroHash) throw new Error("ZeroAddress");

    const m = project.milestones[milestoneIndex];
    if (m.state !== MilestoneState.Pending && m.state !== MilestoneState.RevisionRequested) {
      throw new Error("InvalidState");
    }
    if (now > m.deliveryDeadline) throw new Error("DeliveryDeadlineNotPassed");

    m.state = MilestoneState.Submitted;
    m.deliverableHash = deliverableHash;
    m.reviewDeadline = now + BigInt(m.reviewPeriod);

    this.events.push({
      name: "DeliverableSubmitted",
      projectId,
      milestoneIndex,
      timestamp: now,
      data: { deliverableHash, reviewDeadline: m.reviewDeadline },
    });
  }

  public acceptMilestone(projectId: string, milestoneIndex: number, caller: string, now: bigint): void {
    const project = this.projects.get(projectId);
    if (!project) throw new Error("ProjectNotFound");
    if (this.normalizeAddr(caller) !== project.terms.client) throw new Error("Unauthorized");
    if (milestoneIndex !== project.activeMilestoneIndex) throw new Error("InvalidState");

    const m = project.milestones[milestoneIndex];
    if (m.state !== MilestoneState.Submitted) throw new Error("InvalidState");

    this._settleMilestone(projectId, milestoneIndex, MilestoneState.Released, 0, 10000, now);
  }

  public requestRevision(
    projectId: string,
    milestoneIndex: number,
    revisionReasonHash: string,
    extensionSeconds: bigint,
    caller: string,
    now: bigint
  ): void {
    const project = this.projects.get(projectId);
    if (!project) throw new Error("ProjectNotFound");
    if (this.normalizeAddr(caller) !== project.terms.client) throw new Error("Unauthorized");
    if (milestoneIndex !== project.activeMilestoneIndex) throw new Error("InvalidState");

    const m = project.milestones[milestoneIndex];
    if (m.state !== MilestoneState.Submitted) throw new Error("InvalidState");
    if (m.revisionsUsed >= m.maxRevisions) throw new Error("RevisionsExceeded");

    const maxAllowedExtension = BigInt(m.reviewPeriod * 2);
    let finalExt = extensionSeconds;
    if (finalExt === 0n || finalExt > maxAllowedExtension) {
      finalExt = maxAllowedExtension;
    }

    m.revisionsUsed++;
    m.state = MilestoneState.RevisionRequested;
    m.revisionReasonHash = revisionReasonHash;
    m.deliveryDeadline = now + finalExt;
    m.reviewDeadline = 0n;

    this.events.push({
      name: "RevisionRequested",
      projectId,
      milestoneIndex,
      timestamp: now,
      data: { revisionNumber: m.revisionsUsed, revisionReasonHash, newDeadline: m.deliveryDeadline },
    });
  }

  public finalizeMilestone(projectId: string, milestoneIndex: number, now: bigint): void {
    const project = this.projects.get(projectId);
    if (!project) throw new Error("ProjectNotFound");
    if (milestoneIndex !== project.activeMilestoneIndex) throw new Error("InvalidState");

    const m = project.milestones[milestoneIndex];
    if (m.state !== MilestoneState.Submitted) throw new Error("InvalidState");
    if (now <= m.reviewDeadline) throw new Error("ReviewPeriodNotExpired");

    this._settleMilestone(projectId, milestoneIndex, MilestoneState.Released, 0, 10000, now);
  }

  public claimDeliveryTimeout(projectId: string, milestoneIndex: number, caller: string, now: bigint): void {
    const project = this.projects.get(projectId);
    if (!project) throw new Error("ProjectNotFound");
    if (this.normalizeAddr(caller) !== project.terms.client) throw new Error("Unauthorized");
    if (milestoneIndex !== project.activeMilestoneIndex) throw new Error("InvalidState");

    const m = project.milestones[milestoneIndex];
    if (m.state !== MilestoneState.Pending && m.state !== MilestoneState.RevisionRequested) {
      throw new Error("InvalidState");
    }
    if (now <= m.deliveryDeadline) throw new Error("DeliveryDeadlineNotPassed");

    let totalRefund = 0n;
    for (let i = milestoneIndex; i < project.milestones.length; i++) {
      const cur = project.milestones[i];
      if (cur.state === MilestoneState.Pending || cur.state === MilestoneState.RevisionRequested) {
        cur.state = MilestoneState.Refunded;
        totalRefund += cur.amount;
        this.events.push({
          name: "MilestoneSettled",
          projectId,
          milestoneIndex: i,
          timestamp: now,
          data: { state: MilestoneState.Refunded, clientAmount: cur.amount, freelancerAmount: 0n, feeAmount: 0n },
        });
      }
    }

    const token = project.terms.token;
    this.escrowLiabilities.set(token, (this.escrowLiabilities.get(token) ?? 0n) - totalRefund);
    this.creditLiabilities.set(token, (this.creditLiabilities.get(token) ?? 0n) + totalRefund);
    this.addCredit(project.terms.client, token, totalRefund);

    project.activeMilestoneIndex = project.milestones.length;
    project.settled = true;

    this.events.push({
      name: "ProjectCompleted",
      projectId,
      timestamp: now,
      data: {},
    });
  }

  public openDispute(projectId: string, milestoneIndex: number, disputeReasonHash: string, caller: string, now: bigint): void {
    const project = this.projects.get(projectId);
    if (!project) throw new Error("ProjectNotFound");
    const normCaller = this.normalizeAddr(caller);
    if (normCaller !== project.terms.client && normCaller !== project.terms.freelancer) {
      throw new Error("Unauthorized");
    }
    if (milestoneIndex !== project.activeMilestoneIndex) throw new Error("InvalidState");

    const m = project.milestones[milestoneIndex];
    if (m.state !== MilestoneState.Submitted && m.state !== MilestoneState.RevisionRequested) {
      throw new Error("InvalidState");
    }
    if (m.state === MilestoneState.Submitted && now > m.reviewDeadline) {
      throw new Error("DisputePeriodExpired");
    }

    m.state = MilestoneState.Disputed;
    m.disputeRound++;
    m.disputeReasonHash = disputeReasonHash;
    m.disputeTimeout = now + BigInt(project.terms.disputeWindow);

    this.events.push({
      name: "DisputeOpened",
      projectId,
      milestoneIndex,
      timestamp: now,
      data: { initiator: normCaller, disputeReasonHash, disputeTimeout: m.disputeTimeout },
    });
  }

  public resolveDisputeQuorum(
    projectId: string,
    milestoneIndex: number,
    clientSplitBps: number,
    freelancerSplitBps: number,
    arbitrators: string[],
    now: bigint
  ): void {
    if (clientSplitBps + freelancerSplitBps !== 10000) throw new Error("InvalidSplitBps");

    const project = this.projects.get(projectId);
    if (!project) throw new Error("ProjectNotFound");
    if (milestoneIndex !== project.activeMilestoneIndex) throw new Error("InvalidState");

    const m = project.milestones[milestoneIndex];
    if (m.state !== MilestoneState.Disputed) throw new Error("InvalidState");
    if (arbitrators.length < project.terms.quorumThreshold) throw new Error("QuorumNotMet");

    // Check unique valid committee members
    const seen = new Set<string>();
    for (const a of arbitrators) {
      const normA = this.normalizeAddr(a);
      if (seen.has(normA)) throw new Error("DuplicateSigner");
      if (!project.terms.committee.includes(normA)) throw new Error("InvalidSigner");
      seen.add(normA);
    }

    this._settleMilestone(projectId, milestoneIndex, MilestoneState.SplitSettled, clientSplitBps, freelancerSplitBps, now);
  }

  public resolveDisputeTimeout(projectId: string, milestoneIndex: number, now: bigint): void {
    const project = this.projects.get(projectId);
    if (!project) throw new Error("ProjectNotFound");
    if (milestoneIndex !== project.activeMilestoneIndex) throw new Error("InvalidState");

    const m = project.milestones[milestoneIndex];
    if (m.state !== MilestoneState.Disputed) throw new Error("InvalidState");
    if (now <= m.disputeTimeout) throw new Error("DisputePeriodActive");

    let clientBps = 0;
    let freelancerBps = 0;

    if (project.terms.timeoutPolicy === TimeoutPolicy.RefundToClient) {
      clientBps = 10000;
      freelancerBps = 0;
    } else if (project.terms.timeoutPolicy === TimeoutPolicy.ReleaseToFreelancer) {
      clientBps = 0;
      freelancerBps = 10000;
    } else {
      clientBps = 5000;
      freelancerBps = 5000;
    }

    this._settleMilestone(projectId, milestoneIndex, MilestoneState.SplitSettled, clientBps, freelancerBps, now);
  }

  public executeMutualSettlement(
    projectId: string,
    milestoneIndex: number,
    clientSplitBps: number,
    freelancerSplitBps: number,
    now: bigint
  ): void {
    if (clientSplitBps + freelancerSplitBps !== 10000) throw new Error("InvalidSplitBps");

    const project = this.projects.get(projectId);
    if (!project) throw new Error("ProjectNotFound");
    if (milestoneIndex !== project.activeMilestoneIndex) throw new Error("InvalidState");

    const m = project.milestones[milestoneIndex];
    if (
      m.state === MilestoneState.Released ||
      m.state === MilestoneState.Refunded ||
      m.state === MilestoneState.SplitSettled
    ) {
      throw new Error("InvalidState");
    }

    this._settleMilestone(projectId, milestoneIndex, MilestoneState.SplitSettled, clientSplitBps, freelancerSplitBps, now);
  }

  private _settleMilestone(
    projectId: string,
    milestoneIndex: number,
    targetState: MilestoneState,
    clientSplitBps: number,
    freelancerSplitBps: number,
    now: bigint
  ): void {
    const project = this.projects.get(projectId)!;
    const m = project.milestones[milestoneIndex];
    const principal = m.amount;
    const token = project.terms.token;

    m.state = targetState;

    const clientAmount = (principal * BigInt(clientSplitBps)) / 10000n;
    const freelancerGross = principal - clientAmount;
    let feeAmount = 0n;
    let freelancerNet = freelancerGross;

    if (project.terms.feeBps > 0 && freelancerGross > 0n) {
      feeAmount = (freelancerGross * BigInt(project.terms.feeBps)) / 10000n;
      freelancerNet = freelancerGross - feeAmount;
    }

    // Exact liability conservation invariant:
    // clientAmount + freelancerNet + feeAmount == principal
    if (clientAmount + freelancerNet + feeAmount !== principal) {
      throw new Error("FinancialConservationViolated");
    }

    this.escrowLiabilities.set(token, (this.escrowLiabilities.get(token) ?? 0n) - principal);
    this.creditLiabilities.set(token, (this.creditLiabilities.get(token) ?? 0n) + principal);

    if (clientAmount > 0n) {
      this.addCredit(project.terms.client, token, clientAmount);
    }
    if (freelancerNet > 0n) {
      this.addCredit(project.terms.freelancer, token, freelancerNet);
    }
    if (feeAmount > 0n) {
      this.addCredit(project.terms.feeRecipient, token, feeAmount);
    }

    project.activeMilestoneIndex++;
    if (project.activeMilestoneIndex >= project.milestones.length) {
      project.settled = true;
    }

    this.events.push({
      name: "MilestoneSettled",
      projectId,
      milestoneIndex,
      timestamp: now,
      data: {
        state: targetState,
        clientAmount,
        freelancerAmount: freelancerNet,
        feeAmount,
      },
    });

    if (project.settled) {
      this.events.push({
        name: "ProjectCompleted",
        projectId,
        timestamp: now,
        data: {},
      });
    }
  }

  public withdraw(account: string, token: string, recipient: string, now: bigint): { amount: bigint } {
    const acc = this.normalizeAddr(account);
    const tok = this.normalizeAddr(token);
    const rec = this.normalizeAddr(recipient);

    if (rec === ethers.ZeroAddress) throw new Error("ZeroAddress");

    const amount = this.getCredit(acc, tok);
    if (amount === 0n) throw new Error("ZeroCredit");

    this.setCredit(acc, tok, 0n);
    const currentCreditLiab = this.creditLiabilities.get(tok) ?? 0n;
    this.creditLiabilities.set(tok, currentCreditLiab - amount);

    this.events.push({
      name: "CreditsWithdrawn",
      projectId: "",
      timestamp: now,
      data: { account: acc, token: tok, recipient: rec, amount },
    });

    return { amount };
  }

  public assertInvariants(token: string, actualBalance: bigint): void {
    const tok = this.normalizeAddr(token);
    const liab = this.getLiabilities(tok);

    if (liab.escrowLiability < 0n) {
      throw new Error(`NegativeEscrowLiability: ${liab.escrowLiability}`);
    }
    if (liab.creditLiability < 0n) {
      throw new Error(`NegativeCreditLiability: ${liab.creditLiability}`);
    }
    if (liab.totalLiability !== liab.escrowLiability + liab.creditLiability) {
      throw new Error("LiabilitySumMismatch");
    }
    if (actualBalance < liab.totalLiability) {
      throw new Error(`Insolvency: actual=${actualBalance} < liability=${liab.totalLiability}`);
    }
  }
}
