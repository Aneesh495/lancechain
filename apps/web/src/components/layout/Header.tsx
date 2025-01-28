import React, { useState } from 'react';
import { useWallet } from '../../context/WalletContext';
import { truncateAddress } from '../../services/termsService';
import { ShieldIcon, WalletIcon, UserIcon } from '../common/Icons';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openCreateModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ setActiveTab, openCreateModal }) => {
  const { account, accounts, selectAccount, connectMetaMask, isMetaMask } = useWallet();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const roleColors = {
    client: 'bg-cyan-950/80 text-cyan-300 border-cyan-800',
    freelancer: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
    arbitrator: 'bg-purple-950/80 text-purple-300 border-purple-800',
    admin: 'bg-amber-950/80 text-amber-300 border-amber-800',
    observer: 'bg-slate-800 text-slate-300 border-slate-700',
  };

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 p-0.5 shadow-lg shadow-cyan-950/50 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <span className="text-xl">⛓️</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-slate-100 tracking-tight font-mono">
                LANCECHAIN
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-cyan-950/60 border border-cyan-800/60 text-cyan-400 rounded">
                v1.0-MAINNET
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono tracking-tight flex items-center gap-1">
              <ShieldIcon className="w-3 h-3 text-emerald-400" />
              Verifiable Escrow Protocol
            </p>
          </div>
        </div>

        {/* Network & Actions */}
        <div className="flex items-center gap-3">
          {/* Quick Create Agreement */}
          <button
            onClick={openCreateModal}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 text-xs font-bold rounded-lg hover:opacity-95 shadow-md shadow-cyan-950/40 transition-all active:scale-[0.98]"
          >
            <span>+</span>
            <span>New Agreement</span>
          </button>

          {/* Network Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Anvil (31337)</span>
          </div>

          {/* Account Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-mono transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                <UserIcon className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-200">{account.label}</span>
                  <span
                    className={`text-[9px] uppercase px-1.5 py-0.2 rounded border ${
                      roleColors[account.role]
                    }`}
                  >
                    {account.role}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {truncateAddress(account.address)} • {account.balanceEth} ETH
                </div>
              </div>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1.5 text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider border-b border-slate-800/80">
                  Switch Anvil Test Persona
                </div>
                <div className="p-1 space-y-1">
                  {accounts.map((acc) => (
                    <button
                      key={acc.address}
                      onClick={() => {
                        selectAccount(acc);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-xs font-mono transition-colors ${
                        account.address.toLowerCase() === acc.address.toLowerCase() && !isMetaMask
                          ? 'bg-cyan-950/60 border border-cyan-800/50 text-cyan-300'
                          : 'hover:bg-slate-800/70 text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{acc.label}</div>
                        <div className="text-[10px] text-slate-400">{truncateAddress(acc.address)}</div>
                      </div>
                      <span
                        className={`text-[9px] uppercase px-1.5 py-0.5 rounded border ${
                          roleColors[acc.role]
                        }`}
                      >
                        {acc.role}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-slate-800/80 mt-1 pt-1 p-1">
                  <button
                    onClick={() => {
                      connectMetaMask();
                      setDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-mono text-slate-300 hover:bg-slate-800/70 transition-colors"
                  >
                    <WalletIcon className="w-4 h-4 text-amber-400" />
                    <span>Connect Browser Wallet</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Pull Withdrawals Shortcut */}
          <button
            onClick={() => setActiveTab('withdrawals')}
            className="p-2 text-slate-300 hover:text-cyan-300 bg-slate-900 border border-slate-800 rounded-lg hover:border-cyan-800/50 transition-colors relative"
            title="Pull Withdrawals Ledger"
          >
            <WalletIcon className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
          </button>
        </div>
      </div>
    </header>
  );
};
