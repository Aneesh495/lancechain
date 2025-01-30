import React, { useState } from 'react';
import { useWallet } from '../../context/WalletContext';
import { useLancechain } from '../../context/LancechainContext';
import { MilestoneStatus, DisputeRecord } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { AlertTriangleIcon } from '../common/Icons';

interface DisputeFilingModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreementId: string;
  milestoneId: number;
}

export const DisputeFilingModal: React.FC<DisputeFilingModalProps> = ({
  isOpen,
  onClose,
  agreementId,
  milestoneId,
}) => {
  const { account } = useWallet();
  const { addNotification, updateOptimisticMilestone } = useLancechain();

  const [claimCategory, setClaimCategory] = useState<DisputeRecord['claimCategory']>('quality_defect');
  const [reason, setReason] = useState('');
  const [evidenceUri, setEvidenceUri] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert('Please specify the dispute reason and breach details.');
      return;
    }

    setIsSubmitting(true);
    try {
      const disputeData: DisputeRecord = {
        disputeId: `disp-${Date.now()}`,
        agreementId,
        milestoneId,
        initiator: account.address,
        reason,
        claimCategory,
        evidenceUri: evidenceUri || 'ipfs://bafybeidisputeevidencepacketdefault',
        status: 'OPEN',
        createdAt: Date.now(),
        clientAward: '0',
        freelancerAward: '0',
      };

      updateOptimisticMilestone(agreementId, milestoneId, MilestoneStatus.DISPUTED, {
        dispute: disputeData,
      });

      addNotification(
        'warning',
        'Dispute Opened',
        `Milestone #${milestoneId + 1} has been escalated to authorized arbitration.`
      );

      onClose();
    } catch (err) {
      addNotification('error', 'Dispute Filing Failed', (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Escalate Dispute: Milestone #${milestoneId + 1}`}
      subtitle="Authorized arbitrator will inspect evidence and make binding distribution"
      maxWidth="md"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-mono text-slate-300 mb-1">
            Claim Classification *
          </label>
          <select
            value={claimCategory}
            onChange={(e) => setClaimCategory(e.target.value as DisputeRecord['claimCategory'])}
            className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 outline-none"
          >
            <option value="quality_defect">Defective Deliverable / Invariant Failure</option>
            <option value="non_delivery">Non-delivery / Missed SLA Deadline</option>
            <option value="scope_mismatch">Scope Breach / Divergent Requirements</option>
            <option value="unresponsive">Unresponsive Counterparty</option>
            <option value="other">Other Commercial Dispute</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-300 mb-1">
            Breach Explanation & Detailed Evidence *
          </label>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain how the submitted work violates agreed milestone specifications..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-300 mb-1">
            Evidence Link / IPFS CID
          </label>
          <input
            type="text"
            value={evidenceUri}
            onChange={(e) => setEvidenceUri(e.target.value)}
            placeholder="ipfs://bafybei... or https://..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 outline-none"
          />
        </div>

        <div className="p-3 bg-rose-950/30 border border-rose-800/50 rounded-lg text-xs text-rose-300 space-y-1">
          <div className="font-semibold flex items-center gap-1.5 font-mono">
            <AlertTriangleIcon className="w-3.5 h-3.5" />
            Binding On-Chain Arbitration Policy:
          </div>
          <p className="text-[11px] text-rose-200/80 leading-relaxed">
            Opening a dispute halts payout triggers and transfers custody resolution to the designated arbitrator.
            The arbitration fee agreed upon in terms will be levied upon resolution.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            loading={isSubmitting}
            icon={<AlertTriangleIcon className="w-4 h-4" />}
          >
            Escalate to Arbitrator
          </Button>
        </div>
      </div>
    </Modal>
  );
};
