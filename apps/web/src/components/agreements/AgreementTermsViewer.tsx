import React, { useState } from 'react';
import { AgreementRecord } from '../../types';
import { formatTokenAmount, truncateAddress, formatTimestamp, EIP712_DOMAIN } from '../../services/termsService';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { ShieldIcon, CheckCircleIcon, CopyIcon } from '../common/Icons';

interface AgreementTermsViewerProps {
  project: AgreementRecord;
  onSignTerms?: () => void;
  canSign?: boolean;
}

export const AgreementTermsViewer: React.FC<AgreementTermsViewerProps> = ({
  project,
  onSignTerms,
  canSign = false,
}) => {
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const structuredTermsJson = {
    domain: {
      ...EIP712_DOMAIN,
      verifyingContract: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    },
    primaryType: 'AgreementTerms',
    message: {
      agreementId: project.agreementId,
      client: project.client,
      freelancer: project.freelancer,
      arbitrator: project.arbitrator,
      token: project.token,
      arbitrationFeeBps: project.arbitrationFeeBps,
      termsUri: project.termsUri,
      milestones: project.milestones.map((m) => ({
        milestoneId: m.milestoneId,
        description: m.description,
        amount: m.amount,
        deadline: m.deadline,
        deliverableHash: m.deliverableHash || '0x0000000000000000000000000000000000000000000000000000000000000000',
      })),
    },
  };

  const jsonString = JSON.stringify(structuredTermsJson, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card
        title="EIP-712 Canonical Agreement Specification"
        subtitle="Verifiable cryptographic terms binding on-chain milestone escrow fulfillment"
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRawJson(!showRawJson)}
            >
              {showRawJson ? 'Formatted View' : 'Raw Typed JSON'}
            </Button>
            {canSign && onSignTerms && (
              <Button
                size="sm"
                variant="primary"
                onClick={onSignTerms}
                icon={<ShieldIcon className="w-3.5 h-3.5" />}
              >
                Sign EIP-712 Terms
              </Button>
            )}
          </div>
        }
      >
        {/* Verification Status Banner */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center">
              <CheckCircleIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-slate-100 flex items-center gap-2">
                <span>EIP-712 Signature Root:</span>
                <span className="text-cyan-400">{truncateAddress(project.termsHash)}</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Deterministic hash computed across all milestone amounts, deadlines, and arbitration policies
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="cyan">EIP-712 Typed Data</Badge>
            <Badge variant="purple">EIP-1271 Compatible</Badge>
          </div>
        </div>

        {showRawJson ? (
          <div className="mt-4 relative">
            <button
              onClick={handleCopy}
              className="absolute right-3 top-3 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 rounded border border-slate-700 flex items-center gap-1 z-10"
            >
              <CopyIcon className="w-3.5 h-3.5" />
              <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
            </button>
            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 overflow-x-auto max-h-[450px]">
              {jsonString}
            </pre>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Core Parameters Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Field</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Resolved Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-900/40 text-slate-200">
                  <tr>
                    <td className="p-3 text-slate-400">client</td>
                    <td className="p-3 text-cyan-400">address</td>
                    <td className="p-3 font-semibold">{project.client}</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-400">freelancer</td>
                    <td className="p-3 text-cyan-400">address</td>
                    <td className="p-3 font-semibold">{project.freelancer}</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-400">arbitrator</td>
                    <td className="p-3 text-cyan-400">address</td>
                    <td className="p-3 font-semibold">{project.arbitrator}</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-400">token</td>
                    <td className="p-3 text-cyan-400">address</td>
                    <td className="p-3 font-semibold">{project.token} ({project.tokenSymbol})</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-400">arbitrationFeeBps</td>
                    <td className="p-3 text-cyan-400">uint16</td>
                    <td className="p-3 font-semibold">{project.arbitrationFeeBps} ({(project.arbitrationFeeBps / 100).toFixed(2)}%)</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-400">termsUri</td>
                    <td className="p-3 text-cyan-400">string</td>
                    <td className="p-3 font-semibold truncate max-w-xs">{project.termsUri}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Milestones Schedule Table */}
            <div>
              <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-2">
                Milestone Specifications Array (MilestoneTerms[])
              </h4>
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Scope Description</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Delivery Deadline</th>
                      <th className="p-3">Required Artifact Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-900/40 text-slate-200">
                    {project.milestones.map((m) => (
                      <tr key={m.milestoneId}>
                        <td className="p-3 font-bold text-cyan-400">#{m.milestoneId + 1}</td>
                        <td className="p-3">{m.description}</td>
                        <td className="p-3 font-semibold text-emerald-400">
                          {formatTokenAmount(m.amount, project.tokenDecimals)} {project.tokenSymbol}
                        </td>
                        <td className="p-3 text-slate-400">{formatTimestamp(m.deadline)}</td>
                        <td className="p-3 text-slate-500">
                          {m.deliverableHash ? truncateAddress(m.deliverableHash) : 'Dynamic (Submission-time)'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
