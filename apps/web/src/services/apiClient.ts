import {
  AgreementRecord,
  ReputationProfile,
  AuditEvent,
  ReconciliationReport,
  WithdrawalBalance,
} from '../types';
import {
  MOCK_AGREEMENTS,
  MOCK_REPUTATION,
  MOCK_WITHDRAWALS,
  MOCK_AUDIT_EVENTS,
  MOCK_RECONCILIATION,
} from './mockDataService';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private isOnline = true;

  private async fetchJson<T>(url: string, fallback: T): Promise<T> {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      this.isOnline = true;
      return await response.json();
    } catch {
      this.isOnline = false;
      return fallback;
    }
  }

  public getStatus(): boolean {
    return this.isOnline;
  }

  public async getHealth(): Promise<{ status: string; blockNumber: number }> {
    return this.fetchJson(`${BASE_URL}/status`, {
      status: 'mock_fallback',
      blockNumber: 1043250,
    });
  }

  public async getProjects(params?: {
    status?: string;
    client?: string;
    freelancer?: string;
  }): Promise<AgreementRecord[]> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.client) query.append('client', params.client);
    if (params?.freelancer) query.append('freelancer', params.freelancer);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await this.fetchJson<{ projects: AgreementRecord[] }>(
      `${BASE_URL}/projects${queryString}`,
      { projects: MOCK_AGREEMENTS }
    );
    return res.projects || MOCK_AGREEMENTS;
  }

  public async getProjectById(id: string): Promise<AgreementRecord | null> {
    const res = await this.fetchJson<{ project: AgreementRecord }>(
      `${BASE_URL}/projects/${id}`,
      {
        project:
          MOCK_AGREEMENTS.find((p) => p.agreementId.toLowerCase() === id.toLowerCase()) ||
          MOCK_AGREEMENTS[0],
      }
    );
    return res.project || null;
  }

  public async getReputation(address: string): Promise<ReputationProfile> {
    const defaultProfile: ReputationProfile = MOCK_REPUTATION[address] || {
      address,
      score: 500,
      tier: 'Bronze',
      totalProjectsCompleted: 0,
      totalVolumeHandled: '0',
      totalDisputesInvolved: 0,
      disputesWon: 0,
      disputesLost: 0,
      disputeRateBps: 0,
      averageCompletionTimeSeconds: 0,
      history: [],
    };

    const res = await this.fetchJson<{ profile: ReputationProfile }>(
      `${BASE_URL}/reputation/${address}`,
      { profile: defaultProfile }
    );
    return res.profile || defaultProfile;
  }

  public async getWithdrawals(address: string): Promise<WithdrawalBalance[]> {
    const defaultBalances = MOCK_WITHDRAWALS[address] || [];
    const res = await this.fetchJson<{ balances: WithdrawalBalance[] }>(
      `${BASE_URL}/accounts/${address}/withdrawals`,
      { balances: defaultBalances }
    );
    return res.balances || defaultBalances;
  }

  public async getAuditEvents(limit = 50): Promise<AuditEvent[]> {
    const res = await this.fetchJson<{ events: AuditEvent[] }>(
      `${BASE_URL}/events?limit=${limit}`,
      { events: MOCK_AUDIT_EVENTS }
    );
    return res.events || MOCK_AUDIT_EVENTS;
  }

  public async getReconciliation(): Promise<ReconciliationReport> {
    return this.fetchJson<ReconciliationReport>(
      `${BASE_URL}/reconciliation`,
      MOCK_RECONCILIATION
    );
  }
}

export const apiClient = new ApiClient();
