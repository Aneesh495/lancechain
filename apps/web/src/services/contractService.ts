import { ethers } from 'ethers';
import { AgreementTerms } from '../types';

// ABI fragment for LancechainEscrow
const ESCROW_ABI = [
  'function createAgreement((bytes32 agreementId, address client, address freelancer, address arbitrator, address token, (uint256 milestoneId, string description, uint256 amount, uint256 deadline, bytes32 deliverableHash)[] milestones, uint16 arbitrationFeeBps, string termsUri, bytes32 salt) terms) external returns (bytes32)',
  'function acceptTerms(bytes32 agreementId, bytes signature) external',
  'function fundMilestone(bytes32 agreementId, uint256 milestoneId) external',
  'function submitDeliverable(bytes32 agreementId, uint256 milestoneId, bytes32 deliverableHash) external',
  'function approveMilestone(bytes32 agreementId, uint256 milestoneId) external',
  'function openDispute(bytes32 agreementId, uint256 milestoneId, string reason) external',
  'function resolveDispute(bytes32 agreementId, uint256 milestoneId, uint256 clientAmount, uint256 freelancerAmount) external',
  'function withdraw(address token) external returns (uint256)',
  'function getWithdrawableBalance(address account, address token) external view returns (uint256)',
  'function getMilestone(bytes32 agreementId, uint256 milestoneId) external view returns (tuple(uint8 status, uint256 amount, uint256 deadline, bytes32 deliverableHash, uint256 submissionTime, uint256 clientAmount, uint256 freelancerAmount))',
  'function totalEscrowLiability(address token) external view returns (uint256)',
  'function totalWithdrawableLiability(address token) external view returns (uint256)',
  'function accumulatedProtocolFees(address token) external view returns (uint256)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
];

export class ContractService {
  private escrowAddress: string;

  constructor(escrowAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3') {
    this.escrowAddress = escrowAddress;
  }

  public getEscrowContract(signerOrProvider: ethers.Signer | ethers.Provider): ethers.Contract {
    return new ethers.Contract(this.escrowAddress, ESCROW_ABI, signerOrProvider);
  }

  public getErc20Contract(tokenAddress: string, signerOrProvider: ethers.Signer | ethers.Provider): ethers.Contract {
    return new ethers.Contract(tokenAddress, ERC20_ABI, signerOrProvider);
  }

  public async createAgreement(signer: ethers.Signer, terms: AgreementTerms): Promise<string> {
    const contract = this.getEscrowContract(signer);
    const tx = await contract.createAgreement(terms);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  public async acceptTerms(
    signer: ethers.Signer,
    agreementId: string,
    signature: string
  ): Promise<string> {
    const contract = this.getEscrowContract(signer);
    const tx = await contract.acceptTerms(agreementId, signature);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  public async fundMilestone(
    signer: ethers.Signer,
    tokenAddress: string,
    agreementId: string,
    milestoneId: number,
    amount: string
  ): Promise<string> {
    const erc20 = this.getErc20Contract(tokenAddress, signer);
    const owner = await signer.getAddress();
    const currentAllowance = await erc20.allowance(owner, this.escrowAddress);

    if (BigInt(currentAllowance) < BigInt(amount)) {
      const approveTx = await erc20.approve(this.escrowAddress, amount);
      await approveTx.wait();
    }

    const escrow = this.getEscrowContract(signer);
    const tx = await escrow.fundMilestone(agreementId, milestoneId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  public async submitDeliverable(
    signer: ethers.Signer,
    agreementId: string,
    milestoneId: number,
    deliverableHash: string
  ): Promise<string> {
    const escrow = this.getEscrowContract(signer);
    const tx = await escrow.submitDeliverable(agreementId, milestoneId, deliverableHash);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  public async approveMilestone(
    signer: ethers.Signer,
    agreementId: string,
    milestoneId: number
  ): Promise<string> {
    const escrow = this.getEscrowContract(signer);
    const tx = await escrow.approveMilestone(agreementId, milestoneId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  public async openDispute(
    signer: ethers.Signer,
    agreementId: string,
    milestoneId: number,
    reason: string
  ): Promise<string> {
    const escrow = this.getEscrowContract(signer);
    const tx = await escrow.openDispute(agreementId, milestoneId, reason);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  public async resolveDispute(
    signer: ethers.Signer,
    agreementId: string,
    milestoneId: number,
    clientAmount: string,
    freelancerAmount: string
  ): Promise<string> {
    const escrow = this.getEscrowContract(signer);
    const tx = await escrow.resolveDispute(agreementId, milestoneId, clientAmount, freelancerAmount);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  public async withdraw(signer: ethers.Signer, tokenAddress: string): Promise<string> {
    const escrow = this.getEscrowContract(signer);
    const tx = await escrow.withdraw(tokenAddress);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  public async getWithdrawableBalance(
    provider: ethers.Provider,
    account: string,
    tokenAddress: string
  ): Promise<string> {
    try {
      const escrow = this.getEscrowContract(provider);
      const bal = await escrow.getWithdrawableBalance(account, tokenAddress);
      return bal.toString();
    } catch {
      return '0';
    }
  }

  public async getProtocolLiabilities(
    provider: ethers.Provider,
    tokenAddress: string
  ): Promise<{
    escrowLiability: string;
    withdrawableLiability: string;
    protocolFees: string;
  }> {
    try {
      const escrow = this.getEscrowContract(provider);
      const [escrowLiab, withdrawableLiab, fees] = await Promise.all([
        escrow.totalEscrowLiability(tokenAddress),
        escrow.totalWithdrawableLiability(tokenAddress),
        escrow.accumulatedProtocolFees(tokenAddress),
      ]);
      return {
        escrowLiability: escrowLiab.toString(),
        withdrawableLiability: withdrawableLiab.toString(),
        protocolFees: fees.toString(),
      };
    } catch {
      return {
        escrowLiability: '0',
        withdrawableLiability: '0',
        protocolFees: '0',
      };
    }
  }
}

export const contractService = new ContractService();
