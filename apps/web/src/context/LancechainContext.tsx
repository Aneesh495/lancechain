import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AgreementRecord, MilestoneStatus, AgreementStatus, TokenInfo } from '../types';
import { apiClient } from '../services/apiClient';
import { SUPPORTED_TOKENS, MOCK_AGREEMENTS } from '../services/mockDataService';

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  txHash?: string;
  timestamp: number;
}

interface LancechainContextType {
  projects: AgreementRecord[];
  tokens: TokenInfo[];
  isLoading: boolean;
  notifications: ToastNotification[];
  addNotification: (type: ToastNotification['type'], title: string, message: string, txHash?: string) => void;
  removeNotification: (id: string) => void;
  refreshProjects: () => Promise<void>;
  addOptimisticAgreement: (agreement: AgreementRecord) => void;
  updateOptimisticMilestone: (agreementId: string, milestoneId: number, status: MilestoneStatus, extra?: Record<string, unknown>) => void;
}

const LancechainContext = createContext<LancechainContextType | undefined>(undefined);

export const LancechainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<AgreementRecord[]>(MOCK_AGREEMENTS);
  const [tokens] = useState<TokenInfo[]>(SUPPORTED_TOKENS);
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  const addNotification = useCallback(
    (type: ToastNotification['type'], title: string, message: string, txHash?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newNotification: ToastNotification = {
        id,
        type,
        title,
        message,
        txHash,
        timestamp: Date.now(),
      };
      setNotifications((prev) => [newNotification, ...prev]);

      // Auto dismiss after 7 seconds
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 7000);
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const refreshProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects from indexer:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const addOptimisticAgreement = (newAgreement: AgreementRecord) => {
    setProjects((prev) => [newAgreement, ...prev]);
  };

  const updateOptimisticMilestone = (
    agreementId: string,
    milestoneId: number,
    status: MilestoneStatus,
    extra?: Record<string, unknown>
  ) => {
    setProjects((prev) =>
      prev.map((proj) => {
        if (proj.agreementId.toLowerCase() !== agreementId.toLowerCase()) return proj;

        const updatedMilestones = proj.milestones.map((m) => {
          if (m.milestoneId !== milestoneId) return m;
          return {
            ...m,
            status,
            ...extra,
          };
        });

        // Check if all milestones are approved
        const allApproved = updatedMilestones.every((m) => m.status === MilestoneStatus.APPROVED);
        const hasDispute = updatedMilestones.some((m) => m.status === MilestoneStatus.DISPUTED);

        let newStatus = proj.status;
        if (hasDispute) newStatus = AgreementStatus.DISPUTED;
        else if (allApproved) newStatus = AgreementStatus.COMPLETED;
        else if (status === MilestoneStatus.FUNDED) newStatus = AgreementStatus.ACTIVE;

        return {
          ...proj,
          status: newStatus,
          milestones: updatedMilestones,
          updatedAt: Date.now(),
        };
      })
    );
  };

  return (
    <LancechainContext.Provider
      value={{
        projects,
        tokens,
        isLoading,
        notifications,
        addNotification,
        removeNotification,
        refreshProjects,
        addOptimisticAgreement,
        updateOptimisticMilestone,
      }}
    >
      {children}
    </LancechainContext.Provider>
  );
};

export const useLancechain = (): LancechainContextType => {
  const context = useContext(LancechainContext);
  if (!context) {
    throw new Error('useLancechain must be used within a LancechainProvider');
  }
  return context;
};
