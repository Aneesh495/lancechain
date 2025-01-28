import React from 'react';
import { Card } from './Card';
import { Badge } from './Badge';
import { truncateAddress } from '../../services/termsService';
import { ShieldIcon } from './Icons';

interface ContractMetricsCardProps {
  escrowAddress?: string;
  reputationAddress?: string;
  chainId?: number;
  protocolOwner?: string;
  isPaused?: boolean;
}

export const ContractMetricsCard: React.FC<ContractMetricsCardProps> = ({
  escrowAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  reputationAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  chainId = 31337,
  protocolOwner = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  isPaused = false,
}) => {
  return (
    <Card
      title="Protocol Deployment & Security Parameters"
      subtitle="Canonical addresses, verification proofs, and security guards"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-1">
          <div className="text-slate-400 text-[10px] uppercase">LancechainEscrow.sol</div>
          <div className="text-cyan-300 font-bold break-all">{escrowAddress}</div>
          <div className="text-[10px] text-slate-500">Cancun EVM via_ir = true</div>
        </div>

        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-1">
          <div className="text-slate-400 text-[10px] uppercase">LancechainReputation.sol</div>
          <div className="text-purple-300 font-bold break-all">{reputationAddress}</div>
          <div className="text-[10px] text-slate-500">Autonomous Merit Oracle</div>
        </div>

        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-1">
          <div className="text-slate-400 text-[10px] uppercase">Governance & Admin</div>
          <div className="text-slate-200 font-bold">{truncateAddress(protocolOwner)}</div>
          <div className="text-[10px] text-emerald-400 flex items-center gap-1">
            <ShieldIcon className="w-3 h-3" />
            Timelock 2-of-3 Multisig
          </div>
        </div>

        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-slate-400 text-[10px] uppercase">Circuit Breaker Status</div>
            <div className="text-slate-200 font-bold mt-0.5">
              {isPaused ? 'Protocol Paused' : 'Active (Unpaused)'}
            </div>
            <div className="text-[10px] text-slate-500">Chain ID: {chainId}</div>
          </div>
          <div>
            {isPaused ? (
              <Badge variant="rose">Paused</Badge>
            ) : (
              <Badge variant="emerald">Operational</Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
