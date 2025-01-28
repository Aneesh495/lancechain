import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  glow?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  action,
  className = '',
  bodyClassName = '',
  glow = false,
}) => {
  return (
    <div
      className={`bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm transition-all duration-200 ${
        glow ? 'border-cyan-800/40 shadow-xl shadow-cyan-950/20' : 'hover:border-slate-700/80'
      } ${className}`}
    >
      {(title || action) && (
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between gap-4">
          <div>
            {typeof title === 'string' ? (
              <h3 className="font-semibold text-slate-100 text-base tracking-tight">{title}</h3>
            ) : (
              title
            )}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </div>
  );
};
