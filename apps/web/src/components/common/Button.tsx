import React from 'react';
import { RefreshIcon } from './Icons';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost' | 'emerald';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variantStyles = {
    primary:
      'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold focus:ring-cyan-500 shadow-lg shadow-cyan-950/50',
    secondary:
      'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 focus:ring-slate-500',
    emerald:
      'bg-emerald-600 hover:bg-emerald-500 text-white font-semibold focus:ring-emerald-500 shadow-lg shadow-emerald-950/50',
    danger:
      'bg-rose-600 hover:bg-rose-500 text-white font-semibold focus:ring-rose-500 shadow-lg shadow-rose-950/50',
    outline:
      'border border-cyan-700/60 text-cyan-300 hover:bg-cyan-950/40 focus:ring-cyan-500',
    ghost:
      'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 focus:ring-slate-500',
  };

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="animate-spin mr-1"><RefreshIcon className="w-4 h-4" /></span> : icon}
      {children}
    </button>
  );
};
