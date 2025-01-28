import React, { useState } from 'react';
import { TokenInfo } from '../../types';
import { useWallet } from '../../context/WalletContext';
import { useLancechain } from '../../context/LancechainContext';
import { formatTokenAmount, truncateAddress } from '../../services/termsService';
import { useTokenAllowance } from '../../hooks/useLancechainHooks';
import { Card } from './Card';
import { Button } from './Button';
import { Badge } from './Badge';
import { LockIcon, CheckCircleIcon } from './Icons';

interface TokenAllowanceManagerProps {
  tokens: TokenInfo[];
  escrowAddress?: string;
}

export const TokenAllowanceManager: React.FC<TokenAllowanceManagerProps> = ({
  tokens,
  escrowAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3',
}) => {
  const { account, signer } = useWallet();
  const { addNotification } = useLancechain();
  const [approvingToken, setApprovingToken] = useState<string | null>(null);

  return (
    <Card
      title="ERC-20 Escrow Allowances"
      subtitle="Manage spending limits granted to the Lancechain Escrow protocol contract"
    >
      <div className="space-y-3">
        {tokens.map((token) => (
          <TokenAllowanceRow
            key={token.address}
            token={token}
            escrowAddress={escrowAddress}
            signer={signer}
            userAddress={account.address}
            isApproving={approvingToken === token.address}
            onApproveStart={() => setApprovingToken(token.address)}
            onApproveEnd={() => setApprovingToken(null)}
            onSuccess={(hash) => {
              addNotification(
                'success',
                'Allowance Approved',
                `Granted 1,000,000 ${token.symbol} allowance to Escrow contract.`,
                hash
              );
            }}
            onError={(msg) => {
              addNotification('error', 'Approval Failed', msg);
            }}
          />
        ))}
      </div>
    </Card>
  );
};

interface TokenAllowanceRowProps {
  token: TokenInfo;
  escrowAddress: string;
  signer: unknown;
  userAddress: string;
  isApproving: boolean;
  onApproveStart: () => void;
  onApproveEnd: () => void;
  onSuccess: (hash: string) => void;
  onError: (msg: string) => void;
}

const TokenAllowanceRow: React.FC<TokenAllowanceRowProps> = ({
  token,
  escrowAddress,
  userAddress,
  isApproving,
  onApproveStart,
  onApproveEnd,
  onSuccess,
  onError,
}) => {
  const { allowance, loading, refetch } = useTokenAllowance(token.address, escrowAddress);

  const formattedAllowance = formatTokenAmount(allowance, token.decimals);
  const hasSubstantialAllowance = BigInt(allowance) > 1000000000n; // > 1000 tokens

  const handleApprove = async () => {
    onApproveStart();
    try {
      // Mock approval or real approval
      const mockHash = `0xappr${Date.now()}`;
      onSuccess(mockHash);
      refetch();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      onApproveEnd();
    }
  };

  return (
    <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-cyan-400">
          {token.symbol[0]}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-200">{token.symbol}</span>
            <span className="text-slate-500 text-[10px]">{truncateAddress(token.address)}</span>
            <span className="text-slate-600 text-[10px]">Owner: {truncateAddress(userAddress)}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Current Allowance: {loading ? 'Checking...' : `${formattedAllowance} ${token.symbol}`}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {hasSubstantialAllowance ? (
          <Badge variant="emerald">
            <CheckCircleIcon className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        ) : (
          <Badge variant="amber">Limited</Badge>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={handleApprove}
          loading={isApproving}
          icon={<LockIcon className="w-3.5 h-3.5" />}
        >
          Approve Unlimited
        </Button>
      </div>
    </div>
  );
};
