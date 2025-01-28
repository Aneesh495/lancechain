import React, { useState, useEffect, useCallback } from 'react';
import { AuditEvent } from '../../types';
import { apiClient } from '../../services/apiClient';
import { truncateAddress, formatTimestamp } from '../../services/termsService';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { RefreshIcon, ExternalLinkIcon } from '../common/Icons';

export const ChainAuditLog: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterEvent, setFilterEvent] = useState<string>('ALL');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getAuditEvents(50);
      setEvents(data);
    } catch (err) {
      console.error('Failed to load audit events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filteredEvents = events.filter((e) =>
    filterEvent === 'ALL' ? true : e.eventName === filterEvent
  );

  const getEventBadge = (name: string) => {
    switch (name) {
      case 'AgreementCreated':
        return <Badge variant="cyan">AgreementCreated</Badge>;
      case 'MilestoneFunded':
        return <Badge variant="cyan">MilestoneFunded</Badge>;
      case 'DeliverableSubmitted':
        return <Badge variant="amber">DeliverableSubmitted</Badge>;
      case 'MilestoneApproved':
        return <Badge variant="emerald">MilestoneApproved</Badge>;
      case 'DisputeOpened':
        return <Badge variant="rose">DisputeOpened</Badge>;
      case 'DisputeResolved':
        return <Badge variant="purple">DisputeResolved</Badge>;
      case 'WithdrawalExecuted':
        return <Badge variant="emerald">WithdrawalExecuted</Badge>;
      default:
        return <Badge variant="slate">{name}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="Cryptographic Chain Audit Stream"
        subtitle="Immutable event logs decoded from the Lancechain protocol state machine"
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={fetchEvents}
            loading={loading}
            icon={<RefreshIcon className="w-3.5 h-3.5" />}
          >
            Refresh Logs
          </Button>
        }
      >
        {/* Filter Bar */}
        <div className="flex flex-wrap gap-2 pb-4 mb-4 border-b border-slate-800">
          {[
            'ALL',
            'AgreementCreated',
            'MilestoneFunded',
            'DeliverableSubmitted',
            'MilestoneApproved',
            'DisputeOpened',
            'DisputeResolved',
            'WithdrawalExecuted',
          ].map((type) => (
            <button
              key={type}
              onClick={() => setFilterEvent(type)}
              className={`px-2.5 py-1 text-xs font-mono rounded-lg transition-colors ${
                filterEvent === type
                  ? 'bg-cyan-950 border border-cyan-800 text-cyan-300'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Event List */}
        {filteredEvents.length === 0 ? (
          <div className="text-center py-10 text-xs font-mono text-slate-500">
            No events match the selected filter.
          </div>
        ) : (
          <div className="space-y-3 font-mono">
            {filteredEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-2 hover:border-slate-700/80 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getEventBadge(evt.eventName)}
                    <span className="text-xs font-bold text-slate-200">
                      Block #{evt.blockNumber}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      LogIndex: {evt.logIndex}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{formatTimestamp(evt.timestamp)}</span>
                    <a
                      href={`https://etherscan.io/tx/${evt.transactionHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                    >
                      <span>Tx: {truncateAddress(evt.transactionHash)}</span>
                      <ExternalLinkIcon className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-900/80 border border-slate-800/80 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Actor: <strong className="text-slate-200">{truncateAddress(evt.actor)}</strong></span>
                    {evt.agreementId && (
                      <span>Agreement: <strong className="text-cyan-400">{truncateAddress(evt.agreementId)}</strong></span>
                    )}
                  </div>
                  <pre className="text-[11px] text-slate-300 overflow-x-auto p-1 bg-slate-950 rounded border border-slate-800/60">
                    {JSON.stringify(evt.data, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
