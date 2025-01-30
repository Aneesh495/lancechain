import React from 'react';
import { MilestoneRecord } from '../../types';
import { truncateAddress, formatTimestamp } from '../../services/termsService';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { ShieldIcon, ExternalLinkIcon, CheckCircleIcon, AlertTriangleIcon } from '../common/Icons';

interface DeliverableInspectionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  milestone: MilestoneRecord | null;
  onApprove?: (milestoneId: number) => void;
  onDispute?: (milestoneId: number) => void;
  isClient?: boolean;
}

export const DeliverableInspectionPanel: React.FC<DeliverableInspectionPanelProps> = ({
  isOpen,
  onClose,
  milestone,
  onApprove,
  onDispute,
  isClient,
}) => {
  if (!milestone || !milestone.deliverable) return null;

  const { deliverable } = milestone;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Deliverable Review: Phase #${milestone.milestoneId + 1}`}
      subtitle={`Submitted by ${truncateAddress(deliverable.submittedBy)}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div>
          <h4 className="text-base font-bold text-slate-100">{deliverable.title}</h4>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Submitted at: {formatTimestamp(deliverable.submittedAt)}
          </p>
        </div>

        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
          <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
            Deliverable Notes & Verification Scope
          </label>
          <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
            {deliverable.description}
          </p>
        </div>

        <div className="space-y-2">
          {deliverable.repositoryCommitUrl && (
            <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
              <span className="text-slate-400 font-mono">Source Repository / Commit:</span>
              <a
                href={deliverable.repositoryCommitUrl}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono font-medium"
              >
                <span>View Commit</span>
                <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {deliverable.demoUrl && (
            <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
              <span className="text-slate-400 font-mono">Live Demo / Deployment:</span>
              <a
                href={deliverable.demoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono font-medium"
              >
                <span>Launch Link</span>
                <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-1">
            <ShieldIcon className="w-4 h-4" />
            <span>Cryptographic Artifact Proof:</span>
          </div>
          <div className="text-xs font-mono text-slate-300 break-all bg-slate-900 p-2 rounded border border-slate-800">
            {deliverable.artifactHash}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            This SHA-256 digest is immutably anchored into the escrow state machine.
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>

          {isClient && (
            <div className="flex items-center gap-2">
              {onDispute && (
                <Button
                  variant="danger"
                  onClick={() => {
                    onDispute(milestone.milestoneId);
                    onClose();
                  }}
                  icon={<AlertTriangleIcon className="w-4 h-4" />}
                >
                  Raise Dispute
                </Button>
              )}
              {onApprove && (
                <Button
                  variant="emerald"
                  onClick={() => {
                    onApprove(milestone.milestoneId);
                    onClose();
                  }}
                  icon={<CheckCircleIcon className="w-4 h-4" />}
                >
                  Approve Deliverable
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
