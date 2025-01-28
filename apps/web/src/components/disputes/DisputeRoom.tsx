import React, { useState } from 'react';
import { useLancechain } from '../../context/LancechainContext';
import { useWallet } from '../../context/WalletContext';
import { MilestoneRecord } from '../../types';
import { formatTokenAmount, truncateAddress, formatTimestamp } from '../../services/termsService';
import { Card } from '../common/Card';
import { StatBox } from '../common/StatBox';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { ScaleIcon, AlertTriangleIcon, CheckCircleIcon } from '../common/Icons';
import { ArbitrationConsole } from './ArbitrationConsole';

export const DisputeRoom: React.FC = () => {
  const { projects } = useLancechain();
  const { account } = useWallet();

  const [selectedDisputeMilestone, setSelectedDisputeMilestone] = useState<{
    milestone: MilestoneRecord;
    tokenSymbol: string;
    tokenDecimals: number;
  } | null>(null);

  // Extract all disputed milestones
  const allDisputedMilestones: Array<{
    milestone: MilestoneRecord;
    agreementId: string;
    tokenSymbol: string;
    tokenDecimals: number;
    client: string;
    freelancer: string;
    arbitrator: string;
  }> = [];

  projects.forEach((p) => {
    p.milestones.forEach((m) => {
      if (m.dispute || m.status === 5 || m.status === 6) {
        allDisputedMilestones.push({
          milestone: m,
          agreementId: p.agreementId,
          tokenSymbol: p.tokenSymbol,
          tokenDecimals: p.tokenDecimals,
          client: p.client,
          freelancer: p.freelancer,
          arbitrator: p.arbitrator,
        });
      }
    });
  });

  const openCount = allDisputedMilestones.filter(
    (d) => d.milestone.dispute?.status === 'OPEN' || d.milestone.status === 5
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatBox
          label="Active Disputes"
          value={openCount}
          unit="cases"
          icon={<AlertTriangleIcon className="w-5 h-5 text-rose-400" />}
          trend={openCount > 0 ? 'negative' : 'neutral'}
          subtext="Awaiting arbitrator ruling"
        />
        <StatBox
          label="Cumulative Resolved"
          value={allDisputedMilestones.length - openCount}
          unit="cases"
          icon={<CheckCircleIcon className="w-5 h-5 text-emerald-400" />}
          subtext="Settled with zero loss"
        />
        <StatBox
          label="Designated Arbitrator"
          value={truncateAddress(account.address)}
          icon={<ScaleIcon className="w-5 h-5 text-purple-400" />}
          subtext={`Role: ${account.role.toUpperCase()}`}
        />
      </div>

      {/* Disputes Table / List */}
      <Card
        title="Escalated Milestones Dossier"
        subtitle="Review claims, evidence packets, and execute legally binding settlement awards"
      >
        {allDisputedMilestones.length === 0 ? (
          <div className="text-center py-12 text-slate-500 font-mono text-sm">
            <CheckCircleIcon className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            No active disputes found across all registered agreements.
          </div>
        ) : (
          <div className="space-y-4">
            {allDisputedMilestones.map((item, idx) => {
              const { milestone, tokenSymbol, tokenDecimals, client, freelancer, arbitrator } = item;
              const isArbitrator = account.address.toLowerCase() === arbitrator.toLowerCase();
              const isResolved = milestone.status === 6 || milestone.dispute?.status === 'RESOLVED';

              return (
                <div
                  key={idx}
                  className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-200">
                        Milestone #{milestone.milestoneId + 1}:
                      </span>
                      <span className="text-sm font-semibold text-slate-300">
                        {milestone.description}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-200">
                        {formatTokenAmount(milestone.amount, tokenDecimals)} {tokenSymbol}
                      </span>
                      {isResolved ? (
                        <Badge variant="purple">Resolved</Badge>
                      ) : (
                        <Badge variant="rose">Dispute Open</Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-mono text-slate-400">
                    <div>Client: <span className="text-slate-300">{truncateAddress(client)}</span></div>
                    <div>Freelancer: <span className="text-slate-300">{truncateAddress(freelancer)}</span></div>
                    <div>Arbitrator: <span className="text-purple-300">{truncateAddress(arbitrator)}</span></div>
                  </div>

                  {milestone.dispute && (
                    <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-400 font-mono">
                        <span>Filing Category: <strong className="text-amber-400 uppercase">{milestone.dispute.claimCategory}</strong></span>
                        <span>Opened: {formatTimestamp(milestone.dispute.createdAt)}</span>
                      </div>
                      <p className="text-slate-200 leading-relaxed italic">
                        "{milestone.dispute.reason}"
                      </p>
                      {milestone.dispute.arbitratorNotes && (
                        <div className="pt-2 border-t border-slate-800 text-purple-300">
                          <strong>Arbitrator Verdict:</strong> {milestone.dispute.arbitratorNotes}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-[11px] font-mono text-slate-500">
                      Agreement: {truncateAddress(item.agreementId)}
                    </div>
                    {!isResolved && (
                      <Button
                        size="sm"
                        variant={isArbitrator ? 'primary' : 'outline'}
                        onClick={() =>
                          setSelectedDisputeMilestone({
                            milestone,
                            tokenSymbol,
                            tokenDecimals,
                          })
                        }
                        icon={<ScaleIcon className="w-3.5 h-3.5" />}
                      >
                        {isArbitrator ? 'Arbitrate Case' : 'Inspect Case Details'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Arbitration Modal */}
      {selectedDisputeMilestone && (
        <ArbitrationConsole
          isOpen={!!selectedDisputeMilestone}
          onClose={() => setSelectedDisputeMilestone(null)}
          milestone={selectedDisputeMilestone.milestone}
          tokenSymbol={selectedDisputeMilestone.tokenSymbol}
          tokenDecimals={selectedDisputeMilestone.tokenDecimals}
        />
      )}
    </div>
  );
};
