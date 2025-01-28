import React from 'react';
import { MilestoneRecord, MilestoneStatus } from '../../types';
import { CheckCircleIcon, ClockIcon, LockIcon, AlertTriangleIcon } from '../common/Icons';

interface MilestoneTimelineProps {
  milestones: MilestoneRecord[];
  onSelectMilestone?: (milestoneId: number) => void;
  selectedMilestoneId?: number;
}

export const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({
  milestones,
  onSelectMilestone,
  selectedMilestoneId,
}) => {
  return (
    <div className="py-4">
      <div className="relative flex items-center justify-between">
        {/* Connector line */}
        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-slate-800 z-0" />

        {milestones.map((m, idx) => {
          const isSelected = selectedMilestoneId === m.milestoneId;

          let icon = <ClockIcon className="w-4 h-4 text-slate-400" />;
          let circleBg = 'bg-slate-900 border-slate-700 text-slate-400';

          if (m.status === MilestoneStatus.APPROVED) {
            icon = <CheckCircleIcon className="w-4 h-4 text-emerald-400" />;
            circleBg = 'bg-emerald-950 border-emerald-500 text-emerald-300';
          } else if (m.status === MilestoneStatus.DISPUTED) {
            icon = <AlertTriangleIcon className="w-4 h-4 text-rose-400" />;
            circleBg = 'bg-rose-950 border-rose-500 text-rose-300';
          } else if (m.status === MilestoneStatus.SUBMITTED) {
            icon = <ClockIcon className="w-4 h-4 text-amber-400 animate-spin" />;
            circleBg = 'bg-amber-950 border-amber-500 text-amber-300';
          } else if (m.status === MilestoneStatus.FUNDED) {
            icon = <LockIcon className="w-4 h-4 text-cyan-400" />;
            circleBg = 'bg-cyan-950 border-cyan-500 text-cyan-300';
          }

          return (
            <div
              key={m.milestoneId}
              onClick={() => onSelectMilestone && onSelectMilestone(m.milestoneId)}
              className={`relative z-10 flex flex-col items-center cursor-pointer transition-all duration-150 ${
                isSelected ? 'scale-110' : 'hover:scale-105'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-lg transition-colors ${circleBg} ${
                  isSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-950' : ''
                }`}
              >
                {icon}
              </div>
              <div className="mt-2 text-center">
                <span className="text-xs font-mono font-semibold text-slate-200 block">
                  Phase {idx + 1}
                </span>
                <span className="text-[10px] font-mono text-slate-400 max-w-[100px] truncate block">
                  {m.description}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
