import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  segments?: Array<{ value: number; color: string; label?: string }>;
  showPercent?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  segments,
  showPercent = true,
  className = '',
}) => {
  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className={`w-full ${className}`}>
      {showPercent && (
        <div className="flex justify-between text-xs font-mono text-slate-400 mb-1.5">
          <span>Progress</span>
          <span className="text-cyan-400 font-semibold">{percentage}% ({current} of {total})</span>
        </div>
      )}
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
        {segments ? (
          segments.map((seg, idx) => {
            const widthPct = total > 0 ? (seg.value / total) * 100 : 0;
            return (
              <div
                key={idx}
                className={`h-full transition-all duration-300 ${seg.color}`}
                style={{ width: `${widthPct}%` }}
                title={seg.label}
              />
            );
          })
        ) : (
          <div
            className="h-full bg-cyan-500 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>
    </div>
  );
};
