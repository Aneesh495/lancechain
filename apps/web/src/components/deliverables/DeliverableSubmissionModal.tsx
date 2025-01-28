import React, { useState } from 'react';
import { useWallet } from '../../context/WalletContext';
import { useLancechain } from '../../context/LancechainContext';
import { MilestoneStatus, DeliverableSubmissionData } from '../../types';
import { computeSha256Hex } from '../../services/termsService';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { FileTextIcon, ShieldIcon } from '../common/Icons';

interface DeliverableSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreementId: string;
  milestoneId: number;
}

export const DeliverableSubmissionModal: React.FC<DeliverableSubmissionModalProps> = ({
  isOpen,
  onClose,
  agreementId,
  milestoneId,
}) => {
  const { account } = useWallet();
  const { addNotification, updateOptimisticMilestone } = useLancechain();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [rawArtifactText, setRawArtifactText] = useState('');
  const [artifactHash, setArtifactHash] = useState('0x');
  const [isHashing, setIsHashing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComputeHash = async (text: string) => {
    setRawArtifactText(text);
    if (!text.trim()) {
      setArtifactHash('0x');
      return;
    }
    setIsHashing(true);
    try {
      const hash = await computeSha256Hex(text);
      setArtifactHash(hash);
    } catch (err) {
      console.error('Hashing error:', err);
    } finally {
      setIsHashing(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || artifactHash === '0x') {
      alert('Please provide a title and deliverable artifact to compute hash.');
      return;
    }

    setIsSubmitting(true);
    try {
      const submission: DeliverableSubmissionData = {
        agreementId,
        milestoneId,
        title,
        description,
        repositoryCommitUrl: repoUrl || undefined,
        demoUrl: demoUrl || undefined,
        artifactHash,
        submittedAt: Date.now(),
        submittedBy: account.address,
      };

      updateOptimisticMilestone(agreementId, milestoneId, MilestoneStatus.SUBMITTED, {
        deliverableHash: artifactHash,
        submissionTime: Math.floor(Date.now() / 1000),
        deliverable: submission,
      });

      addNotification(
        'success',
        'Deliverable Submitted',
        `Milestone #${milestoneId + 1} deliverable submitted with artifact hash ${artifactHash.substring(0, 10)}...`,
        artifactHash
      );

      onClose();
    } catch (err) {
      addNotification('error', 'Submission Failed', (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Submit Deliverable — Milestone #${milestoneId + 1}`}
      subtitle="Provide cryptographic proof of completion and review deliverables"
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-mono text-slate-300 mb-1">
            Deliverable Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Production Solidity Contracts & Fuzz Report"
            className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-300 mb-1">
            Scope & Implementation Notes
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what was built, testing performed, and verification instructions"
            className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Git Commit / PR URL
            </label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Live Demo / Spec Link
            </label>
            <input
              type="text"
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 outline-none"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-mono text-slate-300">
              Artifact Content / Output Payload *
            </label>
            <span className="text-[10px] text-cyan-400 font-mono">
              Live SHA-256 Hashing
            </span>
          </div>
          <textarea
            rows={3}
            value={rawArtifactText}
            onChange={(e) => handleComputeHash(e.target.value)}
            placeholder="Paste source code snippet, test report, or build manifest to compute cryptographic fingerprint..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 outline-none resize-none"
          />
        </div>

        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <ShieldIcon className="w-3.5 h-3.5" />
              Cryptographic Artifact Digest (bytes32):
            </span>
            {isHashing && <span className="animate-pulse text-cyan-400">Computing...</span>}
          </div>
          <div className="text-xs font-mono text-cyan-300 break-all bg-slate-900/90 p-2 rounded border border-slate-800">
            {artifactHash}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={isSubmitting}
            icon={<FileTextIcon className="w-4 h-4" />}
          >
            Submit On-Chain
          </Button>
        </div>
      </div>
    </Modal>
  );
};
