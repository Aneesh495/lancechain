import React from 'react';
import { useLancechain } from '../../context/LancechainContext';
import { CheckCircleIcon, AlertTriangleIcon, CloseIcon, ExternalLinkIcon } from '../common/Icons';
import { truncateAddress } from '../../services/termsService';

export const NotificationToastContainer: React.FC = () => {
  const { notifications, removeNotification } = useLancechain();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`pointer-events-auto p-4 rounded-xl border shadow-2xl backdrop-blur-md flex items-start gap-3 transition-all duration-200 animate-in slide-in-from-bottom-2 ${
            n.type === 'success'
              ? 'bg-slate-900/95 border-emerald-800/80 text-emerald-300'
              : n.type === 'error'
              ? 'bg-slate-900/95 border-rose-800/80 text-rose-300'
              : n.type === 'warning'
              ? 'bg-slate-900/95 border-amber-800/80 text-amber-300'
              : 'bg-slate-900/95 border-cyan-800/80 text-cyan-300'
          }`}
        >
          <div className="mt-0.5">
            {n.type === 'success' ? (
              <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
            ) : n.type === 'error' ? (
              <AlertTriangleIcon className="w-5 h-5 text-rose-400" />
            ) : (
              <AlertTriangleIcon className="w-5 h-5 text-cyan-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-slate-100 font-mono">{n.title}</h4>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{n.message}</p>
            {n.txHash && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-cyan-400">
                <span>Tx:</span>
                <span className="underline">{truncateAddress(n.txHash)}</span>
                <ExternalLinkIcon className="w-3 h-3" />
              </div>
            )}
          </div>
          <button
            onClick={() => removeNotification(n.id)}
            className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800/50"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
