import React, { useState } from 'react';
import { useLancechain } from '../../context/LancechainContext';
import { useWallet } from '../../context/WalletContext';
import { MilestoneRecord } from '../../types';
import { truncateAddress } from '../../services/termsService';
import { Card } from '../common/Card';
import { StatBox } from '../common/StatBox';
import { Button } from '../common/Button';
import { MilestoneStatusBadge } from '../common/Badge';
import { FileTextIcon, ShieldIcon, CheckCircleIcon, ExternalLinkIcon } from '../common/Icons';
import { DeliverableInspectionPanel } from './DeliverableInspectionPanel';

interface DeliverablesViewProps {
  onSelectProjectById: (agreementId: string) => void;
}

export const DeliverablesView: React.FC<DeliverablesViewProps> = ({ onSelectProjectById }) => {
  const { projects } = useLancechain();
  const { account } = useWallet();

  const [inspectMilestone, setInspectMilestone] = useState<MilestoneRecord | null>(null);

  // Extract all deliverables
  const deliverablesList: Array<{
    milestone: MilestoneRecord;
    agreementId: string;
    tokenSymbol: string;
    tokenDecimals: number;
    client: string;
    freelancer: string;
  }> = [];

  projects.forEach((p) => {
    p.milestones.forEach((m) => {
      if (m.deliverable || m.deliverableHash) {
        deliverablesList.push({
          milestone: m,
          agreementId: p.agreementId,
          tokenSymbol: p.tokenSymbol,
          tokenDecimals: p.tokenDecimals,
          client: p.client,
          freelancer: p.freelancer,
        });
      }
    });
  });

  const mySubmissions = deliverablesList.filter(
    (d) => d.freelancer.toLowerCase() === account.address.toLowerCase()
  );

  return (
    <div className="space-y-6">
      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatBox
          label="Total Deliverables"
          value={deliverablesList.length}
          unit="artifacts"
          icon={<FileTextIcon className="w-5 h-5 text-cyan-400" />}
          subtext="Cryptographically anchored"
        />
        <StatBox
          label="My Authored Deliverables"
          value={mySubmissions.length}
          unit="milestones"
          icon={<CheckCircleIcon className="w-5 h-5 text-emerald-400" />}
          subtext="As Freelancer"
        />
        <StatBox
          label="Proof Hash Algorithm"
          value="SHA-256"
          unit="bytes32"
          icon={<ShieldIcon className="w-5 h-5 text-purple-400" />}
          subtext="Standardized EVM leaf"
        />
      </div>

      {/* Deliverables List */}
      <Card
        title="Deliverable Submissions Registry"
        subtitle="Immutable evidence packets submitted by freelancers to satisfy milestone requirements"
      >
        {deliverablesList.length === 0 ? (
          <div className="text-center py-12 text-slate-500 font-mono text-sm">
            <FileTextIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            No milestone deliverables submitted yet.
          </div>
        ) : (
          <div className="space-y-4">
            {deliverablesList.map((item, idx) => {
              const { milestone, agreementId, freelancer } = item;
              const del = milestone.deliverable;

              return (
                <div
                  key={idx}
                  className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3 hover:border-slate-700/80 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-mono font-bold text-xs text-slate-300">
                        #{milestone.milestoneId + 1}
                      </span>
                      <div>
                        <h4 className="font-semibold text-sm text-slate-200">
                          {del?.title || milestone.description}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Submitted by {truncateAddress(del?.submittedBy || freelancer)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <MilestoneStatusBadge status={milestone.status} />
                    </div>
                  </div>

                  {del?.description && (
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-2.5 rounded border border-slate-800/60">
                      {del.description}
                    </p>
                  )}

                  <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2 text-slate-400">
                      <ShieldIcon className="w-4 h-4 text-emerald-400" />
                      <span>Proof Hash:</span>
                      <span className="text-cyan-300">
                        {truncateAddress(del?.artifactHash || milestone.deliverableHash || '')}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {del?.repositoryCommitUrl && (
                        <a
                          href={del.repositoryCommitUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                        >
                          <span>Commit</span>
                          <ExternalLinkIcon className="w-3 h-3" />
                        </a>
                      )}
                      {del?.demoUrl && (
                        <a
                          href={del.demoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                        >
                          <span>Live Demo</span>
                          <ExternalLinkIcon className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs font-mono text-slate-400">
                    <div>
                      Agreement: <button onClick={() => onSelectProjectById(agreementId)} className="text-cyan-400 hover:underline">{truncateAddress(agreementId)}</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setInspectMilestone(milestone)}
                        icon={<FileTextIcon className="w-3.5 h-3.5" />}
                      >
                        Inspect Proof
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSelectProjectById(agreementId)}
                      >
                        Open Agreement
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {inspectMilestone && (
        <DeliverableInspectionPanel
          isOpen={!!inspectMilestone}
          onClose={() => setInspectMilestone(null)}
          milestone={inspectMilestone}
        />
      )}
    </div>
  );
};
