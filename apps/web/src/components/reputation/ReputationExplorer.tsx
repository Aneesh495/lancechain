import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../../context/WalletContext';
import { ReputationProfile } from '../../types';
import { apiClient } from '../../services/apiClient';
import { formatTokenAmount, formatTimestamp } from '../../services/termsService';
import { DEMO_ACCOUNTS } from '../../services/mockDataService';
import { Card } from '../common/Card';
import { StatBox } from '../common/StatBox';
import { Badge } from '../common/Badge';
import { CheckCircleIcon, ShieldIcon, ScaleIcon } from '../common/Icons';

export const ReputationExplorer: React.FC = () => {
  const { account } = useWallet();
  const [searchAddress, setSearchAddress] = useState(DEMO_ACCOUNTS[1].address); // default Bob
  const [profile, setProfile] = useState<ReputationProfile | null>(null);

  const fetchProfile = useCallback(async (target: string) => {
    try {
      const data = await apiClient.getReputation(target);
      setProfile(data);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }, []);

  useEffect(() => {
    fetchProfile(searchAddress);
  }, [fetchProfile, searchAddress]);

  const tierColors = {
    Unrated: 'slate',
    Bronze: 'amber',
    Silver: 'slate',
    Gold: 'amber',
    Platinum: 'cyan',
  } as const;

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <Card
        title="Protocol Reputation & Merit Oracle"
        subtitle="On-chain performance scores based on milestone fulfillment, volume, and dispute resolution"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            placeholder="Search address (0x...)"
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 outline-none"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Quick Pick:</span>
            {DEMO_ACCOUNTS.slice(0, 3).map((acc) => (
              <button
                key={acc.address}
                onClick={() => setSearchAddress(acc.address)}
                className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors ${
                  searchAddress.toLowerCase() === acc.address.toLowerCase()
                    ? 'bg-cyan-950 border-cyan-800 text-cyan-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {acc.label.split(' ')[0]}
              </button>
            ))}
            <button
              onClick={() => setSearchAddress(account.address)}
              className="px-2.5 py-1 text-xs font-mono rounded border bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
            >
              Me
            </button>
          </div>
        </div>
      </Card>

      {/* Profile Overview */}
      {profile && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatBox
              label="Trust Score"
              value={profile.score}
              unit="/ 1000"
              icon={<ShieldIcon className="w-5 h-5 text-cyan-400" />}
              trend="positive"
              subtext={`Tier: ${profile.tier}`}
            />
            <div className="sm:hidden">
              <Badge variant={tierColors[profile.tier]}>{profile.tier}</Badge>
            </div>
            <StatBox
              label="Completed Projects"
              value={profile.totalProjectsCompleted}
              unit="milestones"
              icon={<CheckCircleIcon className="w-5 h-5 text-emerald-400" />}
              subtext="Successfully delivered"
            />
            <StatBox
              label="Settled Escrow Volume"
              value={`$${formatTokenAmount(profile.totalVolumeHandled, 6)}`}
              unit="USDC"
              icon={<ShieldIcon className="w-5 h-5 text-cyan-400" />}
              subtext="Lifetime settlement"
            />
            <StatBox
              label="Dispute Ratio"
              value={`${(profile.disputeRateBps / 100).toFixed(2)}%`}
              unit="bps"
              icon={<ScaleIcon className="w-5 h-5 text-amber-400" />}
              trend={profile.disputeRateBps < 100 ? 'positive' : 'negative'}
              subtext={`${profile.disputesWon} won / ${profile.disputesLost} lost`}
            />
          </div>

          {/* Reputation Mechanics Explanation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card
              title="Reputation Scoring Model"
              subtitle="Mathematical invariants governing trust progression"
            >
              <div className="space-y-3 text-xs text-slate-300">
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center justify-between">
                  <span>Base Score (Unrated Baseline)</span>
                  <span className="font-mono font-bold text-slate-200">500 pts</span>
                </div>
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center justify-between">
                  <span>Successful Milestone Delivery & Approval</span>
                  <span className="font-mono font-bold text-emerald-400">+15 to +25 pts</span>
                </div>
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center justify-between">
                  <span>Prompt Client Approval (&lt; 24h)</span>
                  <span className="font-mono font-bold text-cyan-400">+10 pts</span>
                </div>
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center justify-between">
                  <span>Adverse Dispute Ruling (Quality Failure)</span>
                  <span className="font-mono font-bold text-rose-400">-50 to -100 pts</span>
                </div>
              </div>
            </Card>

            <Card
              title="Audit Log of Trust Events"
              subtitle="Cryptographically verified score changes"
            >
              {profile.history.length === 0 ? (
                <div className="text-center py-8 text-xs font-mono text-slate-500">
                  No historical scoring events recorded for this address.
                </div>
              ) : (
                <div className="space-y-3">
                  {profile.history.map((h, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200 text-xs">{h.action}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {formatTimestamp(h.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{h.details}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-mono font-bold text-xs ${
                            h.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {h.delta >= 0 ? `+${h.delta}` : h.delta} pts
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
