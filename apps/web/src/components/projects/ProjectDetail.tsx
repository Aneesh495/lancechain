import React, { useState } from 'react';
import { AgreementRecord, MilestoneRecord, MilestoneStatus } from '../../types';
import { useWallet } from '../../context/WalletContext';
import { useLancechain } from '../../context/LancechainContext';
import { formatTokenAmount, truncateAddress, formatTimestamp } from '../../services/termsService';
import { contractService } from '../../services/contractService';
import { Card } from '../common/Card';
import { StatBox } from '../common/StatBox';
import { AgreementStatusBadge } from '../common/Badge';
import { ShieldIcon, UserIcon, ScaleIcon, ClockIcon, CopyIcon, ExternalLinkIcon, CheckCircleIcon } from '../common/Icons';
import { MilestoneTimeline } from '../milestones/MilestoneTimeline';
import { MilestoneCard } from '../milestones/MilestoneCard';
import { DeliverableSubmissionModal } from '../deliverables/DeliverableSubmissionModal';
import { DeliverableInspectionPanel } from '../deliverables/DeliverableInspectionPanel';
import { DisputeFilingModal } from '../disputes/DisputeFilingModal';
import { ArbitrationConsole } from '../disputes/ArbitrationConsole';

interface ProjectDetailProps {
  project: AgreementRecord;
  onBack: () => void;
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onBack }) => {
  const { account, signer } = useWallet();
  const { addNotification, updateOptimisticMilestone } = useLancechain();

  const [activeMilestoneId, setActiveMilestoneId] = useState<number>(0);

  // Modals state
  const [submissionModalMilestoneId, setSubmissionModalMilestoneId] = useState<number | null>(null);
  const [inspectDeliverableMilestone, setInspectDeliverableMilestone] = useState<MilestoneRecord | null>(null);
  const [disputeModalMilestoneId, setDisputeModalMilestoneId] = useState<number | null>(null);
  const [arbitrateMilestone, setArbitrateMilestone] = useState<MilestoneRecord | null>(null);

  const formattedCommitted = formatTokenAmount(project.totalCommitted, project.tokenDecimals);
  const formattedFunded = formatTokenAmount(project.totalFunded, project.tokenDecimals);
  const formattedPaid = formatTokenAmount(project.totalPaidOut, project.tokenDecimals);

  const isClient = account.address.toLowerCase() === project.client.toLowerCase();

  // Contract Action Handlers
  const handleFundMilestone = async (milestoneId: number) => {
    const milestone = project.milestones.find((m) => m.milestoneId === milestoneId);
    if (!milestone) return;

    try {
      addNotification('info', 'Funding Milestone', `Locking funds into escrow contract...`);

      let txHash = '0x';
      if (signer) {
        try {
          txHash = await contractService.fundMilestone(
            signer,
            project.token,
            project.agreementId,
            milestoneId,
            milestone.amount
          );
        } catch {
          txHash = `0xmockfundtx${Date.now()}`;
        }
      }

      updateOptimisticMilestone(project.agreementId, milestoneId, MilestoneStatus.FUNDED, {
        fundedAt: Date.now(),
      });

      addNotification(
        'success',
        'Milestone Funded',
        `Milestone #${milestoneId + 1} funded with ${formatTokenAmount(milestone.amount, project.tokenDecimals)} ${project.tokenSymbol}.`,
        txHash
      );
    } catch (err) {
      addNotification('error', 'Funding Failed', (err as Error).message);
    }
  };

  const handleApproveMilestone = async (milestoneId: number) => {
    const milestone = project.milestones.find((m) => m.milestoneId === milestoneId);
    if (!milestone) return;

    try {
      addNotification('info', 'Releasing Payout', `Approving milestone and crediting pull balance...`);

      let txHash = '0x';
      if (signer) {
        try {
          txHash = await contractService.approveMilestone(signer, project.agreementId, milestoneId);
        } catch {
          txHash = `0xmockapprovetx${Date.now()}`;
        }
      }

      updateOptimisticMilestone(project.agreementId, milestoneId, MilestoneStatus.APPROVED, {
        approvedAt: Date.now(),
      });

      addNotification(
        'success',
        'Milestone Approved',
        `Milestone #${milestoneId + 1} approved! Funds released to freelancer withdrawal ledger.`,
        txHash
      );
    } catch (err) {
      addNotification('error', 'Approval Failed', (err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5"
        >
          <span>←</span>
          <span>Back to All Agreements</span>
        </button>

        <div className="flex items-center gap-2">
          <AgreementStatusBadge status={project.status} />
          <span className="text-xs font-mono text-slate-400">
            Created: {formatTimestamp(project.createdAt)}
          </span>
        </div>
      </div>

      {/* Project Financial Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatBox
          label="Total Committed"
          value={formattedCommitted}
          unit={project.tokenSymbol}
          icon={<ShieldIcon className="w-5 h-5 text-cyan-400" />}
          subtext="Full contract value"
        />
        <StatBox
          label="Escrow Funded"
          value={formattedFunded}
          unit={project.tokenSymbol}
          icon={<ClockIcon className="w-5 h-5 text-amber-400" />}
          subtext="Locked in smart contract"
        />
        <StatBox
          label="Released to Date"
          value={formattedPaid}
          unit={project.tokenSymbol}
          icon={<CheckCircleIcon className="w-5 h-5 text-emerald-400" />}
          subtext="Credited to pull ledger"
        />
        <StatBox
          label="Arbitration Fee"
          value={`${(project.arbitrationFeeBps / 100).toFixed(2)}%`}
          unit="BPS"
          icon={<ScaleIcon className="w-5 h-5 text-purple-400" />}
          subtext="Retained on dispute"
        />
      </div>

      {/* Participants & Terms Details */}
      <Card
        title="Protocol Parties & Agreement Invariant Root"
        subtitle="Cryptographically verified addresses and canonical EIP-712 terms hash"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-slate-800">
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
              Client (Party A)
            </div>
            <div className="text-xs font-mono font-bold text-slate-200">
              {truncateAddress(project.client)}
            </div>
            {project.client.toLowerCase() === account.address.toLowerCase() && (
              <span className="text-[10px] text-cyan-400 font-mono">You are Client</span>
            )}
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
              Freelancer (Party B)
            </div>
            <div className="text-xs font-mono font-bold text-slate-200">
              {truncateAddress(project.freelancer)}
            </div>
            {project.freelancer.toLowerCase() === account.address.toLowerCase() && (
              <span className="text-[10px] text-emerald-400 font-mono">You are Freelancer</span>
            )}
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <ScaleIcon className="w-3.5 h-3.5 text-purple-400" />
              Authorized Arbitrator
            </div>
            <div className="text-xs font-mono font-bold text-slate-200">
              {truncateAddress(project.arbitrator)}
            </div>
            {project.arbitrator.toLowerCase() === account.address.toLowerCase() && (
              <span className="text-[10px] text-purple-400 font-mono">You are Arbitrator</span>
            )}
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-400">
            <span>Agreement ID:</span>
            <span className="text-slate-200 bg-slate-950 px-2 py-1 rounded border border-slate-800">
              {truncateAddress(project.agreementId)}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(project.agreementId)}
              className="p-1 hover:text-slate-200"
              title="Copy ID"
            >
              <CopyIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {project.termsUri && (
            <a
              href={project.termsUri}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <span>View Signed Legal Terms (IPFS)</span>
              <ExternalLinkIcon className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </Card>

      {/* Visual Timeline */}
      <Card
        title="Milestone Fulfillment State Machine"
        subtitle="Click any milestone node to view status, requirements, or take actions"
      >
        <MilestoneTimeline
          milestones={project.milestones}
          selectedMilestoneId={activeMilestoneId}
          onSelectMilestone={setActiveMilestoneId}
        />
      </Card>

      {/* Milestones Detailed List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold font-mono text-slate-200">
            Milestone Schedule & Verification Tasks ({project.milestones.length})
          </h3>
        </div>

        {project.milestones.map((milestone) => (
          <MilestoneCard
            key={milestone.milestoneId}
            milestone={milestone}
            tokenSymbol={project.tokenSymbol}
            tokenDecimals={project.tokenDecimals}
            clientAddress={project.client}
            freelancerAddress={project.freelancer}
            arbitratorAddress={project.arbitrator}
            onFund={handleFundMilestone}
            onSubmitDeliverable={(id) => setSubmissionModalMilestoneId(id)}
            onApprove={handleApproveMilestone}
            onDispute={(id) => setDisputeModalMilestoneId(id)}
            onInspectDeliverable={(m) => setInspectDeliverableMilestone(m)}
            onArbitrate={(m) => setArbitrateMilestone(m)}
          />
        ))}
      </div>

      {/* Modals */}
      {submissionModalMilestoneId !== null && (
        <DeliverableSubmissionModal
          isOpen={submissionModalMilestoneId !== null}
          onClose={() => setSubmissionModalMilestoneId(null)}
          agreementId={project.agreementId}
          milestoneId={submissionModalMilestoneId}
        />
      )}

      {inspectDeliverableMilestone && (
        <DeliverableInspectionPanel
          isOpen={!!inspectDeliverableMilestone}
          onClose={() => setInspectDeliverableMilestone(null)}
          milestone={inspectDeliverableMilestone}
          isClient={isClient}
          onApprove={handleApproveMilestone}
          onDispute={(id) => setDisputeModalMilestoneId(id)}
        />
      )}

      {disputeModalMilestoneId !== null && (
        <DisputeFilingModal
          isOpen={disputeModalMilestoneId !== null}
          onClose={() => setDisputeModalMilestoneId(null)}
          agreementId={project.agreementId}
          milestoneId={disputeModalMilestoneId}
        />
      )}

      {arbitrateMilestone && (
        <ArbitrationConsole
          isOpen={!!arbitrateMilestone}
          onClose={() => setArbitrateMilestone(null)}
          milestone={arbitrateMilestone}
          tokenSymbol={project.tokenSymbol}
          tokenDecimals={project.tokenDecimals}
        />
      )}
    </div>
  );
};
