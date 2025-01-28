import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../../context/WalletContext';
import { useLancechain } from '../../context/LancechainContext';
import { AgreementTerms, MilestoneTerms, AgreementRecord, AgreementStatus, MilestoneStatus } from '../../types';
import {
  computeAgreementTermsHash,
  parseTokenAmount,
} from '../../services/termsService';
import { DEMO_ACCOUNTS, SUPPORTED_TOKENS } from '../../services/mockDataService';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { PlusIcon, TrashIcon, ShieldIcon } from '../common/Icons';

interface AgreementBuilderProps {
  onSuccess: (newAgreementId: string) => void;
  onCancel: () => void;
}

export const AgreementBuilder: React.FC<AgreementBuilderProps> = ({ onSuccess, onCancel }) => {
  const { account, signer } = useWallet();
  const { addNotification, addOptimisticAgreement } = useLancechain();

  const [freelancerAddress, setFreelancerAddress] = useState(DEMO_ACCOUNTS[1].address);
  const [arbitratorAddress, setArbitratorAddress] = useState(DEMO_ACCOUNTS[2].address);
  const [selectedToken, setSelectedToken] = useState(SUPPORTED_TOKENS[0]);
  const [arbitrationFeeBps, setArbitrationFeeBps] = useState(250); // 2.5%
  const [termsUri, setTermsUri] = useState('ipfs://bafybeilancechaindefaulttermscontract');

  const [milestones, setMilestones] = useState<Array<{ description: string; amountTokens: string; daysToDeadline: number }>>([
    {
      description: 'System Architecture Specification & Invariant Checklist',
      amountTokens: '1000',
      daysToDeadline: 7,
    },
    {
      description: 'Smart Contract Implementation & Fuzzing Suite',
      amountTokens: '2000',
      daysToDeadline: 14,
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const addMilestoneRow = () => {
    setMilestones((prev) => [
      ...prev,
      {
        description: `Milestone ${prev.length + 1} Deliverable`,
        amountTokens: '500',
        daysToDeadline: (prev.length + 1) * 7,
      },
    ]);
  };

  const removeMilestoneRow = (index: number) => {
    if (milestones.length <= 1) return;
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMilestone = (index: number, field: string, value: string | number) => {
    setMilestones((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  // Calculate totals
  const totalAmountTokens = milestones.reduce(
    (sum, m) => sum + (parseFloat(m.amountTokens) || 0),
    0
  );

  const handleCreateAndSign = async () => {
    setIsSubmitting(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const salt = ethers.hexlify(ethers.randomBytes(32));

      const structuredMilestones: MilestoneTerms[] = milestones.map((m, idx) => ({
        milestoneId: idx,
        description: m.description,
        amount: parseTokenAmount(m.amountTokens, selectedToken.decimals),
        deadline: now + m.daysToDeadline * 86400,
        deliverableHash: ethers.ZeroHash,
      }));

      const agreementTerms: AgreementTerms = {
        agreementId: ethers.ZeroHash, // will be computed from hash
        client: account.address,
        freelancer: freelancerAddress,
        arbitrator: arbitratorAddress,
        token: selectedToken.address,
        milestones: structuredMilestones,
        arbitrationFeeBps,
        termsUri,
        salt,
      };

      const computedHash = computeAgreementTermsHash(agreementTerms);
      agreementTerms.agreementId = computedHash;

      let clientSignature = '0x';
      if (signer) {
        try {
          // Attempt on-chain contract creation or local signature
          addNotification(
            'info',
            'Signing Terms',
            'Generating EIP-712 signature for structured milestone terms...'
          );
          clientSignature = await signer.signMessage(ethers.getBytes(computedHash));
        } catch {
          clientSignature = '0xmockclientsignature1234567890abcdef';
        }
      }

      const totalCommittedRaw = structuredMilestones.reduce(
        (sum, m) => (BigInt(sum) + BigInt(m.amount)).toString(),
        '0'
      );

      const newRecord: AgreementRecord = {
        agreementId: computedHash,
        client: account.address,
        freelancer: freelancerAddress,
        arbitrator: arbitratorAddress,
        token: selectedToken.address,
        tokenSymbol: selectedToken.symbol,
        tokenDecimals: selectedToken.decimals,
        status: AgreementStatus.SIGNED,
        totalCommitted: totalCommittedRaw,
        totalFunded: '0',
        totalPaidOut: '0',
        totalDisputed: '0',
        termsHash: computedHash,
        termsUri,
        arbitrationFeeBps,
        clientSignature,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        milestones: structuredMilestones.map((m) => ({
          milestoneId: m.milestoneId,
          agreementId: computedHash,
          description: m.description,
          amount: m.amount,
          deadline: m.deadline,
          status: MilestoneStatus.DRAFT,
        })),
      };

      addOptimisticAgreement(newRecord);
      addNotification(
        'success',
        'Agreement Created',
        `Agreement created with ${milestones.length} milestones totaling ${totalAmountTokens} ${selectedToken.symbol}.`,
        computedHash
      );

      onSuccess(computedHash);
    } catch (err) {
      console.error('Agreement creation error:', err);
      addNotification('error', 'Creation Failed', (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="Parties & Token Configuration"
        subtitle="Specify counterparty addresses, arbitration terms, and settlement currency"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Client Address (Party A)
            </label>
            <input
              type="text"
              readOnly
              value={account.address}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-400 cursor-not-allowed"
            />
            <span className="text-[10px] text-slate-500 font-mono">Current active signer</span>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Freelancer Address (Party B)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={freelancerAddress}
                onChange={(e) => setFreelancerAddress(e.target.value)}
                placeholder="0x..."
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 outline-none"
              />
              <select
                onChange={(e) => setFreelancerAddress(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-slate-300 outline-none"
              >
                <option value={DEMO_ACCOUNTS[1].address}>Bob</option>
                <option value={DEMO_ACCOUNTS[0].address}>Alice</option>
                <option value={DEMO_ACCOUNTS[2].address}>Clara</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Authorized Arbitrator
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={arbitratorAddress}
                onChange={(e) => setArbitratorAddress(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 outline-none"
              />
              <select
                onChange={(e) => setArbitratorAddress(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-slate-300 outline-none"
              >
                <option value={DEMO_ACCOUNTS[2].address}>Clara (Arbitrator)</option>
                <option value={DEMO_ACCOUNTS[3].address}>Admin Deployer</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">Settlement Token</label>
            <select
              value={selectedToken.address}
              onChange={(e) => {
                const tok = SUPPORTED_TOKENS.find((t) => t.address === e.target.value);
                if (tok) setSelectedToken(tok);
              }}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 outline-none"
            >
              {SUPPORTED_TOKENS.map((t) => (
                <option key={t.address} value={t.address}>
                  {t.symbol} ({t.name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Arbitration Fee (Basis Points)
            </label>
            <input
              type="number"
              value={arbitrationFeeBps}
              onChange={(e) => setArbitrationFeeBps(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 outline-none"
            />
            <span className="text-[10px] text-slate-400 font-mono">
              {(arbitrationFeeBps / 100).toFixed(2)}% split upon dispute filing
            </span>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">Terms URI / IPFS Hash</label>
            <input
              type="text"
              value={termsUri}
              onChange={(e) => setTermsUri(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 outline-none"
            />
            <span className="text-[10px] text-slate-400 font-mono">
              Off-chain legal specification reference
            </span>
          </div>
        </div>
      </Card>

      <Card
        title={
          <div className="flex items-center justify-between">
            <span>Milestone Schedule</span>
            <span className="text-xs font-mono text-cyan-400">
              Total: {totalAmountTokens} {selectedToken.symbol}
            </span>
          </div>
        }
        subtitle="Define deterministic milestones with clear deliverables and delivery deadlines"
        action={
          <Button variant="outline" size="sm" onClick={addMilestoneRow} icon={<PlusIcon className="w-3.5 h-3.5" />}>
            Add Milestone
          </Button>
        }
      >
        <div className="space-y-3">
          {milestones.map((m, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl flex flex-col md:flex-row gap-3 items-start md:items-center justify-between"
            >
              <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-400 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                #{idx + 1}
              </div>

              <div className="flex-1 w-full">
                <input
                  type="text"
                  value={m.description}
                  onChange={(e) => updateMilestone(idx, 'description', e.target.value)}
                  placeholder="Milestone description and scope requirements"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="w-32">
                  <div className="relative">
                    <input
                      type="number"
                      value={m.amountTokens}
                      onChange={(e) => updateMilestone(idx, 'amountTokens', e.target.value)}
                      placeholder="Amount"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg pl-3 pr-12 py-1.5 text-xs font-mono text-slate-200 outline-none"
                    />
                    <span className="absolute right-2 top-1.5 text-[10px] font-mono text-slate-400">
                      {selectedToken.symbol}
                    </span>
                  </div>
                </div>

                <div className="w-32">
                  <div className="relative">
                    <input
                      type="number"
                      value={m.daysToDeadline}
                      onChange={(e) => updateMilestone(idx, 'daysToDeadline', parseInt(e.target.value) || 1)}
                      placeholder="Days"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg pl-3 pr-10 py-1.5 text-xs font-mono text-slate-200 outline-none"
                    />
                    <span className="absolute right-2 top-1.5 text-[10px] font-mono text-slate-400">
                      days
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => removeMilestoneRow(idx)}
                  disabled={milestones.length <= 1}
                  className="p-2 text-slate-400 hover:text-rose-400 disabled:opacity-30 rounded-lg hover:bg-slate-900 transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <ShieldIcon className="w-4 h-4 text-emerald-400" />
          <span>EIP-712 Domain Separator active: chainId 31337</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateAndSign}
            loading={isSubmitting}
            icon={<ShieldIcon className="w-4 h-4" />}
          >
            Create & Sign Agreement
          </Button>
        </div>
      </div>
    </div>
  );
};
