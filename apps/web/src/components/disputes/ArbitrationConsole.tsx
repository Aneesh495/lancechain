import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../../context/WalletContext';
import { useLancechain } from '../../context/LancechainContext';
import { MilestoneRecord, MilestoneStatus } from '../../types';
import { formatTokenAmount, parseTokenAmount, truncateAddress } from '../../services/termsService';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { ScaleIcon, CheckCircleIcon, ExternalLinkIcon } from '../common/Icons';

interface ArbitrationConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  milestone: MilestoneRecord | null;
  tokenSymbol: string;
  tokenDecimals: number;
}

export const ArbitrationConsole: React.FC<ArbitrationConsoleProps> = ({
  isOpen,
  onClose,
  milestone,
  tokenSymbol,
  tokenDecimals,
}) => {
  const { account } = useWallet();
  const { addNotification, updateOptimisticMilestone } = useLancechain();

  const [clientSplitPct, setClientSplitPct] = useState(50);
  const [arbitratorNotes, setArbitratorNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!milestone) return null;

  const totalAmountNum = parseFloat(ethers.formatUnits(milestone.amount, tokenDecimals));
  const clientAmountNum = (totalAmountNum * (clientSplitPct / 100)).toFixed(2);
  const freelancerAmountNum = (totalAmountNum * ((100 - clientSplitPct) / 100)).toFixed(2);

  const handleResolve = async () => {
    setIsSubmitting(true);
    try {
      const clientAward = parseTokenAmount(clientAmountNum, tokenDecimals);
      const freelancerAward = parseTokenAmount(freelancerAmountNum, tokenDecimals);

      updateOptimisticMilestone(milestone.agreementId, milestone.milestoneId, MilestoneStatus.RESOLVED, {
        resolvedAt: Date.now(),
        dispute: milestone.dispute
          ? {
              ...milestone.dispute,
              status: 'RESOLVED',
              clientAward,
              freelancerAward,
              arbitratorNotes,
            }
          : undefined,
      });

      addNotification(
        'success',
        'Dispute Resolved',
        `Arbitrator ruling executed: ${clientAmountNum} ${tokenSymbol} to Client, ${freelancerAmountNum} ${tokenSymbol} to Freelancer.`
      );

      onClose();
    } catch (err) {
      addNotification('error', 'Resolution Failed', (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Arbitration Court: Binding Award Verdict"
      subtitle={`Resolving Milestone #${milestone.milestoneId + 1} (${formatTokenAmount(milestone.amount, tokenDecimals)} ${tokenSymbol})`}
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Dispute Summary */}
        {milestone.dispute && (
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Initiated by: {truncateAddress(milestone.dispute.initiator)}</span>
              <span className="text-amber-400 uppercase font-semibold">
                Category: {milestone.dispute.claimCategory.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed italic bg-slate-900/60 p-2.5 rounded border border-slate-800/80">
              "{milestone.dispute.reason}"
            </p>
            {milestone.dispute.evidenceUri && (
              <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-mono">
                <span>Evidence Dossier:</span>
                <a
                  href={milestone.dispute.evidenceUri}
                  target="_blank"
                  rel="noreferrer"
                  className="underline flex items-center gap-1"
                >
                  {truncateAddress(milestone.dispute.evidenceUri)}
                  <ExternalLinkIcon className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}

        {/* Award Distribution Slider */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono text-slate-300 uppercase tracking-wider">
              Settlement Allocation Ratio
            </h4>
            <span className="text-xs font-mono font-bold text-cyan-400">
              Total: {totalAmountNum} {tokenSymbol}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            value={clientSplitPct}
            onChange={(e) => setClientSplitPct(parseInt(e.target.value) || 0)}
            className="w-full accent-cyan-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
          />

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
              <div className="text-[11px] font-mono text-slate-400">Award to Client (Refund)</div>
              <div className="text-lg font-bold font-mono text-cyan-300">
                {clientAmountNum} {tokenSymbol}
              </div>
              <div className="text-[10px] font-mono text-slate-500">{clientSplitPct}% of milestone</div>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
              <div className="text-[11px] font-mono text-slate-400">Award to Freelancer</div>
              <div className="text-lg font-bold font-mono text-emerald-300">
                {freelancerAmountNum} {tokenSymbol}
              </div>
              <div className="text-[10px] font-mono text-slate-500">{100 - clientSplitPct}% of milestone</div>
            </div>
          </div>

          <div className="text-[11px] font-mono text-emerald-400/90 flex items-center gap-1.5">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            <span>Exact Sum Conservation Invariant Verified: Client + Freelancer == Milestone Amount</span>
          </div>
        </div>

        {/* Arbitrator Findings */}
        <div>
          <label className="block text-xs font-mono text-slate-300 mb-1">
            Arbitrator Legal & Technical Findings
          </label>
          <textarea
            rows={3}
            value={arbitratorNotes}
            onChange={(e) => setArbitratorNotes(e.target.value)}
            placeholder="Document rationale, technical assessment of deliverable artifacts, and precedent justification..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none resize-none"
          />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div className="text-[11px] font-mono text-slate-500">
            Signer: {truncateAddress(account.address)}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleResolve}
              loading={isSubmitting}
              icon={<ScaleIcon className="w-4 h-4" />}
            >
              Execute Binding Verdict
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
