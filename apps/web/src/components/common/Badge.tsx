import React from 'react';
import { MilestoneStatus, AgreementStatus } from '../../types';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'cyan',
  size = 'md',
  className = '',
}) => {
  const variantStyles = {
    cyan: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60',
    emerald: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
    amber: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
    rose: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
    purple: 'bg-purple-950/60 text-purple-300 border-purple-800/60',
    slate: 'bg-slate-800/80 text-slate-300 border-slate-700',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 font-mono',
    md: 'text-xs px-2.5 py-1 font-mono font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border tracking-wide uppercase ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 animate-pulse" />
      {children}
    </span>
  );
};

export const MilestoneStatusBadge: React.FC<{ status: MilestoneStatus }> = ({ status }) => {
  switch (status) {
    case MilestoneStatus.DRAFT:
      return <Badge variant="slate">Draft</Badge>;
    case MilestoneStatus.FUNDED:
      return <Badge variant="cyan">Funded</Badge>;
    case MilestoneStatus.SUBMITTED:
      return <Badge variant="amber">Submitted</Badge>;
    case MilestoneStatus.APPROVED:
      return <Badge variant="emerald">Approved</Badge>;
    case MilestoneStatus.DISPUTED:
      return <Badge variant="rose">Disputed</Badge>;
    case MilestoneStatus.RESOLVED:
      return <Badge variant="purple">Resolved</Badge>;
    case MilestoneStatus.REFUNDED:
      return <Badge variant="slate">Refunded</Badge>;
    case MilestoneStatus.CANCELLED:
      return <Badge variant="rose">Cancelled</Badge>;
    default:
      return <Badge variant="slate">None</Badge>;
  }
};

export const AgreementStatusBadge: React.FC<{ status: AgreementStatus }> = ({ status }) => {
  switch (status) {
    case AgreementStatus.DRAFT:
      return <Badge variant="slate">Draft</Badge>;
    case AgreementStatus.SIGNED:
      return <Badge variant="cyan">Signed</Badge>;
    case AgreementStatus.ACTIVE:
      return <Badge variant="cyan">Active</Badge>;
    case AgreementStatus.COMPLETED:
      return <Badge variant="emerald">Completed</Badge>;
    case AgreementStatus.DISPUTED:
      return <Badge variant="rose">Disputed</Badge>;
    case AgreementStatus.CANCELLED:
      return <Badge variant="slate">Cancelled</Badge>;
    default:
      return <Badge variant="slate">Unknown</Badge>;
  }
};
