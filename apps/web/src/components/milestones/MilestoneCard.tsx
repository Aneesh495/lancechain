import React from 'react';
import { MilestoneRecord, MilestoneStatus } from '../../types';
import { useWallet } from '../../context/WalletContext';
import { formatTokenAmount, formatTimeRemaining, truncateAddress } from '../../services/termsService';
import { MilestoneStatusBadge } from '../common/Badge';
import { Button } from '../common/Button';
import { ClockIcon, LockIcon, CheckCircleIcon, AlertTriangleIcon, FileTextIcon } from '../common/Icons';

interface MilestoneCardProps {
  milestone: MilestoneRecord;
  tokenSymbol: string;
  tokenDecimals: number;
  clientAddress: string;
  freelancerAddress: string;
  arbitratorAddress: string;
  onFund: (milestoneId: number) => void;
  onSubmitDeliverable: (milestoneId: number) => void;
  onApprove: (milestoneId: number) => void;
  onDispute: (milestoneId: number) => void;
  onInspectDeliverable: (milestone: MilestoneRecord) => void;
  onArbitrate: (milestone: MilestoneRecord) => void;
}

export const MilestoneCard: React.FC<MilestoneCardProps> = ({
  milestone,
  tokenSymbol,
  tokenDecimals,
  clientAddress,
  freelancerAddress,
  arbitratorAddress,
  onFund,
  onSubmitDeliverable,
  onApprove,
  onDispute,
  onInspectDeliverable,
  onArbitrate,
}) => {
  const { account } = useWallet();
  const currentAddress = account.address.toLowerCase();
  const isClient = currentAddress === clientAddress.toLowerCase();
  const isFreelancer = currentAddress === freelancerAddress.toLowerCase();
  const isArbitrator = currentAddress === arbitratorAddress.toLowerCase();

  const formattedAmount = formatTokenAmount(milestone.amount, tokenDecimals);
  const timeRemaining = formatTimeRemaining(milestone.deadline);

  return (
    <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl hover:border-slate-700/80 transition-all duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs font-bold flex items-center justify-center">
            #{milestone.milestoneId + 1}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-slate-200">{milestone.description}</h4>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5">
              <span className="flex items-center gap-1">
                <ClockIcon className="w-3.5 h-3.5 text-slate-500" />
                {timeRemaining}
              </span>
              {milestone.deliverableHash && (
                <span className="text-cyan-400/80">
                  Hash: {truncateAddress(milestone.deliverableHash)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="text-right">
            <div className="text-sm font-bold font-mono text-slate-100">
              {formattedAmount} {tokenSymbol}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Net: ~{(parseFloat(formattedAmount) * 0.99).toFixed(2)} (1% fee)
            </div>
          </div>
          <MilestoneStatusBadge status={milestone.status} />
        </div>
      </div>

      {/* Deliverable Snapshot if submitted */}
      {milestone.deliverable && (
        <div className="mt-3 p-2.5 bg-slate-950/70 border border-slate-800/70 rounded-lg flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <FileTextIcon className="w-4 h-4 text-cyan-400" />
            <div>
              <span className="font-semibold text-slate-300">
                {milestone.deliverable.title}
              </span>
              <span className="text-[10px] text-slate-500 block">
                Artifact SHA-256: {truncateAddress(milestone.deliverable.artifactHash)}
              </span>
            </div>
          </div>
          <button
            onClick={() => onInspectDeliverable(milestone)}
            className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline"
          >
            Inspect Evidence
          </button>
        </div>
      )}

      {/* Action Footer */}
      <div className="mt-3 flex items-center justify-between gap-2 pt-2">
        <div className="text-[11px] text-slate-500 font-mono">
          {milestone.status === MilestoneStatus.DRAFT && 'Requires client funding to unlock'}
          {milestone.status === MilestoneStatus.FUNDED && 'Funds locked in escrow contract'}
          {milestone.status === MilestoneStatus.SUBMITTED && 'Awaiting client review & release'}
          {milestone.status === MilestoneStatus.APPROVED && 'Released to freelancer pull balance'}
          {milestone.status === MilestoneStatus.DISPUTED && 'Under arbitration review'}
        </div>

        <div className="flex items-center gap-2">
          {/* Client: Fund milestone */}
          {milestone.status === MilestoneStatus.DRAFT && isClient && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onFund(milestone.milestoneId)}
              icon={<LockIcon className="w-3.5 h-3.5" />}
            >
              Fund Milestone ({formattedAmount} {tokenSymbol})
            </Button>
          )}

          {/* Freelancer: Submit Deliverable */}
          {milestone.status === MilestoneStatus.FUNDED && isFreelancer && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onSubmitDeliverable(milestone.milestoneId)}
              icon={<FileTextIcon className="w-3.5 h-3.5" />}
            >
              Submit Deliverable
            </Button>
          )}

          {/* Client: Approve Milestone */}
          {milestone.status === MilestoneStatus.SUBMITTED && isClient && (
            <>
              <Button
                size="sm"
                variant="danger"
                onClick={() => onDispute(milestone.milestoneId)}
                icon={<AlertTriangleIcon className="w-3.5 h-3.5" />}
              >
                Dispute
              </Button>
              <Button
                size="sm"
                variant="emerald"
                onClick={() => onApprove(milestone.milestoneId)}
                icon={<CheckCircleIcon className="w-3.5 h-3.5" />}
              >
                Approve & Release
              </Button>
            </>
          )}

          {/* Freelancer: Dispute if client unresponsive */}
          {milestone.status === MilestoneStatus.SUBMITTED && isFreelancer && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDispute(milestone.milestoneId)}
              icon={<AlertTriangleIcon className="w-3.5 h-3.5" />}
            >
              Dispute Non-Response
            </Button>
          )}

          {/* Arbitrator: Resolve Dispute */}
          {milestone.status === MilestoneStatus.DISPUTED && isArbitrator && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onArbitrate(milestone)}
              icon={<AlertTriangleIcon className="w-3.5 h-3.5" />}
            >
              Arbitrate & Award Split
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
