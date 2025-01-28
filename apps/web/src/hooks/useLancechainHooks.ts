import { useState, useEffect, useCallback } from 'react';
import {
  AgreementRecord,
  ReputationProfile,
  AuditEvent,
  ReconciliationReport,
  WithdrawalBalance,
} from '../types';
import { apiClient } from '../services/apiClient';
import { contractService } from '../services/contractService';
import { useWallet } from '../context/WalletContext';

export function useProjects(pollIntervalMs = 0) {
  const [projects, setProjects] = useState<AgreementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await apiClient.getProjects();
      setProjects(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    if (pollIntervalMs > 0) {
      const interval = setInterval(fetchProjects, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [fetchProjects, pollIntervalMs]);

  return { projects, loading, error, refetch: fetchProjects };
}

export function useProjectDetail(agreementId: string) {
  const [project, setProject] = useState<AgreementRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    if (!agreementId) return;
    setLoading(true);
    try {
      const data = await apiClient.getProjectById(agreementId);
      setProject(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [agreementId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  return { project, loading, error, refetch: fetchProject };
}

export function useReputationProfile(address: string) {
  const [profile, setProfile] = useState<ReputationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const data = await apiClient.getReputation(address);
      setProfile(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile };
}

export function useWithdrawalBalances(address: string) {
  const [balances, setBalances] = useState<WithdrawalBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const data = await apiClient.getWithdrawals(address);
      setBalances(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return { balances, loading, error, refetch: fetchBalances };
}

export function useReconciliationAudit(pollIntervalMs = 0) {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      const data = await apiClient.getReconciliation();
      setReport(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
    if (pollIntervalMs > 0) {
      const interval = setInterval(fetchReport, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [fetchReport, pollIntervalMs]);

  return { report, loading, error, refetch: fetchReport };
}

export function useAuditStream(limit = 50) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await apiClient.getAuditEvents(limit);
      setEvents(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
}

export function useTokenAllowance(tokenAddress: string, spenderAddress: string) {
  const { account, provider } = useWallet();
  const [allowance, setAllowance] = useState<string>('0');
  const [loading, setLoading] = useState(true);

  const fetchAllowance = useCallback(async () => {
    if (!tokenAddress || !spenderAddress || !account.address) return;
    try {
      const erc20 = contractService.getErc20Contract(tokenAddress, provider);
      const allow = await erc20.allowance(account.address, spenderAddress);
      setAllowance(allow.toString());
    } catch {
      setAllowance('0');
    } finally {
      setLoading(false);
    }
  }, [tokenAddress, spenderAddress, account.address, provider]);

  useEffect(() => {
    fetchAllowance();
  }, [fetchAllowance]);

  return { allowance, loading, refetch: fetchAllowance };
}
