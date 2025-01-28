import React, { useState, useEffect, useCallback } from 'react';
import { ReconciliationReport } from '../../types';
import { apiClient } from '../../services/apiClient';
import { formatTokenAmount, truncateAddress } from '../../services/termsService';
import { Card } from '../common/Card';
import { StatBox } from '../common/StatBox';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { ShieldIcon, CheckCircleIcon, RefreshIcon } from '../common/Icons';

export const FinancialReconciliationPanel: React.FC = () => {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchReconciliation = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getReconciliation();
      setReport(data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to run reconciliation:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReconciliation();
  }, [fetchReconciliation]);

  return (
    <div className="space-y-6">
      {/* Top Controls & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2">
            <ShieldIcon className="w-6 h-6 text-emerald-400" />
            <span>Formal Financial Invariant Reconciliation</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Real-time differential solvency verification between blockchain state, indexer journal, and protocol balance sheet
          </p>
        </div>

        <div className="flex items-center gap-3">
          {report && (
            <Badge variant={report.allInvariantsPassed ? 'emerald' : 'rose'}>
              {report.allInvariantsPassed ? 'All Invariants Verified' : 'Invariant Violation'}
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={fetchReconciliation}
            loading={loading}
            icon={<RefreshIcon className="w-3.5 h-3.5" />}
          >
            Run Audit Scan
          </Button>
        </div>
      </div>

      {/* Global Invariant Gates */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatBox
          label="Exact Conservation"
          value={report?.checks.exactSumConservation ? 'VERIFIED' : 'PENDING'}
          unit="No Leakage"
          icon={<CheckCircleIcon className="w-5 h-5 text-emerald-400" />}
          trend="positive"
          subtext="Remainder division exact"
        />
        <StatBox
          label="Pull Solvency"
          value={report?.checks.pullLedgerSolvency ? 'SOLVENT' : 'DEFICIT'}
          unit="100% Backed"
          icon={<ShieldIcon className="w-5 h-5 text-emerald-400" />}
          trend="positive"
          subtext="Withdrawable <= Balance"
        />
        <StatBox
          label="Reorg Consistency"
          value={report?.checks.reorgConsistency ? 'CONSISTENT' : 'UNWIND'}
          unit="Depth 128"
          icon={<CheckCircleIcon className="w-5 h-5 text-cyan-400" />}
          trend="positive"
          subtext="Atomic rollback parity"
        />
        <StatBox
          label="Audit Block Number"
          value={report?.blockNumber || 1043250}
          unit="EVM Height"
          icon={<RefreshIcon className="w-5 h-5 text-slate-400" />}
          subtext={`Audited at ${lastUpdated || 'now'}`}
        />
      </div>

      {/* Invariant Specification Equation */}
      <div className="p-4 bg-slate-900/70 border border-cyan-800/40 rounded-xl space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
          <ShieldIcon className="w-4 h-4 text-cyan-400" />
          <span>Core Protocol Solvency Invariant (Equation 1)</span>
        </div>
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto whitespace-nowrap">
          <code>
            ContractBalance(token) == EscrowLiabilities(token) + UnclaimedWithdrawals(token) + ProtocolFees(token) + Surplus
          </code>
        </div>
        <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
          Guarantees that at every block height and during deep reorganizations, every token held by the contract is accountably tagged. Surplus/Deficit must strictly equal 0.
        </p>
      </div>

      {/* Token Balance Sheet */}
      <Card
        title="Token-by-Token Audited Balance Sheet"
        subtitle="Live verification of on-chain reserve backing across all supported protocol currencies"
      >
        {!report || report.tokensAudited.length === 0 ? (
          <div className="text-center py-8 text-xs font-mono text-slate-500">
            Scanning smart contract reserves...
          </div>
        ) : (
          <div className="space-y-4">
            {report.tokensAudited.map((tok) => {
              const decimals = tok.tokenSymbol === 'WETH' ? 18 : 6;
              const contractBal = formatTokenAmount(tok.contractBalance, decimals);
              const escrowLiab = formatTokenAmount(tok.activeEscrowLiabilities, decimals);
              const unclaimedBal = formatTokenAmount(tok.unclaimedWithdrawalBalances, decimals);
              const protocolFees = formatTokenAmount(tok.accumulatedProtocolFees, decimals);
              const totalObligations = formatTokenAmount(tok.totalContractObligations, decimals);
              const surplusDeficit = formatTokenAmount(tok.surplusOrDeficit, decimals);

              return (
                <div
                  key={tok.tokenAddress}
                  className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 font-mono font-bold text-xs text-cyan-400 flex items-center justify-center">
                        {tok.tokenSymbol}
                      </span>
                      <span className="font-mono text-sm font-bold text-slate-200">
                        {tok.tokenSymbol} Token Reserve (Total Obligations: {totalObligations})
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {truncateAddress(tok.tokenAddress)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {tok.invariantSatisfied ? (
                        <Badge variant="emerald">Invariant Verified (0 Delta)</Badge>
                      ) : (
                        <Badge variant="rose">Invariant Alert</Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
                    <div className="p-2.5 bg-slate-900/60 border border-slate-800/70 rounded-lg">
                      <div className="text-[10px] font-mono text-slate-400">Total Reserves (EVM)</div>
                      <div className="text-sm font-bold font-mono text-slate-100">
                        {contractBal}
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-900/60 border border-slate-800/70 rounded-lg">
                      <div className="text-[10px] font-mono text-slate-400">Active Escrows</div>
                      <div className="text-sm font-bold font-mono text-cyan-400">
                        {escrowLiab}
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-900/60 border border-slate-800/70 rounded-lg">
                      <div className="text-[10px] font-mono text-slate-400">Pull Balances</div>
                      <div className="text-sm font-bold font-mono text-amber-400">
                        {unclaimedBal}
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-900/60 border border-slate-800/70 rounded-lg">
                      <div className="text-[10px] font-mono text-slate-400">Protocol Fees</div>
                      <div className="text-sm font-bold font-mono text-purple-400">
                        {protocolFees}
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-900/60 border border-slate-800/70 rounded-lg">
                      <div className="text-[10px] font-mono text-slate-400">Variance Delta</div>
                      <div className="text-sm font-bold font-mono text-emerald-400">
                        {surplusDeficit}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
