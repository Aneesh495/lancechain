import React, { useState } from 'react';
import { useLancechain } from '../../context/LancechainContext';
import { useWallet } from '../../context/WalletContext';
import { AgreementRecord, MilestoneStatus, AgreementStatus } from '../../types';
import { formatTokenAmount, truncateAddress, formatTimestamp } from '../../services/termsService';
import { Card } from '../common/Card';
import { StatBox } from '../common/StatBox';
import { Button } from '../common/Button';
import { ProgressBar } from '../common/ProgressBar';
import { AgreementStatusBadge } from '../common/Badge';
import { ShieldIcon, ClockIcon, CheckCircleIcon, UserIcon, ArrowRightIcon } from '../common/Icons';

interface ProjectExplorerProps {
  onSelectProject: (project: AgreementRecord) => void;
  openCreateModal: () => void;
}

export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({
  onSelectProject,
  openCreateModal,
}) => {
  const { projects } = useLancechain();
  const { account } = useWallet();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'CLIENT' | 'FREELANCER' | 'ARBITRATOR'>('ALL');

  // Compute protocol summary stats
  const activeCount = projects.filter((p) => p.status === AgreementStatus.ACTIVE).length;
  const completedCount = projects.filter((p) => p.status === AgreementStatus.COMPLETED).length;

  const totalCommittedUsd = projects.reduce((sum, p) => {
    const val = parseFloat(formatTokenAmount(p.totalCommitted, p.tokenDecimals));
    if (p.tokenSymbol === 'WETH') return sum + val * 2500;
    return sum + val;
  }, 0);

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.agreementId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.freelancer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.milestones.some((m) => m.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter !== 'ALL') {
      if (statusFilter === 'ACTIVE' && p.status !== AgreementStatus.ACTIVE) return false;
      if (statusFilter === 'COMPLETED' && p.status !== AgreementStatus.COMPLETED) return false;
      if (statusFilter === 'DISPUTED' && p.status !== AgreementStatus.DISPUTED) return false;
      if (statusFilter === 'DRAFT' && p.status !== AgreementStatus.DRAFT && p.status !== AgreementStatus.SIGNED) return false;
    }

    if (roleFilter === 'CLIENT') {
      return p.client.toLowerCase() === account.address.toLowerCase();
    }
    if (roleFilter === 'FREELANCER') {
      return p.freelancer.toLowerCase() === account.address.toLowerCase();
    }
    if (roleFilter === 'ARBITRATOR') {
      return p.arbitrator.toLowerCase() === account.address.toLowerCase();
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatBox
          label="Total Escrow Value"
          value={`$${totalCommittedUsd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          unit="Committed"
          icon={<ShieldIcon className="w-5 h-5 text-cyan-400" />}
          trend="positive"
          subtext="Backed by verifiable contracts"
        />
        <StatBox
          label="Active Agreements"
          value={activeCount}
          unit="live"
          icon={<ClockIcon className="w-5 h-5 text-amber-400" />}
          subtext="Under active delivery"
        />
        <StatBox
          label="Settled & Completed"
          value={completedCount}
          unit="closed"
          icon={<CheckCircleIcon className="w-5 h-5 text-emerald-400" />}
          subtext="100% invariant verified"
        />
        <StatBox
          label="My Active Role"
          value={account.label.split(' ')[0]}
          unit={account.role.toUpperCase()}
          icon={<UserIcon className="w-5 h-5 text-purple-400" />}
          subtext={truncateAddress(account.address)}
        />
      </div>

      {/* Filter & Controls Bar */}
      <Card
        title="Escrow Agreements Ledger"
        subtitle="Search, filter, and inspect verifiable milestone agreements across all networks"
        action={
          <Button
            size="sm"
            variant="primary"
            onClick={openCreateModal}
            icon={<span className="font-bold">+</span>}
          >
            Create Agreement
          </Button>
        }
      >
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by address, description, or agreement hash..."
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 outline-none"
          />

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 outline-none"
            >
              <option value="ALL">All States</option>
              <option value="ACTIVE">Active Escrows</option>
              <option value="DISPUTED">Disputed Cases</option>
              <option value="COMPLETED">Completed</option>
              <option value="DRAFT">Draft & Signed</option>
            </select>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 outline-none"
            >
              <option value="ALL">All Parties</option>
              <option value="CLIENT">Where I'm Client</option>
              <option value="FREELANCER">Where I'm Freelancer</option>
              <option value="ARBITRATOR">Where I'm Arbitrator</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Agreements Cards Grid */}
      {filteredProjects.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-xl space-y-3 font-mono">
          <p className="text-sm text-slate-400">No agreements matching your current filters.</p>
          <Button size="sm" variant="outline" onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setRoleFilter('ALL'); }}>
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((p) => {
            const formattedTotal = formatTokenAmount(p.totalCommitted, p.tokenDecimals);
            const approvedCount = p.milestones.filter(
              (m) => m.status === MilestoneStatus.APPROVED
            ).length;

            return (
              <div
                key={p.agreementId}
                onClick={() => onSelectProject(p)}
                className="p-5 bg-slate-900/80 border border-slate-800 hover:border-cyan-700/60 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-cyan-950/20 group flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-mono text-slate-400">
                      Created: {formatTimestamp(p.createdAt)}
                    </span>
                    <AgreementStatusBadge status={p.status} />
                  </div>

                  <h3 className="font-bold text-slate-100 text-base group-hover:text-cyan-300 transition-colors line-clamp-1">
                    {p.milestones[0]?.description || 'Multi-Milestone Escrow Agreement'}
                  </h3>

                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <span className="text-xl font-bold font-mono text-slate-100">
                        {formattedTotal}
                      </span>
                      <span className="text-xs font-mono text-cyan-400 font-semibold ml-1.5">
                        {p.tokenSymbol}
                      </span>
                    </div>
                    <div className="text-right text-[11px] font-mono text-slate-400">
                      {p.milestones.length} Milestones
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mt-3">
                    <ProgressBar
                      current={approvedCount}
                      total={p.milestones.length}
                    />
                  </div>
                </div>

                {/* Counterparties Chips */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Client</span>
                      <span className="text-slate-300 font-medium">
                        {truncateAddress(p.client)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Freelancer</span>
                      <span className="text-slate-300 font-medium">
                        {truncateAddress(p.freelancer)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-cyan-400 group-hover:translate-x-1 transition-transform">
                    <span className="text-xs font-semibold">Inspect</span>
                    <ArrowRightIcon className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
