import { ethers } from 'ethers';
import { AgreementTerms } from '../types';

export const EIP712_DOMAIN = {
  name: 'LancechainEscrow',
  version: '1',
  chainId: 31337,
  verifyingContract: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
};

export const MILESTONE_TYPE = [
  { name: 'milestoneId', type: 'uint256' },
  { name: 'description', type: 'string' },
  { name: 'amount', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
  { name: 'deliverableHash', type: 'bytes32' },
];

export const AGREEMENT_TERMS_TYPE = {
  MilestoneTerms: MILESTONE_TYPE,
  AgreementTerms: [
    { name: 'agreementId', type: 'bytes32' },
    { name: 'client', type: 'address' },
    { name: 'freelancer', type: 'address' },
    { name: 'arbitrator', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'milestones', type: 'MilestoneTerms[]' },
    { name: 'arbitrationFeeBps', type: 'uint16' },
    { name: 'termsUri', type: 'string' },
    { name: 'salt', type: 'bytes32' },
  ],
};

export async function computeSha256Hex(data: string | Uint8Array): Promise<string> {
  let bytes: Uint8Array;
  if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data);
  } else {
    bytes = data;
  }
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `0x${hex}`;
}

export function computeAgreementTermsHash(
  terms: AgreementTerms,
  contractAddress = EIP712_DOMAIN.verifyingContract,
  chainId = EIP712_DOMAIN.chainId
): string {
  const domain = {
    ...EIP712_DOMAIN,
    chainId,
    verifyingContract: contractAddress,
  };

  return ethers.TypedDataEncoder.hash(
    domain,
    { AgreementTerms: AGREEMENT_TERMS_TYPE.AgreementTerms, MilestoneTerms: MILESTONE_TYPE },
    terms
  );
}

export function formatTokenAmount(raw: string, decimals = 6): string {
  try {
    const formatted = ethers.formatUnits(raw, decimals);
    const num = parseFloat(formatted);
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: decimals > 4 ? 4 : decimals,
    });
  } catch {
    return '0.00';
  }
}

export function parseTokenAmount(amount: string, decimals = 6): string {
  try {
    return ethers.parseUnits(amount, decimals).toString();
  } catch {
    return '0';
  }
}

export function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
}

export function formatTimestamp(tsSecondsOrMs: number): string {
  const ms = tsSecondsOrMs < 10000000000 ? tsSecondsOrMs * 1000 : tsSecondsOrMs;
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeRemaining(deadlineSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = deadlineSeconds - now;
  if (diff <= 0) {
    return 'Expired / Past Due';
  }
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}
