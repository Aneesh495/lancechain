import { ProjectTerms } from "../types.js";
import { ethers } from "ethers";

export const EIP712_DOMAIN_NAME = "LancechainEscrow";
export const EIP712_DOMAIN_VERSION = "1";

export function getEip712Domain(verifyingContract: string, chainId: number | bigint) {
  return {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId: BigInt(chainId),
    verifyingContract: ethers.getAddress(verifyingContract),
  };
}

export const EIP712_TYPES = {
  MilestoneConfig: [
    { name: "amount", type: "uint256" },
    { name: "deliveryDeadline", type: "uint64" },
    { name: "reviewPeriod", type: "uint32" },
    { name: "maxRevisions", type: "uint8" },
  ],
  ProjectTerms: [
    { name: "client", type: "address" },
    { name: "freelancer", type: "address" },
    { name: "token", type: "address" },
    { name: "milestoneHashes", type: "bytes32" },
    { name: "disputeWindow", type: "uint32" },
    { name: "committeeHash", type: "bytes32" },
    { name: "quorumThreshold", type: "uint8" },
    { name: "timeoutPolicy", type: "uint8" },
    { name: "feeBps", type: "uint16" },
    { name: "feeRecipient", type: "address" },
    { name: "agreementHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "signatureExpiry", type: "uint64" },
  ],
  DisputeResolution: [
    { name: "projectId", type: "bytes32" },
    { name: "milestoneIndex", type: "uint256" },
    { name: "disputeRound", type: "uint32" },
    { name: "clientSplitBps", type: "uint16" },
    { name: "freelancerSplitBps", type: "uint16" },
    { name: "nonce", type: "uint256" },
  ],
  MutualSettlement: [
    { name: "projectId", type: "bytes32" },
    { name: "milestoneIndex", type: "uint256" },
    { name: "clientSplitBps", type: "uint16" },
    { name: "freelancerSplitBps", type: "uint16" },
    { name: "nonce", type: "uint256" },
  ],
};

const MILESTONE_CONFIG_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes(
    "MilestoneConfig(uint256 amount,uint64 deliveryDeadline,uint32 reviewPeriod,uint8 maxRevisions)"
  )
);

export function computeMilestoneHashes(milestones: ProjectTerms["milestones"]): string {
  const mHashes = milestones.map((m) =>
    ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "uint256", "uint64", "uint32", "uint8"],
        [MILESTONE_CONFIG_TYPEHASH, m.amount, m.deliveryDeadline, m.reviewPeriod, m.maxRevisions]
      )
    )
  );
  return ethers.keccak256(ethers.concat(mHashes));
}

export function computeCommitteeHash(committee: string[]): string {
  return ethers.keccak256(ethers.concat(committee.map((c) => ethers.getAddress(c))));
}

export async function signProjectTerms(
  terms: ProjectTerms,
  signer: ethers.Signer,
  escrowAddress: string,
  chainId: number | bigint
): Promise<string> {
  const domain = getEip712Domain(escrowAddress, chainId);
  const milestoneHashes = computeMilestoneHashes(terms.milestones);
  const committeeHash = computeCommitteeHash(terms.committee);

  const value = {
    client: ethers.getAddress(terms.client),
    freelancer: ethers.getAddress(terms.freelancer),
    token: terms.token === ethers.ZeroAddress ? ethers.ZeroAddress : ethers.getAddress(terms.token),
    milestoneHashes,
    disputeWindow: terms.disputeWindow,
    committeeHash,
    quorumThreshold: terms.quorumThreshold,
    timeoutPolicy: terms.timeoutPolicy,
    feeBps: terms.feeBps,
    feeRecipient: ethers.getAddress(terms.feeRecipient),
    agreementHash: terms.agreementHash,
    nonce: terms.nonce,
    signatureExpiry: terms.signatureExpiry,
  };

  return await signer.signTypedData(domain, { ProjectTerms: EIP712_TYPES.ProjectTerms }, value);
}

export async function signDisputeResolution(
  params: {
    projectId: string;
    milestoneIndex: number;
    disputeRound: number;
    clientSplitBps: number;
    freelancerSplitBps: number;
    nonce: bigint;
  },
  signer: ethers.Signer,
  escrowAddress: string,
  chainId: number | bigint
): Promise<string> {
  const domain = getEip712Domain(escrowAddress, chainId);
  const value = {
    projectId: params.projectId,
    milestoneIndex: BigInt(params.milestoneIndex),
    disputeRound: params.disputeRound,
    clientSplitBps: params.clientSplitBps,
    freelancerSplitBps: params.freelancerSplitBps,
    nonce: params.nonce,
  };
  return await signer.signTypedData(domain, { DisputeResolution: EIP712_TYPES.DisputeResolution }, value);
}

export async function signMutualSettlement(
  params: {
    projectId: string;
    milestoneIndex: number;
    clientSplitBps: number;
    freelancerSplitBps: number;
    nonce: bigint;
  },
  signer: ethers.Signer,
  escrowAddress: string,
  chainId: number | bigint
): Promise<string> {
  const domain = getEip712Domain(escrowAddress, chainId);
  const value = {
    projectId: params.projectId,
    milestoneIndex: BigInt(params.milestoneIndex),
    clientSplitBps: params.clientSplitBps,
    freelancerSplitBps: params.freelancerSplitBps,
    nonce: params.nonce,
  };
  return await signer.signTypedData(domain, { MutualSettlement: EIP712_TYPES.MutualSettlement }, value);
}
