import React from 'react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  disputeCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  disputeCount = 1,
}) => {
  const navItems = [
    { id: 'projects', label: 'Projects & Agreements', icon: '📂' },
    { id: 'deliverables', label: 'Deliverables & Submissions', icon: '📦' },
    { id: 'disputes', label: 'Dispute Room', icon: '⚖️', badge: disputeCount > 0 ? disputeCount : undefined },
    { id: 'withdrawals', label: 'Pull Withdrawals', icon: '💰' },
    { id: 'reputation', label: 'Reputation Explorer', icon: '⭐' },
    { id: 'reconciliation', label: 'Financial Reconciliation', icon: '🛡️' },
    { id: 'audit', label: 'Audit Stream', icon: '🔍' },
  ];

  return (
    <div className="border-b border-slate-800 bg-slate-950/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2 scrollbar-none">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-mono font-medium rounded-lg whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/80 shadow-sm shadow-cyan-950/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold bg-rose-950 border border-rose-800 text-rose-300 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
