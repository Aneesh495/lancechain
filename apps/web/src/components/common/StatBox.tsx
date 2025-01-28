import React from 'react';

interface StatBoxProps {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  icon?: React.ReactNode;
  trend?: 'positive' | 'negative' | 'neutral';
  className?: string;
}

export const StatBox: React.FC<StatBoxProps> = ({
  label,
  value,
  unit,
  subtext,
  icon,
  trend,
  className = '',
}) => {
  return (
    <div
      className={`p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl relative overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between text-slate-400 mb-1.5">
        <span className="text-xs uppercase font-mono tracking-wider">{label}</span>
        {icon && <span className="text-cyan-400 opacity-80">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold font-mono text-slate-100 tracking-tight">{value}</span>
        {unit && <span className="text-xs font-mono text-slate-400 font-medium">{unit}</span>}
      </div>
      {subtext && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs">
          {trend === 'positive' && <span className="text-emerald-400 font-mono font-medium">↑</span>}
          {trend === 'negative' && <span className="text-rose-400 font-mono font-medium">↓</span>}
          <span className="text-slate-400">{subtext}</span>
        </div>
      )}
    </div>
  );
};
